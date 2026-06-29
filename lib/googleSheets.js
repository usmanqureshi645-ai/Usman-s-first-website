const SHEET_ID = '10uEjMmIjYQxJoAICFe7OzYEAL1v6d7lymk3aKJfSTdI';
const SHEET_NAME = 'USERS_DATA_LIVE';
const FORM_ID = '1FAIpQLSf_ruZz6fOs2yVcIOSsXZuebudXtTdzaTMkWhsNdGsa2V109w';

// Entry IDs extracted from form (standard Google Forms numbering)
const FORM_FIELDS = {
  date: 'entry.1366620968',
  email: 'entry.1087107498',
  name: 'entry.784503134',
  company: 'entry.1848881655',
};

async function appendUserToSheet(userData) {
  try {
    // Build form submission data
    const params = new URLSearchParams();
    params.append(FORM_FIELDS.date, new Date().toISOString().split('T')[0]);
    params.append(FORM_FIELDS.email, userData.email || '');
    params.append(FORM_FIELDS.name, userData.name || '');
    params.append(FORM_FIELDS.company, userData.company || '');

    // Submit to Google Form (no auth needed, form is public)
    const formResponse = await fetch(
      `https://docs.google.com/forms/d/e/${FORM_ID}/formResponse`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
        redirect: 'follow'
      }
    );

    if (formResponse.ok || formResponse.status === 200) {
      console.log('[GoogleSheets] Form submission successful for:', userData.email);
      return true;
    } else {
      console.error('[GoogleSheets] Form submission failed:', formResponse.status);
      return false;
    }
  } catch (err) {
    console.error('[GoogleSheets] Form submission error:', err.message);
    return false;
  }
}

export { appendUserToSheet };
