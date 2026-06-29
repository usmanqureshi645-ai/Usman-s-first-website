import { createSign } from 'node:crypto';

const SHEET_ID = '10uEjMmIjYQxJoAICFe7OzYEAL1v6d7lymk3aKJfSTdI';
const SHEET_NAME = 'Sheet1';

const b64url = obj => Buffer.from(JSON.stringify(obj)).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function getAccessToken(creds) {
  const now = Math.floor(Date.now() / 1000);
  const headerB64 = b64url({ alg: 'RS256', typ: 'JWT' });
  const payloadB64 = b64url({
    iss: creds.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  });
  const message = `${headerB64}.${payloadB64}`;

  const privateKey = creds.private_key.replace(/\\n/g, '\n');
  const signatureB64 = createSign('RSA-SHA256').update(message).sign(privateKey, 'base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${message}.${signatureB64}`,
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    console.error('[GoogleSheets] Token exchange failed:', JSON.stringify(tokenData));
    return null;
  }
  return tokenData.access_token;
}

async function appendUserToSheet(userData) {
  if (!process.env.GOOGLE_SHEETS_CREDENTIALS) {
    console.log('[GoogleSheets] GOOGLE_SHEETS_CREDENTIALS not set, skipping');
    return false;
  }

  try {
    const creds = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS);
    const accessToken = await getAccessToken(creds);
    if (!accessToken) return false;

    const values = [[
      new Date().toISOString().split('T')[0],
      userData.name || '',
      userData.company || '',
      userData.department || '',
      userData.designation || '',
      userData.city || '',
      userData.country || '',
      userData.email || '',
      userData.ip || '',
    ]];

    const sheetRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_NAME}!A1:append?valueInputOption=RAW`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ values }),
      }
    );

    if (!sheetRes.ok) {
      const error = await sheetRes.json();
      console.error('[GoogleSheets] Append failed, status:', sheetRes.status, JSON.stringify(error));
      return false;
    }

    console.log('[GoogleSheets] Appended successfully for:', userData.email);
    return true;
  } catch (err) {
    console.error('[GoogleSheets] Exception:', err.message);
    return false;
  }
}

export { appendUserToSheet };
