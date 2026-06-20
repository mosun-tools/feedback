# MOSUN — Brand / Design System (canonical)

The single source of truth for MOSUN's visual language. Every tool, page, deck, and
video caption pulls from here. Default theme is **dark** (ink ground, cream text).

> Editorial, after-dark aesthetic for a Lagos-born, London-based artist. Warm, moody,
> premium — golden-hour light against deep black. Never corporate.

---

## Colors (exact hex)

| Token | Hex | Use |
|---|---|---|
| Ink black | `#000000` | primary background / surface |
| Warm cream | `#E8E6D9` | primary foreground / text on ink |
| Saffron | `#F6A25C` | the ONE signature accent — CTAs, highlights, one word in a headline, divider dots. Sparingly. **Never body text or icons.** |
| Oxblood | `#7E0101` | supporting deep red (imagery, restrained status) |
| Forest | `#486348` | supporting muted green (rare) |

**Saffron states:** wash `#FDE7D2` · soft `#FBC89A` · hover `#D8823A` · press `#B8661F`
**Neutral ramp (cream→ink):** `#DEDCD0` `#B9B7AC` `#8A8880` `#5C5B55` `#2E2D2B`
**Borders:** cream low-alpha — hairline `rgba(232,230,217,0.14)` · strong `rgba(232,230,217,0.28)`

```css
:root{
  --ink:#000000; --cream:#E8E6D9;
  --saffron:#F6A25C; --oxblood:#7E0101; --forest:#486348;
  --saffron-wash:#FDE7D2; --saffron-soft:#FBC89A; --saffron-hover:#D8823A; --saffron-press:#B8661F;
  --n1:#DEDCD0; --n2:#B9B7AC; --n3:#8A8880; --n4:#5C5B55; --n5:#2E2D2B;
  --hairline:rgba(232,230,217,0.14); --border-strong:rgba(232,230,217,0.28);
  --r-pill:999px; --r-card:14px; --r-input:6px;
  --ease:cubic-bezier(0.16,1,0.3,1);
}
```

## Typography

| Face | Role | Rules |
|---|---|---|
| **Prospec** | wordmark + ALL titles/headings | **ALL CAPS**, wide Deco tracking `0.08–0.34em`, weight 400 |
| **Rosnoc** | decorative only — drop caps, single letters, roman numerals, poster markers | **all lowercase**, saffron |
| **Futura** | body, UI, labels, captions | fallback: Futura PT → Trebuchet MS → Century Gothic → Avenir → system sans. Small all-caps labels `0.16–0.28em` tracking |
| **Cormorant Garamond** *italic* | pull-quotes ONLY | — |

```css
--font-display:'Prospec','Futura PT','Century Gothic',sans-serif; /* titles: ALL CAPS, tracked, wt 400 */
--font-deco:'Rosnoc',cursive;                                     /* lowercase, saffron */
--font-body:'Futura PT','Trebuchet MS','Century Gothic','Avenir',system-ui,sans-serif;
--font-quote:'Cormorant Garamond',Georgia,serif;                  /* italic, pull-quotes only */
```

## Spacing & form
- **Fibonacci scale:** 4, 8, 12, 20, 32, 52, 84, 136, 220 px.
- **Radii:** CTAs = full pills `999px` · cards `14px` · inputs `6px` or underlined.
- Generous breathing room: 120–140px section padding · content columns capped ~680–780px.

## Motion & light
- Slow, breathing transitions `900–1600ms`, exponential ease-out `cubic-bezier(0.16,1,0.3,1)`.
- Saffron glow blooms on hover, fades back. **No bounces or springs.**
- Signature touches: sun-on-horizon lens flare at section boundaries (half-disc rising/setting); warm sand particles drifting left→right on scroll; letter-by-letter scatter-to-assemble text reveals.

## Tone
Minimal, sensory, low-light. **No emoji. No gradients-as-decoration. No rounded-corner accent boxes.** The only ornament is a single saffron dot. Imagery is warm, grainy, candlelit.

---

## Video caption spec (CapCut / Reels / TikTok / Shorts / 小红书)

- **Font:** **Futura is the default caption font** (in CapCut, pick Futura — it ships with macOS — or the nearest geometric sans). All captions and small text are Futura. **Prospec and Rosnoc are large display text only** (title cards, hook lines) — never small captions or body.
- **Case:** sentence case for spoken captions. Reserve Prospec **ALL CAPS + wide tracking** for title cards / hook lines only.
- **Color:** base text **warm cream `#E8E6D9`** (not pure white). Highlight **one** key word per line in **saffron `#F6A25C`**. Never a whole line in saffron.
- **Legibility:** keep it restrained — a soft shadow (`0 2px 8px rgba(0,0,0,0.6)`) or a thin 2px ink stroke. No heavy boxes.
- **Placement:** lower third, inside platform safe zones (clear the bottom ~15% and right-side UI).
- **Ornament:** at most a single saffron dot. No emoji.

## Font sourcing status
- **Cormorant Garamond** — free (Google Fonts), ready to embed.
- **Futura** — ships with macOS, so CapCut and the Mac use it natively for captions; on the web it uses the fallback stack above.
- **Prospec & Rosnoc** — files received (`Prospec.otf`, `Rosnoc.otf`), copied into the repo at `fonts/` and wired via `theme.css` (`@font-face`). Install them once on the Mac (double-click each → **Install**) so CapCut can use them for **display text only**.
