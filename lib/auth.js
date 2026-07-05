import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'node:crypto';

const SESSION_COOKIE = 'site_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days (was 90 days; reduced for security)

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

export function hashPassword(password) {
  if (password.length > 128) throw new Error('Password too long');
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = (stored || '').split(':');
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET is not configured');
  return secret;
}

export function signSession({ email, name }) {
  const payload = JSON.stringify({ email, name, exp: Date.now() + SESSION_TTL_MS });
  const payloadB64 = b64url(payload);
  const sig = createHmac('sha256', getAuthSecret()).update(payloadB64).digest('base64url');
  return `${payloadB64}.${sig}`;
}

export function verifySession(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payloadB64, sig] = token.split('.');
  const expectedSig = createHmac('sha256', getAuthSecret()).update(payloadB64).digest('base64url');
  const sigBuf = Buffer.from(sig || '');
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null;
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function parseCookies(req) {
  const header = req.headers?.cookie || '';
  const out = {};
  header.split(';').forEach(part => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  });
  return out;
}

export function getUserFromRequest(req) {
  const cookies = parseCookies(req);
  const session = verifySession(cookies[SESSION_COOKIE]);
  if (!session) return null;
  return { email: session.email, name: session.name };
}

export function setSessionCookie(res, { email, name }) {
  const token = signSession({ email, name });
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`);
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

// Owner-only admin actions (dashboard, feedback list/resolve) check against this rather than
// the Redis token itself — leaking it should only expose admin-read actions, not the whole DB.
export function verifyAdminKey(provided) {
  const adminKey = process.env.DASHBOARD_KEY;
  if (!adminKey) return false;
  const providedBuf = Buffer.from(String(provided || '').trim());
  const expectedBuf = Buffer.from(String(adminKey).trim());
  if (providedBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(providedBuf, expectedBuf);
}

// Failed login tracking — prevents brute-force attacks
// Returns { isLocked: boolean, attemptsLeft?: number, lockedUntil?: timestamp }
export async function checkLoginAttempts(kvUrl, kvToken, email) {
  const key = `login_attempts:${normalizeEmail(email)}`;
  try {
    const resp = await fetch(`${kvUrl}/get/${key}`, { headers: { authorization: `Bearer ${kvToken}` } });
    const data = await resp.json();
    if (!data?.result) return { isLocked: false };

    const record = JSON.parse(data.result);
    const now = Date.now();

    // Reset if lockout window has expired (15 minutes)
    if (record.lockedUntil && now > record.lockedUntil) {
      await fetch(`${kvUrl}/del/${key}`, { headers: { authorization: `Bearer ${kvToken}` } });
      return { isLocked: false };
    }

    return {
      isLocked: record.lockedUntil && now < record.lockedUntil,
      attemptsLeft: Math.max(0, 5 - record.attempts),
      lockedUntil: record.lockedUntil,
    };
  } catch {
    return { isLocked: false }; // Fail open if Redis is down
  }
}

export async function recordFailedLogin(kvUrl, kvToken, email) {
  const key = `login_attempts:${normalizeEmail(email)}`;
  const ttl = 15 * 60; // 15 minutes
  try {
    const resp = await fetch(`${kvUrl}/get/${key}`, { headers: { authorization: `Bearer ${kvToken}` } });
    const data = await resp.json();
    const record = data?.result ? JSON.parse(data.result) : { attempts: 0 };

    record.attempts = (record.attempts || 0) + 1;
    if (record.attempts >= 5) {
      record.lockedUntil = Date.now() + (15 * 60 * 1000); // Lock for 15 min after 5 attempts
    }

    await fetch(`${kvUrl}/set/${key}/${encodeURIComponent(JSON.stringify(record))}`, { headers: { authorization: `Bearer ${kvToken}` } });
    await fetch(`${kvUrl}/expire/${key}/${ttl}`, { headers: { authorization: `Bearer ${kvToken}` } });
  } catch {
    // Non-fatal if Redis is down; login still succeeds/fails based on password
  }
}

export async function clearLoginAttempts(kvUrl, kvToken, email) {
  const key = `login_attempts:${normalizeEmail(email)}`;
  try {
    await fetch(`${kvUrl}/del/${key}`, { headers: { authorization: `Bearer ${kvToken}` } });
  } catch {
    // Non-fatal
  }
}
