/**
 * Device tiering for the WebGL scene.
 *
 * One module decides what "mobile" means, so DPR, post-processing and pointer
 * interactivity can never drift apart. Read **once** at construction — a device
 * does not change tier mid-session, and rebuilding buffers on resize costs more
 * than the mismatch is worth.
 *
 * 📖 Docs: obsidian/frontend/chess-scene.md · .claude/skills/optimize-3d-scene
 */

export type Tier = "mobile" | "tablet" | "desktop";

export interface DeviceProfile {
  tier: Tier;
  /** Clamped `[min, max]` pixel ratio handed to the R3F `Canvas`. */
  dpr: [number, number];
  /** Attach the pointer listener at all? Never on touch. */
  pointer: boolean;
  /** Run the post-processing chain (bloom / vignette)? */
  post: boolean;
  /** Run depth of field — the most expensive pass in the chain. */
  depthOfField: boolean;
  antialias: boolean;
  /** Minimum ms between rendered frames — 0 means every tick. */
  frameBudget: number;
  /** Honour `prefers-reduced-motion` on every tier. */
  reducedMotion: boolean;
}

const SERVER_PROFILE: DeviceProfile = {
  tier: "desktop",
  dpr: [1, 1.5],
  pointer: false,
  post: true,
  depthOfField: true,
  antialias: true,
  frameBudget: 0,
  reducedMotion: false,
};

const prefersReducedMotion = (): boolean =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const hasFinePointer = (): boolean =>
  window.matchMedia("(hover: hover) and (pointer: fine)").matches;

const readTier = (): Tier => {
  const coarse = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  if (window.innerWidth < 768 || coarse) return "mobile";
  if (window.innerWidth < 1180) return "tablet";
  return "desktop";
};

let cached: DeviceProfile | null = null;

/** Resolve the device profile once and memoise it for the session. */
export const getDeviceProfile = (): DeviceProfile => {
  if (typeof window === "undefined") return SERVER_PROFILE;
  if (cached) return cached;

  const tier = readTier();
  const reducedMotion = prefersReducedMotion();

  cached = {
    tier,
    dpr: tier === "mobile" ? [0.75, 1] : tier === "tablet" ? [0.75, 1.25] : [1, 1.5],
    // §11 — a pointer effect on touch is dead weight at best, and an unmoved
    // cursor resolves to dead centre, punching a hole through the composition.
    // Gated on pointer *capability*, not viewport width: a 900px-wide desktop
    // window is still a mouse, and tying this to the tier silently killed the
    // interaction on every browser that was not maximised.
    pointer: hasFinePointer() && tier !== "mobile",
    post: true,
    depthOfField: tier !== "mobile",
    antialias: tier !== "mobile",
    // These are fill-bound, not motion-bound — halving the frame rate on a
    // phone is the single biggest win available there and hard to see.
    frameBudget: tier === "mobile" ? 1000 / 30 : tier === "tablet" ? 1000 / 45 : 0,
    reducedMotion,
  };

  return cached;
};
