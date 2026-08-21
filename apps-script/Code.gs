/**
 * MOSUN — Song Feedback backend
 * One web app, five jobs (branch on ?action=):
 *   (no action)        → append a form submission to "Responses"   (PUBLIC, unchanged)
 *   action=data        → return all data as JSON / JSONP            (token-gated, read)
 *   action=save        → upsert one Self-Filter key/value           (token-gated, write)
 *   action=growthSave  → upsert one weekly growth snapshot          (token-gated, write)
 *   action=growthData  → return all Growth rows + live tile counts  (token-gated, read)
 *   action=growthDelete → delete one snapshot row by week          (token-gated, write)
 *
 * ── growthSave: agent-friendly weekly snapshot upsert ─────────────────────────
 * A plain GET — an agent (or a browser address bar) can call it directly.
 * Keyed by week: rows land in the "Growth" tab (auto-created), one row per
 * week-ending date. MERGE semantics: only params present in the URL touch their
 * columns, so Global and China numbers can be saved in separate calls on
 * different days without wiping each other. Passing an explicitly EMPTY param
 * (e.g. &marker=) clears that cell.
 *
 *   required: token=<READ_TOKEN>
 *             week=YYYY-MM-DD   (week-ending date; or week=auto = most recent Sunday)
 *   Global:   ttFollowers ttViews7 ttBestPost ttBestViews
 *             spListeners spFollowers spStreams28 spSingle spSuper spActive spNew
 *             ytSubs ytViews igFollowers
 *   China:    dyFollowers dyViews7        (DY = 抖音)
 *             xhsFollowers xhsViews7      (XHS = 小红书)
 *             wbFollowers                 (WB = 微博)
 *             neFans nePlays              (NE = 网易云音乐)
 *   Meta:     marker  (free text — release/ads events, shown as chart flags)
 *             notes   (free text)
 *   Numeric values tolerate "12.3K", "1.2M", "3.4万", "1.2亿", commas.
 *   ttBestPost, marker, notes are text; everything else is numeric. All optional.
 *
 *   Example:
 *   <EXEC_URL>?action=growthSave&token=…&week=auto&ttFollowers=12.4K&ttViews7=88K
 *     &spListeners=3521&spStreams28=41.2K&ytSubs=890&igFollowers=2310
 *     &dyFollowers=1.2万&marker=released 三更半夜
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
    case 'data':       return handleData(p);
    case 'save':       return handleSave(p);
    case 'growthSave': return handleGrowthSave(p);
    case 'growthData': return handleGrowthData(p);
    case 'growthDelete': return handleGrowthDelete(p);
    default:           return handleSubmit(p);   // form submission — behavior unchanged
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

/* ---------- Growth: weekly cross-platform snapshots ---------- */
var GROWTH_SHEET = 'Growth';

// [param name, column header, type] — column order in the Growth tab.
var GROWTH_COLS = [
  ['week',         'Week ending',          'key'],
  ['ttFollowers',  'TT followers',         'num'],
  ['ttViews7',     'TT views 7d',          'num'],
  ['ttBestPost',   'TT best post',         'text'],
  ['ttBestViews',  'TT best views',        'num'],
  ['spListeners',  'SP monthly listeners', 'num'],
  ['spFollowers',  'SP followers',         'num'],
  ['spStreams28',  'SP streams 28d',       'num'],
  ['spSingle',     'SP single streams',    'num'],
  ['spSuper',      'SP super listeners',   'num'],
  ['spActive',     'SP active listeners',  'num'],
  ['spNew',        'SP new listeners',     'num'],
  ['ytSubs',       'YT subs',              'num'],
  ['ytViews',      'YT views',             'num'],
  ['igFollowers',  'IG followers',         'num'],
  ['dyFollowers',  'DY followers',         'num'],
  ['dyViews7',     'DY views 7d',          'num'],
  ['xhsFollowers', 'XHS followers',        'num'],
  ['xhsViews7',    'XHS views 7d',         'num'],
  ['wbFollowers',  'WB followers',         'num'],
  ['neFans',       'NE fans',              'num'],
  ['nePlays',      'NE plays',             'num'],
  ['marker',       'Marker',               'text'],
  ['notes',        'Notes',                'text']
];

// "12.3K" / "1.2M" / "3.4万" / "1.2亿" / "1,234" → number. Unparseable → raw string.
function parseMetric(raw) {
  var s = String(raw).trim().replace(/,/g, '');
  var m = s.match(/^([\d.]+)\s*([kKmMbB万亿])?$/);
  if (!m) return s;
  var mult = { k: 1e3, m: 1e6, b: 1e9, '万': 1e4, '亿': 1e8 }[(m[2] || '').toLowerCase()] || 1;
  var n = parseFloat(m[1]) * mult;
  return isNaN(n) ? s : Math.round(n);
}

// Normalize a week cell/param to 'yyyy-MM-dd'. Sheets may have coerced the
// stored string to a Date, so handle both. Returns null if unrecognizable.
function growthWeekKey(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var m = String(v || '').trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return null;
  function p2(x) { return ('0' + x).slice(-2); }
  return m[1] + '-' + p2(m[2]) + '-' + p2(m[3]);
}

function growthSheet(ss) {
  var sheet = ss.getSheetByName(GROWTH_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(GROWTH_SHEET);
    sheet.appendRow(GROWTH_COLS.map(function (c) { return c[1]; }));
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/* ---------- action=growthSave: upsert one weekly snapshot (merge by column) ---------- */
function handleGrowthSave(p) {
  if (p.token !== READ_TOKEN) return reply(p, { error: 'unauthorized' });

  var week;
  if (String(p.week).toLowerCase() === 'auto') {
    var d = new Date();
    d.setDate(d.getDate() - d.getDay());   // most recent Sunday (today if Sunday)
    week = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  } else {
    week = growthWeekKey(p.week);
  }
  if (!week) return reply(p, { error: 'missing or invalid week (use YYYY-MM-DD or auto)' });

  var sheet = growthSheet(SpreadsheetApp.getActiveSpreadsheet());

  var rowIndex = -1;   // 1-based sheet row of the matching week, if any
  if (sheet.getLastRow() > 1) {
    var keys = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    for (var r = 0; r < keys.length; r++) {
      if (growthWeekKey(keys[r][0]) === week) { rowIndex = r + 2; break; }
    }
  }

  var saved = [];
  if (rowIndex === -1) {
    var row = GROWTH_COLS.map(function (col) {
      if (col[2] === 'key') return week;
      if (!p.hasOwnProperty(col[0]) || p[col[0]] === '') return '';
      saved.push(col[0]);
      return col[2] === 'num' ? parseMetric(p[col[0]]) : p[col[0]];
    });
    sheet.appendRow(row);
  } else {
    GROWTH_COLS.forEach(function (col, c) {
      if (col[2] === 'key' || !p.hasOwnProperty(col[0])) return;   // absent param → leave cell alone
      var v = p[col[0]] === '' ? '' : (col[2] === 'num' ? parseMetric(p[col[0]]) : p[col[0]]);
      sheet.getRange(rowIndex, c + 1).setValue(v);
      saved.push(col[0]);
    });
  }
  // Keep the week column as plain text so Sheets stops re-coercing it to a date.
  sheet.getRange(rowIndex === -1 ? sheet.getLastRow() : rowIndex, 1).setNumberFormat('@').setValue(week);

  return reply(p, { ok: true, week: week, updated: rowIndex !== -1, fields: saved });
}

/* ---------- action=growthData: all Growth rows + live tile counts ---------- */
function handleGrowthData(p) {
  if (p.token !== READ_TOKEN) return reply(p, { error: 'unauthorized' });

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var rows = [];
  var sheet = ss.getSheetByName(GROWTH_SHEET);
  if (sheet && sheet.getLastRow() > 1) {
    var values = sheet.getDataRange().getValues();
    for (var i = 1; i < values.length; i++) {
      var obj = {};
      GROWTH_COLS.forEach(function (col, c) {
        var v = values[i][c];
        if (col[2] === 'key') { obj.week = growthWeekKey(v); return; }
        obj[col[0]] = (v === '' || v === null) ? null : v;
      });
      if (obj.week) rows.push(obj);
    }
    rows.sort(function (a, b) { return a.week < b.week ? -1 : 1; });
  }

  // Live tiles: total feedback responses + Moonwalker fan count.
  var feedback = 0;
  var resSheet = ss.getSheetByName(RESPONSES_SHEET) || ss.getSheets()[0];
  if (resSheet && resSheet.getLastRow() > 1) feedback = resSheet.getLastRow() - 1;

  var moonwalkers = 0;
  var mw = ss.getSheetByName('MOONWALKERS');   // header on row 3, fans from row 4 (see Moonwalkers.gs)
  if (mw && mw.getLastRow() >= 4) {
    var names = mw.getRange(4, 1, mw.getLastRow() - 3, 1).getValues();
    for (var n = 0; n < names.length; n++) if (String(names[n][0]).trim()) moonwalkers++;
  }

  return reply(p, { rows: rows, live: { feedback: feedback, moonwalkers: moonwalkers } });
}

/* ---------- action=growthDelete: remove one snapshot row by week (fix a bad grab) ---------- */
function handleGrowthDelete(p) {
  if (p.token !== READ_TOKEN) return reply(p, { error: 'unauthorized' });
  var week = growthWeekKey(p.week);
  if (!week) return reply(p, { error: 'missing or invalid week (YYYY-MM-DD)' });

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GROWTH_SHEET);
  if (sheet && sheet.getLastRow() > 1) {
    var keys = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    for (var r = 0; r < keys.length; r++) {
      if (growthWeekKey(keys[r][0]) === week) {
        sheet.deleteRow(r + 2);
        return reply(p, { ok: true, week: week, deleted: true });
      }
    }
  }
  return reply(p, { ok: true, week: week, deleted: false });
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
