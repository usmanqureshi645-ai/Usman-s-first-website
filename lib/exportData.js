// Builds the 3-sheet, Power-BI-ready Excel workbook (Part 4 of
// WEBSITE_LAUNCH_SUMMARY_DATABASE.md): Signups, Feature Usage, Feature Ratings.
// Always a FULL snapshot (not incremental) — simplest, self-contained, no data-loss risk
// if one email send fails. Deliberately excludes password/passwordHash from Sheet 1 —
// exporting any password material to a file that gets emailed around is a firm no-go,
// regardless of the source requirements doc listing "Password" as a signup field.

import ExcelJS from 'exceljs';
import { pipe } from './metrics.js';
import { FEATURE_USAGE_LOG_KEY, FEATURE_RATINGS_LOG_KEY } from './featureLog.js';

const SIGNUPS_LOG_KEY = 'signups_log'; // shared with lib/metrics.js recordSignup()

function safeParse(raw) { try { return JSON.parse(raw); } catch { return null; } }

export async function buildWorkbook(kv) {
  // Single pipelined round-trip for all 3 source lists — same pattern as
  // lib/metrics.js's getDashboardData(). LRANGE 0 -1 = full list each time.
  const [signupsRaw, usageRaw, ratingsRaw] = await pipe(kv, [
    ['LRANGE', SIGNUPS_LOG_KEY, '0', '-1'],
    ['LRANGE', FEATURE_USAGE_LOG_KEY, '0', '-1'],
    ['LRANGE', FEATURE_RATINGS_LOG_KEY, '0', '-1'],
  ]);

  const signups = (Array.isArray(signupsRaw) ? signupsRaw : []).map(safeParse).filter(Boolean);
  const usage = (Array.isArray(usageRaw) ? usageRaw : []).map(safeParse).filter(Boolean);
  const ratings = (Array.isArray(ratingsRaw) ? ratingsRaw : []).map(safeParse).filter(Boolean);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'usman-website-export';
  wb.created = new Date();

  // ---- Sheet 1: Signups (Part 1 fields, MINUS password) ----
  const s1 = wb.addWorksheet('Signups');
  s1.columns = [
    { header: 'Name', key: 'name', width: 24 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Company', key: 'company', width: 24 },
    { header: 'Department', key: 'department', width: 22 },
    { header: 'Department (Other)', key: 'departmentOther', width: 22 },
    { header: 'Designation', key: 'designation', width: 22 },
    { header: 'Designation (Other)', key: 'designationOther', width: 22 },
    { header: 'Country', key: 'country', width: 20 },
    { header: 'City', key: 'city', width: 18 },
    { header: 'Signed Up At', key: 'createdAt', width: 22 },
  ];
  signups.forEach(s => s1.addRow({
    name: s.name || '', email: s.email || '', company: s.company || '',
    department: s.department || '', departmentOther: s.departmentOther || '',
    designation: s.designation || '', designationOther: s.designationOther || '',
    country: s.country || '', city: s.city || '', createdAt: s.createdAt || '',
  }));
  s1.getRow(1).font = { bold: true };

  // ---- Sheet 2: Feature usage logs (Part 2) ----
  const s2 = wb.addWorksheet('Feature Usage');
  s2.columns = [
    { header: 'Tool', key: 'tool', width: 18 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Resumed Session', key: 'resumed', width: 16 },
    { header: 'Detail', key: 'detail', width: 50 },
    { header: 'Logged At', key: 'loggedAt', width: 22 },
  ];
  usage.forEach(u => s2.addRow({
    tool: u.tool || '',
    email: u.email || '(anonymous)',
    resumed: u.detail?.resumed ? 'Yes' : 'No',
    detail: u.detail ? JSON.stringify(u.detail) : '',
    loggedAt: u.loggedAt || '',
  }));
  s2.getRow(1).font = { bold: true };

  // ---- Sheet 3: Feature ratings & feedback (Part 4) ----
  const s3 = wb.addWorksheet('Feature Ratings');
  s3.columns = [
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Timestamp', key: 'loggedAt', width: 22 },
    { header: 'Rating (1-5)', key: 'rating', width: 14 },
    { header: 'Feature', key: 'feature', width: 22 },
  ];
  ratings.forEach(r => s3.addRow({
    email: r.email || '(anonymous)',
    loggedAt: r.loggedAt || '',
    rating: r.rating ?? '',
    feature: r.feature || '',
  }));
  s3.getRow(1).font = { bold: true };

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
