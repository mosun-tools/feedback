# MOSUN Ink-Bloom background (build brief)

A living, full-bleed **saffron ink-bloom** background — inspired by a macro ink-in-water reel
(glowing core, symmetric burst, filament tendrils, fluid cosmic motion) but **recolored fully to
MOSUN** (drop the rainbow). Built as a **reusable, drop-in module** so it can sit behind the fan
listening page, and later the form / self-rating tool — without touching anything live yet.

**How to use:** in Claude Code say
*"Read INK-BLOOM-BRIEF.md and build it — propose a plan first."*

## Read first / reuse
- `BRAND.md` + `theme.css` — palette + tokens. **Saffron is the only bright accent.**
- Build a NEW standalone demo file `ink-bloom-<rand>.html` in this repo. **Do NOT touch `index.html` / the live form** — we wire it in later, after I approve the look.

## The look (recolored — NOT the rainbow reference)
On pure black `#000`:
- A luminous **saffron-gold core** near center — small near-white hot center `#FFF6E8` → saffron `#F6A25C` → amber `#D8823A`.
- Radiating outward through **oxblood `#7E0101`** and a **restrained deep violet** (e.g. `#3B1530`, a depth note only) → into black.
- Soft **concentric pressure waves** + fine **filament tendrils** (the hair-like ink strands).
- **Granular** film-grain texture over everything; strong backlit halo glow.
- **Very slow** breathing/drift — a backdrop, not a light show.

Saffron stays dominant; violet is a *subtle* mid-outer depth note (make it dialable 0→1, default low). If in doubt, lean saffron→oxblood→black.

## Technique — WebGL fragment shader (raw, no Three.js)
- One full-screen quad. Fragment shader does the work.
- **fbm + domain warping** for the fluid/cloud structure; warped noise for filament detail.
- A slowly-drifting **center**; radial distance drives the **palette ramp** + glow falloff.
- **Additive glow** at the core; smooth color ramp by radius × noise.
- **Grain:** animated hash noise added per pixel, low amplitude.
- A single `time` uniform drives slow evolution.

## Performance (it runs on FANS' phones — non-negotiable)
- Render to a **downscaled buffer** — cap backing resolution (~1280px long edge; 0.5–0.75× CSS res is fine, the look is soft) and **cap `devicePixelRatio`**. Upscale via CSS; softness hides it.
- **Cap ~30fps** (time-throttled rAF).
- **Pause** when `document.hidden` (visibilitychange) **and** when the canvas is off-screen (IntersectionObserver).
- **Feature-detect WebGL**; none → CSS fallback.
- `prefers-reduced-motion: reduce` → render **one static frame** (or CSS fallback), no animation.

## Auto fallback — CSS only (bulletproof on any phone)
- Layered `radial-gradient`s: saffron core → oxblood mid-ring → black, plus a faint offset violet blob.
- Grain overlay (SVG `feTurbulence` or a tiny tiled data-URI) at low opacity.
- A very slow CSS keyframe drift/scale — **disabled under reduced-motion** (fully static).

## Reusable contract (so it drops into other pages)
- Expose `initInkBloom(canvasEl, options)` → returns a handle with `.destroy()`.
- `options`: `{ intensity, violet (0..1), speed, maxResolution, fps }` — sensible on-brand defaults.
- Keep the whole background as **one clearly-commented block** (one `<canvas>`, one `<style>`, one `<script>`) that lifts out cleanly.
- **Demo page:** black page, canvas fixed full-bleed **behind** a sample of cream **Prospec** headline + **Futura** body + a mock saffron **PRESS PLAY** pill — so I can judge **legibility**. Keep a subtle dark vignette/overlay behind text.
- **Test hooks:** `?mode=css` (force fallback), `?still=1` (force static frame) so we can compare shader vs fallback fast.

## Brand guardrails (non-negotiable)
Ink `#000` ground, warm cream text, **saffron the only bright accent**; oxblood/violet only as depth. No rainbow, no bright purple/blue/magenta, no neon. Motion slow + premium — "an ember breathing in the dark," not a screensaver.

## Workflow
Plan first. Build the standalone demo. Test: phone-sized viewport, toggle `?mode=css` and `?still=1`, confirm it **pauses off-screen / when hidden** and respects reduced-motion. **Don't push until I approve the look.** Then we lift the module into the listening page (`LISTENING-SESSION-BRIEF.md` already specs it as the ground layer), and optionally the form.
