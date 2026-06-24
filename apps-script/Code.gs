/**
 * MOSUN — Song Feedback backend
 * One web app, three jobs (branch on ?action=):
 *   (no action)   → append a form submission to "Responses"   (PUBLIC, unchanged)
 *   action=data   → return all data as JSON / JSONP            (token-gated, read)
 *   action=save   → upsert one Self-Filter key/value           (token-gated, write)
 *
 * Front-end form: https://mosun-tools.github.io/feedback                 (index.html)
 * A&R dashboard:  https://mosun-tools.github.io/feedback/dashboard-*.html (unlisted)
 *
 * ⚠️ Must stay a doGet. The form sends data via fetch(url, {mode:'no-cors'}) — a POST
 *    body would be silently dropped. The dashboard reads/writes via JSONP (a <script>
 *    tag with ?callback=…) to sidestep CORS, which is also GET-only. So: everything is GET.
 * ⚠️ After ANY edit here it does NOTHING until you redeploy:
 *    Deploy → Manage deployments → ✏️ (edit) → Version: New version → Deploy.
 *    (Editing the existing deployment this way keeps the same /exec URL.)
 */

// Casual-hit guard for the dashboard's read/write actions. This also lives in the
// dashboard's client code — fine for this privacy level; it just stops drive-by hits.
var READ_TOKEN = 'mosun-ar-2026-7Qx39kZ';

var RESPONSES_SHEET = 'Responses';
var SELF_SHEET = 'Self-Filter';

function doGet(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  switch (p.action) {
    case 'data': return handleData(p);
    case 'save': return handleSave(p);
    default:     return handleSubmit(p);   // form submission — behavior unchanged
  }
}

/* ---------- default: append a form submission (PUBLIC, no token) ---------- */
function handleSubmit(p) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(RESPONSES_SHEET) || ss.getSheets()[0];

  // Write the header row once; if the sheet predates the Email/City columns, label them in place.
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Timestamp', 'Name', 'Song', 'Reaction', 'Hook', 'Playlist',
                     'Share', 'Weak parts', 'Weak where', 'Remembered', 'Comments', 'Email', 'City']);
  } else {
    if (!sheet.getRange(1, 12).getValue()) sheet.getRange(1, 12).setValue('Email');
    if (!sheet.getRange(1, 13).getValue()) sheet.getRange(1, 13).setValue('City');
  }

  // Hook arrives as "4/5"; Sheets would auto-coerce that to a DATE. Store the
  // bare integer (1–5) so the rating survives intact. parseInt("4/5") === 4.
  var hookNum = parseInt(p.hook, 10);

  sheet.appendRow([
    new Date(),
    p.name || 'Anonymous',
    p.song || '',
    p.reaction || '',
    isNaN(hookNum) ? '' : hookNum,
    p.playlist || '',
    p.share || '',
    p.weak || '',
    p.weakWhere || '',
    p.remember || '',
    p.comments || '',
    p.email || '',
    p.city || ''
  ]);

  return ContentService.createTextOutput('OK');
}

/* ---------- action=data: return Responses + Self-Filter as JSON/JSONP ---------- */
function handleData(p) {
  if (p.token !== READ_TOKEN) return reply(p, { error: 'unauthorized' });

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // All response rows as objects keyed by the header row.
  var responses = [];
  var resSheet = ss.getSheetByName(RESPONSES_SHEET) || ss.getSheets()[0];
  if (resSheet && resSheet.getLastRow() > 1) {
    var values = resSheet.getDataRange().getValues();
    var headers = values[0];
    for (var i = 1; i < values.length; i++) {
      var row = {};
      for (var c = 0; c < headers.length; c++) row[headers[c]] = values[i][c];
      responses.push(row);
    }
  }

  // Self-Filter tab is a simple key/value store: col A = key, col B = JSON string.
  var selfFilter = {};
  var selfSheet = ss.getSheetByName(SELF_SHEET);
  if (selfSheet && selfSheet.getLastRow() > 0) {
    var sv = selfSheet.getDataRange().getValues();
    for (var r = 0; r < sv.length; r++) {
      var key = sv[r][0];
      if (!key) continue;
      try { selfFilter[key] = JSON.parse(sv[r][1]); }
      catch (err) { selfFilter[key] = sv[r][1]; }
    }
  }

  return reply(p, { responses: responses, selfFilter: selfFilter });
}

/* ---------- action=save: upsert one Self-Filter key/value ---------- */
function handleSave(p) {
  if (p.token !== READ_TOKEN) return reply(p, { error: 'unauthorized' });
  if (!p.key) return reply(p, { error: 'missing key' });

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SELF_SHEET) || ss.insertSheet(SELF_SHEET);
  var value = p.value || '';   // expected: a JSON string produced by the dashboard

  var data = sheet.getDataRange().getValues();
  for (var r = 0; r < data.length; r++) {
    if (data[r][0] === p.key) {
      sheet.getRange(r + 1, 2).setValue(value);
      return reply(p, { ok: true, key: p.key, updated: true });
    }
  }
  sheet.appendRow([p.key, value]);
  return reply(p, { ok: true, key: p.key, updated: false });
}

/* ---------- JSON, or JSONP when a ?callback= is supplied ---------- */
function reply(p, obj) {
  var json = JSON.stringify(obj);
  if (p.callback) {
    return ContentService
      .createTextOutput(p.callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}
