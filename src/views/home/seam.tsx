"use client";

/**
 * The seam between two sections: a skyline whose blocks light one at a time.
 *
 * Where the page changes surface, paper to ink and back, the reference does not
 * draw a rule. It interlocks the two: blocks of the surface above hang down
 * into the one below at uneven lengths, so the join reads as two materials
 * meeting rather than as a line.
 *
 * **One block at a time, not thirty-six at once.** The first version re-rolled
 * every height on a shared clock, which at this width reads as the whole strip
 * twitching however gently it is eased. Here the skyline has a *resting* shape
 * that never changes, and a focus walks across it: the chosen block rises,
 * takes the accent tip, holds, and sinks back as the focus moves on. At any
 * moment two or three blocks are moving out of thirty-six, which is what makes
 * it read as considered rather than busy.
 *
 * The motion itself is exponential smoothing toward a target rather than a
 * timed tween — a block that is already most of the way up does not restart, it
 * just keeps easing, so an interrupted rise never snaps.
 *
 * One canvas, and frames that would paint the same pixels are skipped: with
 * four seams on the page that is the difference between smooth and heavy.
 *
 * 📖 Docs: obsidian/frontend/components/common.md
 */

import { useEffect, useRef } from "react";

import { subscribeToTicker } from "@/lib/animation/ticker";
import { resolveColor } from "@/lib/css-color";

export type Surface = "ink" | "paper" | "paper-2";

const TOKEN: Record<Surface, string> = {
  ink: "--surface-ink",
  paper: "--surface-paper",
  "paper-2": "--surface-paper-2",
};

const FALLBACK: Record<Surface, [number, number, number]> = {
  ink: [26, 26, 26],
  paper: [255, 255, 255],
  "paper-2": [245, 245, 245],
};

/** Columns across the band, at every width. */
const COLUMNS = 32;
/** Height of the tip a lit block carries, px. */
const TIP = 12;
/**
 * Resting height band, as a fraction of the seam.
 *
 * Wide on purpose. A narrow band puts every block's foot on roughly the same
 * line and the seam reads as a torn edge rather than as a skyline; the whole
 * effect lives in the difference between the shortest block and the longest.
 * The ceiling stops short of the floor so a lit block's tip still has room to
 * be drawn inside the band.
 */
const REST_MIN = 0.18;
const REST_MAX = 0.86;
/**
 * Heights the blocks are allowed to take.
 *
 * Snapped to a grid rather than free: a continuous random height gives a noisy
 * edge, and stepping it makes the blocks look cut from one sheet. Neighbours
 * are then forced at least two steps apart, which is what produces the tall
 * block beside the short one rather than a slow drift across the band.
 */
const LEVELS = 8;
/** Steps two neighbours must differ by. */
const CONTRAST = 2;
/**
 * How far a block drifts above and below its resting height, as a fraction.
 *
 * Every block breathes, each on its own phase and its own rate, so the whole
 * seam is alive rather than one lit block moving through a still row. Kept to
 * under half a grid step: the skyline's shape is the thing being looked at,
 * and a drift large enough to swap two neighbours' order destroys it.
 */
const BREATH = 0.045;
/** Seconds for the slowest and the quickest block to complete one breath. */
const BREATH_SLOW = 9;
const BREATH_FAST = 4.5;
/** How much taller a block gets while it is the lit one, as a fraction. */
const LIFT = 0.09;
/** Ceiling on a lit block, so the tip is never drawn off the band. */
const CEILING = 0.88;
/** Seconds the focus spends on one block before moving to the next. */
const DWELL = 0.85;
/**
 * Seconds for a block to cover ~63% of the distance to its target.
 *
 * Exponential rather than a tween: the rise and the fall share one constant, so
 * a block caught mid-fall by a new focus simply turns around.
 */
const TAU = 0.42;
/** Below this a lit block is treated as resting and its tip is not drawn. */
const FLOOR = 0.012;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** Deterministic per-column noise — the same skyline on server and client. */
const hash = (column: number): number => {
  let value = (column + 1) * 2654435761;
  value ^= value >>> 15;
  value = Math.imul(value, 2246822519);
  value ^= value >>> 13;
  return (value >>> 0) / 4294967295;
};

/**
 * The order the focus visits the blocks.
 *
 * A shuffle rather than left to right: a marching highlight reads as a loading
 * bar. Deterministic, so every seam on the page is not the same sequence but
 * each one is stable across renders.
 */
const order = (seed: number): number[] => {
  const list = Array.from({ length: COLUMNS }, (_, index) => index);
  for (let index = COLUMNS - 1; index > 0; index -= 1) {
    const swap = Math.floor(hash(index * 31 + seed * 7) * (index + 1));
    [list[index], list[swap]] = [list[swap], list[index]];
  }
  return list;
};

export const Seam = ({
  label,
  above,
  below,
}: {
  /** Printed under the band, centred. */
  label: string;
  /** The section overhead — the blocks are made of it. */
  above: Surface;
  /** The section underneath — the band's own ground. */
  below: Surface;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return;

    const top = resolveColor(TOKEN[above], FALLBACK[above]);
    const ground = resolveColor(TOKEN[below], FALLBACK[below]);
    const accent = resolveColor("--accent", [0, 85, 255]);
    const soft = resolveColor("--accent-soft", [0, 153, 255]);

    const rgb = (c: [number, number, number]) => `rgb(${c[0]},${c[1]},${c[2]})`;

    let width = 0;
    let height = 0;

    const measure = (): void => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      if (!rect.width || !rect.height) return;

      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    // The resting skyline. Fixed for the life of the seam: only the lit block
    // ever leaves it, which is what keeps the shape recognisable.
    //
    // Each column takes one of `LEVELS` heights, and a column that lands within
    // `CONTRAST` steps of its neighbour is pushed across the grid instead. The
    // push is arithmetic on the level rather than a re-roll, so the skyline is
    // still the same on the server and in the browser.
    const seed = Math.abs(label.length * 13 + above.length);

    // Every level is used the same number of times and the set is then
    // shuffled, rather than each column rolling its own height. Rolling
    // independently is what left one seam nearly all deep blocks and another
    // nearly all shallow ones: an even pool guarantees the same count of each,
    // so every seam has the same balance of paper and ink however it shuffles.
    const levels: number[] = [];
    for (let column = 0; column < COLUMNS; column += 1) {
      levels.push(column % LEVELS);
    }
    for (let index = COLUMNS - 1; index > 0; index -= 1) {
      const swap = Math.floor(hash(index * 17 + seed * 31) * (index + 1));
      [levels[index], levels[swap]] = [levels[swap], levels[index]];
    }

    // Neighbours too close together are fixed by *swapping* with a later
    // column rather than by changing a height, so the pool stays even.
    for (let index = 1; index < COLUMNS; index += 1) {
      if (Math.abs(levels[index] - levels[index - 1]) >= CONTRAST) continue;
      for (let other = index + 1; other < COLUMNS; other += 1) {
        if (Math.abs(levels[other] - levels[index - 1]) < CONTRAST) continue;
        [levels[index], levels[other]] = [levels[other], levels[index]];
        break;
      }
    }

    const rest = new Float32Array(COLUMNS);
    for (let column = 0; column < COLUMNS; column += 1) {
      rest[column] =
        REST_MIN + ((REST_MAX - REST_MIN) * levels[column]) / (LEVELS - 1);
    }

    // Each block's own breath: its own phase and its own rate, so no two rise
    // together and the row never falls into step with itself.
    const phase = new Float32Array(COLUMNS);
    const rate = new Float32Array(COLUMNS);
    for (let column = 0; column < COLUMNS; column += 1) {
      phase[column] = hash(column * 53 + seed * 29) * Math.PI * 2;
      const period =
        BREATH_SLOW +
        (BREATH_FAST - BREATH_SLOW) * hash(column * 97 + seed * 11);
      rate[column] = (Math.PI * 2) / period;
    }

    /** How lit each block is, 0–1. Only the focused one is heading for 1. */
    const lit = new Float32Array(COLUMNS);
    const sequence = order(seed);
    let step = 0;
    let elapsed = 0;
    /** Seconds since the seam started, the clock every breath is read off. */
    let clock = 0;

    /**
     * What was last painted, per column — the dirty check.
     *
     * It tracks the tip's opacity as well as the height. The first version
     * compared heights only, so on every frame where no block crossed a whole
     * pixel the draw was skipped and the tip's fade froze with it: the accent
     * came up in visible steps instead of a fade. Quantised to 0–255 because
     * that is all the canvas can show anyway.
     */
    const painted = new Int16Array(COLUMNS).fill(-1);
    const paintedGlow = new Int16Array(COLUMNS).fill(-1);
    const frame = new Int16Array(COLUMNS);
    const frameGlow = new Int16Array(COLUMNS);

    const advance = (delta: number): boolean => {
      clock += delta;
      elapsed += delta;
      if (elapsed >= DWELL) {
        elapsed -= DWELL;
        step = (step + 1) % COLUMNS;
      }

      const focus = sequence[step];
      // One exponential step toward each block's target. `1 - e^(-dt/τ)` is the
      // frame-rate independent form: the same motion at 60 or 144 Hz.
      const chase = 1 - Math.exp(-delta / TAU);

      let changed = false;
      for (let column = 0; column < COLUMNS; column += 1) {
        const target = column === focus ? 1 : 0;
        lit[column] += (target - lit[column]) * chase;
        if (lit[column] < FLOOR && target === 0) lit[column] = 0;

        // Three things decide a block's height: where it rests, the breath it
        // is taking, and whether it is the lit one.
        const breath = Math.sin(clock * rate[column] + phase[column]) * BREATH;
        const level = Math.min(
          CEILING,
          rest[column] + breath + LIFT * lit[column],
        );
        const next = Math.round(height * clamp01(level));
        const glow = lit[column] < FLOOR ? 0 : Math.round(lit[column] * 255);

        frame[column] = next;
        frameGlow[column] = glow;
        if (next !== painted[column] || glow !== paintedGlow[column]) {
          changed = true;
        }
      }
      return changed;
    };

    const draw = (): void => {
      const span = width / COLUMNS;

      context.fillStyle = rgb(ground);
      context.fillRect(0, 0, width, height);

      for (let column = 0; column < COLUMNS; column += 1) {
        const blockHeight = frame[column];
        const x = Math.round(column * span);
        const next = Math.round((column + 1) * span);
        const blockWidth = next - x;

        context.fillStyle = rgb(top);
        context.fillRect(x, 0, blockWidth, blockHeight);

        // The tip fades in with the lift rather than switching on at a
        // threshold, so a block lights and dims instead of blinking.
        const glow = frameGlow[column];
        if (glow > 0) {
          const colour = hash(column * 7 + seed) < 0.5 ? accent : soft;
          const alpha = (glow / 255).toFixed(3);
          context.fillStyle = `rgba(${colour[0]},${colour[1]},${colour[2]},${alpha})`;
          context.fillRect(x, blockHeight, blockWidth, TIP);
        }

        painted[column] = blockHeight;
        paintedGlow[column] = glow;
      }
    };

    measure();
    advance(0);
    draw();

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const onStill = () => {
        measure();
        painted.fill(-1);
        paintedGlow.fill(-1);
        advance(0);
        draw();
      };
      window.addEventListener("resize", onStill);
      return () => window.removeEventListener("resize", onStill);
    }

    let last = performance.now();
    let visible = true;

    // Off screen the seam stops drawing: there are several on the page and only
    // one is ever being looked at.
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
      },
      { rootMargin: "140px" },
    );
    observer.observe(canvas);

    const onResize = () => {
      measure();
      painted.fill(-1);
      paintedGlow.fill(-1);
    };
    window.addEventListener("resize", onResize);

    const unsubscribe = subscribeToTicker(
      (time) => {
        const delta = Math.min((time - last) / 1000, 0.05);
        last = time;
        if (!visible) return;
        if (advance(delta)) draw();
      },
      () => 0,
    );

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", onResize);
      unsubscribe();
    };
  }, [above, below, label]);

  return (
    <div
      className={
        below === "ink"
          ? "bg-surface-ink"
          : below === "paper-2"
            ? "bg-surface-paper-2"
            : "bg-surface-paper"
      }
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="block h-[4.375rem] w-full sm:h-[7.5rem]"
      />

      {/* The label sits under the band rather than inside it. In the band it
          would sooner or later end up behind a block, and a caption that is
          legible only on some frames is worse than no caption. */}
      <div className="flex justify-center pb-8 pt-3">
        <span className="label text-accent">{label}</span>
      </div>
    </div>
  );
};
