# MOSUN Self-Rating tool (build brief)

Rate my OWN songs through my real filter — gates + scored — get a self-score and a
ready / not-ready verdict, and feed it into the A&R dashboard's blended MOSUN Score.

**How to use:** in Claude Code say
*"Read SELF-RATING-BRIEF.md and build it — propose a plan first."*

## Read first / reuse
- `BRAND.md` + `theme.css` (dark, ink/cream/saffron, Prospec titles, Futura body).
- `apps-script/Code.gs` — the **Self-Filter store** + `action=save` / `action=data` (token-gated). Write self-ratings there so the dashboard consumes them.
- `dashboard-k7m2x9.html` — keep the data shape compatible so the self side of the MOSUN Score reads these ratings (this tool becomes the single source of truth for self-ratings; don't leave two competing scorecards).

## What it is
A single self-contained HTML page in this repo (unlisted, random-suffix filename, e.g. `rate-<rand>.html`). Chrome. Machine-light. On-brand.

## The filter — use EXACTLY this (it's mine, locked)

**GATES — pass/fail. Fail one → the song is flagged "NOT READY," no matter the scores:**
- **Body moment** — a spot that gives goosebumps, a tear, or makes me bop. Every time.
- **Core message** — I can say what it's about in one sentence; it says something.
- **Honesty** — it comes from something real, not a performance of the idea.
- **Conviction** — I'd still put my name on it in five years.

**SCORED 1–5 (show the sub-questions as guidance; I give one score per dimension):**
- **Vision** — Can I see its world (video, cover, color)? Do I know why it exists?
- **Only-me (not generic)** — Could only I have made it? Where's the fingerprint? Strip my name off — would someone still know it's mine? One choice no one else would make?
- **Message & lyric** — Does the lyric say something true, or just rhyme? A line someone would screenshot? Does the production serve the message?
- **Brand & visual fit** — Does it live in the MOSUN world (after-dark, cinematic)? Does it move the album story forward? Does it fit where I'm going?
- **Replay / pull** — Want to replay it instantly? Hum it unprompted? Could I perform it (falsetto, swell)?

## Per song
- Enter/select a song title.
- 4 **gate toggles** (pass/fail).
- 5 **score sliders** (1–5), each with its sub-questions shown as helper text.
- Compute **Self-Score** = average of the 5 dimensions (→ 0–100). If any gate fails → big **NOT READY** flag (still show the score, but mark it).
- Optional note.
- **Save** → write to the Self-Filter store via the existing `action=save` (READ_TOKEN, `key` = song title, `value` = JSON `{gates, scores, selfScore, status, ratedAt}`). Same store the dashboard reads → it feeds the blended MOSUN Score.

## UX — one question at a time, game-like (but on-brand)
NOT a form — a **guided single-question flow**, like a sleek game level. Keep it cinematic and premium (this is MOSUN, not an arcade): use the brand's motion language — slow exponential ease-out `cubic-bezier(0.16,1,0.3,1)` (900–1600ms), saffron glow blooms, scatter-to-assemble text reveals. **No bouncy springs, no childish UI, no emoji.** Honor `prefers-reduced-motion`.

Flow:
- **Start screen:** enter the song title → a saffron **BEGIN** pill that transitions into the run.
- **One question per screen**, full focus, big Prospec type for the question. Advance by click **or keyboard** (Enter / arrows / number keys).
- **Progress** shown subtly — a row of 9 dots or a thin saffron bar (4 gates + 5 scores) filling as you go.
- **Gates** = a dramatic two-choice (**PASS / FAIL**) with a saffron-glow confirm. If a gate FAILS, a quiet "not ready" beat — but let me finish the run.
- **Scores** = a tactile **1–5** selector (number keys or drag), the sub-questions fading in as guidance.
- **Transitions:** the current question scatters/dissolves, the next assembles in.
- **Final reveal:** an animated **Self-Score** count-up + a cinematic **READY / NOT READY** verdict (saffron bloom for READY, restrained for not), then **Save**.
- Optional soft tick/confirm sound, default muted.

Then a **library view** of rated songs (status + self-score); click any to re-run or edit.

## Honest notes
- Gates are non-negotiable; the score is my read, not a formula's. Sub-questions guide the score.
- One score per dimension (not per sub-question) to keep it fast.

## Workflow
Plan first. Build; update the dashboard's self side to read these ratings so there's one source of truth. Test by rating 1–2 songs → confirm it saves to the Self-Filter sheet and the dashboard reflects it. Don't push until I confirm; then commit + give me the unlisted Pages link. Don't touch `index.html` or the feedback form.
