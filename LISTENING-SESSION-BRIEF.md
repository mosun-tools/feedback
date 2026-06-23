# MOSUN Fan Listening-Session (build brief)

Upgrade the fan feedback experience: I attach a specific unreleased demo to a link, the
fan opens it, the song **plays right on the page (listen-only via a DISCO embed)**, and
they give feedback in a **fun, one-question-at-a-time game UI**. Feedback lands in the
existing Responses sheet, tagged with the song — so the dashboard still works.

**How to use:** in Claude Code say
*"Read LISTENING-SESSION-BRIEF.md and build it — propose a plan first."*

## Read first / reuse
- `index.html` — the current form's question fields + the `SCRIPT_URL` submit. **Do NOT break the live form** — build this as a NEW page (e.g. `listen-<rand>.html`).
- `apps-script/Code.gs` — submissions still `doGet` + URL params (the gotcha) → the **Responses** sheet.
- `BRAND.md` + `theme.css` — brand. **Mobile-first** (fans open on phones).

## Audio = DISCO embed (listen-only)
- The song plays via **DISCO's embeddable player** (iframe). In DISCO: Track → Share → **Embed** → **Customize player → uncheck "Enable downloads"** (streaming-only) → copy the embed code.
- The feedback page hosts that iframe as the centerpiece. DISCO handles streaming + no-download + link security; we don't host any audio ourselves.

## Attach a song / make a link
- A small **"create link"** step (e.g. a builder view on the page) where I paste: **song title**, the **DISCO embed URL/iframe**, optional cover, optional note → it outputs a **shareable fan link** with an **unguessable token** (params encoded in the URL/hash).
- Opening that link launches the listening-session experience for that track.

## Look & interaction reference — silviasguotti.design, in MOSUN's brand
Match the *feel* of that site (high-end, cinematic, smooth, type-forward) but entirely in MOSUN's world (ink/cream/saffron, Prospec/Futura). Reproduce this interaction DNA:
- **Animated preloader:** a centered **LOADING 00→100%** count-up on ink black (saffron number) before the experience reveals.
- **Inertia / smooth scroll** (Lenis-style) — weighty and smooth; the session is a vertical scroll-journey through **full-bleed, viewport-height sections**, not a clicky form.
- **Custom cursor** (desktop): a small circle that grows on hover and is **magnetically pulled** toward buttons. Mobile = normal touch.
- **Scroll-reveal type:** big editorial headlines animate in word/line-by-line on enter, with **mixed-weight emphasis** (one bold word in a light line — your Prospec moments).
- **Marquee band:** a slow horizontal repeating strip (the song title, or *listen • feel • tell me*) as texture between beats.
- **Magnetic CTAs:** PRESS PLAY / advance buttons pull toward the cursor and bloom saffron on hover.
- **Tech:** Lenis (smooth scroll) + GSAP ScrollTrigger (reveals) from CDN; self-contained and performant — **no heavy WebGL** (fans' phones + my machine stay light). Honor `prefers-reduced-motion`; on mobile swap smooth-scroll/cursor for tasteful native scroll + the tactile taps below.

## Fan experience — a GAME, scroll-driven (unmistakably MOSUN)
A smooth, scroll-driven cinematic journey: each feedback step is its own **full-bleed section** you scroll into (like the reference's numbered sections), carrying real game juice. Think "a short journey through the night," not a form.

**Framing & core loop**
- **Title card:** the cover + song title assemble from scattered letters; a single saffron **PRESS PLAY** pill — a game start screen.
- **The song is the world:** while it plays (DISCO embed, downloads off), the screen is alive — warm sand particles drift left→right, a low saffron glow breathes, the ink background shifts subtly. Listening *is* the ambience. Soft-unlock the questions once the track starts.
- **Sun-as-progress:** instead of a plain bar, a half-disc **sun rises across the horizon** as they advance (dusk → sunrise) — ties to the brand lens-flare motif. That's the level meter.

**Each question = a "beat" (one at a time, juicy)**
- **Reactions** (🔥/😌/😑/😕/⏭️): big tactile targets; on tap → a saffron bloom/ripple from the touch point, a soft confirm tick, and a phone haptic (`navigator.vibrate`).
- **Hook 1–5:** a saffron **meter you "charge"** by tapping/dragging up (power-bar feel), not radio buttons.
- Playlist / share / weak (+where) / hum / comments: each enters via scatter-to-assemble as you **scroll into its section**, leaves as a dissolve. Scroll (smooth/inertia) between beats on desktop; swipe on mobile. The **sun-as-progress rises with scroll**.

**Juice & reward (restrained, on-brand)**
- Every choice fires a small, tasteful animation — glow bloom, particle puff, next beat assembling. Slow exponential ease — **no cartoon bounce, no arcade colors, no emoji in the chrome** (the reaction faces are content, fine).
- Optional soft sound + haptics, default on, mutable; honor `prefers-reduced-motion`.
- **End payoff:** finishing feels like clearing a level — the sun crests into a saffron **sunrise bloom**, a warm thank-you, and a small **insider reward** (a handwritten-style note from MOSUN and/or a hidden lyric line revealed — "you helped shape this"). Rewards completion.

**Brand guardrails (non-negotiable):** ink `#000` ground, warm cream text, **saffron the only accent**; Prospec ALL-CAPS for big moments, Futura for body. Dark, moody, premium — "a game that feels like 3am," not Candy Crush.

**Submit:** on finish → existing backend via `doGet` + URL params; set **Song = the attached track title** from the link, so responses flow to the same Responses sheet and the dashboard/analytics keep working.

## Protection (honest)
DISCO listen-only embed (downloads off) + an unguessable fan link. Note: no web playback is fully download-proof (audio must reach the browser to play) — this deters the realistic case, which is the bar you set.

## Workflow
Plan first. Build the new page + the create-link builder. Test: make a link with a sample DISCO embed (or placeholder), walk the full fan flow on a phone-sized viewport, and confirm a submission lands in the Responses sheet tagged with the song. Don't push until I confirm; then commit + give me the unlisted link. **Leave `index.html` (the live form) working.**
