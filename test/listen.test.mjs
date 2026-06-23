// Node harness for the fan listening-session's contract-critical logic — extracts
// the PURE-LOGIC region from listen-9f3xk2.html and verifies which steps are
// required, and that the submit params exactly match what index.html sends to the
// SAME backend (so responses land in the Responses sheet and the dashboard works).
//
//   run:  node test/listen.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, '..', 'listen-9f3xk2.html'), 'utf8');
const pure = html.match(/PURE-LOGIC-START[\s\S]*?\*\/\n([\s\S]*?)\/\*[^]*?PURE-LOGIC-END/);
assert.ok(pure, 'PURE-LOGIC region not found');

const ctx = {};
vm.createContext(ctx);
vm.runInContext(pure[1] + '\n;globalThis.api = { STEPS, REQUIRED, missingRequired, buildParams, progress };', ctx);
const { STEPS, REQUIRED, missingRequired, buildParams, progress } = ctx.api;

let n = 0, pass = 0;
function check(name, fn){ n++; try{ fn(); pass++; console.log('  ✓ ' + name); }
  catch(e){ console.error('  ✗ ' + name + '\n      ' + e.message); } }

// The exact field set index.html appends to SCRIPT_URL.
const INDEX_FIELDS = ['name','song','reaction','hook','playlist','share','weak','weakWhere','remember','comments'];
const full = { reaction:'Fire', hook:4, playlist:'Yes', share:'Maybe', weak:'Some parts', weakWhere:'  2nd verse  ', remember:'Yes', comments:'  loved it  ', name:'  Ada  ' };

check('the 6 required steps are the gating questions', () => {
  assert.deepEqual(REQUIRED, ['reaction','hook','playlist','share','weak','remember']);
  assert.ok(STEPS.includes('comments') && STEPS.includes('name'));   // present but optional
});
check('missingRequired flags an empty run, clears on a full one', () => {
  assert.deepEqual(missingRequired({}), ['reaction','hook','playlist','share','weak','remember']);
  assert.deepEqual(missingRequired(full), []);
});
check('hook must be 1..5 to count', () => {
  assert.ok(missingRequired({ ...full, hook: 0 }).includes('hook'));
  assert.ok(missingRequired({ ...full, hook: 6 }).includes('hook'));
  assert.ok(!missingRequired({ ...full, hook: 1 }).includes('hook'));
});
check('buildParams emits EXACTLY index.html\'s fields', () => {
  const p = buildParams(full, 'Afraid of the Light');
  assert.deepEqual(Object.keys(p).sort(), INDEX_FIELDS.slice().sort());
});
check('buildParams sets song from the attached title + trims/normalizes', () => {
  const p = buildParams(full, 'Afraid of the Light');
  assert.equal(p.song, 'Afraid of the Light');     // the dashboard groups on this
  assert.equal(p.hook, '4');                        // bare integer (no "/5" → no date coercion)
  assert.equal(p.weakWhere, '2nd verse');           // trimmed
  assert.equal(p.comments, 'loved it');
  assert.equal(p.name, 'Ada');
});
check('blank name → Anonymous (matches the public form)', () => {
  assert.equal(buildParams({ ...full, name: '' }, 'X').name, 'Anonymous');
  assert.equal(buildParams({ ...full, name: '   ' }, 'X').name, 'Anonymous');
});
check('hook out of range serializes to empty string, not a bogus number', () => {
  assert.equal(buildParams({ ...full, hook: 9 }, 'X').hook, '');
});
check('progress climbs 0 → <1 across steps (sun never crests early)', () => {
  assert.equal(progress(0), 0);
  assert.ok(progress(3) > 0 && progress(3) < 1);
  assert.ok(progress(STEPS.length - 1) < 1);
  assert.equal(progress(STEPS.length), 1);          // reveal = full sunrise
});

console.log('\n' + pass + '/' + n + ' passed');
process.exit(pass === n ? 0 : 1);
