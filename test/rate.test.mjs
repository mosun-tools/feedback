// Node harness for the Self-Rating tool's contract-critical logic — extracts the
// PURE-LOGIC region from rate-bjpuru.html and verifies the self-score, the
// gate verdict, the stored rating shape, and that the dashboard can read it.
//
//   run:  node test/rate.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, '..', 'rate-bjpuru.html'), 'utf8');
const pure = html.match(/PURE-LOGIC-START[\s\S]*?\*\/\n([\s\S]*?)\/\*[^]*?PURE-LOGIC-END/);
assert.ok(pure, 'PURE-LOGIC region not found');

const ctx = {};
vm.createContext(ctx);
vm.runInContext(pure[1] + '\n;globalThis.api = { norm5, computeSelfScore, verdict, buildRating, GATE_KEYS, SCORE_KEYS };', ctx);
const { norm5, computeSelfScore, verdict, buildRating, GATE_KEYS, SCORE_KEYS } = ctx.api;

let n = 0, pass = 0;
function check(name, fn){ n++; try{ fn(); pass++; console.log('  ✓ ' + name); }
  catch(e){ console.error('  ✗ ' + name + '\n      ' + e.message); } }

const ISO = '2026-06-23T00:00:00.000Z';
const allPass = { body: true, message: true, honesty: true, conviction: true };
const fiveScores = { vision: 5, onlyMe: 4, message: 3, brandFit: 5, replay: 4 };   // mean norm5 = 0.8 → 80

check('keys match the locked filter', () => {
  assert.deepEqual(GATE_KEYS, ['body', 'message', 'honesty', 'conviction']);
  assert.deepEqual(SCORE_KEYS, ['vision', 'onlyMe', 'message', 'brandFit', 'replay']);
});
check('norm5 maps 1..5 → 0..1', () => {
  assert.equal(norm5(1), 0); assert.equal(norm5(3), 0.5); assert.equal(norm5(5), 1);
});
check('computeSelfScore = average of the 5 dims → 0..100', () => {
  assert.equal(computeSelfScore(fiveScores), 80);
  assert.equal(computeSelfScore({ vision: 5, onlyMe: 5, message: 5, brandFit: 5, replay: 5 }), 100);
  assert.equal(computeSelfScore({ vision: 1, onlyMe: 1, message: 1, brandFit: 1, replay: 1 }), 0);
});
check('computeSelfScore averages only the scored dims, null when none', () => {
  assert.equal(computeSelfScore({ vision: 4, onlyMe: 2 }), Math.round(((0.75 + 0.25) / 2) * 100));  // 50
  assert.equal(computeSelfScore({}), null);
});
check('verdict: READY only when every gate passes', () => {
  assert.equal(verdict(allPass), 'READY');
  assert.equal(verdict({ body: true, message: true, honesty: false, conviction: true }), 'NOT READY');
  assert.equal(verdict({ body: true, message: true, honesty: true }), 'NOT READY');   // missing = fail
  assert.equal(verdict({}), 'NOT READY');
});
check('buildRating: the stored shape (keyed by song → {gates,scores,selfScore,status,note,ratedAt})', () => {
  const r = buildRating(fiveScores, allPass, '  feels real  ', ISO);
  assert.deepEqual(Object.keys(r).sort(), ['gates', 'note', 'ratedAt', 'scores', 'selfScore', 'status'].sort());
  assert.equal(r.selfScore, 80);
  assert.equal(r.status, 'READY');
  assert.equal(r.note, 'feels real');          // trimmed
  assert.equal(r.ratedAt, ISO);
  assert.deepEqual(r.gates, allPass);
  assert.deepEqual(r.scores, fiveScores);
});
check('buildRating: a failed gate → NOT READY but the score still computes', () => {
  const r = buildRating(fiveScores, { body: true, message: false, honesty: true, conviction: true }, '', ISO);
  assert.equal(r.status, 'NOT READY');
  assert.equal(r.selfScore, 80);
  assert.equal(r.gates.message, false);
});
check('buildRating coerces partial/garbage input safely', () => {
  const r = buildRating({ vision: 9, onlyMe: 0, message: 3 }, { body: 'yes' }, null, ISO);
  assert.equal(r.scores.vision, null);   // out of 1..5 → null
  assert.equal(r.scores.onlyMe, null);
  assert.equal(r.scores.message, 3);
  assert.equal(r.gates.body, true);      // truthy → true
  assert.equal(r.gates.conviction, false);
});

// ---- dashboard compatibility: how dashboard-k7m2x9.html will read these ----
function dashIsRating(key, val){
  return key !== 'config' && key.indexOf('scores::') !== 0 &&
    val && typeof val === 'object' && typeof val.selfScore !== 'undefined' && val.status;
}
function dashSelfScore(ratings, song){ const r = ratings[song]; return r && typeof r.selfScore === 'number' ? r.selfScore : null; }
check('dashboard recognizes the rating + reads its selfScore', () => {
  const store = { config: { blend: 0.6 }, 'scores::Old': { Hook: 4 }, 'BASSLINE': buildRating(fiveScores, allPass, '', ISO) };
  const ratings = {};
  Object.keys(store).forEach(k => { if(dashIsRating(k, store[k])) ratings[k] = store[k]; });
  assert.deepEqual(Object.keys(ratings), ['BASSLINE']);   // not config, not scores::
  assert.equal(dashSelfScore(ratings, 'BASSLINE'), 80);   // single source of truth for the self side
  assert.equal(ratings['BASSLINE'].status, 'READY');
});

console.log('\n' + pass + '/' + n + ' passed');
process.exit(pass === n ? 0 : 1);
