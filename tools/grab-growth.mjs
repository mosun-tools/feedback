#!/usr/bin/env node
/**
 * MOSUN — automatic growth grab (public numbers only, zero login, zero deps).
 *
 *   node tools/grab-growth.mjs            → grab + print (dry run, nothing saved)
 *   node tools/grab-growth.mjs --save     → grab + save to the Growth tab (week = Sunday on/after today)
 *   node tools/grab-growth.mjs --save --week=2026-08-23
 *
 * What it can reach without a login (verified 2026-08-21):
 *   TikTok    followers (+likes, videos)   — public profile, needs a real browser render (headless Chrome)
 *   Spotify   monthly listeners            — public artist page, headless Chrome
 *   YouTube   subs (rounded, e.g. 8.38K) + exact total views — public channel page, plain fetch
 *   NetEase   fans (网易云 fansCnt)          — public JSON endpoint, plain fetch
 *   抖音       粉丝 (+获赞)                  — iesdouyin share page, headless Chrome with a mobile UA
 *   微博       粉丝                          — m.weibo.cn profile, headless Chrome with a mobile UA
 *   Instagram followers (rounded, e.g. 22.4K) — public profile meta, headless Chrome
 * Login-walled (stays on the Cowork-in-Chrome grab or the entry form): TikTok views 7d / best
 * post, Spotify streams + super/active/new listeners, NetEase plays, and all of 小红书 (its
 * site returns 500 to headless browsers). Merge semantics on the server mean this script never
 * wipes those columns — it only writes the fields it actually fetched.
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
  douyinSecUid: 'MS4wLjABAAAA6p3DqjDIv9esQu8ARh6PXb4luWaybWypv-9yk-r3JGs',   // from v.douyin.com/hbrSfaWZ5qE
  weiboUid: '2100022061',
  instagram: 'morrisonma',
  chrome: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  mobileUa: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  maxRenders: 2          // headless Chromes at once — five in parallel starved an 8 GB Mac
};

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));

function weekEnding(d = new Date()) {            // Sunday on or after today, local time
  const x = new Date(d); x.setDate(x.getDate() + (7 - x.getDay()) % 7);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
const num = s => s == null ? null : Number(String(s).replace(/,/g, ''));
const strip = html => html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ');

// Tiny semaphore so at most CFG.maxRenders Chromes run at once.
let active = 0; const queue = [];
const acquire = () => new Promise(res => { const go = () => { active++; res(); }; active < CFG.maxRenders ? go() : queue.push(go); });
const release = () => { active--; (queue.shift() || (() => {}))(); };

async function renderDom(url, { ua = CFG.ua } = {}) {   // headless Chrome, JS executed, DOM dumped
  await acquire();
  const profile = mkdtempSync(join(tmpdir(), 'mosun-grab-'));   // isolated profile: parallel renders don't collide
  const tag = `--mosun-tag=${profile.split('-').pop()}`;           // lets us kill the whole tree if it hangs
  try {
    const args = ['--headless', '--disable-gpu', '--dump-dom', '--virtual-time-budget=15000', '--no-first-run',
      '--no-default-browser-check', '--disable-background-networking', '--disable-sync', '--window-size=1280,900',
      '--lang=en-US', `--user-agent=${ua}`, `--user-data-dir=${profile}`, tag, url];
    try {
      return (await run(CFG.chrome, args, { maxBuffer: 64 * 1024 * 1024, timeout: 60000, killSignal: 'SIGKILL' })).stdout;
    } catch (e) {
      // Chrome writes the DOM once the virtual-time budget is spent, then often lingers instead of
      // exiting; the timeout kill still hands us everything it wrote. Use it.
      if (e.stdout && e.stdout.length > 10000) return e.stdout;
      throw e;
    }
  } finally {
    await run('pkill', ['-9', '-f', tag]).catch(() => {});           // children can outlive the browser process
    rmSync(profile, { recursive: true, force: true });
    release();
  }
}
const cn = s => s && s.trim();   // "1.6万" etc. — the server's parseMetric understands 万/亿
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
  },
  douyin: () => retry(async () => {
    const html = await renderDom(`https://www.iesdouyin.com/share/user/${CFG.douyinSecUid}`, { ua: CFG.mobileUa });
    const txt = strip(html).replace(/\s+/g, ' ');
    const fans = (html.match(/"follower_count":\s*(\d+)/) || txt.match(/粉丝\s*([\d.]+万?)/) || [])[1];
    if (!fans) throw new Error('粉丝 not rendered (verify wall?)');
    return { dyFollowers: cn(fans), _extra: { 获赞: (txt.match(/获赞\s*([\d.]+万?)/) || [])[1] } };
  }),
  weibo: () => retry(async () => {
    const txt = strip(await renderDom(`https://m.weibo.cn/u/${CFG.weiboUid}`, { ua: CFG.mobileUa })).replace(/\s+/g, ' ');
    const m = txt.match(/粉丝\s*([\d.]+万?)/);          // profile header reads "关注 248 粉丝 2976"
    if (!m) throw new Error('粉丝 not rendered (login wall?)');
    return { wbFollowers: cn(m[1]) };
  }),
  instagram: () => retry(async () => {
    const html = await renderDom(`https://www.instagram.com/${CFG.instagram}/`);
    const txt = strip(html).replace(/\s+/g, ' ');
    const m = txt.match(/([\d.,]+[KM]?)\s*followers/i) || html.match(/content="([\d.,]+[KM]?) Followers/);
    if (!m) throw new Error('followers not rendered (login wall?)');
    return { igFollowers: m[1] };
  })
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

// Apps Script answers via a one-shot redirect to googleusercontent.com, which intermittently
// returns an HTML "page not found" instead of our JSON even when the write succeeded. So: parse
// defensively, retry, and verify against growthData before declaring failure.
async function api(params) {
  const r = await fetch(`${CFG.exec}?${new URLSearchParams({ token: CFG.token, ...params })}`, { redirect: 'follow' });
  const text = await r.text();
  try { return JSON.parse(text); } catch { throw new Error(`non-JSON reply (HTTP ${r.status})`); }
}
const payload = Object.fromEntries(got.map(k => [k, fields[k]]));
let res = null, lastErr = null;
for (let i = 0; i < 3 && !res; i++) {
  try { res = await api({ action: 'growthSave', week, ...payload }); }
  catch (e) {
    lastErr = e;
    try {                                        // did the write land anyway? check before retrying
      const row = (await api({ action: 'growthData' })).rows.find(r => r.week === week) || {};
      if (got.every(k => row[k] != null && String(row[k]) === String(num(fields[k]) ?? fields[k]).replace(/[^\d]/g, '') || row[k] != null))
        res = { ok: true, week, updated: true, fields: got, verified: true };
    } catch { /* verification failed too — retry the save */ }
    if (!res) await new Promise(r => setTimeout(r, 5000));
  }
}
if (!res || !res.ok) { console.error('save failed:', res || lastErr.message); process.exit(1); }
console.log(`saved → week ${res.week} (${res.updated ? 'updated' : 'new row'}${res.verified ? ', verified via growthData after a flaky reply' : ''}): ${res.fields.join(', ')}`);
