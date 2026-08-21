#!/usr/bin/env node
/**
 * MOSUN — automatic growth grab (public numbers only, zero login, zero deps).
 *
 *   node tools/grab-growth.mjs            → grab + print (dry run, nothing saved)
 *   node tools/grab-growth.mjs --save     → grab + save to the Growth tab (week = Sunday on/after today)
 *   node tools/grab-growth.mjs --save --week=2026-08-23
 *
 * What it can reach without a login (verified 2026-08-21):
 *   TikTok   followers (+likes, videos)   — public profile, needs a real browser render (headless Chrome)
 *   Spotify  monthly listeners            — public artist page, headless Chrome
 *   YouTube  subs (rounded, e.g. 8.38K) + exact total views — public channel page, plain fetch
 *   NetEase  fans (网易云 fansCnt)          — public JSON endpoint, plain fetch
 * Everything login-walled (views 7d, streams 28d, audience trio, 抖音/小红书/微博, IG) stays on
 * the Cowork-in-Chrome grab or the entry form. Merge semantics on the server mean this
 * script never wipes those columns — it only writes the fields it actually fetched.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const run = promisify(execFile);

const CFG = {
  exec: 'https://script.google.com/macros/s/AKfycbzBHACycNb4bteP8p9jW-894zG0-IGYZzJYsvRJ5koZ8BgwBHkU2UXFUC6VuFQBnnOl/exec',
  token: 'mosun-ar-2026-7Qx39kZ',
  tiktok: 'mosuntheartist',
  spotifyArtist: '76gcbuCZgpmlqrao6FkiKw',
  youtubeChannel: 'UCuv6XNA4PI4KmT6cauM3EbQ',
  neteaseArtist: 12645566,
  chrome: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
};

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));

function weekEnding(d = new Date()) {            // Sunday on or after today, local time
  const x = new Date(d); x.setDate(x.getDate() + (7 - x.getDay()) % 7);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
const num = s => s == null ? null : Number(String(s).replace(/,/g, ''));
const strip = html => html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ');

async function renderDom(url) {                   // headless Chrome, JS executed, DOM dumped
  const profile = mkdtempSync(join(tmpdir(), 'mosun-grab-'));   // isolated profile: parallel renders don't collide
  try {
    const { stdout } = await run(CFG.chrome, ['--headless', '--disable-gpu', '--dump-dom', '--virtual-time-budget=15000',
      '--window-size=1280,900', '--lang=en-US', `--user-agent=${CFG.ua}`, `--user-data-dir=${profile}`, url],
      { maxBuffer: 64 * 1024 * 1024, timeout: 90000 });
    return stdout;
  } finally { rmSync(profile, { recursive: true, force: true }); }
}
async function retry(fn, times = 3, waitMs = 4000) {   // bot walls are intermittent — try again before giving up
  let err;
  for (let i = 0; i < times; i++) {
    try { return await fn(); } catch (e) { err = e; if (i < times - 1) await new Promise(r => setTimeout(r, waitMs)); }
  }
  throw err;
}
async function fetchText(url, headers = {}) {
  const r = await fetch(url, { headers: { 'User-Agent': CFG.ua, 'Accept-Language': 'en', ...headers } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

const sources = {
  tiktok: () => retry(async () => {
    const html = await renderDom(`https://www.tiktok.com/@${CFG.tiktok}?lang=en`);
    const g = k => (html.match(new RegExp(`"${k}":(\\d+)`)) || [])[1];
    const followers = g('followerCount') || (strip(html).match(/([\d.,]+[KM]?)\s*Followers/) || [])[1];
    if (!followers) throw new Error('followerCount not in page (bot wall?)');
    return { ttFollowers: followers, _extra: { likes: g('heartCount'), videos: g('videoCount') } };
  }),
  spotify: () => retry(async () => {
    const txt = strip(await renderDom(`https://open.spotify.com/artist/${CFG.spotifyArtist}`));
    const m = txt.match(/([\d,.]+\s*[KM]?)\s*monthly listeners/i);
    if (!m) throw new Error('monthly listeners not rendered');
    return { spListeners: m[1].trim() };
  }),
  async youtube() {
    const html = await fetchText(`https://www.youtube.com/channel/${CFG.youtubeChannel}/about`, { Cookie: 'CONSENT=YES+cb; SOCS=CAI' });
    const subs = (html.match(/"subscriberCountText":"([\d.,]+[KM]?) subscribers"/) || [])[1];
    const views = (html.match(/"viewCountText":"([\d,]+) views"/) || [])[1];
    if (!subs && !views) throw new Error('channel stats not in page');
    return { ytSubs: subs, ytViews: views };
  },
  async netease() {
    const j = JSON.parse(await fetchText(`https://music.163.com/api/artist/follow/count/get?id=${CFG.neteaseArtist}`, { Referer: 'https://music.163.com/' }));
    if (j.code !== 200 || j.data?.fansCnt == null) throw new Error(`unexpected reply ${JSON.stringify(j).slice(0, 120)}`);
    return { neFans: String(j.data.fansCnt) };
  }
};

const week = args.week && args.week !== true ? args.week : weekEnding();
const fields = {}, report = [];
await Promise.all(Object.entries(sources).map(async ([name, fn]) => {
  try {
    const { _extra, ...got } = await fn();
    Object.assign(fields, got);
    report.push(`  ✓ ${name.padEnd(8)} ${Object.entries(got).map(([k, v]) => `${k}=${v}`).join('  ')}${_extra ? `  (${Object.entries(_extra).map(([k, v]) => `${k} ${v}`).join(', ')})` : ''}`);
  } catch (e) { report.push(`  ✗ ${name.padEnd(8)} ${e.message}`); }
}));
console.log(`Growth grab — week ending ${week}`);
console.log(report.sort().join('\n'));

const got = Object.keys(fields).filter(k => fields[k]);
if (!got.length) { console.error('nothing grabbed — not saving'); process.exit(1); }
if (!args.save) { console.log(`dry run — ${got.length} fields ready; add --save to write them`); process.exit(0); }

const q = new URLSearchParams({ action: 'growthSave', token: CFG.token, week, ...Object.fromEntries(got.map(k => [k, fields[k]])) });
const res = await (await fetch(`${CFG.exec}?${q}`, { redirect: 'follow' })).json();
if (!res.ok) { console.error('save failed:', res); process.exit(1); }
console.log(`saved → week ${res.week} (${res.updated ? 'updated' : 'new row'}): ${res.fields.join(', ')}`);
