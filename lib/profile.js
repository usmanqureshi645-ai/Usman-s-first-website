// Shared per-user "profile" store so the CV, cover letter and contact details a logged-in
// user gives any one tool are reused everywhere else (CV scoring, tailoring, job search),
// instead of asking for the same thing again and again.
//
// Stored in Upstash Redis under profile:<email> as a single JSON blob, no TTL (it's the
// user's own permanent data, same lifetime as their account). Accounts-only by design —
// anonymous visitors are never persisted.

function profileKey(email) {
  return `profile:${email}`;
}

export async function getProfile({ kvUrl, kvToken, email }) {
  if (!kvUrl || !kvToken || !email) return null;
  const resp = await fetch(`${kvUrl}/get/${encodeURIComponent(profileKey(email))}`, {
    headers: { authorization: `Bearer ${kvToken}` },
  });
  const data = await resp.json();
  if (!data?.result) return null;
  try { return JSON.parse(data.result); } catch { return null; }
}

// Merge-patch: only the fields passed in are overwritten, everything else is preserved,
// so saving a cover letter never wipes a previously-saved CV.
export async function saveProfile({ kvUrl, kvToken, email, patch }) {
  if (!kvUrl || !kvToken || !email) return null;
  const existing = (await getProfile({ kvUrl, kvToken, email })) || {};
  const ALLOWED = ['cv', 'cvFilename', 'coverLetter', 'coverFilename', 'location', 'country', 'experienceLevel'];
  const merged = { ...existing };
  for (const k of ALLOWED) {
    if (patch[k] !== undefined) merged[k] = patch[k];
  }
  merged.updatedAt = new Date().toISOString();
  await fetch(`${kvUrl}/set/${encodeURIComponent(profileKey(email))}/${encodeURIComponent(JSON.stringify(merged))}`, {
    headers: { authorization: `Bearer ${kvToken}` },
  });
  return merged;
}
