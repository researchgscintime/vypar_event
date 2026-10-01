/**
 * GSC Intime · GST Health Check app → Google Sheet
 * ------------------------------------------------
 * SETUP (about 5 minutes, once):
 *  1. Create a new Google Sheet (e.g. "Vyapar Utsav 2026 – Health Check leads").
 *  2. In that sheet: Extensions → Apps Script. Delete what is there, paste this whole file, click Save.
 *  3. Change SHARED_KEY below to a word of your choice (the same word goes into the tablet app).
 *  4. Click Deploy → New deployment → gear icon → Web app.
 *       Execute as: Me      Who has access: Anyone
 *     Click Deploy, allow the permissions, and copy the Web app URL (ends with /exec).
 *  5. In Vercel → Project → Settings → Environment Variables, set
 *     GOOGLE_SCRIPT_URL = the Web app URL and SHARED_KEY = the key below, then redeploy.
 *     The tablets use the Vercel site and need no setup.
 *
 * If you edit this script later: Deploy → Manage deployments → edit (pencil) → Version: New version → Deploy.
 * The URL stays the same.
 */

const SHARED_KEY = 'gsc-g09-2026';     // change this, and enter the same key in the app
const SHEET_NAME = 'Leads';
// The Google Sheet the leads go into (the long ID in the sheet's URL).
const SPREADSHEET_ID = '19BNU3_i6XwozdYHjMhk5_1bfUCyJU1yu0-bXaZgKAyE';

const HEADERS = [
  'Received at', 'Record ID', 'Played at', 'Name', 'Mobile', 'Email', 'Business name', 'City',
  'Business type', 'Annual turnover', 'Score (out of 10)', 'Result', 'Areas to check',
  'Q1 Godowns / branches in registration', 'Q2 Timely GSTR-1 / 3B', 'Q3 ITC vs GSTR-2B',
  'Q4 IMS review', 'Q5 Supplier compliance', 'Q6 180-day payments', 'Q7 E-way bills',
  'Q8 Stock records', 'Q9 Portal notices', 'Q10 Notice replies',
  'Time taken (s)', 'Timed out', 'Consent given', 'Device', 'Follow-up status', 'Notes'
];

function doGet() {
  return json_({ ok: true, service: 'GSC GST Health Check', sheet: SHEET_NAME });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const d = JSON.parse(e.postData.contents || '{}');
    if (d.key !== SHARED_KEY) return json_({ ok: false, error: 'bad_key' });
    if (d.test) return json_({ ok: true, test: true });

    const sh = sheet_();
    // Ignore a record that was already received (the app retries until it gets "ok").
    if (d.id && sh.getLastRow() > 1) {
      const found = sh.getRange(2, 2, sh.getLastRow() - 1, 1).createTextFinder(String(d.id)).matchEntireCell(true).findNext();
      if (found) return json_({ ok: true, duplicate: true });
    }
    const a = d.answers || [];
    const yn = i => a[i] === 1 ? 'Yes' : a[i] === 0 ? 'No' : 'Not answered';
    const row = [
      new Date(), d.id, d.playedAt ? new Date(d.playedAt) : '', d.name, d.mobile, d.email, d.company, d.city,
      d.businessType, d.turnover, d.score, d.band, (d.gaps || []).join(', '),
      yn(0), yn(1), yn(2), yn(3), yn(4), yn(5), yn(6), yn(7), yn(8), yn(9),
      d.seconds, d.timedOut ? 'Yes' : 'No', d.consent ? 'Yes' : 'No', d.device, '', ''
    ].map(safe_);
    sh.appendRow(row);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

function sheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#FCE8F1');
    sh.getRange('E:E').setNumberFormat('@');          // keep mobile numbers as text
    sh.setColumnWidths(1, HEADERS.length, 140);
  }
  return sh;
}

// Stop spreadsheet formula injection from typed-in text.
function safe_(v) {
  if (typeof v === 'string' && /^[=+\-@]/.test(v)) return "'" + v;
  return v === undefined || v === null ? '' : v;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
