# Plus 4 Performance — Visual Design Spec v1

Locked design language, approved [24 June 2026]. This is the source of truth for all future styling work — paste this whole doc into Claude Code at the start of any visual/styling session so it doesn't default to generic choices.

Reference prototype: `p4p-design-prototype-v5.html` (final approved version).

---

## The one rule that matters most

**Pink is light, never ink.**

Pink only appears as: ambient glow, drop-shadow bloom, thin borders/edges, and progress fill. Pink **never** appears as the colour of text, and never as a large solid fill (no pink buttons, no pink backgrounds on cards or panels). Every word on screen is white, off-white, or grey. The accent colour illuminates the product — it doesn't write in it.

If you're ever unsure whether something should be pink: if it's a letter or a number, no. If it's a glow, a border, or a bar filling up, yes.

This single rule is what keeps the product premium rather than "girly" or "generic neon AI template." Don't relax it screen by screen.

---

## Colour tokens

```css
--ink: #08070A;            /* base background */
--ink-soft: #0C0B10;
--surface: #14121A;        /* card/input base */
--surface-2: #1A1722;      /* track backgrounds, subtle fills */

--bone: #F3F1ED;           /* primary text — off-white, never pure #FFF */
--ash: #87858E;            /* secondary text, labels */
--ash-dim: #5C5A62;        /* tertiary text, meta labels */

/* accent — vibrant magenta-pink, used ONLY as glow/border/fill-bar, never as text */
--violet-deep: #4A1240;
--violet-mid: #E8389E;
--violet-line: #FF4FC4;
--violet-bright: #FF8FE0;
--violet-glow: rgba(255, 79, 196, 0.55);  /* the workhorse — box-shadow blooms use this */
```

**Do not desaturate the accent.** Earlier exploration tried a muted/dusty version of this colour for a "luxury" feel and it read as dull, not premium. The vibrancy is what makes the glow read as deliberate/futuristic rather than decorative. Luxury comes from restraint in *where* it's used, not from how loud the colour itself is.

**Do not swap in a different colour family** (no orange, no lime/green, no red) without re-running this same approval loop — the magenta-pink-as-glow identity is now the brand signal.

---

## Typography

- **Display / headings**: Oswald, weight 600–700, uppercase, tight letter-spacing (0.3–0.5px on large sizes, 1.5–3px on small uppercase labels). This is the gym-poster energy — keep it.
- **Body / UI text**: Inter, weight 400–500. Everything that isn't a heading or a stat number.
- **Data / stat numbers**: Roboto Mono, weight 600. Reserved for things that are genuinely numerical data (calories, protein grams, weights, prices in stat-card context) — gives numbers a "this is measured, not decorated" feel.

All headings and uppercase labels are set in caps via the font weight/style choice already — don't also reach for `letter-spacing` beyond what's specified above, it gets shouty fast.

---

## Surfaces & depth

Three elevation levels, each a touch lighter/warmer than the one below:

1. **Base** — `--ink` (#08070A), flat
2. **Card / panel** — dark gradient (`linear-gradient(160deg, #131119 0%, #0C0A0F 100%)` or similar), 1px border at `rgba(255,255,255,0.05)`, soft drop shadow
3. **Elevated / featured card** (e.g. the "coach's note") — slightly lighter gradient, thin pink-tinted border (`rgba(255, 79, 196, 0.1–0.25)` depending on emphasis), plus a soft pink bloom shadow (`0 0 24-32px -12px var(--violet-glow)`)

**Ambient glow**: a single soft radial gradient using `--violet-glow`, positioned top-left, fixed position, low opacity (0.7–0.85), large blur radius. This is the "is the light on" feeling — one source, consistent position, never multiple competing glows on one screen.

**The CTA pattern** (this took a few iterations to get right — follow it exactly):
- Background: dark gradient, same family as elevated cards — **not** a pink fill
- Border: thin pink-tinted (`rgba(255, 79, 196, 0.2-0.25)`)
- Box-shadow: pink bloom (`0 12px 36px -6px var(--violet-glow)`)
- Text: white/bone, never pink
- On press: scale down slightly (0.97), shadow tightens

---

## Motion

- Page-load sequence: elements fade up and stagger in (heading → progress bar → eyebrow text → coach's note → stat cards in sequence → CTA → footer). Roughly 80-120ms stagger between elements, ~0.5-0.7s duration each, `cubic-bezier(0.16, 1, 0.3, 1)` easing.
- Progress bars fill from 0 to target width on load, slight delay after the track itself fades in.
- Stat numbers count up from 0 to their target value (eased, ~1s), don't just appear instantly — this is a small detail with disproportionate "this feels engineered" payoff.
- Cards give tactile feedback on tap/press (slight scale or lift), not just on hover — most of your audience is on mobile.
- Always wrap motion in `prefers-reduced-motion` respect.

---

## Things explicitly rejected — don't reintroduce these

- **Neon hexagon/circuit-board graphics** — the generic white-label fitness-app-reseller look. Rejected even though it shares the pink/purple family with our actual direction.
- **Pink as a large fill** (buttons, panels, backgrounds) — reads as a wellness/beauty palette choice rather than a technical one. Glow only.
- **Pink text of any kind** — including stat numbers and prices. Tried both; both got walked back. Text is always white/grey.
- **Desaturated/muted "tasteful" pink** — tried this too; read as dull rather than premium. The vibrancy + glow combination is what makes it feel both premium and futuristic at once; don't sand off the saturation to chase "tasteful."
- **Generic AI-design defaults** — warm cream/serif, or newspaper-hairline broadsheet layouts. Neither fits this brand; don't default to them on future screens just because they're common safe choices.

---

## Build priority (for reference — not a styling rule, a sequencing note)

1. ✅ Intake/snapshot screen (this spec, proven)
2. Rest of the intake flow (account creation, training prefs, nutrition prefs, health & injuries) — apply identical card/input/select treatment
3. Homepage hero — signature interactive moment: a live mini-calculator a visitor can type into before signing up, styled in this system
4. Retention-focused interaction work (streaks, progress visualisation, check-in reward states) — once base visual language is proven across the flow above

Mobile-first throughout — most traffic arrives from TikTok/Instagram on a phone, and the app itself will eventually need to feel native-adjacent even while staying web/PWA for now.
