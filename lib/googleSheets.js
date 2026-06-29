// Write to Google Sheet directly via native Sheets API
async function appendUserToSheet(userData) {
  if (!process.env.GOOGLE_SHEETS_CREDENTIALS) {
    console.log('[GoogleSheets] Credentials not configured, skipping');
    return false;
  }

  try {
    const credsJson = process.env.GOOGLE_SHEETS_CREDENTIALS;
    const creds = JSON.parse(credsJson);

    // Get access token via simple service account auth
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
      iss: creds.client_email,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    };

    // Encode JWT parts
    const b64 = str => Buffer.from(JSON.stringify(str)).toString('base64').replace(/[+/=]/g, c => ({ '+': '-', '/': '_', '=': '' }[c]));
    const headerB64 = b64(header);
    const payloadB64 = b64(payload);
    const message = `${headerB64}.${payloadB64}`;

    // Sign with private key
    const { createSign } = await import('node:crypto');
    const privateKey = creds.private_key.replace(/\\n/g, '\n');
    const signatureB64 = createSign('RSA-SHA256')
      .update(message)
      .sign(privateKey, 'base64')
      .replace(/[+/=]/g, c => ({ '+': '-', '/': '_', '=': '' }[c]));

    const jwt = `${message}.${signatureB64}`;

    // Exchange JWT for access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      console.error('[GoogleSheets] Failed to get access token:', tokenData.error);
      return false;
    }

    // Append to Form responses 2 sheet (we know this exists and works)
    const sheetRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/10uEjMmIjYQxJoAICFe7OzYEAL1v6d7lymk3aKJfSTdI/values/'Form responses 2'!A1:append?valueInputOption=RAW`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenData.access_token}`,
        },
        body: JSON.stringify({
          values: [[
            new Date().toISOString().split('T')[0],
            userData.email || '',
            userData.name || '',
            userData.company || '',
          ]],
        }),
      }
    );

    if (sheetRes.ok) {
      console.log('[GoogleSheets] Appended to Form responses 2');
      return true;
    } else {
      const error = await sheetRes.json();
      console.error('[GoogleSheets] Append failed:', error);
      return false;
    }
  } catch (err) {
    console.error('[GoogleSheets] Exception:', err.message);
    return false;
  }
}

export { appendUserToSheet };
