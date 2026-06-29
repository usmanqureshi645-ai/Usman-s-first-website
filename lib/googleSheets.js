import { createSign } from 'node:crypto';

const SHEET_ID = '10uEjMmIjYQxJoAICFe7OzYEAL1v6d7lymk3aKJfSTdI';
const SHEET_NAME = 'Sheet1';

async function getAccessToken() {
  if (!process.env.GOOGLE_SHEETS_CREDENTIALS) {
    console.error('[GoogleSheets] GOOGLE_SHEETS_CREDENTIALS env var not set');
    return null;
  }

  try {
    const creds = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS);
    console.log('[GoogleSheets] Credentials parsed, client_email:', creds.client_email);

    // Fix escaped newlines in private key
    const privateKey = creds.private_key.replace(/\\n/g, '\n');

    const now = Math.floor(Date.now() / 1000);
    const exp = now + 3600;

    const payload = {
      iss: creds.client_email,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      exp,
      iat: now,
    };

    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64').replace(/[+/=]/g, c => ({ '+': '-', '/': '_', '=': '' }[c]));
    const body = Buffer.from(JSON.stringify(payload)).toString('base64').replace(/[+/=]/g, c => ({ '+': '-', '/': '_', '=': '' }[c]));
    const message = `${header}.${body}`;

    const signature = createSign('RSA-SHA256')
      .update(message)
      .sign(privateKey, 'base64')
      .replace(/[+/=]/g, c => ({ '+': '-', '/': '_', '=': '' }[c]));

    const jwt = `${message}.${signature}`;

    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    const tokenData = await tokenResp.json();
    if (!tokenResp.ok) {
      console.error('[GoogleSheets] Token error:', tokenData);
    } else {
      console.log('[GoogleSheets] Access token obtained successfully');
    }
    return tokenData.access_token || null;
  } catch (err) {
    console.error('[GoogleSheets] Token generation exception:', err.message);
    return null;
  }
}

async function appendUserToSheet(userData) {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    console.warn('[GoogleSheets] Could not obtain access token, skipping sheet update');
    return false;
  }

  try {
    const values = [[
      new Date().toISOString().split('T')[0],
      userData.email || '',
      userData.name || '',
      userData.company || '',
      userData.department || '',
      userData.designation || '',
      userData.country || '',
      userData.city || ''
    ]];

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_NAME}!A:H:append?valueInputOption=RAW`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          values,
          majorDimension: 'ROWS',
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('[GoogleSheets] Append failed, status:', response.status);
      console.error('[GoogleSheets] Error details:', JSON.stringify(error));
      return false;
    }

    const result = await response.json();
    console.log('[GoogleSheets] User added successfully, updates:', result?.updates?.updatedRows);
    return true;
  } catch (err) {
    console.error('[GoogleSheets] Exception:', err.message, err.stack);
    return false;
  }
}

export { appendUserToSheet };
