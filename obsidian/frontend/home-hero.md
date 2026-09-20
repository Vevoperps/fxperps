---
tags: [frontend, layout, stable]
updated: 2026-07-31
---

# Home Hero

The home page's UI, ported from Figma
([Get Layers, node `1097:251`](https://www.figma.com/design/WINXFW2nTM7zYwd5dGgm1T/Get-Layers?node-id=1097-251)).
A top bar, a copy column, the [[chess-scene]] in the middle, and a 2 × 2 grid of
figures on the right.

## Files

```
src/views/home/
├── index.tsx          # HomeView — the shell, the three columns, the bot gate
├── site-header.tsx    # logo · centred nav · contact pill · burger  ("use client")
├── hero-intro.tsx     # headline / rule / copy / call to action
├── headline.tsx       # the headline, set letter by letter  ("use client")
├── reveal.tsx         # one staged entrance, held until the curtain lifts  ("use client")
└── stat-grid.tsx      # the 2 × 2 figures
```

They live beside the view rather than in `components/`, per
[[folder-structure]]: feature-specific components go next to the feature.

## How the design's pixels became a layout

The Figma frame is **1440 × 800**, and the starter's adaptive grid holds
`1rem = 16px` at exactly that width — so **design px ÷ 16 = rem**, and the whole
composition scales proportionally below it. Nothing is positioned absolutely
except the two header items that have to ignore their neighbours.

Everything that is a *proportion* is expressed as `fr`, not a fixed size:

| Design | As built |
|--------|----------|
| shell inset 20px, rules down each side | `px-shell-inset` + `border-x border-rule` |
| columns 493 / 414 / 493 | `grid-cols-[493fr_414fr_493fr]` |
| left rows 534 / 211 (rule at y=589) | `grid-rows-[534fr_211fr]` |
| right rows 323 / 211 / 211 (rules at y=378, 589) | `grid-rows-[323fr_211fr_211fr]`, first row empty |
| content inset 30px inside the shell | `--shell-gutter` |

**Verified numerically, not by eye.** At 1440 × 800 the built layout reports the
design's own coordinates: scene cell `513,55,414,745`; CTA `50,719,433,51`; copy
`50,619,400,38`; rules at y=589, 378, 589; stat figures at (957, 408) /
(1204, 408) / (957, 619) / (1204, 619) and their labels at y=540 / 751. The only
drift is ±1px where a 1px border sits on a zero-width Figma line.

## Responsive

The **body** splits at `lg` (1024px), which is also where the adaptive grid
changes base width, so the type and the layout switch together:

- **`lg` and up** — the design's three columns, measured above.
- **Below `lg`** — one stacked column: header, headline, copy + CTA, scene,
  figures. `main` goes `h-lvh` → `min-h-lvh` so the page can scroll, and the
  scene takes an explicit aspect (`4/5`, `3/2` from `sm`) because there is no
  fixed body height left for it to fill.

The **header** splits earlier, at `sm` (640px), because it fits earlier:

- **`sm` and up** — one row, `1fr auto 1fr`, the nav centred on the shell. At 768
  that measures logo `16,0,231,41` · nav `246,0,260,41` · pill `506,0,231,41` in
  a 41px bar: everything on one line with room to spare.
- **Below `sm`** — logo and a burger toggle, with the nav *and* the contact pill
  inside the menu.

> [!important] `sm` is the seam because of the adaptive grid, not the content
> Above it the root font-size is a viewport fraction of a 1024/1440/1920 base, so
> every element in the bar keeps the same *proportion* of the width at every
> size — a fit at one width in the band is a fit at all of them, and there is no
> intermediate width where the row half-breaks. Below `sm` the base drops to 360
> and the type jumps against the shell, which is exactly what breaks the row.

Four things that had to be got right:

- **One `<nav>` at every size**, re-flowed by grid order (`order-4 sm:order-2`,
  `col-span-2 sm:col-span-1`) rather than duplicated. A second nav for the
  burger would mean two "Primary" landmarks on the page.
- **The open/closed switch is a JS branch, not stacked utilities.**
  `hidden sm:flex` and `flex` cannot both sit in one class list without one of
  them needing `!important` to win, so the class string is built from the state.
- **`h-topbar` belongs on the `<header>`, not its inner grid** — and only from
  `sm`, since an open burger has to be free to make the header taller. With
  border-box the 1px bottom rule has to sit *inside* the 55px; putting the height
  on the grid pushed the whole body down a pixel and every measured coordinate
  drifted.
- **No `items-center` on the header grid.** It collapses each cell to its text
  height, which leaves the contact pill's `h-full` nothing to fill — the pill
  rendered 19px tall instead of 54. Cells stretch; each centres its own content.

The contact pill follows the links into the burger rather than staying in the
bar: below `sm` its 189px frame and the logo together leave no room for the
toggle.

## The headline is set letter by letter

`views/home/headline.tsx`, one `TextEngine` per line of `homeCopy.headline` —
see [[text-engine]]. One engine per line rather than one for the whole string:
the design's break is content, not a consequence of the column width, and it is
also what lets one line be held together without dragging the other along.

- **No `overflow`.** The clip is the usual way to hide letters before they move,
  but it clips to the *line-height* box, and this headline is set at 80% leading
  on purpose ([[design-system]] `--raw-text-display-leading`). Under `overflow`
  that shaves the glyphs. Translating and fading without a clip reads the same at
  this size and stays honest about the leading.
- **`enabled` is the load curtain's `done` flag**, or the whole stagger plays
  behind an opaque overlay and the headline is simply *there* when it lifts.
- **One line on tablets is `sm:flex-nowrap!`.** The engine's container is a flex
  row, so a line breaks when its *words* wrap — `white-space` has nothing to say
  about it. The `!` is required: the engine writes `flex-wrap: wrap` as an inline
  style, which a plain utility cannot beat. Below `sm` that default is left
  alone, because the display face is far larger against the column there and one
  line will not fit however much it is told to.
- The engine's `seo` prop (on by default) renders a clipped plain-text copy, so
  `aria-labelledby="hero-headline"` and crawlers still see unsplit text.

## Entrances

`views/home/reveal.tsx` wraps one block in a `Spring` and holds it at `from`
until `usePreloader`'s `done` flips. Measured from the frame the curtain
unmounts: logo 99ms · first nav link 165 · pill 299 · last headline letter 499 ·
copy 732 · CTA 899 · first stat figure 999.

- **Gated on `done`, not on mount.** `Spring` renders at `from` while inactive,
  so nothing burns its entrance behind the curtain and the order above is the
  order that is actually seen.
- **Only `opacity` and `transform`.** The markup is in the document at full size
  from the first paint either way — see [[seo-metadata]].
- **A transform ancestor is only safe here because the controls panel is gone.**
  It was the one `position: fixed` descendant of `<main>`; the 3D cursor and the
  pixel-wave background are siblings of `<main>`, not children. Check this again
  before adding anything `fixed` under the hero.
- **`Reveal` replaces the element it animates, it does not wrap it** — it takes
  the `tag` and the element's own classes. Wrapping would insert a div into the
  grid and break the stat cells (see the warning below).
- The blocks arrive on **different vectors** — the bar drops from above, the copy
  rises, the CTA comes in from the left, the figures from the right. Same-vector
  staggering reads as one long fade, which is the thing this is trying not to be.

## The headline doubles above 1440 — and only there

`text-display wide:text-display-wide`, i.e. 48px → 96px at ≥1441px. The stat
figures deliberately stay at 48px.

It fits there and nowhere else, and the reason is the adaptive grid rather than
the design. Within one grid band the font (rem) and the column (`fr`) scale
together, so their ratio is fixed — doubling always overflows. The ratio only
changes when the band changes:

| Viewport | Headline | Column content | Fill |
|----------|----------|----------------|------|
| 821 | 38.5px | 217px | **99%** |
| 1440 | 48px | 433px | 62% |
| 1441 | 72px | 437px | 92% |
| 1600 | 80px | 491px | 91% |

Below 1440 the headline already fills its column, which is why the rule starts
at 1441 — the first pixel of the 1920-base band, where the rem shrinks against a
column that keeps growing. All four rows above were measured, not derived.

> [!warning] The 62px gap under the copy is not a value
> It is whatever is left when the copy and the button are pushed apart inside
> the lower-left row by `justify-between`. Don't "fix" it to a constant — it is
> derived, and derived is why it survives a resize.

> [!warning] A stat cell must be the grid child itself
> Wrapping it stretches the wrapper to the row and leaves the cell only as tall
> as its content, so `justify-between` has nothing to distribute and the label
> rides up under the figure. This was a real bug, caught by measuring. It is also
> why `Reveal` renders *as* the cell rather than around it.

## Hover

Colour-only, `transition-colors duration-[var(--duration-fast)] ease-entrance` —
the narrow CSS exception the [[design-system]] allows, so none of it needs a
spring. The contact pill and the CTA both invert to `bg-ink` / `text-surface-invert`;
the CTA's dot and arrow box invert with it via `group-hover`. Nav links and the
burger toggle fade to `text-foreground/60`.

## The mark on the contact pill

Two squares — a small one stepping up to a larger one, on a 9×9 `viewBox`, drawn
as `<rect>`s rather than a path. It replaced a diagonal arrow and reads as the
same up-and-right movement, but on the grid the display face is built on. At the
8px it renders at, every edge lands on a whole pixel, which a diagonal cannot.

The 3D cursor swaps to its hover variant over the same elements — that is driven
independently by a selector in `Cursor3D`, see [[components/common]].

## Copy

All of it is placeholder in `src/data/mocks/home.ts` and passed in by props. The
Figma copy was replaced wholesale **except the company name** — the design's own
strings were placeholder too (four identical "$4B+ / Processed" tiles).

## What is *not* verified

- **`get_design_context` was unavailable** for the whole port — seven timeouts
  across the frame, sub-frames and single text nodes. Geometry came from
  `get_metadata` (exact) and type/colour were matched against `get_screenshot`
  renders **by eye**. So the layout is measured and the palette is *approximated*:
  `--raw-color-ink-900` and `--raw-color-rule` in particular are visual matches,
  not extracted values. If the real hexes surface, they are a one-line change.
- **The wordmark renders ~10px narrower than the design** (78px vs 88px at 18px).
  The design looks like a heavier cut of General Sans than the Medium that was
  supplied; only Medium exists in `src/app/fonts/`.
- **Below 1024px the starter's adaptive grid switches base width** (1.5625vw,
  i.e. designed for a 1024 layout), so the type runs large relative to a
  1440-based composition. There is still no Figma frame for the smaller
  breakpoints — the tablet and mobile treatments here were built to reference
  screenshots and measured against the DOM, not extracted from a design.

## Related

[[design-system]] · [[chess-scene]] · [[text-engine]] · [[animation-system]] ·
[[folder-structure]] · [[html-semantics]]
