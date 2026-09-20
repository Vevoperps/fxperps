"use client";

/**
 * The gate's backdrop: the load curtain's flooded frame, frozen.
 *
 * Deliberately the *end* of the entry wave rather than its first frame — the
 * first frame is a white screen, and what should greet a visitor here is the
 * blue. Same field, same cell size, same quantisation as
 * `components/common/preloader`, so entering the code hands over to a curtain
 * that is already the colour the visitor was looking at.
 *
 * Drawn once per size, not per frame: nothing here is animated, so there is no
 * ticker subscription and no reason for a device sitting on this page to spin
 * its GPU.
 */

import { useEffect, useRef } from "react";

import { DEFAULT_BACKDROP } from "@/lib/backdrop-settings";
import { resolveColor, type Rgb } from "@/lib/css-color";

/** Cell edge, CSS px — matches the curtain so the hand-over is seamless. */
const CELL = 16;

export const PixelField = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return;

    const low = resolveColor("--backdrop-wave-low", [0, 58, 158]);
    const high = resolveColor("--backdrop-wave-high", [0, 85, 255]);
    const spread: Rgb = [high[0] - low[0], high[1] - low[1], high[2] - low[2]];

    const { waveScale, levels } = DEFAULT_BACKDROP;
    const steps = Math.max(1, levels - 1);

    const paint = (): void => {
      const columns = Math.max(1, Math.ceil(window.innerWidth / CELL));
      const rows = Math.max(1, Math.ceil(window.innerHeight / CELL));

      canvas.width = columns;
      canvas.height = rows;

      const image = context.createImageData(columns, rows);
      const { data } = image;

      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          // Three sines at different scales and angles: no repeat the eye can
          // catch, and cheap enough to run over every cell on every resize.
          const wave =
            Math.sin(column * 0.13 * waveScale) +
            Math.sin(row * 0.15 * waveScale) +
            Math.sin((column + row) * 0.07 * waveScale);
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

    paint();

    window.addEventListener("resize", paint);
    return () => window.removeEventListener("resize", paint);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pixelated absolute inset-0 block size-full bg-backdrop-wave-low"
    />
  );
};
