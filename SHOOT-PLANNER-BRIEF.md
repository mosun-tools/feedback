# MOSUN Shoot-Day Planner (build brief)

Turn a whole week of TikTok scripts (multiple videos) into **one batched shoot-day plan** —
so I film everything in a day, grouped by **location, light, and look**, instead of
video-by-video. Pure planning: text only, no video, machine-light.

**How to use:** in Claude Code say
*"Read SHOOT-PLANNER-BRIEF.md and build it — propose a plan first."*

## Read first / reuse
- The weekly script format (shot-by-shot: `[0-2s]` timecodes, framing, action, the Taipei "where," text overlays, sound). Examples live in `~/Desktop/Cowork/MOSUN_Weekly_TikTok_Scripts_*.pdf`.
- `BRAND.md` + `theme.css` (dark, ink/cream/saffron, Prospec titles, Futura body).
- The **browser Claude API-key pattern** from the Assemble tool (reuse the stored key; don't re-prompt).

## What it is
A single self-contained HTML page in this repo (unlisted, random-suffix filename). Chrome. No File System Access needed — input is paste or file-drop.

## Input
- **Paste** the week's scripts as text, **or drop the weekly PDF** (use pdf.js to extract text). Then Claude parses (browser key) into structured shots.

## Per shot, extract
`{ day, post, beat#, duration, location, timeOfDay/light, framing, action, wardrobe (inferred, editable), props (inferred), onScreenText, audioCue }`

## Cluster for batch shooting
- **Primary group: location/setting** (studio apartment, Taipei street, rooftop, café, transit, stage, gear-closeup) — shoot everything at one place together.
- **Time-of-day / light as a scheduling constraint:** golden-hour shots scheduled at golden hour, night at night, daytime/indoor flexible.
- **Secondary: wardrobe/look** (batch by outfit) and **camera setup** (tripod/handheld, angle).
- Let me **re-prioritize** the grouping order (location-first vs light-first vs outfit-first).

## Output — a shoot-day call sheet
- Ordered **blocks**, e.g. `GOLDEN HOUR · Taipei street` → the shots from across the week that fit, each with a **suggested time window** for light-bound blocks.
- Each shot row: **source (Day / Post)**, action + framing, wardrobe, props, on-screen text (reference), and a **checkbox**.
- **Summary header:** total shots · # locations · # outfits · golden-hour vs night counts · rough time estimate.
- **Wardrobe & props master list** (dress/pack once).
- **Printable** (`window.print` + print CSS), brand-styled, so I carry it on the shoot. Optional `.md`/CSV download.
- Drag-to-reorder blocks/shots (nice-to-have).

## Honest notes
- Wardrobe/props are **inferred** from the script vibe and editable — scripts don't always state them.
- Light-bound blocks are constraints, not suggestions — flag them and note the day's Taipei golden-hour window.

## Workflow
Plan first. Build; test by parsing a real weekly PDF from `~/Desktop/Cowork` (e.g. `MOSUN_Weekly_TikTok_Scripts_Jun8-14_2026.pdf`) → show the batched call sheet → print preview. Don't push until I confirm. Don't touch `index.html` or the feedback form.
