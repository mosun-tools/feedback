// Node harness for the footage catalog's contract-critical logic.
// It extracts the PURE-LOGIC region from catalog-q2wln8.html (the single source
// of truth) and runs assertions against it — so the test can never drift from
// shipped code. FSA / DOM glue is verified manually in Chrome (see README/PR).
//
//   run:  node test/catalog.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
// non-strict on purpose: values created inside the vm realm have a different
// Array/Object prototype, which deepStrictEqual rejects on identity. Loose
// deepEqual compares by structure, which is what we want across the realm.
import assert from 'node:assert';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, '..', 'catalog-q2wln8.html'), 'utf8');

// pull the taxonomy + the pure region out of the page
const taxo = html.match(/const TAG_GROUPS = \[[\s\S]*?\];\nconst TAG_KEYS[\s\S]*?;/);
// grab the code BETWEEN the start-marker comment's close and the end-marker comment
const pure = html.match(/PURE-LOGIC-START[\s\S]*?\*\/\n([\s\S]*?)\/\*[^]*?PURE-LOGIC-END/);
assert.ok(taxo, 'TAG_GROUPS block not found');
assert.ok(pure, 'PURE-LOGIC region not found');

const ctx = {};
vm.createContext(ctx);
vm.runInContext(
  taxo[0] + '\n' + pure[1] + '\n' +
  ';globalThis.api = { fmtDuration, newClip, isTagged, buildMergedCatalog, matchesSearch, TAG_KEYS };',
  ctx
);
const { fmtDuration, newClip, isTagged, buildMergedCatalog, matchesSearch, TAG_KEYS } = ctx.api;

let n = 0, pass = 0;
function check(name, fn){ n++; try{ fn(); pass++; console.log('  ✓ ' + name); }
  catch(e){ console.error('  ✗ ' + name + '\n      ' + e.message); } }

const ISO = '2026-06-21T00:00:00.000Z';
let _i = 0; const idFn = () => 'id-' + (++_i);   // deterministic ids for tests

// ---- duration formatting ----
check('fmtDuration formats m:ss', () => {
  assert.equal(fmtDuration(0), '0:00');
  assert.equal(fmtDuration(5), '0:05');
  assert.equal(fmtDuration(75), '1:15');
  assert.equal(fmtDuration(125.4), '2:05');
  assert.equal(fmtDuration(59.6), '1:00');       // rounds up cleanly, not 0:60
});
check('fmtDuration handles unknown', () => {
  assert.equal(fmtDuration(null), '—');
  assert.equal(fmtDuration(undefined), '—');
  assert.equal(fmtDuration(Infinity), '—');
});

// ---- newClip = the catalog.json contract ----
check('newClip matches the schema contract', () => {
  const c = newClip('IMG_0001.MOV', ISO, idFn);
  assert.deepEqual(Object.keys(c).sort(),
    ['addedAt','duration','file','id','notes','song','source','tagged','tags'].sort());
  assert.equal(c.version, undefined);            // version lives on the root, not the clip
  assert.equal(c.file, 'IMG_0001.MOV');
  assert.equal(c.duration, 0);
  assert.equal(c.addedAt, ISO);
  assert.equal(c.tagged, false);
  assert.equal(c.source, 'manual');              // room for "ai" later
  assert.equal(c.song, '');
  assert.equal(c.notes, '');
  assert.deepEqual(Object.keys(c.tags).sort(), [...TAG_KEYS].sort());
  for(const k of TAG_KEYS) assert.deepEqual(c.tags[k], []);
});

// ---- isTagged ----
check('isTagged reflects only taxonomy tags', () => {
  const c = newClip('a.mp4', ISO, idFn);
  assert.equal(isTagged(c), false);
  c.song = 'Golden Hour'; c.notes = 'nice';
  assert.equal(isTagged(c), false);              // song/notes alone ≠ tagged
  c.tags.setting.push('studio');
  assert.equal(isTagged(c), true);
});

// ---- merge / reload behavior ----
check('buildMergedCatalog adds new files as untagged', () => {
  const merged = buildMergedCatalog([], ['b.mov','a.mp4'], ISO, idFn);
  assert.equal(merged.length, 2);
  assert.ok(merged.every(c => c.tagged === false && c.source === 'manual'));
});
check('buildMergedCatalog preserves tags + id for known files', () => {
  const first = buildMergedCatalog([], ['a.mp4'], ISO, idFn);
  first[0].tags.shot.push('wide'); first[0].tagged = true;
  const savedId = first[0].id;
  // simulate reload: same file present, plus a newly-dropped one
  const second = buildMergedCatalog(first, ['a.mp4','new.mov'], ISO, idFn);
  const a = second.find(c => c.file === 'a.mp4');
  const fresh = second.find(c => c.file === 'new.mov');
  assert.deepEqual(a.tags.shot, ['wide']);       // tags survived
  assert.equal(a.id, savedId);                   // stable id survived
  assert.equal(a.tagged, true);
  assert.equal(fresh.tagged, false);
});
check('buildMergedCatalog retains records for absent files', () => {
  const have = buildMergedCatalog([], ['gone.mov'], ISO, idFn);
  have[0].tags.mood.push('moody');
  const after = buildMergedCatalog(have, [], ISO, idFn);   // file removed from folder
  assert.equal(after.length, 1);
  assert.deepEqual(after[0].tags.mood, ['moody']);         // tags kept if it returns
});
check('buildMergedCatalog re-syncs tagged flag from tags', () => {
  const stale = [{ ...newClip('x.mp4', ISO, idFn), tagged: true }];  // flag wrong, no tags
  const merged = buildMergedCatalog(stale, ['x.mp4'], ISO, idFn);
  assert.equal(merged[0].tagged, false);
});

// ---- search: AND across groups, OR within a group, + text ----
const mk = (file, tags, extra = {}) => ({ ...newClip(file, ISO, idFn), tags: { ...newClip(file, ISO, idFn).tags, ...tags }, ...extra });
const none = Object.fromEntries(TAG_KEYS.map(k => [k, []]));
check('matchesSearch passes with no filters', () => {
  assert.equal(matchesSearch(mk('a.mp4', {}), none, ''), true);
});
check('matchesSearch OR within a group', () => {
  const c = mk('a.mp4', { setting: ['street'] });
  assert.equal(matchesSearch(c, { ...none, setting: ['studio','street'] }, ''), true);
  assert.equal(matchesSearch(c, { ...none, setting: ['studio'] }, ''), false);
});
check('matchesSearch AND across groups', () => {
  const c = mk('a.mp4', { setting: ['street'], time: ['night'] });
  assert.equal(matchesSearch(c, { ...none, setting: ['street'], time: ['night'] }, ''), true);
  assert.equal(matchesSearch(c, { ...none, setting: ['street'], time: ['day'] }, ''), false);
});
check('matchesSearch text hits filename/song/notes', () => {
  const c = mk('IMG_8219.MOV', { setting: ['rooftop'] }, { song: 'Golden Hour', notes: 'sunset' });
  assert.equal(matchesSearch(c, none, '8219'), true);
  assert.equal(matchesSearch(c, none, 'golden'), true);
  assert.equal(matchesSearch(c, none, 'sunset'), true);
  assert.equal(matchesSearch(c, none, 'nope'), false);
});
check('matchesSearch combines tags AND text', () => {
  const c = mk('a.mp4', { mood: ['warm'] }, { notes: 'candlelit' });
  assert.equal(matchesSearch(c, { ...none, mood: ['warm'] }, 'candle'), true);
  assert.equal(matchesSearch(c, { ...none, mood: ['calm'] }, 'candle'), false);
});

console.log('\n' + pass + '/' + n + ' passed');
process.exit(pass === n ? 0 : 1);
