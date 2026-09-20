---
tags: [frontend, stable]
updated: 2026-07-31
---

# Catalog — Common Components

Files in `src/components/common/` — shared infrastructure that may depend on
providers. Conventions: [[component-conventions]].

## ChessScene — `chess-scene/`

The home page's WebGL scene. Full documentation: [[chess-scene]].

| File | Role |
|------|------|
| `index.tsx` | `next/dynamic` `ssr:false` wrapper — keeps `three` out of first-load |
| `chess-scene.tsx` | React host — owns the canvas element and the scene's lifetime |

**Mounting** — `views/home.tsx` renders it only for non-bots:
```tsx
import { LazyChessScene } from "@/components/common/chess-scene";
```

All rendering lives in `src/lib/scene/` and is driven by the shared ticker — no
React involvement per frame. Settings reach it through the `useChessSettings`
Zustand store.

> [!info] The controls panel is gone
> `components/common/controls-panel/` — the art-direction HUD that drove every
> material, light, motion, camera, post and background parameter — was removed
> once the look was settled. ADR: [[decisions-log]] ADR-0023. The stores it wrote
> to are still there and are still the way to change the look; what went is the
> UI, its tokens (`--raw-color-panel-*`, `--*-control-*`), its `.panel-range` /
> `.panel-swatch` component classes, the `.scrollbar-none` utility and
> `serialiseSettings`. To retune, edit `chess-defaults.ts` and
> `backdrop-settings.ts` directly.
>
> Its removal is also what made [[home-hero]]'s entrance animations safe: the
> panel was the one `position: fixed` descendant of `<main>`, so nothing under
> `<main>` could carry a transform without displacing it.

## Cursor3D — `cursor-3d/`

Replaces the native cursor with the 3D pointer from `public/assets/cursor.glb`,
which carries both variants as sibling nodes: `normal` (leaning, turning about
its own axis) and `hover` (shown over interactive elements).

**The hover variant does not turn, so its attitude is chosen once** — three
numbers, in two groups, in `DEFAULT_CURSOR_ANGLES` (`lib/cursor-settings.ts`).

- `pitch` / `yaw` sit on the node itself and turn the hand **toward the camera**.
  At zero rotation the model is nearly edge-on: 735 covered pixels against 4 114
  at the shipped angles. Winding these *down* does not make the hand look less
  angled, it makes it disappear.
- `roll` sets how the hand sits in the screen plane, on its own group
  **outside** those two.

> [!warning] The roll cannot be the third component of the same `rotation`
> Euler order is XYZ, so after a pitch and a yaw that component turns about an
> axis that no longer faces the camera. Winding it produces almost no visible
> change — −0.8 and −1.15 render nearly identically — and the apparent tilt
> saturates instead of following the number. On its own outer group it is a true
> screen roll: the silhouette's *area* stays constant while its tilt moves,
> which is the signature of an in-plane rotation and the check to repeat if this
> is ever retuned.

> [!important] The shipped angles were chosen by eye — do not tidy them
> They came from dragging sliders against the live render, through a panel that
> has since been removed, and their trailing digits are an artefact of that
> slider's step grid. They sit nowhere near the round numbers anyone would guess:
> all three are past −1.97rad, well round the back of the arcs that reasoning
> from the model's rest pose suggests. Rounding them is safe; *re-deriving* them
> is not.
>
> To retune, put the panel back rather than editing the constants blind — the
> hover pointer is only on screen while something interactive is under the
> cursor, so it can only be judged while it is being dragged. That is why the
> angles are still a store and not three constants. See the twenty-second entry
> in [[changelog]] for what the panel was.

Rendering is `lib/cursor-scene.ts`: a second, small WebGL context
(`CURSOR_CANVAS_SIZE`, currently **104** CSS px square) with an **orthographic**
camera, because a cursor under perspective distorts as it turns and stops
reading as a flat pointer. `HOTSPOT` is a *fraction* of that size, so resizing
the cursor does not need the offset re-measured.

Three things worth knowing:

- **Position is written straight from the `pointermove` handler**, not the
  render loop. A cursor lagging its own pointer by a frame is immediately
  noticeable; one `transform` write costs nothing, and the canvas only
  re-renders for the spin.
- **The native cursor is hidden only after the scene resolves.** The
  `.custom-cursor-active` class goes on `<html>` in the `.then()`, so a WebGL
  failure, a missing model or a slow network leaves the real cursor in place
  instead of leaving the page with none. Hiding it needs a universal selector
  and `!important` to beat controls that set their own `cursor`.
- **`HOTSPOT` is the tuning knob** for where the model's tip sits relative to
  the pointer, and it must be **measured against the render, not derived**.
  Flipping `TILT` does not mirror it: the arrow points up-left either way and
  only its lean angle changes, so mirroring the value overshoots. Horizontal
  alignment is also only ever right *on average*, because the model turns and
  its tip sweeps a few pixels each cycle. Currently within ~4px of the pointer.
  The hover variant inherits this offset and sits low and right of its true
  hotspot — it will need its own if that ever matters.

Never mounted on touch — `getDeviceProfile().pointer` gates it.

> [!info] `cursor-controls/` is gone
> The slider panel that produced the angles above was removed once they were
> settled, like the scene's controls panel before it (ADR-0023). If it is ever
> needed again, four things it got right and a rebuild would have to repeat:
>
> - **Mount it from the root layout, never inside `<main>`.** It is
>   `position: fixed`, and a fixed descendant of `<main>` is displaced by the
>   hero's entrance transforms — the incompatibility ADR-0024 turns on.
> - **`cursor-scene.ts` must push a frame itself** when an angle changes. The
>   hover variant is static, so nothing else would redraw it mid-drag. That
>   subscription is still in place.
> - **`min` on a range input must be a whole number of steps.** It snaps to
>   `min + n * step`, so `min={-Math.PI}` puts every value off a clean grid —
>   `-0.42` was copied out as `-0.421592653589793`, which is where the shipped
>   angles' trailing digits come from.
> - **Bottom-left.** Top-right is the contact pill; bottom-right is the
>   preloader's counter.

## Preloader — `preloader/`

The load curtain: a white field that a pixel wave floods with the hero's blues
from the centre out, with a counter in the bottom-right corner set in the
display face. Mounted in the root layout; unmounts itself when it lifts.

| File | Role |
|------|------|
| `preloader.tsx` | The whole component — canvas, counter, ramp, clear |
| `index.ts` | Barrel export |

**The curtain no longer does the entire reveal.** It used to, and the page under
it was deliberately static; it now hands over to [[home-hero]]'s staged
entrances, which are gated on this component's `done` flag so that nothing plays
behind an opaque overlay. What has *not* changed is why the curtain's own blur is
a `backdrop-filter` on the overlay and never a `filter` on a wrapper: any
non-`none` `filter` makes its element a containing block for `position: fixed`
descendants, which would tear the 3D cursor out of the viewport — permanently,
since even `blur(0px)` counts. Entrances under `<main>` are transforms, which are
subject to the same rule; they are safe only because the panel that used to be
`fixed` inside `<main>` is gone and the cursor and background are siblings of it.
Content also stays at full size and in the document either way — see
[[seo-metadata]].

> [!warning] The blur target carries no filter until the clear begins
> An active `backdrop-filter` anywhere in the overlay softens the wave canvas
> itself — even from *behind* it, and even with `image-rendering: pixelated`
> confirmed on the canvas. The wave rendered as a blurry blob until the filter
> was deferred to the 0.7s clear. It also means no full-screen blur runs during
> the two seconds nothing needs it.

> [!important] `lifting` and `done` are different moments — pick the right one
> `lifting` fires when the curtain *starts* fading, `done` when it has gone;
> `CLEAR_DURATION` (0.7s) apart. Anything that should be **seen happening
> through the fade** hangs off `lifting` — the chess scene's opening magnet does,
> and on `done` it fired a full 0.7s after the page was already visible, which
> read as the swarm sitting still and then remembering to move. Anything that
> should land on a clear page hangs off `done` — [[home-hero]]'s staged
> entrances do.
>
> `finish()` sets **both**, so a consumer watching only `lifting` still fires on
> the reduced-motion path, which never plays a fade at all.

**Progress is time-based but really gated.** The count ramps over `MIN_DURATION`
and stalls at `READY_CEILING` (92) until the chess scene calls
`markSceneReady()` — so it can never read 100 over a canvas that is not running.
`MAX_WAIT` (8s) is the escape hatch: the bot path never mounts the scene at all,
and without it the curtain would sit at 92 forever. The scene also marks ready on
**failure**, because a curtain that never lifts is worse than a blank page.

`prefers-reduced-motion` skips the curtain entirely rather than making someone
sit through it.

## PixelWaves — `pixel-waves/`

The site background: a soft field of drifting pixel blocks in brand-blue shades,
behind the scene card. Mounted once in the root layout, so every route gets it.

| File | Role |
|------|------|
| `pixel-waves.tsx` | The whole component — canvas + ticker subscription |
| `index.ts` | Barrel export |

**No props.** Every parameter comes from `lib/backdrop-settings.ts`, read with
`getState()` inside the loop — a selector would re-render the component and
re-run its whole effect on every change. Defaults live in `DEFAULT_BACKDROP`, and
with the panel gone that is where you change them.

**Interaction** — a concentric ripple radiates from the cursor, added into the
wave sum before quantisation, so it bends the existing field rather than
painting a separate highlight on top. The centre is lerped toward the pointer at
`rippleFollow` (default **0.035** — deliberately laggy, so the field trails the
cursor by a visible beat and keeps drifting after it stops), snaps on the very
first move (otherwise it sweeps in from a corner), and fades in over ~0.45s.
Reads `lib/pointer.ts` and attaches only when `getDeviceProfile().pointer` is
true — never on touch.

Four things about it are load-bearing:

- **The canvas is tiny and scaled up.** One device pixel per wave cell (≈206 ×
  115 at a 1440-wide viewport), then `image-rendering: pixelated` via the
  `.pixelated` utility. That is what makes blocks crisp instead of blurred, and
  it turns a full-screen effect into tens of thousands of `ImageData` writes per
  frame rather than millions. Cost scales with **CSS** viewport area ÷
  `cellSize²`, not with device pixel ratio — halving `cellSize` quadruples the
  work, which is the knob to reach for first if it ever needs to get cheaper.
- **The ripple skips the square root for most cells.** Distance is compared
  squared against the radius, and only cells inside the reach pay for `Math.sqrt`.
- **`levels` is what makes it read as pixels at all.** Left continuous, adjacent
  cells differ by a fraction of a channel and the field looks like a smooth
  gradient no matter how crisply it is scaled — this was the first attempt, and
  it did. Quantising to a handful of flat shades gives every block a definite
  edge.
- **Colours are read from the tokens, not hardcoded** — `--backdrop-wave-low` /
  `--backdrop-wave-high`, resolved once on mount through a probe element.
  `getComputedStyle().getPropertyValue()` would return the *specified* value,
  which for these is another `var()` reference; assigning to `color` makes the
  browser substitute and hand back `rgb(...)`.

**Motion** — continuous per-frame animation, so neither a spring nor a CSS
transition applies and `@keyframes` are banned. It subscribes to the shared
ticker ([[animation-system]]) at a 30fps budget. `prefers-reduced-motion` draws
one settled frame and never subscribes; the canvas keeps that frame, so a frozen
field costs nothing.

## Cookie — `Cookie/`

Self-contained cookie consent system — a bottom-right **banner** plus a full
category **preferences modal**. No third-party library (the old
`react-cookie-consent` dependency was removed). Lives in `src/components/common/Cookie/`.

| File | Role |
|------|------|
| `Cookie.tsx` | Mount component — hydrates the store, renders banner + modal |
| `LazyCookie.tsx` | `next/dynamic` `ssr:false` wrapper — keeps cookie JS out of first-load |
| `CookieBanner.tsx` | Bottom-right consent banner |
| `CookiePreferencesModal.tsx` | Category preferences dialog with per-category toggles |
| `CookieButton.tsx` | Local button primitive — `primary` / `secondary` variants |
| `cookieStore.ts` | Zustand store + `localStorage` persistence |
| `index.ts` | Barrel exports — `Cookie`, `LazyCookie`, `useCookieStore`, `CookieConsent` |

**Mounting** — the root layout renders `<LazyCookie />` inside `ScrollLayout`:
```tsx
import { LazyCookie } from "@/components/common/Cookie";
```

**State** — `useCookieStore` (Zustand). `consent` is `null` until the user decides;
the banner shows only after hydration confirms `consent === null`. Persisted to
`localStorage` under key `cookie-consent-v1`. Three categories: `necessary`
(always on), `analytics`, `marketing`.

**Styling & motion** — ported to the project stack: Tailwind v4 with the
`background` / `foreground` design tokens (dark-mode adaptive, no hardcoded hex),
and `@react-spring/web` for all motion — `useTransition` drives the banner and
modal mount/unmount, `useSpring` drives the toggle knob. No CSS transitions.
The modal locks scroll through the Lenis [[smooth-scroll|scroll store]]
(`useScroll.stop()`), not `body` overflow.

> [!note] `#todo`
> The privacy-policy link points to `/privacy-policy` — that route does not exist
> yet. Placeholder consent copy should be reviewed before launch.

## Grid — adaptive scaling (`grid/`)

The **adaptive scaling grid** keeps a rem-based layout proportional across every
viewport by scaling the root (`<html>`) font-size. Design in `rem` once, and the
whole UI scales as one unit. Lives in `src/components/common/grid/`.

| File | Role |
|------|------|
| `grid.config.ts` | Breakpoints + `FONT_BASE` — the single source of truth for the grid |
| `adaptive-grid.tsx` | `<AdaptiveGrid>` client component — drives the scale-up, renders `null` |
| `index.ts` | Barrel exports — `AdaptiveGrid`, `GRID_BREAKPOINTS`, … |

**How it works** — two halves cover the whole viewport range:

- **Scale down** (viewport ≤ 1920px) — `vw`-based `html { font-size }` media
  queries in `globals.css`. At each breakpoint's design base width the root
  font-size resolves to 16px; between breakpoints it tracks the viewport.
- **Scale up** (viewport > 1920px) — the `<AdaptiveGrid>` component sets an
  inline `html` font-size at runtime via [[hooks|`useAdaptiveGrid`]], so the
  design keeps growing (damped by `coef`) on large displays.

The `globals.css` media queries and `grid.config.ts` describe the same
breakpoints — **keep them in sync** (formula: `font-size = 16 * 100 / baseWidth vw`).

**Mounting** — the root layout renders `<AdaptiveGrid />` inside `ScrollLayout`:
```tsx
import { AdaptiveGrid } from "@/components/common/grid";
```
Mount it once. Props: `baseWidth` (defaults to the largest breakpoint) and
`coef` (0–1 scale-up damping, default `0.6666`).

> [!note]
> This replaced a `styled-components`-based scaling system that was dropped into
> `common/` — see [[decisions-log]] ADR-0008. `styled-components` is **not** a
> project dependency; the scale-down CSS lives in `globals.css` per [[design-system]].

## ReducedMotion — `reduced-motion.tsx`

`<ReducedMotion>` — a client leaf that calls react-spring's `useReducedMotion()`.
It watches the `prefers-reduced-motion` media query and toggles react-spring's
global `skipAnimation`, so every spring — and `spring-text-engine` — jumps to its
end state instead of animating. Renders `null`; mounted once in the root layout.
See [[animation-system]] and [[seo-metadata]].

## Skeleton loaders

Three skeleton components for `loading` states of async-data components — every
async component must mirror its final layout with one of these
(see [[component-conventions]]).

| Component | File | For |
|-----------|------|-----|
| `<SkeletonImage>` | `skeleton-image.tsx` | image placeholders |
| `<SkeletonLoader>` | `skeleton-loader.tsx` | generic block placeholders |
| `<SkeletonVideo>` | `skeleton-video.tsx` | video placeholders |

> [!note]
> `components/ui/` (design-system primitives) does not exist yet — create it when
> the first primitive is added. See [[folder-structure]].

## Related

[[component-conventions]] · [[components/animation-springs]]
