# Stage 1 — MOSUN Footage Catalog (build brief)

The searchable footage library that the script-to-video system depends on. Makes my
clips findable so a later script-parser can pull the right footage automatically.

**How to use:** in Claude Code, open this repo and say
*"Read FOOTAGE-CATALOG-BRIEF.md and build it — propose a plan first."*

First read **BRAND.md** and **theme.css** and match the brand (dark, ink/cream/saffron, Futura body, Prospec titles in ALL CAPS). Then plan before coding.

## What it is
A single-page tool that opens my local **"MOSUN Footage"** folder (a plain local folder I drop clips into: `~/Desktop/MOSUN Footage`), lists every video, lets me tag each one fast, and saves a `catalog.json` index **inside that folder**. All footage and the catalog stay 100% local — nothing uploads.

## Tech
- Use the **File System Access API** (`showDirectoryPicker`) to read the chosen folder and write `catalog.json` back. It needs a secure context, so **host it as a new UNLISTED page in this repo** (random-suffix filename, e.g. `catalog-<rand>.html`, not linked from anywhere) — GitHub Pages gives the https FSA needs. Chrome only (FSA limitation) — that's fine.
- Single self-contained HTML; `<link>` `theme.css` for brand tokens/fonts. Vanilla JS only.
- Store the folder handle in **IndexedDB** so I don't re-pick each visit.
- Machine-light: only list files and play `<video>` previews — **never transcode or render.**

## Features
- "Open footage folder" → remembers it. Enumerate video files (`.mp4 .mov .m4v`).
- Each clip = a card: thumbnail (poster frame via `<video>` + `<canvas>`, seek ~1s), filename, duration; click to preview-play.
- **Fast tagging:** multi-select chip groups for `setting`, `time`, `action`, `shot`, optional `mood`; a `song/project` text field; free `notes`. Big tap targets, number-key shortcuts per chip, and **auto-advance to the next untagged clip** after save.
- An **"untagged" queue** + live count, so newly dropped clips surface for tagging.
- **Search/filter** by any tag combination; results as a grid.
- Auto-save writes `catalog.json` into the footage folder (debounced); reload restores everything.

## Starter tag taxonomy (put it in an editable config near the top)
- **setting:** studio, street, home, rooftop, cafe, nature, transit, stage, gear-closeup
- **time:** day, golden-hour, blue-hour, night, indoor
- **action:** walking, performing, instrument, hands-on-gear, talk-to-cam, ambient, notebook, reaction
- **shot:** wide, medium, close, extreme-close, low-angle, high-angle, POV, static, handheld
- **mood:** moody, warm, energetic, calm, cinematic

## catalog.json schema (the CONTRACT the Stage-2 parser reads — keep it stable)
```json
{ "version": 1, "updated": "<ISO>", "clips": [
  { "id": "<stable id>", "file": "<filename>", "duration": 0, "addedAt": "<ISO>",
    "tagged": true, "source": "manual",
    "tags": { "setting": [], "time": [], "action": [], "shot": [], "mood": [] },
    "song": "", "notes": "" }
]}
```

## AI-ready (don't build now — just leave room)
Structure so an AI auto-tagger can later pre-fill the same `tags` fields and set `source: "ai"` for me to confirm/override.

## Workflow
Plan first. Build, then test by pointing it at a folder with 2–3 sample clips: confirm tag → auto-save → `catalog.json` written → reload persists. Then commit and push to the unlisted Pages URL and give me the link. **Don't touch `index.html` or the feedback form.**
