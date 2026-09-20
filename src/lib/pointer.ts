/**
 * App-wide pointer tracking.
 *
 * Deliberately **not** R3F-style `state.pointer` or a React state value: it
 * reads (0, 0) until the mouse first moves, so any effect keyed to it would
 * fire at dead centre of the viewport on every freshly-loaded page. `moved`
 * gates that.
 *
 * A module-scope singleton, mutated in place — a per-frame React state update
 * would re-render every consumer sixty times a second.
 *
 * `attachPointer` is **reference-counted**, because more than one feature reads
 * this now (the chess scene and the pixel-wave background). Without the count,
 * whichever consumer unmounted first would tear the listener out from under the
 * other and reset `moved` back to false.
 *
 * Lives in `lib/` rather than `lib/scene/` for exactly that reason — it stopped
 * being scene-specific the moment the background wanted it.
 *
 * 📖 Docs: obsidian/frontend/chess-scene.md · obsidian/frontend/components/common.md
 */

interface PointerState {
  /** Normalised device coordinates, -1 … 1. */
  x: number;
  y: number;
  /** Has the pointer ever moved? Gates every pointer-driven effect. */
  moved: boolean;
  /** 0 → 1 ramp after the first move, so the field eases in. */
  ease: number;
}

export const pointer: PointerState = { x: 0, y: 0, moved: false, ease: 0 };

/** Advance the ease ramp. Called once per frame by the chess scene. */
export const easePointer = (delta: number, seconds = 0.6): void => {
  if (!pointer.moved) return;
  pointer.ease = Math.min(1, pointer.ease + delta / seconds);
};

let listeners = 0;
let detach: (() => void) | null = null;

/**
 * Attach the listener and return a release function.
 *
 * Call only on a tier that has a real pointer (`getDeviceProfile().pointer`) —
 * never "attach and ignore".
 */
export const attachPointer = (): (() => void) => {
  listeners += 1;

  if (!detach) {
    const onMove = (event: PointerEvent): void => {
      pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -((event.clientY / window.innerHeight) * 2 - 1);
      pointer.moved = true;
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    detach = () => window.removeEventListener("pointermove", onMove);
  }

  return () => {
    listeners -= 1;
    if (listeners > 0) return;

    detach?.();
    detach = null;
    pointer.moved = false;
    pointer.ease = 0;
  };
};
