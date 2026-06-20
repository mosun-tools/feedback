# Stage 2.1 — Pre-cut with handles (enhancement brief)

Extend the existing **Assemble** tool so each exported package contains clips already
trimmed to their script-beat timing, **with padding handles** so they stay fully editable
in CapCut. Result: I open the package, drag the clips into CapCut already ~aligned, import
the SRT, add music, and just tweak.

**How to use:** in Claude Code say
*"Read PRECUT-HANDLES-BRIEF.md and build it — propose a plan first."*

## Read first (extend, don't rebuild)
- `SCRIPT-TO-PACKAGE-BRIEF.md` + the current tool `assemble-rovoe1.html` — this is an enhancement to it.
- `BRAND.md` + `theme.css` — keep the brand.

## New in the review UI
- Per beat, a **scrubber on the chosen clip** to set the **in-point** (which moment of the source the beat starts on). Default = clip start. Show the beat duration (from the script `[tStart-tEnd]`).
- A global **Handle** control (default **1.5s**) — padding added before AND after each beat segment, **clamped to the clip's bounds** (never < 0 or > clip length).

## New on export — a pre-cut, still-editable package
Produce the package + a **`build.command`** (double-clickable macOS script) + a **`cuts.json`** manifest. I double-click `build.command` once; it runs **ffmpeg** locally to create the trimmed clips.

- Each output = source trimmed to **[in − handle, in + duration + handle]**, clamped, **re-encoded to H.264 MP4** (frame-accurate + CapCut-friendly; use `h264_videotoolbox` hardware encoding for speed). Named `01_<beat-slug>.mp4`, `02_…` in script order.
- `build.command` checks for ffmpeg first; if missing, prints the one-line `brew install ffmpeg` and exits cleanly (don't fail cryptically).
- Keep `captions.srt` (timed to the script), `MUSIC.txt`, `TO-FILM.md`.
- Update `shotlist.md` to show per clip: source, in-point, beat duration, handle, and the **clean trim marks** — i.e. where the exact beat in/out sit *inside* the handled clip — so I know exactly where to trim to in CapCut.
- Optional `--preview` flag in `build.command` that also renders a flat `preview.mp4` (beat-exact segments concatenated + burned captions + music) just to eyeball. **Off by default.**

## Honest constraints to honor
- **Short clips only** — these ffmpeg trims are light and fast; this is NOT a heavy render pipeline.
- **Clamp handles** so they never exceed the source clip's start/end.
- **Missing source clips** → list in `TO-FILM.md`, skip them in `build.command` (don't crash).
- **Keep the existing full-clip export** as a toggle — pre-cut is the new default, full-clip stays available.
- ffmpeg is a one-time light install; the script guides me if it's not there.

## Workflow
Plan first. Extend the tool; add a **Node test** for the cut math (in/out/handle clamping, slugging, shotlist marks) and a Node dry-run of the `build.command` logic against the real catalog with a synthetic beat list. Then hand me the in-browser test (set in-points → export → double-click `build.command` → confirm pre-cut handled clips land, drag into CapCut). **Don't push until I confirm.** Don't touch `index.html` or the feedback form.
