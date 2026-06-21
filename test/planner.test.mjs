// Node harness for the Shoot-Day Planner's contract-critical logic.
// Extracts the PURE-LOGIC region from shoot-planner-bzr4a5.html (single source
// of truth) and runs clustering/summary/builders against a synthetic week.
//
//   run:  node test/planner.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert';   // loose: vm-realm objects have a different prototype

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, '..', 'shoot-planner-bzr4a5.html'), 'utf8');

const consts = html.match(/const LOCATIONS =[\s\S]*?const MIN_PER_SHOT[\s\S]*?;/);
const pure = html.match(/PURE-LOGIC-START[\s\S]*?\*\/\n([\s\S]*?)\/\* =+ PURE-LOGIC-END/);
assert.ok(consts && pure, 'could not extract consts / pure region');

const ctx = {};
vm.createContext(ctx);
vm.runInContext(
  consts[0] + '\n' + pure[1] + '\n' +
  ';globalThis.api = { clusterShots, summarize, wardrobePropsMaster, buildCallSheetMd, buildCsv, sortShots, fmtMinutes, shotSource, shotMeta, shotLabel, weekCode, LOCATIONS, LIGHTS };',
  ctx
);
const A = ctx.api;

let n = 0, pass = 0;
function check(name, fn){ n++; try{ fn(); pass++; console.log('  ✓ ' + name); }
  catch(e){ console.error('  ✗ ' + name + '\n      ' + e.message); } }

const shots = [
  { day: 'Mon · Jun 8', post: 'P1', beat: 2, duration: 4, location: 'taipei-street', light: 'golden-hour', framing: 'POV low', action: 'walk down a quiet lane', wardrobe: 'dark jacket', props: ['scooter'], onScreenText: 'before the week', audioCue: 'sub-bass drone' },
  { day: 'Tue · Jun 9', post: 'P1', beat: 1, duration: 3, location: 'studio-apartment', light: 'indoor', framing: 'close', action: 'hands on synth', wardrobe: 'black tee', props: ['synth','headphones'], onScreenText: '', audioCue: 'ambient' },
  { day: 'Tue · Jun 9', post: 'P2', beat: 1, duration: 2, location: 'studio-apartment', light: 'indoor', framing: 'medium', action: 'talk to cam about the song', wardrobe: 'black tee', props: ['headphones'], onScreenText: 'how i made it', audioCue: 'ambient' },
  { day: 'Thu · Jun 11', post: 'P1', beat: 3, duration: 5, location: 'taipei-street', light: 'golden-hour', framing: 'wide', action: 'performing on the move', wardrobe: 'dark jacket', props: [], onScreenText: 'I ENVY YOU', audioCue: 'I ENVY YOU' },
  { day: 'Fri · Jun 12', post: 'P1', beat: 2, duration: 3, location: 'rooftop', light: 'night', framing: 'medium', action: 'night out reaction', wardrobe: 'leather jacket', props: ['drink'], onScreenText: 'drop dead', audioCue: 'Olivia Rodrigo' },
];

check('clusterShots location-first: ordered (location, light), single-light blocks', () => {
  const blocks = A.clusterShots(shots, 'location');
  // groups: studio-apartment×indoor (2), taipei-street×golden (2), rooftop×night (1)
  assert.equal(blocks.length, 3);
  // location order from LOCATIONS: studio-apartment(0) < taipei-street(1) < rooftop(2)
  assert.deepEqual(blocks.map(b => b.location), ['studio-apartment', 'taipei-street', 'rooftop']);
  assert.equal(blocks[0].shots.length, 2);
  assert.ok(blocks[1].title.includes('GOLDEN HOUR') && blocks[1].title.includes('Taipei street'));
});
check('clusterShots light-first: golden-hour block leads, night last', () => {
  const blocks = A.clusterShots(shots, 'light');
  assert.equal(blocks[0].light, 'golden-hour');
  assert.equal(blocks[blocks.length - 1].light, 'night');
  assert.ok(blocks.every(b => b.constraint === (b.light === 'golden-hour' || b.light === 'night' || b.light === 'blue-hour')));
});
check('clusterShots outfit-first: grouped by wardrobe', () => {
  const blocks = A.clusterShots(shots, 'outfit');
  // wardrobes: black tee (×2 studio), dark jacket (×2 across two locations → 2 blocks), leather jacket (×1)
  const byWard = blocks.map(b => b.wardrobe);
  assert.ok(byWard.includes('black tee') && byWard.includes('dark jacket') && byWard.includes('leather jacket'));
  // dark jacket spans street(golden) — its block light is uniform there
  const dj = blocks.filter(b => b.wardrobe === 'dark jacket');
  assert.ok(dj.length >= 1);
});
check('light-bound blocks carry a constraint flag + window', () => {
  const blocks = A.clusterShots(shots, 'location');
  const golden = blocks.find(b => b.light === 'golden-hour');
  assert.equal(golden.constraint, true);
  assert.ok(/golden hour/i.test(golden.window));
  const studio = blocks.find(b => b.light === 'indoor');
  assert.equal(studio.constraint, false);
});

check('summarize counts shots/locations/outfits/golden/night + time estimate', () => {
  const s = A.summarize(shots);
  assert.equal(s.shots, 5);
  assert.equal(s.locations, 3);           // studio, street, rooftop
  assert.equal(s.outfits, 3);             // dark jacket, black tee, leather jacket
  assert.equal(s.golden, 2);
  assert.equal(s.night, 1);
  assert.equal(s.estimateMin, 5 * 10 + 3 * 25);   // MIN_PER_SHOT=10, MIN_PER_LOCATION=25 → 125
});
check('fmtMinutes formats h/m', () => {
  assert.equal(A.fmtMinutes(125), '2h 5m');
  assert.equal(A.fmtMinutes(60), '1h');
  assert.equal(A.fmtMinutes(40), '40m');
});

check('wardrobePropsMaster dedups + counts, most-used first', () => {
  const m = A.wardrobePropsMaster(shots);
  assert.equal(m.outfits[0].name, 'dark jacket');   // ×2 (Mon, Thu)... black tee also ×2; tie broken by count then insertion
  const dj = m.outfits.find(o => o.name === 'dark jacket');
  assert.equal(dj.count, 2);
  assert.deepEqual(dj.days.sort(), ['Mon · Jun 8', 'Thu · Jun 11']);
  const hp = m.props.find(p => p.name === 'headphones');
  assert.equal(hp.count, 2);
});

check('buildCallSheetMd: header, blocks with checkboxes, master lists', () => {
  const blocks = A.clusterShots(shots, 'location');
  const md = A.buildCallSheetMd('Week of Jun 8–14, 2026', 'Taipei golden hour ≈ 5:10am / 6:40pm', blocks, A.summarize(shots), A.wardrobePropsMaster(shots));
  assert.ok(md.includes('# Week of Jun 8–14, 2026'));
  assert.ok(md.includes('> Taipei golden hour'));
  assert.ok(md.includes('5 shots · 3 locations · 3 outfits · 2 golden-hour · 1 night'));
  assert.ok(md.includes('**Mon · Jun 8 · P1**'));
  assert.ok(md.includes('`JUN08_MON-P1-b2'));   // per-shot label leads the row
  assert.ok(md.includes('## Wardrobe — pack once') && md.includes('## Props — pack once'));
  assert.ok(/GOLDEN HOUR · Taipei street\s+⚑/.test(md));   // constraint flag on light-bound block
});
check('shotMeta + md show framing and shot length per shot', () => {
  assert.equal(A.shotMeta({ framing: 'close-up', duration: 2 }), 'close-up · 2s');
  assert.equal(A.shotMeta({ framing: 'macro', duration: 0 }), 'macro');      // no length if 0
  assert.equal(A.shotMeta({ framing: '', duration: 3 }), '3s');
  const blocks = A.clusterShots(shots, 'location');
  const md = A.buildCallSheetMd('W', '', blocks, A.summarize(shots), A.wardrobePropsMaster(shots));
  assert.ok(md.includes('**Mon · Jun 8 · P1** (POV low · 4s)'));   // framing + length on the row
  assert.ok(md.includes('(close · 3s)'));
});
check('shotLabel: unique file-safe code (week + day + post + beat + slug)', () => {
  assert.equal(A.weekCode('Week of Jun 8–14, 2026'), 'JUN08');
  assert.equal(A.shotLabel({ day: 'Mon · Jun 8', post: 'P1', beat: 2, action: 'walk down a quiet lane' }, 'JUN08'), 'JUN08_MON-P1-b2_walk-down-a-quie');
  assert.equal(A.shotLabel({ day: 'Tuesday / June 9', post: 'P2 craft', beat: 1, framing: 'macro' }, ''), 'TUE-P2-b1_macro');
});
check('buildCsv: header has label first + escaped rows', () => {
  const csv = A.buildCsv(shots, 'location', 'Week of Jun 8–14, 2026');
  assert.ok(csv.startsWith('label,day,post,beat,duration,location,light,framing,action,wardrobe,props,onScreenText,audioCue'));
  assert.ok(csv.includes('Mon · Jun 8,P1,2,4,taipei-street,golden-hour'));
  assert.ok(csv.includes('synth; headphones'));   // props joined
  assert.ok(/JUN08_MON-P1-b2_[a-z-]+,Mon · Jun 8,P1,2,4/.test(csv));   // label leads its row
});
check('exports: .md grouped by location (blocks in LOCATIONS order)', () => {
  const byLoc = A.clusterShots(shots, 'location');
  const md = A.buildCallSheetMd('W', '', byLoc, A.summarize(shots), A.wardrobePropsMaster(shots));
  const headingLocs = [...md.matchAll(/^## .*· (.+?)(?:  |$)/gm)].map(m => m[1].trim());
  // studio apartment (loc 0) appears before Taipei street (1) before Rooftop (2)
  const iStudio = headingLocs.indexOf('Studio apartment');
  const iStreet = headingLocs.indexOf('Taipei street');
  const iRoof = headingLocs.indexOf('Rooftop');
  assert.ok(iStudio >= 0 && iStudio < iStreet && iStreet < iRoof, 'location order: ' + headingLocs.join(', '));
});
check('buildCsv: default groups by location', () => {
  const lines = A.buildCsv(shots).trim().split('\n').slice(1);   // drop header
  const locs = lines.map(l => l.split(',')[5]);   // location now index 5 (label is 0)
  assert.equal(locs[0], 'studio-apartment');
  assert.equal(locs[locs.length - 1], 'rooftop');
  const idx = locs.map(l => A.LOCATIONS.indexOf(l));
  assert.deepEqual(idx, [...idx].sort((a, b) => a - b));   // non-decreasing
});
check('buildCsv: can group by light (selector-driven)', () => {
  const lines = A.buildCsv(shots, 'light').trim().split('\n').slice(1);
  const lights = lines.map(l => l.split(',')[6]);   // light now index 6
  // LIGHT_ORDER: golden-hour(0) < indoor(2) < night(4)
  assert.equal(lights[0], 'golden-hour');
  assert.equal(lights[lights.length - 1], 'night');
});
check('buildCsv: can group by outfit (selector-driven)', () => {
  const lines = A.buildCsv(shots, 'outfit').trim().split('\n').slice(1);
  const wards = lines.map(l => l.split(',')[9]);   // wardrobe now index 9
  // wardrobes sort alphabetically: "black tee" before "dark jacket" before "leather jacket"
  assert.deepEqual([...wards], [...wards].sort());
});

console.log('\n' + pass + '/' + n + ' passed');
process.exit(pass === n ? 0 : 1);
