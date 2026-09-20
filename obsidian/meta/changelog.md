---
tags: [meta, changelog]
updated: 2026-07-31
---

# Changelog

Chronological log of notable changes to the project. Newest first.
This is a human-curated log — not a mirror of `git log`.

## 2026-07-31 (twenty-third pass)

- **Hover-cursor angles settled and the tuning panel removed.** Pitch −2.25,
  yaw −1.97, roll −2.19 — dialled in by hand through the sliders, and nowhere
  near where reasoning from the model's rest pose would have put them. The
  silhouette now covers 4 114 pixels against 735 at zero rotation: the most
  face-on of anything tried, reading as a clean pointing hand.
  - The trailing digits are the slider's step grid (`min + n * step` with
    `min = -Math.PI`), not precision. Safe to round, not safe to re-derive —
    noted in [[components/common]] along with what a rebuilt panel would need.
  - `cursor-settings.ts` stays a store rather than collapsing to constants: it
    is what a future panel would need, and the hover pointer can only ever be
    judged while it is being dragged.
- **The curtain is quicker** — `MIN_DURATION` 2.2 → **1.5s**, `CLEAR_DURATION`
  0.7 → **0.55s**; ~2.9s to ~2.05s at the floor. Both have a floor of their own:
  much under a second and the wave's dithered front crosses faster than it can
  be seen breaking up, and the clear is also the window the chess scene's
  opening magnet plays inside.
- **Published.** `origin` is now
  [textura-agency/getlayers-voxelia](https://github.com/textura-agency/getlayers-voxelia),
  `main` tracking it — the repo had been local-only since the starter's history
  was cut. Nothing sensitive is tracked; `.env.example` is the only env file in
  the tree.

## 2026-07-31 (twenty-second pass)

- **The opening magnet fires when the curtain *starts* fading, not when it has
  gone.** New `lifting` flag on the preloader store, set at the top of the clear;
  the chess scene's `reveal()` moved onto it. The two now fire 1ms apart, **628ms
  earlier** than before — on `done` the whole gesture began a beat after the page
  was already visible, which read as the swarm sitting still and then
  remembering to move. `finish()` sets both flags so the reduced-motion path,
  which never plays a fade, still triggers it.
- **New `cursor-controls/` panel** — three sliders and a copy button for the
  hover cursor's `pitch` / `yaw` / `roll`, now held in `lib/cursor-settings.ts`
  rather than as module constants. **A tuning tool, to be removed once the
  angles are settled**, exactly like the scene's controls panel (ADR-0023).
  - The angles had to become a store: the hover pointer only exists while
    something interactive is under the cursor — which includes these sliders —
    so it is tuned by watching it change under your hand, not by reloading.
    `cursor-scene.ts` pushes a frame itself on change, since the hover variant
    is static and nothing would otherwise redraw it mid-drag.
  - Mounted from the root layout, never inside `<main>`: it is `fixed`, and a
    fixed descendant of `<main>` is displaced by the hero's entrance transforms
    (ADR-0024).
  - `LIMIT` is `3.14`, not `Math.PI` — a range input snaps to `min + n * step`,
    so an irrational `min` put every value off a clean grid and `-0.42` was
    copied out as `-0.421592653589793`.

## 2026-07-31 (twenty-first pass)

- **The hover cursor rolls the other way, less far.** New `HOVER_ROLL` (−0.62)
  on its own group outside `HOVER_YAW` / `HOVER_PITCH`. Measured tilt +21.6px →
  **−12.1px**: mirrored, at a little over half the magnitude.
  - **It could not be the third component of the same `rotation`.** Euler order
    is XYZ, so after a pitch and a yaw that component turns about an axis that no
    longer faces the camera — −0.8 and −1.15 rendered nearly identically. On its
    own outer group the silhouette's area stays constant (~2 630) while its tilt
    moves, which is what an in-plane rotation should look like.
  - Also corrects the note in [[components/common]]: `HOVER_YAW` / `HOVER_PITCH`
    turn the hand *toward* the camera, they do not tip it off-axis. At zero it
    covers 735 pixels against 2 647 at the shipped pair — nearly edge-on.

## 2026-07-31 (twentieth pass)

- **`motion.kingAim` 0.12 → 0.45rad** (7° → 26° at the edge of the viewport, so
  ~50° of roll across the screen), on request. With the precession gone this is
  the king's only large movement, so it carries the scene rather than decorating
  it. Measured swing 5.5° → **16.3°** on the canvas proxy.
  - The aim is symmetric but the absolute angle is not — `kingTilt` leans the
    king toward −X regardless, so the range runs ~38° left to ~12° right. Base
    tilt showing through, not a sign error.
  - At 38° the crown sits ~0.95 world units off centre against a ~1.47
    half-extent at z=0. It fits; that is the margin to check before raising it
    again, and it is written down in [[chess-scene]].

## 2026-07-31 (nineteenth pass)

- **The king no longer precesses.** The nesting flipped to
  `kingAim` → `kingLean` → `kingSpin`, so it turns about its own tilted axis and
  holds one attitude instead of sweeping its lean around world Y. On request —
  the scene had run the other way round for most of its life because that reads
  as much more movement. Now the pointer lean carries the motion instead.
  - **`motion.kingSpin` shows far less than its number suggests** as a result:
    the king is nearly a solid of revolution, so turning about its own axis is
    visible only in the crown. 1.1rad/s was tuned for precession. Noted in
    [[chess-scene]] rather than silently re-tuned.
  - Bob, scale and the collision capsule moved to `kingLean`. `position` is read
    in the parent's space, so a `.y` on `kingSpin` would now drift the king
    along its own leaning axis rather than straight up.
  - Verified by least-squares fit at the precession frequency (5.712s) over
    43.8s: amplitude 2.27° against controls of 2.20° / 1.79° / 1.43° — a flat
    spectrum, nothing periodic left. The pointer lean still measures a 5.5°
    swing end to end.

## 2026-07-31 (eighteenth pass)

- **The king leans toward the pointer.** New `motion.kingAim` (0.12rad ≈ 7° at
  the edge of the viewport) on a new outermost `kingAim` group. It has to be
  outside the spin: on either inner group the lean would be expressed in axes
  that are themselves turning, so a *stationary* pointer would produce a wobble
  going round and round instead of a fixed attitude. Chased on a
  frame-rate-independent exponential (2.6/s) so the follow feels the same on a
  throttled tier as at 60fps, and deliberately slow — tracking exactly reads as
  the mouse dragging a lightweight prop around. Details in [[chess-scene]].
  - `kingCenter` is now read with `getWorldPosition()`: `kingSpin` stopped being
    a direct child of the scene, so its local position and its world position
    are no longer the same thing.
  - Verified by averaging the canvas's principal axis over **three full
    precession periods** — the king's own precession swings its apparent lean by
    the same order as the aim, so a short sample proves nothing. −0.92 → 3.44°,
    +0.92 → 9.46°.

## 2026-07-31 (seventeenth pass)

- **The controls panel is gone.** `components/common/controls-panel/` deleted,
  along with `serialiseSettings`, the `--raw-color-panel-*` and `--*-control-*`
  token groups, the `.panel-range` / `.panel-swatch` `@layer components` styles
  and the `.scrollbar-none` utility. Both Zustand stores stayed — they are the
  seam that lets the look change mid-flight without restarting the canvas — so
  retuning is now an edit to `chess-defaults.ts` / `backdrop-settings.ts`.
  ADR-0023. `ChessSceneProps` and `showPanel` went with it; `LazyChessScene` is
  now the `dynamic()` call itself.
- **The swarm collapses onto the king as the page appears.** `pullToKing()` in
  `chess-physics.ts`, fired once off the curtain's `done` flag. It *sets*
  velocity rather than adding to it, so the seeded tangential motion cannot bend
  the collapse into a curve, and the rate scales with distance so every piece
  arrives at the same moment. Nothing switches it off — the king's capsule, the
  contacts and the shell spring absorb it. Measured on the canvas: ~28%
  contraction, bottoming out 300–500ms after the curtain goes.
- **The page now assembles itself after the curtain**, reversing the "curtain
  does the whole reveal" rule — the panel was the only `fixed` descendant of
  `<main>`, and its removal is what made transforms under the hero safe.
  ADR-0024.
  - `views/home/reveal.tsx` holds a block at `from` until `done` flips. Logo
    99ms · nav 165 · pill 299 · last headline letter 499 · copy 732 · CTA 899 ·
    first figure 999, measured from the frame the curtain unmounts.
  - `views/home/headline.tsx` sets the headline **letter by letter** through
    `TextEngine`, one engine per line. **No `overflow`** — the clip is bounded by
    the line-height box and the headline is set at 80% leading on purpose, so it
    would shave the glyphs.
  - Blocks arrive on different vectors (bar from above, copy up, CTA from the
    left, figures from the right); same-vector staggering reads as one long fade.
- **Header: burger below `sm`, one row above it.** `sm` (640px) is the seam
  because it is where the adaptive grid changes base — above it every element
  keeps the same proportion of the width, so a fit at one width in the band is a
  fit at all of them. The nav and the contact pill both go into the menu; one
  `<nav>` at every size, re-flowed by grid order. At 768 the bar measures logo
  `16,0,231,41` · nav `246,0,260,41` · pill `506,0,231,41`.
- **The headline holds one line per entry from `sm`**, via `sm:flex-nowrap!`.
  The engine's container is a flex row, so a line breaks when its *words* wrap —
  `white-space` has nothing to say about it — and the `!` is required because the
  engine writes `flex-wrap: wrap` as an inline style.
- **The contact pill's arrow became two squares**, a small one stepping up to a
  larger one on a 9×9 `viewBox`, drawn as `<rect>`s. At the 8px it renders at,
  every edge lands on a whole pixel; a diagonal cannot.
- **The hover cursor is held at a fixed three-quarter attitude** (`HOVER_YAW` /
  `HOVER_PITCH`). It does not turn, and the camera is orthographic, so face-on it
  flattened into a sticker — off axis its side faces catch the key light at a
  different angle and the volume comes back.

## 2026-07-31 (sixteenth pass)

- **Load curtain.** A white field that a pixel wave floods with the hero's blues
  from the centre out — same cell-per-pixel canvas and same quantised shades as
  the background it hands over to — with a counter in the corner set in the
  display face. Catalogued in [[components/common]].
  - **The curtain does the whole reveal; nothing underneath animates.** Fading
    `<main>` would leave content at `opacity: 0` in the server render, and
    "appearing through blur" had to be `backdrop-filter` on the curtain rather
    than `filter` on a wrapper — any non-`none` `filter` makes its element a
    containing block for `position: fixed` children, which would displace the
    controls panel and 3D cursor permanently. *(Reversed the following pass,
    once the panel was gone — ADR-0024.)*
  - **The blur target carries no filter until the clear starts.** An active
    `backdrop-filter` in the overlay softened the wave canvas even from behind
    it, with `image-rendering: pixelated` confirmed applied — the wave rendered
    as a blurry blob until the filter was deferred.
  - Progress is time-based but gated on the scene reporting in (`lib/preloader.ts`),
    with an 8s escape hatch because the bot path never mounts a scene. The scene
    also reports ready on failure.
  - `resolveColor` moved out of `pixel-waves.tsx` into `lib/css-color.ts`, now
    shared by both canvases.

## 2026-07-31 (fifteenth pass)

- **Responsive hero.** Two layouts splitting at `lg` (1024px, where the adaptive
  grid also changes base): the design's three columns above, one stacked column
  below — header, nav row, headline, copy + CTA, scene, figures. `main` becomes
  `min-h-lvh` so it can scroll, and the scene takes an explicit aspect since
  there is no fixed body height to fill. Details and the three traps hit along
  the way in [[home-hero]]; desktop re-verified against the Figma coordinates
  afterwards.
- **Headline leading 0.8 at every breakpoint**, down from the Figma frame's
  1.0625. Applies to `text-display`, so the stat figures set tighter too.
- **Hovers** on the nav, contact pill and CTA — colour-only transitions with
  token-backed timing, the narrow exception [[design-system]] allows.
- **Stronger magnet** — `magnetAmount` 0.85 → **1.25**; the swarm now presses
  onto the king's collision capsule at the top of the inward stroke.
- **Bigger cursor** — `CURSOR_CANVAS_SIZE` 64 → **104**. `HOTSPOT` is a fraction
  of that, so no re-measuring was needed.
- **Background lags the cursor.** The ripple centre's follow rate became a
  setting (`backdrop.rippleFollow`, default **0.035**, was a fixed 0.16) with a
  "Cursor lag" slider, so the field trails a visible beat behind.
- **Real metadata, with the icon and share card generated from the wordmark.**
  `siteConfig` filled in; new `app/icon.tsx`, `app/apple-icon.tsx` and
  `app/opengraph-image.tsx` draw the mark with `next/og` at build time. See
  [[seo-metadata]].
  - `generateMetadata` no longer names any image or icon — anything named there
    **wins over** a generated file, which is how the starter's placeholders kept
    being served. The `ogImage` option was removed rather than left as a trap.
  - The starter's placeholder assets were deleted, `src/app/favicon.ico`
    included: it was still winning over the generated `/icon`.
  - The share card uses a short `brandMark.tagline`, not `siteConfig.description`
    — the description overflowed the card at display size, verified by rendering
    it.
- **The panel's collapsed toggle moved bottom-right**, off the contact pill it
  was covering.

## 2026-07-31 (fourteenth pass)

- **The board was removed.** It had been reduced to a single flat colour, which
  the renderer's clear colour already provides — so the plane, its two baked
  geometries, three materials, transform hierarchy, cursor tilt, fog and nine
  settings all went, replaced by `stage.color`. ADR-0022 in [[decisions-log]].
  - `SurfaceKey` narrows from four to two; the panel loses both board-material
    sections and gains a one-row "Backdrop".
  - **Presets copied before this restore nothing for the backdrop** — their
    `board` key matches nothing and `stage` is absent. The default was seeded
    from the last `solidColor` (`#0b2a6f`) so nothing changed visually.
- **Applied a supplied preset.** Only the post group differed:
  `bloomIntensity` 0.9 → **0**, `focusRange` 14 → **3.4**, `bokehScale`
  0 → **5.9**. Everything else already matched. Bloom at zero is dropped from
  the chain by the same rule that already drops depth of field at zero bokeh.
- **The headline doubles above 1440** (`text-display-wide`, 96px, at the new
  `wide:` breakpoint). Stat figures stay at 48px. It fits only there: within one
  adaptive-grid band the font and column scale together so the ratio is fixed,
  and below 1440 the headline already fills 99% of its column. Measured at four
  widths — table in [[home-hero]].
  - `--breakpoint-wide` is a **literal** in `@theme` and cannot be anything else:
    a media query condition cannot resolve a `var()`. Noted in [[design-system]].

## 2026-07-31 (thirteenth pass)

- **The board can be a solid colour instead of a checkerboard.** New
  `board.solid` toggle and `board.solidColor` picker in the panel's
  "Board · fill & placement" section (renamed from "Board placement"). Both
  round-trip through `Copy JSON` like everything else in `board`.
  - Built as **two sets of meshes toggled by `visible`**, not a material swap:
    `renderer.compile` walks hidden objects too, so both programs link during
    prewarm and the switch never stalls a frame.
  - The fill is a `MeshBasicMaterial` with `toneMapped: false` — a colour picker
    should give you the colour you picked, and a lit or tone-mapped material
    would shade or shift it. Fog stays on so the far edge still dissolves.
  - `BoardControls` now renders toggles and colours, not just sliders.

## 2026-07-31 (twelfth pass)

- **Ported the home page UI from Figma** (node `1097:251`) — top bar, copy
  column, the scene in the middle, and a 2 × 2 figure grid. New
  `src/views/home/` with `index.tsx`, `site-header.tsx`, `hero-intro.tsx`,
  `stat-grid.tsx`; `views/home.tsx` removed. Full note: [[home-hero]].
  - Layout is proportional (`fr` ratios + the adaptive grid), not absolute, and
    was **verified numerically**: at 1440 × 800 the build reports the design's
    own coordinates to ±1px.
  - **`get_design_context` was unavailable throughout** — seven timeouts across
    the frame, sub-frames and single text nodes. Geometry came from
    `get_metadata` (exact); type and colour were matched by eye against
    `get_screenshot`. `--raw-color-ink-900` and `--raw-color-rule` are therefore
    approximations, flagged in [[home-hero]].
- **Fonts replaced.** Onest (Google) is gone — it was a third family doing
  General Sans's job. The two supplied faces are loaded with `next/font/local`
  from `src/app/fonts/`: **General Sans Medium** → `--font-sans`, **Jersey 25** →
  `--font-display`. See [[design-system]].
- **New tokens** — `--color-ink` / `--color-rule` / `--color-veil` /
  `--color-surface-invert`, a `text-display` / `text-body` / `text-logo` scale,
  and layout metrics (`shell-inset`, `shell-gutter`, `topbar`, `action`,
  `action-icon`, `marker`, `contact`).
- **The scene is no longer a floating card.** It fills the hero's centre column
  (`513,55,414,745` in the design), so the `--scene-frame-*` tokens and the
  `min(92vw, …)` sizing are gone. `body` also lost the starter's flex-centring
  and `100vw`.
- **Copy replaced wholesale except the company name**, in
  `src/data/mocks/home.ts`. The design's own strings were placeholder too.
- Known gap: below 1024px the starter's adaptive grid switches to a 1024 base
  width, so type runs large against a 1440-based composition. No Figma frame
  exists for the smaller breakpoints yet.

## 2026-07-31 (eleventh pass)

- **Applied a supplied preset** — the first one to carry a `camera` key, so the
  round-trip fixed last pass now works. Changes: king loses both reflection
  terms (`reflectivity` and `envMapIntensity` → 0) and softens
  (`roughness` 0.3, `emissiveIntensity` 0.33), so it is lit purely by the real
  lights and its own emissive; the cold rim shifts cyan → blue (`#5294ff`);
  `board.cursorTilt` 0.34 → 0.29; **depth-of-field blur off**
  (`post.bokehScale` 16 → 0); and much chunkier background blocks
  (`backdrop.cellSize` 7 → 28) with a far wider ripple (`cursorRadius`
  300 → 900). Everything else was already at these values.
- **Depth of field is now skipped when `bokehScale` is 0.** At zero the pass
  produced no blur but still rendered its full chain every frame. Same image,
  one fewer full-screen pass — `optimize-3d-scene` §7, "skip a pass that
  contributes nothing". Verified both ways: sharp at 0, blur back at 10.

## 2026-07-31 (tenth pass)

- **Camera framing is now live in the panel** — a "Camera" section with field of
  view, distance, height and aim height. It was a `CAMERA` module constant, so
  it was invisible to the panel *and* absent from `Copy JSON`: pasting a copied
  preset back restored everything except the framing, which is what "the copy
  button doesn't work / not all settings applied" actually was. Only the clip
  planes stay constant (`CAMERA_CLIP`).
  - `fov` changes rebuild the projection matrix and are guarded; position and
    aim are plain per-frame writes.
- **`Copy JSON` hardened.** The button itself was verified working — instrumented
  `clipboard.writeText`, confirmed one call, no error, live values, all groups —
  but it had no failure path: `navigator.clipboard` is absent outside a secure
  context and rejects when the document is unfocused, and the rejection was
  unhandled with no failure state, so either case looked like a dead button. It
  now falls back to a selection copy and shows **Copy failed**.
- Serialised presets gained a `camera` key (ten groups now). A preset copied
  before this change restores everything but the framing.

## 2026-07-31 (ninth pass)

- **King precession faster again** — `kingSpin` 0.65 → **1.1**, a full sweep in
  ~5.7s.
- **Camera pulled in** — `CAMERA.position` z 12.5 → **10** (and y 1.5 → 1.25).
  Moving the camera rather than narrowing the fov, so the pieces keep their
  perspective instead of flattening.
- **Cursor slowed and re-leaned** — `SPIN` 1.15 → **0.45** turns/sec, `TILT`
  −0.32 → **+0.32**.
- **`HOTSPOT` re-measured** to 0.46 / 0.26 after the tilt flip. First attempt
  assumed flipping `TILT` would mirror it, which overshot by ~13px: the model's
  arrow points up-left at either lean, and only the lean angle changes. Now
  within ~4px of the pointer, which is about the limit — the model turns, so its
  tip sweeps horizontally every cycle. Noted in [[components/common]].
- The supplied preset was **byte-identical to the current defaults** (all eight
  groups including `backdrop`), so nothing was applied from it; `kingSpin` was
  then raised past its value on request.

## 2026-07-31 (eighth pass)

- **Background settings are now in the panel** — a "Background · pixel waves"
  section driving pixel size, wave density, drift speed, shades, and the four
  cursor-ripple parameters. `PixelWaves` lost its props and reads
  `lib/backdrop-settings.ts` with `getState()` inside the loop; a selector would
  re-render the component and re-run its whole effect on every slider tick.
- **The panel moved out of the scene** to `components/common/controls-panel/`
  (`SettingsPanel` → `ControlsPanel`), and backdrop settings got their own store
  rather than a slice of the scene store. ADR-0021 in [[decisions-log]].
  `Reset` and `Copy JSON` now act on both stores — the serialised JSON gained a
  `backdrop` key, so a preset copied before this change restores the scene but
  leaves the background at defaults.
- **New `Cursor3D`** — the native cursor is replaced by the `normal` node from
  `public/assets/cursor.glb`: leaning like a real pointer and turning about its
  own axis. The `hover` node is swapped in over links, buttons and other
  interactive elements and does **not** turn; it is otherwise untouched pending
  a real UI. Rendering is `lib/cursor-scene.ts` — a second 64px WebGL context
  with an orthographic camera, since perspective distorts a turning cursor.
  Position is written from the `pointermove` handler rather than the render
  loop, because a cursor lagging its pointer by a frame is obvious.
  `.custom-cursor-active` (added only *after* the scene resolves, so a failure
  leaves the native cursor intact) hides the real one.
- Known gap, deliberate: the hover variant's hotspot is inherited from the arrow
  and sits low and right of the true point. To be fixed when that variant is
  styled.

## 2026-07-31 (seventh pass)

- **Pixel waves are finer and interactive.** `cellSize` 14 → **7** with the wave
  frequencies roughly halved to match, so the blocks shrink without the wave
  shapes shrinking with them — the tiling was reading as too coarse. A
  concentric **cursor ripple** is now summed into the wave *before*
  quantisation, so it bends the existing field rather than painting a separate
  highlight over it; the centre trails the pointer, snaps on the first move and
  fades in over ~0.45s. New `cursorRadius` prop (default 300px).
- **`lib/scene/pointer.ts` moved to `lib/pointer.ts`** — it stopped being
  scene-specific once the background wanted it. `attachPointer()` is now
  **reference-counted**: with two consumers, the un-counted version let
  whichever unmounted first tear the listener out from under the other and reset
  `moved` to false. Imports updated in `chess-scene.ts`, `chess-physics.ts` and
  `chess-scene.tsx`.
- Cost note recorded in [[components/common]]: the field scales with CSS
  viewport area ÷ `cellSize²` and is DPR-independent, so halving `cellSize`
  quadruples the per-frame work (≈24k cells at 1440 × 800).

## 2026-07-31 (sixth pass)

- **The page background is now brand blue `#004AC7`**, not black. The WebGL
  backdrop inside the scene card keeps its own black, so card and page are
  deliberately separate surfaces where they previously shared one colour — the
  note in [[design-system]] about "no seam between canvas and page" was updated
  rather than left stale.
- **New `PixelWaves` background component** (`components/common/pixel-waves/`,
  mounted in the root layout) — a soft field of drifting pixel blocks in shades
  either side of the background (`--raw-color-brand-500/700`). Catalogued in
  [[components/common]]. New tokens: a `--raw-color-brand-*` ramp,
  `--backdrop-wave-low/high`, and a `.pixelated` utility.
  - Drawn on a canvas of **one pixel per wave cell** and scaled up with
    `image-rendering: pixelated` — a few thousand `ImageData` writes per frame
    instead of a few million.
  - **First attempt read as a smooth gradient**, not pixels: the blocks were
    genuinely there and crisply scaled, but neighbouring cells differed by a
    fraction of a channel. Fixed by quantising the wave to five flat shades,
    which is what gives each block a visible edge.
  - Continuous motion, so neither a spring nor a CSS transition applies and
    `@keyframes` are banned — it subscribes to the shared ticker at a 30fps
    budget. `prefers-reduced-motion` draws one frame and never subscribes.

## 2026-07-31 (fifth pass)

- **Applied a new supplied look preset** to `chess-defaults.ts` — a cool,
  high-key palette replacing the previous warm one: chrome pieces
  (`#d1d1d1`, `metalness` 1) instead of near-black, pure-black dark squares
  (`envMapIntensity` 0) against **glowing blue light squares** (`#0055ff` with a
  `#e0f9ff` emissive at 1.86), both rims now cool (cyan `#52fff3` / blue
  `#001eff`), no ambient, no vignette, and a much wider focus range with heavy
  bokeh (14 / 16). The board also moved out and shrank (`distance` 20,
  `scale` 1.85, `tilt` 1.435), so far more squares are in frame.
- **Two values deliberately depart from that preset, on request:**
  `motion.kingSpin` 0.32 → **0.65** (a full precession in ~10s rather than ~20s)
  and `motion.magnetAmount` 0.6 → **0.85** (a stronger inward stroke — pieces
  are drawn visibly tighter against the king before the swing reverses; the
  capsule contacts from ADR-0020 are what stop them reaching it).
- Noted in [[chess-scene]] that the `cold` / `warm` light settings are **role
  names for the two rim slots, not colour promises** — this preset drives both
  cool, and the keys should not be renamed to chase a palette.

## 2026-07-31 (fourth pass)

- **Pieces are larger (~1.3×) and packed closer** — `PIECE_HEIGHTS` raised and
  `orbitRadius` 3.9 → 3.5, with the preferred-radius band narrowed to 0.9–1.18
  and the height spread tightened, so the swarm reads as a cluster pressed
  around the king rather than a cloud. 3.1 was tried first and buried the king
  on the magnet's inward stroke.
- **Collision primitive changed from sphere to capsule.** At the new size and
  density the sphere approximation failed in both directions — visible gaps side
  by side, lap-through end-on — and no single fudge factor fixes both. Pieces now
  collide as capsules along their own axis, sized from a measured half-width
  rather than a bounding sphere, via segment-to-segment closest points. Solver
  went from 2 substeps × 1 pass to 4 × 2, and orientation is integrated inside
  the substep so contacts test current geometry. ADR-0020 in [[decisions-log]].
  Verified with a stress test: 22 pieces at minimum orbit radius stay separated
  and do not breach the king.
- **The king now precesses about world Y** instead of turning about its own
  tilted axis. Same lean angle; the lean *direction* sweeps around the vertical.
  The old nesting rotated a near-solid-of-revolution about its own axis, which
  read as almost no motion.
- **Dev server pinned to port 3200** (`.claude/launch.json`, `autoPort: false`).
  It had been taking a fresh random port on every restart because port 3000 is
  occupied by another project on this machine.

## 2026-07-31 (later still)

- **The scene is now a centred portrait card, not a full-bleed canvas.** Cropped
  to `min(92vw, 92lvh × 0.7)` at a 0.7 aspect with rounded corners, on the page's
  void black — matching a supplied reference frame (measured 515 × 736 at
  1440 × 800 against the reference's 512 × 734). New tokens
  `--raw-aspect-scene` / `--raw-size-scene-fill` / `--raw-radius-scene-frame`
  → `--scene-*` → `--container-scene-frame` (`max-w-scene-frame`) and
  `--radius-scene-frame` (`rounded-scene-frame`). See [[design-system]] and
  [[chess-scene]].
- **Side effect worth noting:** the camera aspect is now portrait, so the
  horizontal field of view is much narrower. Vertical framing is unchanged —
  three's `fov` is the vertical one — but the sides of the composition are
  cropped away, and the board reads more zoomed than it did full-bleed.
  Recompose via the board/camera settings, not the frame.

## 2026-07-31 (later)

- **The black pieces are now simulated rigid bodies, not scripted orbits.**
  Reported as three separate "looks fake" problems and all three were real:
  pieces passed through each other (no contact test existed), nothing magnetised
  to the king (the "magnetism" was a sine on the orbital radius — a position
  curve, with no acceleration the eye could read as a force), and pieces stopped
  dead when the cursor left (a stiff spring back to a fixed path killed the
  motion in ~0.2s). Replaced with `lib/scene/chess-physics.ts`: real linear and
  angular velocity, an alternating radial magnet force, pairwise impulse contact
  with restitution and spin transfer, a collision capsule for the king, and a
  cursor impulse against low drag so scattered pieces coast. ADR-0019 in
  [[decisions-log]]. `chess-orbits.ts` removed.
- **Two new motion controls: `drag` and `bounce`** — inertia and contact
  restitution, both of which want tuning by eye.
- **Fixed: the "Orbit radius" slider did nothing.** Each body's preferred radius
  was baked as an absolute distance at construction, so the control moved and the
  scene ignored it. It is a ratio of the live setting now. Found by using the
  slider as a test instrument rather than by reading the code.
- **Applied a supplied look preset** to `chess-defaults.ts`: metallic, strongly
  emissive king (`metalness` 1, `envMapIntensity` 2.35, `emissiveIntensity`
  0.55), **emissive white board light-squares** (`emissiveIntensity` 1.27), a
  much stronger cold rim (154), and a near-vertical board (`tilt` 1.52,
  `distance` 13.8, `cursorTilt` 0.34). This is a deliberate departure from the
  original black-void reference — the board now reads as a lit checkerboard
  backdrop rather than dissolving into darkness.

## 2026-07-31

- **Home page is now an interactive 3D chess scene** — the previously empty home
  view renders a full-bleed WebGL scene: a white king leaning and turning at the
  centre, black pieces on deterministic orbits that breathe in and out ("magnetism")
  and scatter from the cursor, and a chessboard receding into a black void behind,
  tilting slightly with the pointer. Lighting reproduces a supplied reference
  frame — black void, hard white key on the king, one cold and one warm rim.
  Full documentation: [[chess-scene]].
- **New dependencies: `three` `0.185.1` and `postprocessing` `6.39.4`** (plus
  `@types/three`). Draco decoder vendored to `public/draco/` — kept local, never
  a CDN. See [[tech-stack]].
- **`@react-three/fiber` / `drei` / `postprocessing` were installed, used, and
  then removed.** R3F v9's global `JSX.IntrinsicElements` augmentation breaks the
  vendored spring engine's `animated[tag] as ElementType` pattern — five
  `#do-not-modify` files stopped type-checking. No local shim can undo it, so the
  scene was rewritten against three.js directly. ADR-0018 in [[decisions-log]].
- **New scene control panel** — every material parameter for the king, the black
  pieces and both sets of board squares, plus lighting, motion, board placement
  and post-processing. Built in-house on design tokens rather than `leva`, which
  would style straight past them. **Copy JSON** serialises a tuned look for
  pasting back into `src/lib/scene/chess-defaults.ts`.
- **Theme is now dark-only** — `--background` is a new `--raw-color-void`
  (`#000000`) in both colour schemes, matching the WebGL backdrop so there is no
  seam between canvas and page. Added panel surface/foreground/accent tokens and
  native-control geometry primitives (consumed only from vendor pseudo-elements
  in `@layer components`). See [[design-system]].
- **`public/**` added to the ESLint ignore list** — the vendored Draco decoder is
  minified third-party output and was failing `no-require-imports` / `no-this-alias`.
- **`/` is now a dynamic route (`ƒ`)**, not static: `isBot()` reads `headers()` so
  crawlers get the copy and no WebGL bundle at all. That is the deliberate trade
  described in `optimize-3d-scene` §1.
- **Not measured on a real device.** DPR clamps, frame budgets and tier gates are
  ported from the skill's canonical values, not tuned against numbers from this
  scene. §0 has not been run.

## 2026-07-25

- **Released into the public domain (Unlicense)** — the starter now ships a root
  `LICENSE.md` carrying the [Unlicense](https://unlicense.org) and declares
  `"license": "Unlicense"` in `package.json`. Anyone may copy, modify, sell, or
  redistribute it with **no attribution requirement and no copyright retained** —
  the intent being that projects built from this starter can absorb it wholesale
  without carrying a notice. Briefly authored as MIT in the same session and
  changed before any release; the MIT attribution clause was the specific thing
  being dropped, so a recognized no-attribution licence was chosen over an
  edited MIT text. `"private": true` is unchanged, so npm publishing stays
  blocked regardless — the licence governs redistribution of the source, not
  registry availability.

## 2026-07-24

- **`optimize-3d-scene` hardened from its first field run** — the skill was run
  on a real raw-WebGL scene (no three.js, no scroll) and eight gaps came back,
  ranked by the time each cost. Fixed in `SKILL.md` and `references/patterns.md`:
  **§0** now ships a `getContext` hook so a non-three.js scene has counted
  equivalents of `renderer.info` (`draws` / `verts` / `links[]` timestamps /
  captured `attrs`) — previously §0 was unexecutable there — plus the
  *measurement environment* rules that invalidate everything if missed
  (production build only: dev's eager chunks fake a §1 failure and Strict Mode's
  double-mount fakes 2 listeners and a halved fps; kill the stale server;
  `waitUntil: "load"`, since `networkidle0` never fires against `next start`;
  SwiftShader is not a GPU, so only counted quantities transfer). **§3** now
  states that **§1 breaks it** — `dynamic(ssr: false)` pushes compilation past
  hydration, measured at 5.0 s against a loader lifting at 2.36 s — and gains a
  fifth stall cause (CPU decode/parse → **Worker**, 3.9 s measured) and the
  `as="fetch"` preload credentials trap (only `use-credentials` + `include`
  dedupes; the others silently download twice). **§5** admits `1000/30` measures
  ~26 fps given the ticker's `<=` throttle. **§7** requires a decile ordering
  check before truncating a baked point buffer (one was spatially sorted —
  truncating would have deleted half the subject). **§13** splits canvas `lvh`
  from content `dvh`. **§1**'s poster is rejustified — crawler screenshots and
  the no-WebGL fallback, not layout stability — with two crops and the
  `headers()` → static-prerender (`○`→`ƒ`) trade-off named. Unchanged on
  purpose: the cheapest-first order, the canonical-file table, and "port, don't
  invent". ADR: [[decisions-log]] ADR-0017.
- **`optimize-3d-scene` skill registered in the vault** — the new skill at
  `.claude/skills/optimize-3d-scene/` is now a first-class part of the workflow
  set, documented in [[optimize-3d-scene]] and linked from the
  [[README|Map of Content]] and [[ai-agent-guide]].
  **Routing rule (AGENTS.md hard rule #11):**
  a performance / jank / pre-ship request on a project that renders a three.js
  or WebGL scene must invoke the skill and follow its fourteen-step order — no
  improvised fix list. The vault note also maps the skill's canonical patterns
  onto primitives the starter *already* ships, so nothing gets duplicated:
  `subscribeToTicker` (`src/lib/animation/ticker.ts`, ADR-0009) is the one
  app-wide rAF loop the skill's §4/§5 ask for, `isBot()` (`src/utils/is-bot.ts`,
  ADR-0010) is the §1 bot path, the Lenis scroll store is the §9/§10 scroll
  source, `useDynamicInView` is the §4 visibility gate, and `lvh.ts` covers §13
  sizing. Only device tiering (§2) has no local equivalent. The starter itself
  carries **no `three` dependency** ([[tech-stack]] unchanged) — this applies to
  projects built from it. ADR: [[decisions-log]] ADR-0016.
- **Fixed a broken path inside the skill** — its closing "write it down" step
  pointed at `obsidian/Meta/changelog.md` / `decisions-log.md` (capital `M`, and
  an `open-questions.md` that does not exist here), so an agent following it
  would have written to a non-existent folder. Rewritten against this vault's
  actual `obsidian/meta/` layout.
- **`ai-agent-guide` gained a Skills section** — how skills are registered
  (drop in `.claude/skills/<name>/`, add a `workflows/` note, link from the MoC
  and the skills table, log in the changelog), so the next skill follows the
  same path.

## 2026-07-17

- **README — one-prompt quick start** — added a copy-paste **⚡ Start in one
  prompt** block at the top of the README: a single prompt that has Claude Code
  (or Cursor) clone the starter, detach it from this repo's git history, read the
  vault first, and run the default install. The manual [Getting started](../../README.md#getting-started)
  path stays below for anyone who prefers it.
- **Fixed: `cp .env.example .env` broke `/api/contact`** — surfaced by writing
  that step into the quick-start prompt. Copying the example leaves
  `CONTACT_ENDPOINT=` (blank), which reaches zod as `""`, and `""` is not
  `undefined` — so `z.url().optional()` rejected it. The route returned **HTTP
  400 `{"path":"CONTACT_ENDPOINT","message":"Invalid URL"}`**, misreporting a
  *server misconfiguration* as the caller's bad input. `src/env.ts` now routes
  optional URLs through an `optionalUrl()` helper that preprocesses `""` →
  `undefined`. Verified end-to-end: a valid POST now returns 200, and genuinely
  invalid payloads still return 400. Any new **optional** variable must use the
  same helper — see [[environment-variables]].
- **README — corrected clone URL & Node requirement** — step 1 pointed at
  `github.com/textura/next16-claude-starter` (wrong org — the repo is
  `textura-agency/…`), so the documented clone would 404. Also added the Node
  floor (**22.13+**; 20.19+ works, 24 LTS recommended) — below it `yarn install`
  fails outright on `eslint-visitor-keys` — and the missing
  `cp .env.example .env` step.
- **TextEngine alignment & clipping rules documented** — two failure modes that
  bite every TextEngine block, now written into [[text-engine]] (new *Alignment &
  line-height* section), [[text-engine-reference]], and AGENTS.md hard rule #3.
  **(1)** The container renders `display: flex; flex-wrap: wrap`, so words are
  flex items and `text-align` cannot position them — a lone `text-center`
  silently does nothing. Always pair `text-*` with `justify-*` on the tag
  (`justify-between` is a trap: it spreads *words*, not lines). **(2)** `overflow`
  sets `overflow: hidden` on `inline-block` wrap layers whose height comes from
  `line-height`, so tight leading shaves descenders and accented caps — keep
  leading ≥ 1.1 via the new `leading-display` token, never `leading-none` with
  `overflow`, and watch for `text-5xl`+ which ship `line-height: 1`. Both fixes
  are **classes on the `TextEngine` tag** — no wrapper component, no helper to
  import. Verified against the `spring-text-engine@0.1.5` dist source.
- **Strict three-tier token naming convention** — tokens now follow a fixed,
  portable grammar so names are predictable across every project built from this
  starter: `--raw-<category>-<name>` primitives → `--<role>` semantic →
  `--<tw-namespace>-<role>: var(--<role>)` bindings in `@theme inline`. Only
  Tier 1 holds literals; Tier 2 names purpose and is the themeable layer.
  `globals.css` restructured accordingly — **no brand palette invented**, the
  convention is the deliverable. Two deviations from the reference article,
  verified by compiling a probe against `tailwindcss` v4.3.3: primitives are
  `--raw-*` and stay out of `@theme` (a `--color-*` entry would generate
  utilities and let markup skip the semantic tier), and **`--duration-*` is not a
  Tailwind v4 namespace** — `duration-fast` compiles to nothing, so durations
  stay Tier 2 and are used as `duration-[var(--duration-fast)]`. See
  [[decisions-log]] ADR-0015 and [[design-system]].
- **Narrow CSS-transition exception** — hard rule #1 no longer bans CSS
  transitions outright. CSS `transition-*` is allowed for simple discrete state
  changes only (hover/focus colour, opacity, border, small nudges), requiring
  token-backed timing (`duration-[var(--duration-fast)] ease-entrance`),
  `transition-*` only (`@keyframes` still banned), and utilities only. Everything
  scroll-driven, revealing, staggered, or layout-affecting stays spring-based.
  A hover colour fade no longer needs a client component wrapping `<Hover>`. See
  [[decisions-log]] ADR-0014, [[animation-system]], [[design-system]].
- **New tokens** — `--raw-color-white` / `--raw-color-neutral-100/900/950`,
  `--raw-duration-fast/normal`, `--duration-fast/normal`, `--leading-display`
  (1.1 — the TextEngine clip floor), `--ease-entrance`.
- **Build & lint verified clean** — `yarn lint` and `yarn build` both pass with 0
  errors and 0 warnings; no lint fixes were needed. Note: `yarn install` **fails
  on Node 20.17** (`eslint-visitor-keys` requires `^20.19 || ^22.13 || >=24`) —
  use Node ≥ 20.19; this repo was verified on 24.16.

## 2026-06-07

- **Fixed `<Inview>` standalone reveal + spring resize gating** — `<Inview>`
  never animated unless an external `trigger` ref was passed. The JSX `ref`
  callback wrote `inViewRef.current = node`, but that tuple slot is a *callback
  ref* (`setNode`), so the element was never observed and the `node` stayed
  `null`. Now calls `setInViewNode(node)`. This was also a build-breaking type
  error. Additionally, `<Inview>`, `<Spring>`, and `<Hover>` tracked `width` as a
  hook dependency but never passed it to `isMobileDisabled` — fixed by passing the
  tracked `width`, restoring resize re-evaluation and clearing the
  `react-hooks/exhaustive-deps` warnings. `yarn build` and `yarn lint` are now
  clean. See [[decisions-log]] ADR-0013 and [[components/animation-springs]].

## 2026-06-05

- **Home view emptied** — removed the animation showcase (`src/views/home-showcase.tsx`
  deleted) and reduced `HomeView` to an empty `<main>`. The home view is now the
  blank starting point for new work. Documented the convention — *if the project
  is empty and no other instructions are provided, start developing in the home
  view on route `/`* — in [[ai-agent-guide]] and [[new-page]].

## 2026-05-23

- **README — setup + Vercel deploy steps added** — *Getting started* expanded
  into a four-step flow (clone the template → delete bundled `.git` →
  initialise your own GitHub repo → install & run), with a macOS hint for
  revealing the hidden `.git` folder (`⇧ + ⌘ + .`). Added a *🚀 Deploy to
  Vercel* section covering the CLI flow (`vercel` / `vercel --prod`) and the
  dashboard import path, plus an `env pull` pointer to
  [[environment-variables]].
- **README rewritten to lead with the AI workflow** — root `README.md`
  reorganised so the AI usage guide is the first section: how the three
  `.claude/settings.json` hooks (`SessionStart`, `UserPromptSubmit`, `Stop`)
  enforce the vault workflow automatically, how to write a good request
  against this convention layer, and a cost-expectations note recommending
  **Claude Max (5×)** as the minimum plan (the vault-fan-out + hook
  re-injection on every turn is token-intensive by design). Technical
  *Getting started* and the existing AI-agents entry-point pointer stay
  below.

## 2026-05-22

- **Styling-placement convention added** — to stop `globals.css` accumulating
  hundreds of component-specific classes, styling now follows a strict
  placement order: one-offs are Tailwind utilities, repeated patterns become
  **React components** (not `@layer components` classes), and `@layer
  components` is reserved strictly for pseudo-elements and third-party
  overrides. `globals.css` stays bounded — `@import`, tokens, base resets only.
  No CSS Modules. Codified in [[decisions-log]] ADR-0012; [[design-system]]
  (new *Where a style goes* section) and [[component-conventions]] updated.
- **Semantic-HTML / SEO-markup convention added** — new [[html-semantics]]
  rulebook: landmarks, one `<h1>` + heading outline, native elements over
  `div`s, forms/images/ARIA, JSON-LD over microdata, a `data-*` convention, and
  passing a semantic `tag` to animation components. Codified as AGENTS.md hard
  rule #10; cross-linked from [[component-conventions]] and [[new-page]]. Fixed
  the demo (`home-showcase.tsx`) to a single `<h1>` to follow it.
- **API layer added** — a convention for reaching external services.
  `app/api/<resource>/route.ts` Route Handlers own their logic and read secret
  env vars directly (safe — route files never reach the browser). New: `zod`
  dependency; `src/env.ts` (validated env, public/server split); `src/lib/api/`
  (`handle` wrapper + `ApiError` + `{ data }`/`{ error }` envelope);
  `src/lib/api-client.ts` (typed same-origin fetch); example
  `app/api/contact/route.ts`. Codified as AGENTS.md hard rule #9. See
  [[decisions-log]] ADR-0011 and [[api-architecture]].

## 2026-05-21

- **Asset convention added** — site content assets (images, videos) now live
  under `public/assets/<section>/`, one folder per section; meta/PWA/SEO assets
  stay at the `public/` root. Documented in [[folder-structure]],
  [[component-conventions]], and the [[new-page]] playbook; `public/assets/`
  created with a `.gitkeep`.
- **SEO & performance hardening** — a broad pass on the starter. **SEO:** new
  `src/lib/site.ts` config (single source of truth, fed by `NEXT_PUBLIC_SITE_URL`);
  `metadataBase` is now always set (relative OG/canonical URLs resolve);
  `themeColor` moved to a `viewport` export; added `app/robots.ts`,
  `app/sitemap.ts`, and an `Organization`+`WebSite` JSON-LD helper; OG image
  dimensions corrected to match the asset; dead `keywords`/`other` tags dropped.
  **Performance:** populated `next.config.ts` (`removeConsole` in prod,
  AVIF/WebP, `next/image` breakpoints aligned to the grid, `poweredByHeader:
  false`); fixed a `requestAnimationFrame` leak in `ScrollLayout` (Lenis loop
  never cancelled on unmount); `HomeView` is now a Server Component with the
  animation demo split into the `HomeShowcase` client leaf; added
  `<ReducedMotion>` (honours `prefers-reduced-motion` via react-spring's global
  `skipAnimation`); removed a per-frame `console.log` from the demo; added
  `app/loading.tsx` / `error.tsx` / `not-found.tsx`. See [[decisions-log]]
  ADR-0010, [[seo-metadata]], and [[environment-variables]].
- **Animation engine — lint pass** — cleared all 13 pre-existing ESLint problems
  in the engine (2 errors + 11 warnings), an authorized engine edit (ADR-0009).
  `isMobileDisabled` now takes an optional `viewportWidth` argument, so the
  `active` memos in `<Spring>` / `<Hover>` / `<Inview>` / the trigger hooks
  depend on it genuinely. Added missing `disableOnMobile` effect deps; fixed a
  `trigger.current`-in-cleanup hazard in `<Hover>`; ref-stabilised `<Handle>`'s
  transition effects. **API change:** `useProgressTrigger` now returns `progress`
  as a `RefObject<number>` (read `.current`) instead of a render-time ref read —
  no consumer was affected (`<ProgressTrigger>` discards the return).
- **Animation engine — performance refactor** — fixed load issues that scaled
  with the number of animated components. Added `src/lib/animation/ticker.ts`, a
  single reference-counted `requestAnimationFrame` loop; `useLoop` (and all loop
  hooks) now subscribe to it instead of each starting its own rAF. `useWindowWidth`
  / `Height` / `Size` now share one debounced `resize` listener via a
  `useSyncExternalStore` store (the `debounceDelay` param was dropped — unused).
  `useDynamicInView` rewritten without the per-render `Proxy`/observer churn.
  Fixed a stale-closure bug in `useLoop`. `mode="forward"` scroll listeners made
  `passive`. This was an **authorized edit to `#do-not-modify` engine files** —
  hard rule #2 amended. See [[decisions-log]] ADR-0009 and [[animation-system]].
- **`spring-text-engine` updated** — bumped `^0.1.3` → `^0.1.5` (latest). The
  public API, types, and dependencies are unchanged between these versions
  (verified) — an internal-only patch bump, no code changes required.
- **Adaptive scaling grid added** — a root-font-size scaling system landed in
  `src/components/common/grid/` (`<AdaptiveGrid>` + `useAdaptiveGrid` hook +
  `grid.config.ts`), with `vw` media queries in `globals.css` for scale-down.
  It was dropped into `common/` as a `styled-components` system; ported to the
  project stack — config-driven TS + CSS-only Tailwind, no `styled-components`.
  The unused dropped files (`colors.ts`, `fonts.ts`, `utils.ts`, `index.ts`,
  the `styled-components` `grid.tsx`) were removed. Mounted via `<AdaptiveGrid>`
  in the root layout. See [[components/common]] and [[decisions-log]] ADR-0008.
- **Vault created** — `obsidian/` Obsidian vault initialised as the project's
  second brain. Architecture, frontend, and workflow docs populated. See [[decisions-log]] ADR-0001.
- **Root README rewritten** — replaced `create-next-app` boilerplate with a real
  project README that points into this vault.
- **`generic-layout-prompt.md` moved** — relocated from repo root to
  `obsidian/workflows/` as [[generic-layout-prompt]].
- **Navigation convention resolved** — standard `next/link` confirmed; the unbuilt
  `<AnimLink>` / `useAnimRouter()` convention dropped. See [[decisions-log]] ADR-0005.
- **Docs consolidated into the vault** — `project-specs.md` deleted (decomposed into
  vault notes + new [[environment-variables]]); `text-engine-docs.md` moved in as
  [[text-engine-reference]]. `AGENTS.md` rewritten as a thin shim; `.cursorrules`
  repointed to `@AGENTS.md`. The vault is now the single source of truth.
  See [[decisions-log]] ADR-0006.
- **Vault renamed & restructured** — vault folder `getlayers.io/` → `obsidian/`;
  number prefixes dropped from section folders (`00-meta` → `meta`, etc.). Project
  name standardised to **`next16-claude-starter`** across docs and `package.json`.
- **Components linked to docs** — every file in `src/components/` now carries a
  `// 📖 Docs:` pointer comment to its catalog note, so agents can jump from code
  to docs and back.
- **Vault workflow automated** — added `.claude/settings.json` with `SessionStart`,
  `UserPromptSubmit`, and `Stop` hooks that make agents read the vault first,
  follow the relevant guide, and update docs after every change — with no manual
  reminder. See [[decisions-log]] ADR-0007 and [[ai-agent-guide]].
- **Cookie component replaced** — the `react-cookie-consent`-based `cookie.tsx`
  was replaced by an in-house `Cookie/` component (banner + category preferences
  modal + Zustand store). `react-cookie-consent` removed from dependencies. The
  component shipped using `styled-components` + an external design system; it was
  ported to the project stack — Tailwind v4 tokens and `@react-spring/web` motion.
  Mounted via `<LazyCookie>`. See [[components/common]].
- **Fixed TextEngine spring type mismatch** — the `mode="once"` heading in
  `views/home.tsx` mixed `lineIn={{ y: 0 }}` (number) with `lineOut={{ y: "100%" }}`
  (string), throwing *"Cannot animate between _AnimatedString and _AnimatedValue"*.
  Changed to `y: "0%"`. The buggy pattern in [[text-engine]] / [[text-engine-reference]]
  examples was corrected and a type-matching gotcha note added.

## Project baseline (git history)

| Commit | Description |
|--------|-------------|
| `94b0870` | feat: update starter |
| `5280ef2` | fix: linter errors & build |
| `b2b84e6` | initial — `next16-claude-starter` scaffold |

> [!note]
> The starter shipped with: Next.js 16.2, React 19.2, Tailwind v4, `@react-spring/web`,
> `spring-text-engine`, Lenis, and Zustand. See [[tech-stack]] for the current state.
