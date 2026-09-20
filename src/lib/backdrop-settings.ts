/**
 * Live settings store for the pixel-wave background.
 *
 * Separate from `chess-settings.ts` because the background is not part of the
 * scene — it renders behind the scene card, from the root layout, and survives
 * the scene failing to mount. The controls panel reads both.
 *
 * Zustand rather than React state for the same reason as the scene store: the
 * render loop reads it with `getState()` inside the ticker, so dragging a
 * slider re-renders one panel row and nothing else.
 *
 * 📖 Docs: obsidian/frontend/components/common.md
 */

import { create } from "zustand";

import type { BackdropSettings } from "@/types/backdrop";

export const DEFAULT_BACKDROP: BackdropSettings = {
  cellSize: 28,
  waveScale: 1,
  speed: 0.35,
  levels: 5,
  cursorRadius: 900,
  rippleAmplitude: 2.4,
  rippleFrequency: 0.34,
  rippleSpeed: 3.4,
  // Deliberately slow — the wave field trails the cursor by a visible beat and
  // keeps drifting after it stops.
  rippleFollow: 0.035,
};

interface BackdropStore extends BackdropSettings {
  setBackdrop: <K extends keyof BackdropSettings>(key: K, value: BackdropSettings[K]) => void;
  reset: () => void;
}

export const useBackdropSettings = create<BackdropStore>()((set) => ({
  ...DEFAULT_BACKDROP,

  setBackdrop: (key, value) => set({ [key]: value } as Pick<BackdropSettings, typeof key>),

  reset: () => set({ ...DEFAULT_BACKDROP }),
}));
