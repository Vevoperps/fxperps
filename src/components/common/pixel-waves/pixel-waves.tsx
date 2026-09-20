"use client";

/**
 * A soft field of pixel waves behind the scene card, rippling under the cursor.
 *
 * Drawn on a **deliberately tiny** 2D canvas — one device pixel per wave cell —
 * which CSS then scales up with `image-rendering: pixelated`. That is what makes
 * the blocks crisp rather than blurred, and it means a full-screen effect costs
 * a few tens of thousands of `ImageData` writes per frame instead of millions.
 *
 * No CSS keyframes (they are banned) and no spring — this is continuous
 * per-frame motion, so it belongs on the shared ticker, which is the supported
 * extension point for loop-based animation. It subscribes at a 30fps budget,
 * because a slow wave field gains nothing from 60.
 *
 * Colours come from the design tokens rather than literals: the component reads
 * the resolved `--backdrop-wave-*` values once on mount, so re-theming the
 * palette re-themes the waves.
 *
 * 📖 Docs: obsidian/frontend/components/common.md
 */

import { useEffect, useRef } from "react";

import { subscribeToTicker } from "@/lib/animation/ticker";
import { useBackdropSettings } from "@/lib/backdrop-settings";
import { resolveColor, type Rgb } from "@/lib/css-color";
import { attachPointer, pointer } from "@/lib/pointer";
import { getDeviceProfile } from "@/lib/scene/device";
import type { BackdropSettings } from "@/types/backdrop";

/** Slow waves gain nothing from 60fps. */
const FRAME_BUDGET = 1000 / 30;
/** A tab-switch return otherwise hands the ramp a multi-second delta. */
const MAX_DELTA = 0.05;

/**
 * Three summed sines at incommensurate frequencies. Two would visibly repeat;
 * three keeps the field from ever quite landing on the same frame twice.
 */
const WAVE = {
  columnFrequency: 0.13,
  rowFrequency: 0.15,
  diagonalFrequency: 0.07,
  columnDrift: 0.9,
  rowDrift: -0.7,
  diagonalDrift: 0.5,
} as const;

/** Seconds for the ripple to fade in after the first pointer move. */
const RIPPLE_ENGAGE = 0.45;

/**
 * No props: every parameter is live in the controls panel, so they come from
 * `useBackdropSettings` and are read with `getState()` inside the loop rather
 * than through a selector. A selector would re-render the component — and
 * re-run this whole effect — on every slider tick.
 */
export const PixelWaves = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return;

    const low = resolveColor("--backdrop-wave-low", [0, 58, 158]);
    const high = resolveColor("--backdrop-wave-high", [15, 93, 223]);
    const spread: Rgb = [high[0] - low[0], high[1] - low[1], high[2] - low[2]];

    let image: ImageData | null = null;
    let columns = 0;
    let rows = 0;
    let cellSize = 0;

    // Cursor highlight, smoothed so it trails the pointer instead of snapping.
    let focusColumn = 0;
    let focusRow = 0;
    let engaged = 0;

    /** Reallocate only when the grid actually changes shape. */
    const measure = (nextCellSize: number): void => {
      const nextColumns = Math.max(1, Math.ceil(window.innerWidth / nextCellSize));
      const nextRows = Math.max(1, Math.ceil(window.innerHeight / nextCellSize));
      if (nextColumns === columns && nextRows === rows) return;

      cellSize = nextCellSize;
      columns = nextColumns;
      rows = nextRows;
      canvas.width = columns;
      canvas.height = rows;
      image = context.createImageData(columns, rows);
    };

    const draw = (seconds: number, settings: BackdropSettings): void => {
      if (!image) return;
      const { data } = image;

      const scale = settings.waveScale;
      const columnFrequency = WAVE.columnFrequency * scale;
      const rowFrequency = WAVE.rowFrequency * scale;
      const diagonalFrequency = WAVE.diagonalFrequency * scale;

      const steps = Math.max(1, settings.levels - 1);
      const radius = Math.max(1, settings.cursorRadius / cellSize);
      const radiusSquared = radius * radius;
      const live = engaged > 0.001 && settings.rippleAmplitude > 0 && settings.cursorRadius > 0;

      for (let row = 0; row < rows; row += 1) {
        const rowTerm = Math.sin(row * rowFrequency + seconds * WAVE.rowDrift);
        const verticalDistance = row - focusRow;

        for (let column = 0; column < columns; column += 1) {
          let wave =
            Math.sin(column * columnFrequency + seconds * WAVE.columnDrift) +
            rowTerm +
            Math.sin((column + row) * diagonalFrequency + seconds * WAVE.diagonalDrift);

          if (live) {
            // Squared distance first — most cells are outside the reach and
            // never pay for a square root.
            const horizontalDistance = column - focusColumn;
            const distanceSquared =
              horizontalDistance * horizontalDistance + verticalDistance * verticalDistance;

            if (distanceSquared < radiusSquared) {
              const distance = Math.sqrt(distanceSquared);
              const falloff = 1 - distance / radius;
              wave +=
                falloff *
                falloff *
                engaged *
                settings.rippleAmplitude *
                Math.sin(distance * settings.rippleFrequency - seconds * settings.rippleSpeed);
            }
          }

          // -3…3 → 0…1, then smoothstep so crests and troughs hold instead of
          // sweeping past at constant speed. This is what reads as "soft".
          const level = Math.min(1, Math.max(0, (wave + 3) / 6));
          const eased = level * level * (3 - 2 * level);
          const stepped = Math.round(eased * steps) / steps;

          const index = (row * columns + column) * 4;
          data[index] = low[0] + spread[0] * stepped;
          data[index + 1] = low[1] + spread[1] * stepped;
          data[index + 2] = low[2] + spread[2] * stepped;
          data[index + 3] = 255;
        }
      }

      context.putImageData(image, 0, 0);
    };

    const initial = useBackdropSettings.getState();
    measure(initial.cellSize);
    draw(0, initial);

    // An accessibility promise, honoured on every tier: one settled frame and no
    // ticker. It still redraws when the panel changes, so the controls keep
    // working; it just never animates on its own.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return useBackdropSettings.subscribe((settings) => {
        measure(settings.cellSize);
        draw(0, settings);
      });
    }

    const interactive = getDeviceProfile().pointer;
    const releasePointer = interactive ? attachPointer() : null;

    let resizeFrame = 0;
    const onResize = (): void => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        const settings = useBackdropSettings.getState();
        measure(settings.cellSize);
        draw(performance.now() * 0.001 * settings.speed, settings);
      });
    };
    window.addEventListener("resize", onResize, { passive: true });

    let lastTime = performance.now();

    const unsubscribe = subscribeToTicker((time) => {
      const settings = useBackdropSettings.getState();
      const delta = Math.min((time - lastTime) / 1000, MAX_DELTA);
      lastTime = time;

      measure(settings.cellSize);

      if (interactive && pointer.moved) {
        const targetColumn = (pointer.x * 0.5 + 0.5) * columns;
        const targetRow = (0.5 - pointer.y * 0.5) * rows;

        if (engaged === 0) {
          // Snap on the very first move, or the ripple sweeps in from a corner.
          focusColumn = targetColumn;
          focusRow = targetRow;
        } else {
          const follow = 1 - Math.pow(1 - settings.rippleFollow, delta * 60);
          focusColumn += (targetColumn - focusColumn) * follow;
          focusRow += (targetRow - focusRow) * follow;
        }

        engaged = Math.min(1, engaged + delta / RIPPLE_ENGAGE);
      }

      draw(time * 0.001 * settings.speed, settings);
    }, () => FRAME_BUDGET);

    return () => {
      unsubscribe();
      releasePointer?.();
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(resizeFrame);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pixelated fixed inset-0 -z-10 size-full"
    />
  );
};
