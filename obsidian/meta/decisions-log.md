---
tags: [meta, decision]
updated: 2026-09-19
---

# Decisions Log (ADRs)

Architecture Decision Records. Each entry captures a choice, its context, and its
consequences. Use [[templates/adr-note]] for new entries. Newest first.

---

## ADR-0026 — The reference's four set pieces, and what each one runs on

- **Status:** Accepted
- **Date:** 2026-09-19

**Context.** Four pieces of the reference had to be reproduced closely: the
hero grid that lights under the cursor, the bracketed word a terminal types,
the card row where one card is open at a time, and the step row that fills
itself in order. The project bans CSS keyframes and defaults everything to
springs, so each one needed a decision about *what kind of motion it is*
rather than a blanket answer.

**Decision.** Three mechanisms, chosen by what the motion actually is:

- **Canvas + the shared ticker** for the grid (`views/home/grid-field.tsx`).
  Each cell holds an energy value the pointer sets to 1 and the frame decays;
  the trail is the decay. A hundred DOM cells transitioning their opacity would
  be a hundred style recalculations a frame, and the grid rules themselves come
  free once there is a canvas. The loop stops drawing when nothing is lit.
- **A timeout chain** for the typed word (`views/home/typed-word.tsx`) and the
  ticker for the step fill (`views/home/how-it-works.tsx`). Neither is a value
  settling — one is characters on a clock, the other a sequence with an order —
  and a spring per character or per card would fight for the same wall time.
  The step rules animate `scaleX`, never `width`, so the row is not laid out
  again sixty times a second; the sequence starts on an `IntersectionObserver`,
  because a flow diagram that drew itself two screens ago is a static picture.
- **CSS transitions** for the card row (`views/home/key-value.tsx`), which is
  ADR-0014's case exactly: a discrete two-state change on `opacity`. The cards
  are height-locked so the open paragraph cannot push the row around.

**Consequences.** The grid is the page's one canvas outside the curtain and is
reused as the footer's call-to-action panel, so the last screen answers the
first. `SectionHead` grew an `aside` slot for the performance readout — the one
section whose heading shares its row with something.

---

## ADR-0025 — Pre-launch gate in `proxy.ts`, with a derived cookie

- **Status:** Accepted
- **Date:** 2026-09-19

**Context.** The site has a domain and a deployment before it has an
announcement. Anything reachable is indexable, screenshot-able and shareable,
and the brand layer is still a placeholder — so the whole site had to be closed
until a code is entered, without building real auth for a landing page.

**Decision.** Three small pieces:

- `src/proxy.ts` (**not** `middleware.ts` — Next 16 renamed the convention and
  warns on the old filename) **rewrites** every matched request to `/gate`
  unless the visitor's cookie matches. Rewrite, not redirect: the requested URL
  stays in the address bar, so entering the code lands the visitor on the page
  they actually asked for. The matcher excludes `_next/*` and the generated
  icon routes, or the gate screen could not load its own CSS and fonts.
- `src/lib/gate.ts` holds the one password (`SITE_PASSWORD`, defaulting to the
  agreed code) and derives the cookie value from it with FNV-1a. **The cookie
  never carries the password**, so devtools does not hand it over, and rotating
  the password invalidates every cookie already issued for free. The hash is
  synchronous because the proxy runs on every request and `crypto.subtle` is
  async.
- `app/api/gate/route.ts` does the comparison server-side and sets the httpOnly
  cookie. `secure` is decided **per request** (`x-forwarded-proto`), not from
  `NODE_ENV`: `next start` is production mode over plain http, where a `secure`
  cookie is silently dropped and the gate would be unopenable locally.

The gate screen (`views/gate/`) is the load curtain's flooded frame, frozen —
same cell size, same quantised field, drawn once per resize rather than per
frame — with one plate on it. `/gate` is `noindex`.

**Consequences.** This is a curtain, not a security boundary: it keeps the
project out of search results and out of the hands of anyone who stumbles on
the URL. Anything that must actually stay secret needs real auth. Removing the
gate later is deleting `src/proxy.ts`.

---

## ADR-0024 — The page assembles itself once the curtain has gone

- **Status:** Accepted
- **Date:** 2026-07-31
- **Supersedes:** the "curtain does the whole reveal" rule from the load-curtain work

**Context.** The load curtain (ADR-0023's sibling work) was built on a deliberate
rule: it does the entire reveal and nothing underneath animates. That rule had
two justifications, and by this point exactly one of them still held.

- *Still true:* content must not be at `opacity: 0` in the server render, and no
  ancestor of a `position: fixed` element may carry a `filter` or a `transform`.
- *No longer true:* that this forced the page to be static. The only `fixed`
  descendant of `<main>` was the controls panel, and ADR-0023 deleted it. The 3D
  cursor and the pixel-wave background are siblings of `<main>`, not children.

Meanwhile the curtain lifting on a finished, motionless page read as a wipe
followed by a screenshot.

**Decision.** Reverse it. `views/home/reveal.tsx` wraps a block in the vendored
`Spring` and holds it at `from` until `usePreloader`'s `done` flips; the headline
gets its own per-letter treatment through `TextEngine` (`views/home/headline.tsx`),
gated the same way.

Three constraints carried over rather than dropped:

- **Gated on `done`, never on mount.** A spring that plays behind an opaque
  overlay is a spring nobody sees, and the ordering would be fiction.
- **`opacity` and `transform` only.** The markup is in the document at full size
  from the first paint, so [[seo-metadata]]'s warning is still respected.
- **`Reveal` renders *as* the element**, taking its tag and its classes, rather
  than wrapping it. Wrapping a grid child inserts a div into the grid — which is
  the exact bug the stat cells already had once.

**Consequences.**

- Measured from the frame the curtain unmounts: logo 99ms · nav 165 · pill 299 ·
  last headline letter 499 · copy 732 · CTA 899 · first figure 999.
- **Anything `position: fixed` added under `<main>` now breaks.** That was always
  the rule; it is now load-bearing rather than theoretical. Put it in the layout,
  as a sibling.
- `site-header.tsx` became a client component. It needed to be anyway, for the
  burger.
- The headline animates **without `overflow`**. The engine's clip is bounded by
  the line-height box and this headline is set at 80% leading on purpose, so the
  clip would shave the glyphs — see [[text-engine]].

---

## ADR-0023 — The controls panel is removed

- **Status:** Accepted
- **Date:** 2026-07-31
- **Supersedes:** ADR-0021 (which moved the panel to page level)

**Context.** The panel existed to art-direct the scene by eye: every material,
light, motion, camera, post and background parameter, with `Reset` and
`Copy JSON` for round-tripping a look back into source. It did that job — the
current `chess-defaults.ts` and `backdrop-settings.ts` are its output. With the
look settled it was shipping a development tool to production, and it was also
the single `position: fixed` descendant of `<main>`, which blocked any transform
on the hero (see ADR-0024).

**Decision.** Delete `components/common/controls-panel/` and its mount.

**Kept:** both Zustand stores. Nothing writes to them now, but materials are
mutated imperatively through `useChessSettings.subscribe`, so they remain the
seam for changing the look mid-flight without restarting the canvas. Deleting
them would have meant collapsing that back into construction-time constants.

**Removed with it:** `serialiseSettings`, the `--raw-color-panel-*` and
`--*-control-*` token groups, the `.panel-range` / `.panel-swatch` `@layer
components` styles, and the `.scrollbar-none` utility. `ChessSceneProps` and the
`showPanel` prop went too; `LazyChessScene` is now the `dynamic()` call itself
rather than a wrapper forwarding props.

**Consequences.**

- Retuning the scene is now a source edit, not a drag — and there is no
  `Copy JSON` to produce a preset. If art direction reopens, restore the panel
  from history rather than rebuilding it.
- The `@layer components` block is down to `.custom-cursor-active`. The
  range/colour-input pseudo-element styles were this project's only genuinely
  unavoidable use of that layer (ADR-0012), and they are gone with the panel.

---

## ADR-0022 — The board is gone; a backdrop colour replaced it

- **Status:** Accepted
- **Date:** 2026-07-31

**Context.** The scene shipped with the GLB's `deck` — a checkerboard plane
behind the pieces, tilted, scaled and fogged so its far edge dissolved. It then
gained a solid-fill mode, and the preset that followed switched it on. At that
point the board was a flat colour occupying a tilted plane: two baked
geometries, three materials, a four-group transform hierarchy, fog, a
cursor-tilt lerp, and nine settings — all to paint one colour behind the pieces,
which the renderer's clear colour already does for free.

**Decision.** Remove it. `BoardSettings` becomes `StageSettings` with a single
`color`, and `scene.background` carries it.

Deleted along with it: `boardDark` / `boardLight` / `boardSolid` materials, the
`deck` extraction in `chess-model.ts`, `BOARD_NODE` and the two glTF material
names, the board's transform groups and cursor tilt, the scene `Fog` (it existed
only to fade the board's far edge — the pieces always opted out), and the panel's
two board-material sections plus its fill-and-placement section.

**Consequences.**

- `SurfaceKey` narrows from four members to two, which is why
  `chess-materials.ts` lost its `Record` shape and iterates an explicit list.
- **Presets copied before this restore nothing for the backdrop.** Their `board`
  key no longer matches anything and `stage` is absent, so the colour falls back
  to the default. The default was seeded from the last `solidColor` (`#0b2a6f`)
  so nothing changed visually at the cut.
- The light rig's short ranges were tuned to keep light *off* the board. With no
  board they only shape the pieces, so they are now stricter than they need to
  be — noted in [[chess-scene]] rather than silently re-tuned.
- If a board is ever wanted again it is a rebuild, not a flag. The geometry is
  still in `chess.glb`; nothing else survives.

---

## ADR-0021 — The controls panel is page-level, with one store per domain

- **Status:** Accepted
- **Date:** 2026-07-31

**Context.** The panel was built as part of the chess scene and lived at
`components/common/chess-scene/panel/`, reading a single store
(`lib/scene/chess-settings.ts`). Then the pixel-wave background needed its
parameters exposed in the same panel. That put a scene-scoped component in
charge of something that renders from the root layout and outlives the scene.

**Decision.** Two changes:

- The panel moved to `components/common/controls-panel/` and the component was
  renamed `SettingsPanel` → `ControlsPanel`. It is the page's art-direction HUD,
  not the scene's.
- Backdrop settings got their **own** store, `lib/backdrop-settings.ts`, rather
  than a slice of the scene store. The two have different lifetimes and
  different owners; merging them would mean the background's defaults live in
  `chess-defaults.ts`, which is already the scene's look preset.

`ChessScene` still *mounts* the panel. That is deliberate — mounting it from the
layout instead would put a large control surface on the bot path, which
`views/home.tsx` goes out of its way to keep clear.

**Consequences.**

- The panel now imports from two stores and its `Reset` and `Copy JSON` act on
  both. The serialised JSON gained a `backdrop` key, so a preset copied before
  this change will restore the scene but leave the background at defaults.
- A third domain (a future UI theme, say) should get a third store and a third
  section rather than being folded into either existing one.
- The panel is still unavailable when the scene fails to mount. If that ever
  matters — controlling a background you can see while the scene is broken —
  the fix is to mount it from the layout behind the same bot check the view
  uses, not to move it back.

---

## ADR-0020 — Pieces collide as capsules, not spheres

- **Status:** Accepted
- **Date:** 2026-07-31

**Context.** ADR-0019's simulation approximated each piece as a sphere sized
from its bounding sphere, trimmed by a `CONTACT_FIT` fudge factor. That was
adequate while pieces were small and sparse. Asked to make them ~1.3× larger and
pack them closer, it stopped being adequate in both directions at once:

- A chess piece is 4–6× taller than it is wide, so its bounding sphere is
  mostly empty space. Side by side, two pieces stopped with a visible gap.
- Trimming the sphere to close that gap is the same knob that lets pieces
  overlap end-on — a piece crossing another lengthwise had nothing to stop it.

There is no value of `CONTACT_FIT` that fixes both; the primitive was wrong.

**Decision.** Each piece is a **capsule along its own axis**. The radius comes
from a measured quantity — the widest distance from the piece's vertical axis,
computed once per part at load in `chess-model.ts` — rather than from a bounding
sphere. Contact is a segment-to-segment closest-point test (Ericson §5.1.9). The
king is a capsule too, rebuilt each frame from its live world axis since it
leans and precesses.

The solver also went from 2 substeps × 1 pass to **4 × 2**. A sequential-impulse
solver needs iterations to settle a pile; at the new density pieces hold three
or four simultaneous contacts, and one pass per frame leaves residual overlap
that compounds.

**Consequences.**

- Contact now looks like contact at any orientation, and interpenetration
  survives a stress test (22 pieces at minimum orbit radius stay separated and
  do not breach the king).
- `CONTACT_FIT` changed meaning: it was a fraction of the *bounding sphere*
  (0.58), and is now a small inset on the piece's *true half-width* (0.82). Read
  it as "how tightly the capsule hugs the silhouette".
- The capsule still over-estimates the narrow stems between base and head, so
  pieces meeting stem-to-stem keep a small gap. Modelling that away would take
  per-piece convex hulls, which is far more than the look needs.
- Cost is O(n²) segment tests × 4 substeps × 2 passes. Negligible at 12–22
  bodies; a swarm in the hundreds would need spatial hashing first.

---

## ADR-0019 — The black pieces are simulated, not scripted

- **Status:** Accepted
- **Date:** 2026-07-31

**Context.** The first motion model was a scripted orbit: each piece's position
was a pure function of time, with a small displacement spring layered on top for
the cursor. It was stable and cheap, and it looked wrong. Three specific
complaints, all correct:

1. **Pieces passed through each other.** There was no contact test at all —
   twelve bodies sharing a shell and never touching reads as a video overlay,
   not a scene.
2. **Nothing magnetised.** "Magnetism" was a sine on the orbital *radius*. A
   position that varies sinusoidally has no acceleration the eye can attribute
   to a force: pieces slid in and out at a constant-ish rate rather than being
   drawn in, overshooting, and being pushed back.
3. **No inertia off the cursor.** The displacement spring had stiffness 14 and
   damping 3.4 against a fixed path, so a scattered piece was back on its orbit
   in about two tenths of a second. Being shoved and instantly stopping is the
   single clearest "this is fake" signal available.

**Decision.** Replace it with a real rigid-body simulation
(`lib/scene/chess-physics.ts`). Every piece carries linear and angular velocity;
position changes only through accumulated force. Magnetism is a radial force
that alternates sign, contact is pairwise impulse resolution with restitution
and positional correction, the king is a collision capsule, and the cursor
applies an impulse against a low drag coefficient.

**The one thing that makes this safe:** tangential velocity is *regulated*
toward an orbital target, while radial velocity is left completely free. A fully
free simulation of twelve mutually-repelling bodies either clumps, spins up, or
diffuses off screen given enough minutes; regulating only the tangential
component removes all three failure modes without touching the axis the eye
actually reads for physicality.

**Consequences.**

- Contact, magnetism and inertia are all genuinely present and were verified by
  isolating them from the panel (zeroing orbit and magnet speed so only the
  cursor could move anything; collapsing the orbit radius so the swarm was
  forced into contact).
- Two new controls, `drag` and `bounce`, because the realism the simulation buys
  is only as good as those two numbers and they want tuning by eye.
- Cost is 66 pair tests × 2 substeps per frame at twelve bodies — negligible,
  but it is O(n²), so a much larger swarm would need spatial hashing.
- The simulation is no longer time-reversible or reproducible from a timestamp:
  the opening layout is seeded and deterministic, but the state after a minute
  depends on the whole history of collisions. Nothing in the scene relied on
  that, but a future "seek to time T" feature could not be built on it.

---

## ADR-0018 — The chess scene uses plain three.js, not react-three-fiber

- **Status:** Accepted
- **Date:** 2026-07-31

**Context.** The home page needed an animation-heavy WebGL scene ([[chess-scene]]).
The obvious stack was `@react-three/fiber` + `drei` + `@react-three/postprocessing`,
and it was built that way first — it rendered correctly.

Then `tsc` failed in five files nobody had touched:
`components/animation/springs/{spring,spring-trigger,hover,progress-trigger,animated-var-text-tag}.tsx`.

R3F v9 ships an unconditional global augmentation:

```ts
declare module 'react' { namespace JSX { interface IntrinsicElements extends ThreeElements {} } }
```

`ThreeElements` is `ThreeToJSXElements<typeof THREE>`, a mapped type over *every*
three.js export. Exports that are not constructors — constants, namespaces,
functions — map to `never`. So `React.JSX.IntrinsicElements` gains ~150 keys,
some of them typed `never`, for the whole program the moment any file imports
R3F.

`React.ElementType` is derived from `IntrinsicElements`. The vendored spring
engine does `const Tag = animated[tag] as ElementType` and then `<Tag ref
className style>`, so TypeScript now intersects props across a union containing
`never` members and every prop collapses to `never`.

**Options considered.**

1. **Module augmentation.** Tried, and it cannot work: declaration merging adds
   interface members, it cannot remove or retype the inherited `never` keys.
2. **Upgrade R3F.** 9.6.1 is the latest stable; only v10 canaries exist.
3. **Exclude the engine from `tsconfig`.** `exclude` only trims the *root* file
   list — imported files are still added to the program and still checked.
4. **Edit the five engine files** (`ElementType` → a non-union component type).
   A one-word change each, but `components/animation/springs/` is
   `#do-not-modify` and hard rule #2 requires explicit sign-off.
5. **Write the scene against three.js directly.**

**Decision.** Option 5. The scene is plain three.js in `src/lib/scene/`, with
React owning only the canvas element and the scene's lifetime.

**Consequences.**

- The `#do-not-modify` boundary holds with no negotiation, and the starter's
  spring engine keeps working for DOM motion exactly as documented.
- Three dependencies dropped (`@react-three/fiber`, `@react-three/drei`,
  `@react-three/postprocessing`); `three` and `postprocessing` remain.
- Two things drei gave for free had to be written: the PMREM environment built
  from emissive quads (`chess-environment.ts`, ~40 lines, replaces
  `<Environment>` + `<Lightformer>`) and the GLTF/Draco loading path
  (`chess-model.ts`, replaces `useGLTF`). Both are small and neither is
  load-bearing on R3F.
- It also lands closer to `optimize-3d-scene`, whose canonical implementations
  (`chain-scene.ts`, `canvas3d.ts`) are all plain three.js, and it lets the scene
  subscribe to the existing app-wide ticker instead of running R3F's own loop.
- **If R3F is ever wanted here**, this ADR is the thing to revisit: it needs
  either an R3F release that stops emitting `never`-valued JSX keys, or sign-off
  to edit the five engine files.

---

## ADR-0017 — A skill states its preconditions and its own internal conflicts

- **Status:** Accepted
- **Date:** 2026-07-24

**Context.** `optimize-3d-scene` (ADR-0016) was run for the first time on a real
scene outside this repo — a raw WebGL project, no three.js, no scroll. The fix
order held up; what cost hours was everything the skill left implicit. Ranked by
time burned:

1. **§0 could not be executed at all.** `renderer.info.render` /
   `.programs.length` exist only on `THREE.WebGLRenderer`, yet the skill's own
   title says "three.js / WebGL". The agent had to invent instrumentation before
   it could take a baseline.
2. **The measurement environment was never stated**, and all three failure modes
   fired: dev-mode numbers are invalid (eager chunk serving faked a §1 failure;
   Strict Mode's double-mount faked 2 listeners and a halved frame rate), a
   stale `next start` on the port served 500s that read as a code bug, and
   `waitUntil: "networkidle0"` never fires against `next start`.
3. **§1 actively breaks §3.** `dynamic(ssr: false)` means the scene cannot
   compile until after hydration; on Regular 3G + 4× CPU programs linked at
   5.0 s against a loader that lifted at 2.36 s. Two correct steps, silently
   contradicting each other.
4. **§3's stall list was GPU-only** — all four causes shader/texture/target —
   but the worst stall measured was a 3.9 s main-thread CPU decode. Workers
   appeared nowhere in the skill.

Plus four smaller ones: the `as="fetch"` preload credentials trap (only
`use-credentials` + `include` dedupes; the other pairings silently
double-download), §5's `1000/30` actually measuring ~26 fps because of how the
ticker throttles, §7's "cut the sparse end" having no lever on a *baked* point
buffer, and §13's `lvh` being read as applying to the layout when it is for the
canvas only.

**Decision.** Fold all of it back into the skill, and adopt two rules for how
this and every future skill is written:

- **A step states its preconditions.** §0 now ships a `getContext` hook that
  gives a raw WebGL scene the counted equivalents of `renderer.info`
  (`draws` / `verts` / `links[]` timestamps / captured `attrs`), and a
  *measurement environment* block: production build, kill the old server first,
  `waitUntil: "load"`, and — because SwiftShader is not a GPU — only counted
  quantities transfer, never absolute fps.
- **A step names where it fights another step.** §3 now carries the §1 conflict
  explicitly, with the measurement that exposes it (link timestamps vs handoff
  time) and the fix (preload the data from the HTML; gate the loader on
  scene-ready, not on a duration).

Also added: §3 gains a fifth stall cause (CPU decode → Worker, with
transfer-in-both-directions) and the preload-credentials warning; §5 states the
~26 fps reality; §7 requires a decile ordering check before truncating a baked
buffer; §13 splits canvas `lvh` from content `dvh`; §1's poster is rejustified
(crawler screenshots and the no-WebGL fallback — *not* layout stability) with
two crops for tighter-axis framing and the `headers()` → `○`→`ƒ` prerender
trade-off named.

**Consequences.** The skill now works on a scene with no three.js in it, and its
first section can be executed instead of merely read. The cost is a longer §0 —
an agent must build instrumentation and a production build before touching
anything — which is the correct tax: every number the skill asks for later is
worthless without it. Deliberately kept unchanged, because the field run
confirmed them: the cheapest-first ordering, the canonical-file table, and
"don't invent new shapes; port these" — the `device.ts` port dropped in clean
and is most of why that run went as fast as it did.

---

## ADR-0016 — Skills are registered in the vault, not just dropped in `.claude/`

- **Status:** Accepted
- **Date:** 2026-07-24

**Context.** The first Claude Code skill for this starter —
`optimize-3d-scene` — arrived as a folder under `.claude/skills/`. A skill there
is discoverable to Claude Code *at runtime*, but it is invisible to the vault:
nothing in `obsidian/` said it existed, when to reach for it, or how it relates
to the hard rules. That contradicts ADR-0006 (the vault is the single source of
truth) and leaves the invocation decision to model judgement — exactly the kind
of thing this project pins down in writing. A performance request on a
scene-carrying project would otherwise get whatever fix order the agent invented
that day, when the skill exists precisely because the order matters (audit →
bot path → tiering → prewarm → visibility gate → budgets → fill).

**Decision.** A skill is only "installed" once it is registered:

1. The skill lives at `.claude/skills/<name>/`.
2. A vault note under `workflows/` documents what it does, its trigger
   conditions, and how it maps onto this project's primitives.
3. It is linked from [[README]]'s Map of Content and from the skills table in
   [[ai-agent-guide]].
4. If invocation should be non-optional, the routing rule goes into AGENTS.md's
   hard rules — the shim every agent reads first.
5. It is logged in [[changelog]].

For `optimize-3d-scene` this became **hard rule #11**: a performance / jank /
pre-ship request **and** a three.js or WebGL scene in the project → invoke the
skill and follow its order. The vault note [[optimize-3d-scene]] additionally
maps the skill's canonical patterns (which reference an external workspace) onto
what the starter already ships — the shared ticker (ADR-0009) for its one-rAF
rule, `isBot()` (ADR-0010) for its bot path, the Lenis store for scroll, the
in-view hooks for its render gate — so following the skill does not produce a
second copy of infrastructure that exists.

**Consequences.** Skill invocation becomes a documented rule rather than a guess,
and the routing survives model, tool and session changes because it lives in
AGENTS.md and the vault, not only in the skill's own `description`. The cost is
one extra note plus two index edits per skill — the same tax every component and
hook already pays. The starter still ships **no `three` dependency**
([[tech-stack]] unchanged); rule #11 is dormant until a project adds one. A
wrong vault path inside the skill (`obsidian/Meta/…`, plus an `open-questions.md`
this vault does not have) was corrected as part of registering it — registration
is also the moment a skill gets checked against reality.

---

## ADR-0015 — Strict three-tier design-token naming convention

- **Status:** Accepted
- **Date:** 2026-07-17

**Context.** ADR-0004 made tokens the styling currency but never said what a token
should be *called*. The starter shipped two tokens (`--background`,
`--foreground`) and no grammar, so every project built from it would invent its
own — defeating the point of a shared starter, since an agent moving between
projects could not predict a token name without reading `globals.css`. Reference
taken from [Mavik Labs — *Design Tokens in Tailwind v4*](https://www.maviklabs.com/blog/design-tokens-tailwind-v4-2026/)
(three tiers: primitive → semantic → component).

**Decision.** Adopt the three-tier model with an explicit grammar, documented in
[[design-system]] and codified as AGENTS.md hard rule #4:

| Tier | Grammar | Lives in |
|------|---------|----------|
| Primitive | `--raw-<category>-<name>[-<shade>]` | `:root` |
| Semantic | `--<role>[-<variant>][-<state>]` | `:root` |
| Component | `--<tw-namespace>-<component>[-<property>]` | `@theme inline` |

- Only Tier 1 holds literals; Tier 2 names purpose, never appearance; Tier 2 is
  the themeable layer (dark mode overrides there). No tier may be skipped.
- Every `@theme inline` entry is exactly `--<namespace>-<role>: var(--<role>)`.
  `inline` is load-bearing — it inlines the `var()` into each utility so Tier 2
  overrides cascade; binding a literal freezes the value and breaks theming.
- Tier 3 stays rare by design (ADR-0012 prefers a React component).

**Two deliberate deviations from the reference article**, both verified against
`tailwindcss` v4.3.3 by compiling a probe stylesheet:
1. The article names primitives `--color-blue-500`. We prefix them `--raw-*` and
   keep them out of `@theme` — under Tailwind v4 a `--color-*` entry *generates
   utilities*, so naming primitives that way would emit a `bg-blue-500` for every
   raw value and let markup bypass the semantic tier.
2. The article lists `--duration-fast` / `--duration-normal` next to `--ease-*`.
   **There is no `--duration-*` namespace in Tailwind v4** — the probe confirmed
   `duration-fast` compiles to nothing and the variable is not even emitted from
   `@theme inline`. Durations therefore stay Tier 2 only, consumed as
   `duration-[var(--duration-fast)]`. (`--ease-*` *is* a real namespace and is used.)

Retrofit is **minimal and unopinionated**: the existing background/foreground
tokens were restructured into the tiers, and the primitives/durations/`--ease-entrance`
/`--leading-display` they imply were added. **No brand palette was invented** —
the convention is the deliverable; projects add `--raw-color-brand-*` themselves.

**Consequences.** Token names are now predictable across every project from this
starter. This **amends ADR-0004**, which said only that new values go in
`globals.css` first — they must now also follow the tier grammar. `globals.css`
grew a documented tier structure but stays bounded (ADR-0012). Existing markup is
unaffected: `bg-background` / `text-foreground` still resolve, since the Tier 2
names and `@theme` bindings kept their public names.

---

## ADR-0014 — Narrow CSS-transition exception for trivial state changes

- **Status:** Accepted
- **Date:** 2026-07-17

**Context.** ADR-0002 banned CSS transitions outright to force every motion
through the spring layer. In practice the ban's cost lands hardest where its
benefit is lowest: a nav link fading its colour on hover had to become a client
component wrapping `<Hover>` with a spring config, to animate one property that
no user will ever interrupt or perceive as physical. The rule pushed teams toward
either boilerplate or quiet rule-breaking.

**Decision.** Keep hard rule #1 for all real motion; carve out one narrow,
condition-bound exception. CSS `transition-*` is allowed **only** for simple,
discrete state changes — `hover:` / `focus-visible:` / `active:` colour, opacity,
border-colour, underline, and small decorative nudges — subject to three
conditions, all required:

1. **Token-backed timing** — `duration-[var(--duration-fast)] ease-entrance`; raw
   ms/cubic-bezier values remain banned by hard rule #4.
2. **`transition-*` only** — `@keyframes` stay banned outright. Anything long
   enough to need keyframes is long enough to deserve a spring.
3. **Utilities only** — the transition lives in `className`, never in a CSS file
   (ADR-0012).

Everything scroll-driven, revealing, layout-affecting, staggered, orchestrated,
or interruptible remains spring-based; text remains [[text-engine]]. Anything
past the allowed list is `<Hover>`.

**Consequences.** A hover colour change no longer needs a client component — the
common case gets cheaper and the spring layer keeps the cases it is actually good
at. This **amends ADR-0002**, whose "CSS transitions are banned" is now "CSS
keyframes are banned; transitions are limited to the list above". The exception is
deliberately narrow and enumerated rather than a judgement call ("simple
animations") so it cannot erode into general CSS animation. `--raw-duration-*` /
`--duration-*` / `--ease-entrance` tokens exist to serve it (ADR-0015).
[[animation-system]], [[design-system]], and [[ai-agent-guide]] updated to match.

---

## ADR-0013 — `<Inview>` self-observe fix; spring components honour resize

- **Status:** Accepted
- **Date:** 2026-06-07

**Context.** `<Inview>` only animated when an external `trigger` ref was passed.
Without one it never revealed. Root cause: `useDynamicInView` returns its target
attachment as a **callback ref** (`setNode`) in the first tuple slot, but
`in-view.tsx` destructured it as `inViewRef` and wrote `inViewRef.current = node`
in the JSX `ref` callback — assigning `.current` to a function instead of calling
it. `setNode` never ran, the observed `node` stayed `null`, and with no `trigger`
the observer had nothing to watch (`trigger?.current ?? node` → `null`). With a
`trigger` it worked only because `trigger.current` bypassed the dead `node` path.
TypeScript flagged this at build time (`Property 'current' does not exist on type
'TargetRefCallback'`), so the build was already failing.

Separately, `<Inview>`, `<Spring>`, and `<Hover>` tracked `width`
(`useWindowWidth()`) as a `useMemo`/`useEffect` dependency to re-evaluate mobile
gating on resize, but never passed it to `isMobileDisabled()` — so the value was
genuinely unused (ESLint `react-hooks/exhaustive-deps` warning) **and** resize
re-evaluation silently did nothing; the check always read `window.innerWidth` at
call time.

**Decision.** This is the second authorized edit to the `#do-not-modify` engine
(after ADR-0009). Two corrections:
1. In `in-view.tsx`, call the callback ref — `setInViewNode(node)` — instead of
   assigning `.current`, so the component observes itself when no `trigger` is
   given.
2. Pass the React-tracked `width` into every `isMobileDisabled(value, width)`
   call across `in-view.tsx`, `spring.tsx`, and `hover.tsx`. This is the
   documented second parameter of `isMobileDisabled` and makes the `width`
   dependency meaningful, fixing resize re-evaluation and clearing the lint
   warnings.

**Consequences.** `<Inview>` now works standalone (the common case). `yarn build`
and `yarn lint` are both clean (0 errors, 0 warnings). The springs folder remains
`#do-not-modify` by default — these were explicitly signed-off bug fixes.

---

## ADR-0012 — Styling lives in utilities and components, not `globals.css`

- **Status:** Accepted
- **Date:** 2026-05-22

**Context.** ADR-0004 made design tokens the styling currency and ruled that
"new values must be added to `globals.css` first." Combined with the
design-system guidance to *"extract repeated multi-class patterns to
`@layer components`"*, the path of least resistance for any repeated visual
pattern became a named class in `globals.css`. On an animation-heavy,
multi-section marketing site that grows the file without bound — a single
global stylesheet accumulating hundreds of component-specific classes that are
never deleted when their component is. The fix is a placement rule, not a
file-splitting trick: splitting `globals.css` into many files only spreads the
same bloat.

**Decision.** Styling follows a strict placement order; `globals.css` stays
bounded by design.

- One-off styling → **Tailwind utilities** in `className`. Nothing enters CSS.
- A repeated pattern with markup/structure/props → a **React component**
  (`components/ui/`), *not* a CSS class. This is the default answer to "this
  looks repeated" — e.g. an eyebrow label with a `::before` dot is an
  `<Eyebrow>` component, not a `.label-eyebrow` class.
- A repeated pure-utility combo with no structure → a Tailwind v4 `@utility`.
- `@layer components` is reserved **strictly** for what utilities and
  components genuinely cannot express: pseudo-elements (`::before`/`::after`),
  third-party DOM overrides (`!important` on library markup), complex
  descendant/state selectors.
- `globals.css` only ever holds: `@import`, tokens (`:root` + `@theme`), base
  element resets (`@layer base`), and the narrow `@layer components`
  exceptions above. If it grows past that, something was misplaced.
- CSS Modules were considered and **rejected** — a second styling mechanism
  for the rare bespoke-CSS case is not worth the extra mental model when
  motion is spring-based (no keyframes — ADR-0002) and utilities + components
  cover everything else.

**Consequences.** `globals.css` stays a few-hundred-line file indefinitely.
"Repeated thing" pressure now pushes toward React components — which the
project wants anyway. This **amends ADR-0004**: design *tokens* still go in
`globals.css` first, but component-specific *classes* no longer do.
[[design-system]] and [[component-conventions]] updated to match.

---

## ADR-0011 — API layer: `app/api` route handlers, secrets server-side

- **Status:** Accepted
- **Date:** 2026-05-22

**Context.** The starter had no API layer. It needs a convention for reaching
external services that keeps secret keys off the client and gives endpoints a
consistent shape.

**Decision.** External calls go through Next.js Route Handlers —
`src/app/api/<resource>/route.ts`:
- **The handler owns the work** — business logic, multiple upstream calls,
  filtering, and reading secret env vars all live in `route.ts`. No mandatory
  passthrough service layer; extract shared code only when genuinely reused.
- Secrets are safe in handlers because `route.ts` is never bundled to the
  browser. Secret env vars are **unprefixed**; `NEXT_PUBLIC_` only for
  browser-safe values.
- Every endpoint: validates input with `zod`, returns the `{ data }` /
  `{ error }` envelope via the shared `handle()` wrapper (`src/lib/api/`), runs
  on the Node runtime (not Edge).
- `src/env.ts` validates env with zod — `publicEnv` vs `getServerEnv()`.
- Client Components fetch via `apiFetch` (`src/lib/api-client.ts`), same-origin
  only. Render-time data is read in Server Components.
- Added `zod`. The example endpoint is `app/api/contact/route.ts`.
- Codified as **AGENTS.md hard rule #9**.

**Consequences.** A clear, secret-safe API convention (full note:
[[api-architecture]]). Server Actions were considered for mutations but
deferred — for now everything goes through `app/api`. The choice can be
revisited if forms need progressive enhancement. First server dependency
(`zod`) and first server-only env var (`CONTACT_ENDPOINT`) now exist.

---

## ADR-0010 — SEO & performance hardening

- **Status:** Accepted
- **Date:** 2026-05-21

**Context.** A review found gaps that would hurt a production marketing site:
`metadataBase` defaulted to `null` (relative OG/canonical URLs never resolved to
absolute — broken social previews); `themeColor` sat on the deprecated metadata
field; there was no `robots.txt`, `sitemap.xml`, or structured data; the
`next.config.ts` was empty; `ScrollLayout` leaked a `requestAnimationFrame`
loop; the home view was a top-level `"use client"` (violating hard rule #6);
and the animation-heavy starter ignored `prefers-reduced-motion`.

**Decision.**
- **Site config.** `src/lib/site.ts` (`siteConfig`) is the single source of
  truth for SEO, fed by `NEXT_PUBLIC_SITE_URL` (fallback `http://localhost:3000`).
- **Metadata.** `metadataBase` is always set; `themeColor` moved to a
  `generateViewport()` / `viewport` export; dead `keywords` / `other` tags
  dropped; OG dimensions corrected to match the asset.
- **Crawlability.** Added `app/robots.ts`, `app/sitemap.ts`, and a JSON-LD
  `Organization`+`WebSite` helper rendered once in the root layout.
- **App Router files.** Added `loading.tsx` (enables streaming), `error.tsx`,
  `not-found.tsx`.
- **Rendering.** `HomeView` is a Server Component; client-only animation moved
  to the `HomeShowcase` leaf — models hard rule #6 instead of breaking it.
- **Reduced motion.** `<ReducedMotion>` calls react-spring's `useReducedMotion`,
  toggling the global `skipAnimation` — one app-root mount covers every spring
  and `spring-text-engine`. Chosen over per-component handling for its reach.
- **Build config.** `next.config.ts` now sets `removeConsole` (prod),
  AVIF/WebP, `next/image` breakpoints aligned to the adaptive-grid widths, and
  `poweredByHeader: false`. React Compiler is left as a documented opt-in (needs
  `babel-plugin-react-compiler`).
- Fixed the `ScrollLayout` Lenis rAF leak (cancel on unmount).

**Consequences.** Social/SEO metadata is correct in production once
`NEXT_PUBLIC_SITE_URL` is set. The first project env var now exists (see
[[environment-variables]]). `isBot()` stays available but is discouraged — it
opts routes out of static rendering; reduced-motion is the preferred lever (see
[[seo-metadata]]). React Compiler remains opt-in pending a dependency install.

---

## ADR-0009 — Shared animation ticker; authorized engine performance refactor

- **Status:** Accepted
- **Date:** 2026-05-21

**Context.** A performance review of the animation engine found load issues that
scale with the number of animated components on a page:
- `useLoop` started a **private `requestAnimationFrame` loop per hook instance** —
  N scroll-driven components meant N rAF loops, none of which ever stopped.
- `useWindowWidth` attached a **separate debounced `resize` listener per call** —
  one per spring component.
- `useDynamicInView` re-created its `IntersectionObserver` **on every render**
  (effect keyed on an unstable `options` object), and a dead `Proxy` branch
  created observers that were never disconnected.
- `useLoop`'s mount-only effect captured a **stale `onRender`**, so prop changes
  after mount were ignored.
All of this lives under `src/hooks/animation/` and `src/components/animation/springs/`
— `#do-not-modify` (ADR-0002).

**Decision.** With explicit user sign-off, apply a one-time performance refactor
to the protected engine, and introduce a shared, unprotected loop primitive:
- New `src/lib/animation/ticker.ts` — a single app-wide, reference-counted rAF
  loop (`subscribeToTicker`). It starts on the first subscriber, stops on the
  last, and throttles each subscriber independently. **Not** `#do-not-modify` —
  it is the supported extension point.
- `useLoop` now subscribes to the ticker and reads `onRender` / `framerate`
  through refs (fixes the stale-closure bug). Public signature unchanged.
- `useDynamicInView` rewritten without the `Proxy`: one observer, re-created only
  when the observed element or options actually change; exposes a callback ref.
- `use-window-size.ts` (not protected) now serves all three hooks from one
  debounced `resize` listener via `useSyncExternalStore`. The unused
  `debounceDelay` parameter was dropped.
- `mode="forward"` `scroll` listeners in `<Spring>` / `<Inview>` made `passive`.
- Hard rule #2 amended: the engine stays protected by default; changes require
  explicit sign-off.

**Consequences.** A page with N animated components now runs **one** rAF loop and
**one** resize listener instead of N of each, with no observer churn. Public
hook/component APIs are unchanged except `useWindowWidth`/`Height`/`Size`, which
no longer take a `debounceDelay` argument (no caller passed one). This **amends
ADR-0002's** do-not-modify scope.

A follow-up pass then cleared all 13 pre-existing ESLint problems in the engine
(also authorized): `isMobileDisabled` gained an optional `viewportWidth`
argument, missing `disableOnMobile` effect deps were added, a
`trigger.current`-in-cleanup hazard in `<Hover>` was fixed, `<Handle>`'s
transition effects were ref-stabilised, and `useProgressTrigger` now returns
`progress` as a `RefObject<number>` (no consumer affected).

---

## ADR-0008 — Adaptive scaling grid via root font-size

- **Status:** Accepted
- **Date:** 2026-05-21

**Context.** An adaptive scaling system was dropped into `src/components/common/`
to keep a rem-based design proportional across viewports. It shipped as a
`styled-components` implementation (`createGlobalStyle`, a `css` `media` helper,
`rm`/`em` helpers, plus `colors.ts` / `fonts.ts` / `utils.ts`). `styled-components`
is not a project dependency, and global CSS belongs in `globals.css` per ADR-0004.

**Decision.** Keep only the scaling behaviour; rebuild it to the project stack.
- **Scale down** (viewport ≤ largest breakpoint) — `vw`-based `html { font-size }`
  media queries in `globals.css`, inside `@layer base`.
- **Scale up** (viewport > largest breakpoint) — a `<AdaptiveGrid>` client
  component (`useAdaptiveGrid` hook) sets an inline `html` font-size at runtime,
  reusing the existing `useResizeLoop` render loop.
- Breakpoints live in `grid.config.ts` as typed config; the `globals.css` media
  queries mirror them and must be kept in sync (formula in both files).
- The dropped `styled-components` files were deleted, not committed.

**Consequences.** A rem-based layout now scales as one unit on every viewport.
`styled-components` stays out of the dependency tree. The breakpoint set is
duplicated across `grid.config.ts` and `globals.css` by design — the CSS-only
config rule (ADR-0004) forbids generating the media queries from JS.

---

## ADR-0007 — Automate the vault workflow with Claude Code hooks

- **Status:** Accepted
- **Date:** 2026-05-21

**Context.** The "read the vault first, follow the relevant guide, update the docs
after every change" workflow depended on the user reminding the agent each time.
Documentation drifts the moment it relies on memory.

**Decision.** Encode the workflow as Claude Code hooks in `.claude/settings.json`
(committed, team-wide):
- `SessionStart` — injects a pointer to read the vault first.
- `UserPromptSubmit` — on every request, reminds the agent to consult the relevant
  guide and to update docs for any change made.
- `Stop` — at the end of every turn, blocks **once** to confirm the vault was
  updated. A `${TMPDIR}` marker keyed by session id guarantees it blocks at most
  once per turn (no infinite loop).

**Consequences.** The documentation workflow is enforced without user prompting.
`.claude/settings.json` is now a tracked project file. Hooks are reviewable and
disableable via `/hooks`. New hooks take effect on the next session start (or after
opening `/hooks`). See [[ai-agent-guide]].

---

## ADR-0006 — The vault is the single source of truth

- **Status:** Accepted
- **Date:** 2026-05-21

**Context.** ADR-0001 left dense spec files (`project-specs.md`, `text-engine-docs.md`)
at the repo root alongside the vault, creating duplication — the same conventions
existed both as terse specs and as expanded vault notes, which would drift.

**Decision.** The vault is the **only** documentation source.
- `project-specs.md` — deleted; its content was already decomposed into the
  `architecture/` and `frontend/` notes (and `environment-variables.md`).
- `text-engine-docs.md` — moved into the vault as [[text-engine-reference]].
- `generic-layout-prompt.md` — moved into the vault (see ADR via [[changelog]]).
- Root keeps only thin shims: `AGENTS.md` carries the breaking-change warning and
  hard rules and points into the vault; `CLAUDE.md` and `.cursorrules` both
  `@`-import `AGENTS.md`.

**Consequences.** No documentation duplication. Agents bootstrap from `AGENTS.md`
and read vault notes on demand. This **amends ADR-0001** — root files no longer
hold canonical spec content.

---

## ADR-0005 — Use standard `next/link` for navigation

- **Status:** Accepted
- **Date:** 2026-05-21

**Context.** Two conflicting conventions existed: `project-specs.md` specified
standard `next/link` / `useRouter`, while `generic-layout-prompt.md` specified
custom `<AnimLink>` / `useAnimRouter()` wrappers. The custom wrappers were never
built.

**Decision.** Use standard Next.js navigation — `<Link>` from `next/link` and
`useRouter` from `next/navigation`. The `AnimLink` / `useAnimRouter` convention is
dropped. See [[routing]].

**Consequences.** `generic-layout-prompt.md` §5 updated to match. No animated-route-
transition layer exists; if one is needed later, revisit with a new ADR.

---

## ADR-0001 — Adopt an Obsidian vault as the project brain

- **Status:** Accepted — amended by ADR-0006
- **Date:** 2026-05-21

**Context.** Project knowledge was scattered across root markdown files
(`project-specs.md`, `text-engine-docs.md`, `AGENTS.md`). New contributors and AI
agents had no structured map of the system.

**Decision.** Introduce `obsidian/` as an Obsidian vault — a linked, navigable
second brain. Root spec files remain as machine-read sources; the vault expands on
them. See [[ai-agent-guide]].

**Consequences.** Docs must now be maintained alongside code. The vault is the
canonical place to *understand* the project; root files stay canonical for *tooling*.

---

## ADR-0002 — All motion is spring-based (`@react-spring/web`)

- **Status:** Accepted (inherited from starter) — amended by ADR-0014
- **Date:** Project baseline

**Context.** Marketing sites need rich, interruptible, physically natural motion.
CSS transitions and keyframes are rigid; competing libraries add weight.

**Decision.** Use `@react-spring/web` for every animation. A custom component layer
(`src/components/animation/springs/`) wraps it. CSS keyframes and `framer-motion`
are **banned**. CSS transitions were banned outright here; **ADR-0014 narrows that
to allow `transition-*` for trivial hover/focus state changes only.**

**Consequences.** All animation goes through the [[animation-system]]. The springs
folder is `#do-not-modify`. Text animation is delegated to [[text-engine]].

---

## ADR-0003 — Routes delegate to Views

- **Status:** Accepted (inherited from starter)
- **Date:** Project baseline

**Context.** Mixing routing concerns with page UI makes `app/` files heavy and hard
to test.

**Decision.** `app/**/page.tsx` files only import and render a component from
`src/views/`. All layout/UI logic lives in the view. See [[routing]].

**Consequences.** Every route is a 3-line file. Views are the real page components.

---

## ADR-0004 — Tailwind v4 with CSS-based config

- **Status:** Accepted (inherited from starter) — amended by ADR-0012 and ADR-0015
- **Date:** Project baseline

**Context.** Tailwind v4 removes `tailwind.config.js` in favour of CSS-native config.

**Decision.** All theme tokens live in `globals.css` under `:root` and `@theme inline`.
No JS config file. Raw values in class names are banned. See [[design-system]].

**Consequences.** Design tokens are the only styling currency. New values must be
added to `globals.css` first — and, per ADR-0015, must follow the three-tier
naming convention.
