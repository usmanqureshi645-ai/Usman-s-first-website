// Server-side fetch of a user-supplied URL, hardened against SSRF.
// Used to read a job-posting link (Interview Coach) and a company page (cover-letter writer).
// Guards: http/https only, no embedded credentials, DNS-resolved IP must be public
// (private/loopback/link-local/metadata ranges are rejected), redirects are followed
// manually and each hop re-validated, hard timeout, and a capped response body.
import dns from 'node:dns/promises';
import net from 'node:net';

function ipv4Blocked(ip) {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some(n => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  if (a === 0) return true;                       // 0.0.0.0/8 "this network"
  if (a === 10) return true;                      // private
  if (a === 127) return true;                     // loopback
  if (a === 169 && b === 254) return true;        // link-local (incl. 169.254.169.254 metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true;        // private
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 192 && b === 0 && p[2] === 0) return true; // 192.0.0.0/24
  if (a >= 224) return true;                      // multicast + reserved
  return false;
}

function ipBlocked(ip) {
  const kind = net.isIP(ip);
  if (kind === 4) return ipv4Blocked(ip);
  if (kind === 6) {
    const v = ip.toLowerCase();
    if (v === '::' || v === '::1') return true;                 // unspecified / loopback
    if (v.startsWith('fe8') || v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb')) return true; // fe80::/10 link-local
    if (v.startsWith('fc') || v.startsWith('fd')) return true;  // fc00::/7 unique-local
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);    // IPv4-mapped
    if (mapped) return ipv4Blocked(mapped[1]);
    return false;
  }
  return true; // not a literal IP → treat as blocked (we only pass resolved IPs here)
}

async function assertHostAllowed(hostname) {
  // If the host is a literal IP, check it directly; otherwise resolve every address it maps to.
  if (net.isIP(hostname)) {
    if (ipBlocked(hostname)) throw new Error('blocked address');
    return;
  }
  let addrs;
  try { addrs = await dns.lookup(hostname, { all: true }); }
  catch { throw new Error('dns resolution failed'); }
  if (!addrs.length) throw new Error('no address');
  for (const { address } of addrs) {
    if (ipBlocked(address)) throw new Error('blocked address');
  }
}

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

// Fetch a URL and return plain text, or '' on any failure (fail-closed on security, fail-soft on errors).
export async function fetchUrlText(rawUrl, { maxBytes = 2_000_000, timeoutMs = 8000, maxChars = 6000, maxRedirects = 4 } = {}) {
  let url;
  try { url = new URL(String(rawUrl)); } catch { return ''; }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let redirects = 0;
    while (true) {
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
      if (url.username || url.password) return '';           // no credentials in URL
      await assertHostAllowed(url.hostname);                 // SSRF guard on every hop

      const resp = await fetch(url.href, {
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; UQConsultingBot/1.0)', 'accept': 'text/html,text/plain' },
      });

      if (resp.status >= 300 && resp.status < 400 && resp.headers.get('location')) {
        if (++redirects > maxRedirects) return '';
        url = new URL(resp.headers.get('location'), url);    // resolve relative redirects, re-loop to re-validate
        continue;
      }
      if (!resp.ok) return '';

      const ctype = resp.headers.get('content-type') || '';
      if (ctype && !/text\/html|text\/plain|application\/xhtml/i.test(ctype)) return '';

      // Read with a byte cap so a huge/streamed response can't exhaust memory.
      const reader = resp.body?.getReader?.();
      if (!reader) { const t = await resp.text(); return htmlToText(t).slice(0, maxChars); }
      const chunks = []; let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > maxBytes) { try { await reader.cancel(); } catch {} break; }
        chunks.push(value);
      }
      const buf = Buffer.concat(chunks.map(c => Buffer.from(c)));
      return htmlToText(buf.toString('utf8')).slice(0, maxChars);
    }
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}
