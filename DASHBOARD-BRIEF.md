# Dashboard build brief — MOSUN A&R dashboard

A private dashboard that turns listener feedback into a track-ranking system — an upgrade to how singles get picked.

**How to use:** open this repo in VS Code, then in the Claude Code panel say:
*"Read DASHBOARD-BRIEF.md and build it — propose a plan first."*

---

## Goal

Aggregate listener responses per song, blend in my own scorecard, auto-rank the tracks, chart them, and export.

First read the existing code: `index.html` (the feedback form + its fields) and `apps-script/Code.gs` (backend bound to the "MOSUN Listener Feedback" Google Sheet). Propose a short plan before writing code.

## Data source — live via Apps Script

- Extend `apps-script/Code.gs` so the SAME web app can also RETURN responses as JSON without breaking the form. Branch on a query param: if `action=data`, return all rows as JSON and do **not** append a row; otherwise keep current behavior (append a form submission).
- Gate the read with a token: add a `READ_TOKEN` constant; the dashboard passes `?action=data&token=…` and the script rejects mismatches. (The token lives in the dashboard's client code — fine for this privacy level; it just stops casual hits.)
- Cross-origin reads from GitHub Pages can be blocked by CORS. If plain `fetch` is blocked from `mosun-tools.github.io`, implement JSONP (a `callback` param) or another approach that actually works, and **test it end to end**.
- After editing `Code.gs`, the human must redeploy the Apps Script as a **new version** for changes to go live. Remind me with the exact path (**Deploy → Manage deployments → ✏️ → New version → Deploy**) and pause until I confirm — editing code alone does nothing until redeployed.

## Self-filter scorecard — my own ratings

- A panel to score each song on editable criteria with weights. Start with: **Hook, Production, Lyrics/topline, Replay value, Originality, Gut feel** — each 1–5, each with an adjustable weight. Let me add/rename/remove criteria and change weights in the UI.
- Persist scores so they survive reloads and sync across devices: write them to a separate **"Self-Filter" tab** in the same Sheet via a write action in the Apps Script. Fall back to `localStorage` only if that isn't feasible.

## Ranking — the "MOSUN Score"

Per song, compute and clearly show:

- **Listener score (0–100):** weighted blend of avg Hook (1–5), playlist-add rate (Yes=1, Maybe=0.5), share intent, reaction quality (Fire=5, Vibing=4, Meh=2, Confused=2, Skip=1), memorability ("can you hum it" Yes-rate), minus a "weak parts" penalty. Show response count **n** per song and flag low-sample tracks.
- **Self score (0–100)** from my scorecard.
- **Final MOSUN Score** = configurable blend (default **60% listener / 40% self**) with an editable slider. Auto-rank descending.

## Charts

- Ranked bar chart of tracks by MOSUN Score.
- Per-track breakdown (radar or grouped bars) of the sub-metrics when I click a song.
- Chart.js from CDN is fine; keep everything else inline.

## Export

- Ranked table → CSV, plus a clean print-to-PDF view (`window.print` + print CSS). JSON export is a bonus.

## Design & files

- New file, **unlisted**: name it with a random suffix (e.g. `dashboard-<random>.html`) so it's not guessable, and do **not** link it from `index.html`.
- Follow **BRAND.md** (the canonical MOSUN kit) — read it first. Default **dark**: ink `#000000` ground, warm cream `#E8E6D9` text, **saffron `#F6A25C`** as the single accent used sparingly (never body text). Titles in Prospec (ALL CAPS, wide tracking); body/UI/labels in Futura (fallback stack in BRAND.md); Cormorant Garamond italic for any pull-quote. Cards `14px`, no green, no Instrument Sans. (`index.html` still uses the old placeholder look — it's being migrated, so match BRAND.md, not index.html.)
- Responsive (phone + desktop). Do **not** change the public form's behavior in `index.html`.

## Workflow

Work in steps with diffs to approve. Implement the backend change, then the dashboard, testing against live data. When it works, commit with a clear message and push (GitHub Pages serves the front-end; remind me to redeploy the Apps Script for the backend).
