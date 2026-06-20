# Stage 2 — Script → CapCut-ready package (build brief)

Feed in one video's script → parse it into a timed shot list → match each beat to clips
from the Stage-1 catalog → let me review/swap → export a **CapCut-ready project folder**.
The output is an ~80% assembly I finish in CapCut. **No rendering** — this stays light.

**How to use:** in Claude Code, open this repo and say
*"Read SCRIPT-TO-PACKAGE-BRIEF.md and build it — propose a plan first."*

## Reuse what Stage 1 already built (read these first)
- **`FOOTAGE-CATALOG-BRIEF.md`** + the live catalog (`catalog-q2wln8.html`) — same `catalog.json` schema, same File System Access API approach, and the **same in-browser Claude API-key pattern** the AI-tagger uses (reuse the stored key; don't re-prompt if present).
- **`BRAND.md` + `theme.css`** — match the brand (dark, ink/cream/saffron, Futura body, Prospec ALL-CAPS titles).

## What it is
A single self-contained HTML page in this repo (unlisted, random-suffix filename, e.g. `assemble-<rand>.html`). Chrome only (File System Access API). Machine-light — never transcodes; only copies short clips.

## Flow
1. **Paste the script** (the MOSUN weekly-TikTok format — shot-by-shot with `[0-2s]` timestamps, camera/action, "where", text overlays, and a sound recommendation). Also allow loading a `.txt`/`.md`.
2. **Parse with Claude** (browser key) into a structured beat list:
   `{ index, tStart, tEnd, action, setting, time, shot, mood, onScreenText, audioCue, needDescription }`
3. **Match each beat to the catalog** (`catalog.json` from the chosen footage folder): score clips by tag overlap (setting/time/action/shot/mood), then an optional Claude semantic re-rank on the beat's `needDescription`. Show the **top 3 candidates per beat** (thumbnails). If nothing clears a threshold → mark the beat **"TO FILM."**
4. **Review UI:** a vertical list of beats in script order; each shows the chosen clip thumbnail, the on-screen text, the audio cue, and a **swap dropdown** of alternates. A separate **"Gaps to film"** panel collects the TO-FILM beats.
5. **Export the package** to a project folder (let me pick; default `~/Desktop/MOSUN Projects/<date>__<slug>/`):
   - **Ordered clips** copied in, named `01_<beat-slug>.mp4`, `02_…` in script order. (Skip the copy for any source file > ~300 MB — reference it by path instead and note it; these are short social clips so copying is normally fine.)
   - **`shotlist.md`** — a table: `# | time | clip file | on-screen text | audio / notes`.
   - **`captions.srt`** — the text overlays, timed to the script (CapCut imports SRT).
   - **`MUSIC.txt`** — the script's sound recommendation + any timing notes.
   - **`TO-FILM.md`** — every gap beat with what to shoot (use the script's "where/action").

## Honest UX rules (this is an assistant, not magic)
- **Always show the matches for review and let me swap** — never silently trust a match.
- **Flag gaps loudly** — a missing clip is a "film this," not a wrong guess buried in the timeline.
- Show a per-video summary: X beats matched, Y to film, total runtime vs script length.

## Workflow
Plan first. Build, then test: paste one sample script, point at my footage folder + `catalog.json`, show the review UI, and export a sample package into a temp folder (confirm `shotlist.md`, `captions.srt`, `MUSIC.txt`, ordered clips, `TO-FILM.md` all appear correctly). **Don't push until I confirm it works**; then commit and give me the unlisted Pages link. **Don't touch `index.html` or the feedback form.**
