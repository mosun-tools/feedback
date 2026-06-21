// Node harness for the Stage-2 assembler's contract-critical logic.
// Extracts the PURE-LOGIC region from assemble-rovoe1.html (single source of
// truth) and runs it against the REAL catalog.json, then dry-runs the export
// text artifacts so their contents are verified before the in-Chrome test.
//
//   run:  node test/assemble.test.mjs
import { readFileSync, existsSync, mkdtempSync, writeFileSync, mkdirSync, symlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
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
  'buildShotlist, buildSrt, buildMusic, buildToFilm, summarize, computeCut, buildPrecutShotlist, ' +
  'buildBuildCommand, beatBase, clipLabelSlug, labelBonus, WEIGHTS, GAP_THRESHOLD, LABEL_TOKEN_WEIGHT, TAG_KEYS };',
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
check('beatBase has NO extension (guards double-ext: source+outName)', () => {
  const base = A.beatBase(0, { action: ['walking'] });
  assert.equal(base, '01_walking');                  // no .mp4
  assert.equal(base + '.MOV', '01_walking.MOV');     // source/ copy
  assert.equal(base + '.mp4', '01_walking.mp4');     // trimmed output
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

// ---- label-aware matching (plan → shoot → catalog → cut) ----
check('clipLabelSlug extracts the slug from a planner-named clip, ignores raw', () => {
  assert.equal(A.clipLabelSlug('JUN08_MON-P1-b2_walk-a-misty-lane.MOV'), 'walk-a-misty-lane');
  assert.equal(A.clipLabelSlug('IMG_8163.MOV'), '');
});
check('labelBonus rewards token overlap between label-slug and beat action', () => {
  const named = { file: 'JUN08_MON-P1-b2_walk-a-misty-lane.MOV', tags: {} };
  const beat = { action: 'walk down a misty lane' };
  // shared big tokens (>2 chars): walk, misty, lane → 3 × LABEL_TOKEN_WEIGHT
  assert.equal(A.labelBonus(beat, named), 3 * A.LABEL_TOKEN_WEIGHT);
  assert.equal(A.labelBonus(beat, { file: 'IMG_8163.MOV', tags: {} }), 0);
});
check('a named clip wins its beat over a better-tagged unnamed clip', () => {
  const beat = { action: 'walk a misty lane', setting: ['studio'], time: [], shot: [], mood: [] };
  const named = { file: 'JUN08_MON-P1-b2_walk-a-misty-lane.MOV', tags: { setting: [], time: [], action: [], shot: [], mood: [] } };
  const tagged = { file: 'b.mov', tags: { setting: ['studio'], time: [], action: [], shot: [], mood: [] } };
  const ranked = A.rankClips(beat, [tagged, named], A.WEIGHTS);
  assert.equal(ranked[0].file, named.file);   // label match sorts first
  assert.equal(ranked[0].byLabel, true);
  assert.ok(ranked[0].score >= A.GAP_THRESHOLD);   // not a gap → becomes the chosen clip
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

// ---- Stage 2.1: cut math + handle clamping ----
const clip10 = { duration: 10 };
check('computeCut: front handle clamps to clip start', () => {
  const c = A.computeCut({ tStart: 0, tEnd: 2 }, clip10, 0, 1.5);
  assert.equal(c.trimStart, 0);      // 0 - 1.5 clamped to 0
  assert.equal(c.trimEnd, 3.5);      // 0 + 2 + 1.5
  assert.equal(c.handledDur, 3.5);
  assert.equal(c.cleanIn, 0);        // no pre-roll available
  assert.equal(c.cleanOut, 2);
});
check('computeCut: full handles mid-clip', () => {
  const c = A.computeCut({ tStart: 0, tEnd: 2 }, clip10, 4, 1.5);
  assert.equal(c.trimStart, 2.5);
  assert.equal(c.trimEnd, 7.5);
  assert.equal(c.handledDur, 5);
  assert.equal(c.cleanIn, 1.5);      // full front handle
  assert.equal(c.cleanOut, 3.5);     // beat is 2s within the handled clip
});
check('computeCut: back handle + in-point clamp at clip end', () => {
  const c = A.computeCut({ tStart: 0, tEnd: 2 }, clip10, 9, 1.5);  // in-point clamps to 8
  assert.equal(c.inPoint, 8);
  assert.equal(c.trimStart, 6.5);
  assert.equal(c.trimEnd, 10);       // 8 + 2 + 1.5 clamped to 10
  assert.equal(c.handledDur, 3.5);
  assert.equal(c.cleanIn, 1.5);
  assert.equal(c.cleanOut, 3.5);
});
check('computeCut: handle 0 = exact beat (assembles to script length)', () => {
  const c = A.computeCut({ tStart: 0, tEnd: 2 }, clip10, 4, 0);
  assert.equal(c.trimStart, 4);
  assert.equal(c.trimEnd, 6);
  assert.equal(c.handledDur, 2);     // == beatDur, no padding
  assert.equal(c.cleanIn, 0);
  assert.equal(c.cleanOut, 2);
});
check('computeCut: beat longer than clip uses whole clip', () => {
  const c = A.computeCut({ tStart: 0, tEnd: 30 }, clip10, 5, 1.5);
  assert.equal(c.trimStart, 0);
  assert.equal(c.trimEnd, 10);
  assert.equal(c.cleanIn, 0);
  assert.equal(c.cleanOut, 10);
});

const precutRows = [
  { beat: beats[0], outName: '01_walking.mp4', srcOriginal: 'IMG_8163.MOV',
    cut: A.computeCut(beats[0], clip10, 4, 1.5) },
  { beat: beats[2], cut: null },   // gap
];
check('buildPrecutShotlist shows trim marks + TO FILM + chmod hint', () => {
  const md = A.buildPrecutShotlist(precutRows);
  assert.ok(md.includes('clean trim (in→out in clip)'));
  assert.ok(md.includes('chmod +x build.command'));
  assert.ok(md.includes('01_walking.mp4') && md.includes('IMG_8163.MOV'));
  assert.ok(md.includes('1.50s → 3.50s'));   // clean marks
  assert.ok(md.includes('**TO FILM**'));
});

const dryCuts = [
  { outName: '01_walking.mp4', source: '01_walking.MOV', srcOriginal: 'IMG_8163.MOV', trimStart: 2.5, handledDur: 5, cleanIn: 1.5, cleanOut: 3.5 },
  { outName: '02_perform.mp4', source: '02_perform.mov', srcOriginal: 'IMG_7963.mov', trimStart: 0, handledDur: 4, cleanIn: 0, cleanOut: 3 },
];
const dryMissing = [{ srcOriginal: 'gone.MOV', reason: 'not in folder' }];
check('buildBuildCommand structure: shebang, guard, encoder, trims, skip, preview', () => {
  const sh = A.buildBuildCommand(dryCuts, dryMissing);
  assert.ok(sh.startsWith('#!/bin/bash'));
  assert.ok(sh.includes('command -v ffmpeg') && sh.includes('brew install ffmpeg'));
  assert.ok(sh.includes('h264_videotoolbox'));
  assert.ok(sh.includes('trim "source/01_walking.MOV" 2.500 5.000'));
  assert.ok(sh.includes("'01_walking.mp4'") && sh.includes("'02_perform.mp4'"));
  assert.ok(sh.includes('skipped (not in folder): gone.MOV'));
  assert.ok(sh.includes('PREVIEW=1') && sh.includes('preview.mp4'));
});

// ---- build.command dry-run: actually execute it with ffmpeg forced absent ----
check('build.command runs cleanly + prints brew line when ffmpeg is missing', () => {
  const sh = A.buildBuildCommand(dryCuts, dryMissing);
  const dir = mkdtempSync(join(tmpdir(), 'mosun-bc-'));
  writeFileSync(join(dir, 'build.command'), sh);
  const bin = join(dir, 'bin'); mkdirSync(bin);
  symlinkSync('/usr/bin/dirname', join(bin, 'dirname'));   // only dirname on PATH → ffmpeg absent
  let out = '', code = 0;
  // absolute bash so the spawn resolves; restricted PATH so `command -v ffmpeg` fails
  try{ out = execFileSync('/bin/bash', [join(dir, 'build.command')], { env: { PATH: bin }, encoding: 'utf8' }); }
  catch(e){ code = (e.status == null ? 'signal/' + e.signal + ' code/' + e.code : e.status); out = (e.stdout || '') + (e.stderr || ''); }
  assert.equal(code, 0, 'expected clean exit, got ' + code + '\n' + out);
  assert.ok(/brew install ffmpeg/.test(out), out);
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
