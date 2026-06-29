const SHEET_ID = '10uEjMmIjYQxJoAICFe7OzYEAL1v6d7lymk3aKJfSTdI';
const SHEET_NAME = 'Sheet1';

async function appendUserToSheet(userData) {
  if (!process.env.GOOGLE_SHEETS_API_KEY) {
    console.warn('[GoogleSheets] API key not configured, skipping sheet update');
    return;
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
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_NAME}!A:H:append?key=${process.env.GOOGLE_SHEETS_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          values,
          majorDimension: 'ROWS',
          insertDataOption: 'INSERT_ROWS'
        })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('[GoogleSheets] Error:', error.error?.message);
      return false;
    }

    console.log('[GoogleSheets] User added successfully');
    return true;
  } catch (err) {
    console.error('[GoogleSheets] Exception:', err.message);
    return false;
  }
}

export { appendUserToSheet };
