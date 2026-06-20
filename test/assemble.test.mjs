// Node harness for the Stage-2 assembler's contract-critical logic.
// Extracts the PURE-LOGIC region from assemble-rovoe1.html (single source of
// truth) and runs it against the REAL catalog.json, then dry-runs the export
// text artifacts so their contents are verified before the in-Chrome test.
//
//   run:  node test/assemble.test.mjs
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import vm from 'node:vm';
import assert from 'node:assert';   // loose: vm-realm objects have a different prototype

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, '..', 'assemble-rovoe1.html'), 'utf8');

const taxo = html.match(/const TAG_GROUPS = \[[\s\S]*?\];\nconst TAG_KEYS[\s\S]*?;/);
const cfg = html.match(/const WEIGHTS =[\s\S]*?const BIG_FILE_BYTES[\s\S]*?;/);
const pure = html.match(/PURE-LOGIC-START[\s\S]*?\*\/\n([\s\S]*?)\/\*[^]*?PURE-LOGIC-END/);
assert.ok(taxo && cfg && pure, 'could not extract taxonomy / config / pure region');

const ctx = {};
vm.createContext(ctx);
vm.runInContext(
  taxo[0] + '\n' + cfg[0] + '\n' + pure[1] + '\n' +
  ';globalThis.api = { slugify, fmtClock, srtTimestamp, scoreClip, rankClips, isGap, clipOutName, ' +
  'buildShotlist, buildSrt, buildMusic, buildToFilm, summarize, WEIGHTS, GAP_THRESHOLD, TAG_KEYS };',
  ctx
);
const A = ctx.api;

let n = 0, pass = 0;
function check(name, fn){ n++; try{ fn(); pass++; console.log('  ✓ ' + name); }
  catch(e){ console.error('  ✗ ' + name + '\n      ' + e.message); } }

// ---- slug / clock / srt ----
check('slugify is filesystem-safe', () => {
  assert.equal(A.slugify('Walking OUT the door!'), 'walking-out-the-door');
  assert.equal(A.slugify('  --weird__name--  '), 'weird-name');
  assert.equal(A.slugify(''), 'beat');
});
check('fmtClock formats m:ss', () => {
  assert.equal(A.fmtClock(0), '0:00');
  assert.equal(A.fmtClock(75), '1:15');
  assert.equal(A.fmtClock(59.6), '1:00');
});
check('srtTimestamp formats HH:MM:SS,mmm', () => {
  assert.equal(A.srtTimestamp(0), '00:00:00,000');
  assert.equal(A.srtTimestamp(3.5), '00:00:03,500');
  assert.equal(A.srtTimestamp(3661.25), '01:01:01,250');
});
check('clipOutName is ordered + slugged + keeps source ext', () => {
  assert.equal(A.clipOutName(0, { action: ['walking'] }, '.MOV'), '01_walking.MOV');
  assert.equal(A.clipOutName(9, { action: [], needDescription: 'rooftop sunset' }, '.mp4'), '10_rooftop-sunset.mp4');
});

// ---- scoring ----
const clipA = { file: 'a.mov', tags: { setting: ['street'], time: ['golden-hour'], action: ['walking'], shot: ['wide'], mood: ['warm'] } };
const clipB = { file: 'b.mov', tags: { setting: ['studio'], time: ['indoor'], action: ['performing'], shot: ['close'], mood: ['moody'] } };
check('scoreClip weights setting & action ×2', () => {
  const beat = { setting: ['street'], time: [], action: ['walking'], shot: [], mood: [] };
  assert.equal(A.scoreClip(beat, clipA, A.WEIGHTS), 4);   // setting 2 + action 2
  assert.equal(A.scoreClip(beat, clipB, A.WEIGHTS), 0);
});
check('rankClips sorts desc and drops zero-score', () => {
  const beat = { setting: ['street'], time: ['golden-hour'], action: [], shot: [], mood: [] };
  const r = A.rankClips(beat, [clipB, clipA], A.WEIGHTS);
  assert.equal(r.length, 1);
  assert.equal(r[0].file, 'a.mov');
  assert.equal(r[0].score, 3);   // setting 2 + time 1
});
check('isGap respects the threshold', () => {
  assert.equal(A.isGap({ score: 1 }, 2), true);
  assert.equal(A.isGap({ score: 2 }, 2), false);
  assert.equal(A.isGap(undefined, 2), true);
});

// ---- export artifacts ----
const beats = [
  { tStart: 0, tEnd: 2, setting: ['street'], time: ['golden-hour'], action: ['walking'], shot: ['wide'], mood: ['warm'],
    onScreenText: 'new chapter', audioCue: 'lo-fi beat in', needDescription: 'artist walking out a door at golden hour' },
  { tStart: 2, tEnd: 5, setting: ['studio'], time: ['indoor'], action: ['performing'], shot: ['close'], mood: ['moody'],
    onScreenText: 'the work', audioCue: '', needDescription: 'close performing in studio' },
  { tStart: 5, tEnd: 7, setting: ['rooftop'], time: ['night'], action: ['reaction'], shot: ['medium'], mood: ['cinematic'],
    onScreenText: '', audioCue: 'beat drop', needDescription: 'rooftop reaction at night' },
];
const assign = [ { chosen: '01_walking.MOV' }, { chosen: '02_perform.MOV' }, { chosen: null } ];
const rows = [
  { beat: beats[0], outName: '01_walking.MOV' },
  { beat: beats[1], outName: '02_perform.MOV' },
  { beat: beats[2], outName: null },
];

check('buildShotlist is a valid table with TO FILM marker', () => {
  const md = A.buildShotlist(rows);
  assert.ok(md.includes('| # | time | clip file | on-screen text | audio / notes |'));
  assert.ok(md.includes('| 1 | 0:00–0:02 | 01_walking.MOV | new chapter | lo-fi beat in |'));
  assert.ok(md.includes('**TO FILM**'));
});
check('buildSrt numbers + times only text overlays', () => {
  const srt = A.buildSrt(beats);
  assert.ok(srt.startsWith('1\n00:00:00,000 --> 00:00:02,000\nnew chapter'));
  assert.ok(srt.includes('2\n00:00:02,000 --> 00:00:05,000\nthe work'));
  assert.ok(!srt.includes('3\n'));   // beat 3 has no on-screen text → skipped
});
check('buildMusic carries recommendation + per-beat cues', () => {
  const m = A.buildMusic('warm lo-fi, 80 BPM', beats);
  assert.ok(m.includes('warm lo-fi, 80 BPM'));
  assert.ok(m.includes('- 0:00 — lo-fi beat in'));
  assert.ok(m.includes('- 0:05 — beat drop'));
});
check('buildToFilm details the gap beats', () => {
  const tf = A.buildToFilm([{ beat: beats[2] }]);
  assert.ok(tf.includes('1 beat need'));
  assert.ok(tf.includes('rooftop') && tf.includes('night'));
  assert.ok(tf.includes('**Shot:** medium'));
});
check('summarize counts matched/gaps + runtime vs script length', () => {
  const s = A.summarize(beats, assign);
  assert.equal(s.beats, 3); assert.equal(s.matched, 2); assert.equal(s.gaps, 1);
  assert.equal(s.runtime, 7); assert.equal(s.scriptLen, 7);
});

// ---- live dry-run against the real catalog.json ----
const catPath = join(homedir(), 'Desktop', 'MOSUN Footage', 'catalog.json');
if(existsSync(catPath)){
  const cat = JSON.parse(readFileSync(catPath, 'utf8'));
  const clips = cat.clips;
  check('real catalog: a street/walking beat ranks a real clip', () => {
    const beat = { setting: ['street'], time: [], action: ['walking'], shot: [], mood: [] };
    const ranked = A.rankClips(beat, clips, A.WEIGHTS);
    console.log('      catalog has ' + clips.length + ' clips; top match: ' +
      (ranked[0] ? ranked[0].file + ' (score ' + ranked[0].score + ')' : 'none'));
    assert.ok(Array.isArray(ranked));
  });
} else {
  console.log('  • skipped real-catalog dry-run (no ~/Desktop/MOSUN Footage/catalog.json)');
}

console.log('\n' + pass + '/' + n + ' passed');
process.exit(pass === n ? 0 : 1);
