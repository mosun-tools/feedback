/**
 * MOSUN — Song Feedback backend
 * Receives form submissions and appends them to THIS Google Sheet.
 * Front-end: https://mosun-tools.github.io/feedback
 *
 * ⚠️ Must stay a doGet. The form sends data as URL params via
 *    fetch(url, { mode: 'no-cors' }) — a POST body would be silently dropped.
 * ⚠️ After ANY edit here: Deploy → Manage deployments → ✏️ → Version: New version → Deploy.
 *    (Editing the existing deployment keeps the same /exec URL.)
 */
function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Responses') || ss.getSheets()[0];

  // Write a header row once.
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Timestamp', 'Name', 'Song', 'Reaction', 'Hook', 'Playlist',
                     'Share', 'Weak parts', 'Weak where', 'Remembered', 'Comments']);
  }

  var p = (e && e.parameter) ? e.parameter : {};
  sheet.appendRow([
    new Date(),
    p.name || 'Anonymous',
    p.song || '',
    p.reaction || '',
    p.hook || '',
    p.playlist || '',
    p.share || '',
    p.weak || '',
    p.weakWhere || '',
    p.remember || '',
    p.comments || ''
  ]);

  return ContentService.createTextOutput('OK');
}
