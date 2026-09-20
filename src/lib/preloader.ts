/**
 * Load-curtain state.
 *
 * Flags, not a progress number: the count the curtain shows is a local
 * animation, but *when it is allowed to finish* is real — it waits for the
 * page's fonts to be resolved. So the counter can never hit 100 over a page
 * that is about to reflow under the reader.
 *
 * `ready` is also set when that wait fails or times out. A curtain that hangs
 * forever because a font never arrived is worse than one that lifts on a page
 * rendering in the fallback face.
 *
 * **`lifting` and `done` are different moments and both matter.** `lifting`
 * fires when the curtain *starts* fading, `done` when it has gone. Anything
 * that should be seen happening *through* the fade hangs off `lifting`;
 * anything that should land on a clear page hangs off `done` — which is what
 * every `Reveal` on the page waits for.
 */

import { create } from "zustand";

interface PreloaderStore {
  /** The page's fonts have resolved, or never will. */
  ready: boolean;
  /** The curtain has begun to fade, but is still on screen. */
  lifting: boolean;
  /** The curtain has gone. */
  done: boolean;
  markReady: () => void;
  beginLift: () => void;
  finish: () => void;
}

export const usePreloader = create<PreloaderStore>()((set) => ({
  ready: false,
  lifting: false,
  done: false,
  markReady: () => set({ ready: true }),
  beginLift: () => set({ lifting: true }),
  // Never leaves `lifting` behind: the reduced-motion path finishes without ever
  // playing a fade, and a consumer watching only `lifting` would wait forever.
  finish: () => set({ lifting: true, done: true }),
}));
