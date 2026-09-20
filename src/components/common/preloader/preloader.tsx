"use client";

/**
 * Load curtain: a white field that a pixel wave floods with the hero's blues
 * from the centre out, with a counter in the corner.
 *
 * **The curtain does the whole reveal.** Nothing under it animates — the page
 * is rendered opaque from the first paint and simply becomes visible as the
 * curtain clears. Two reasons that matters:
 *
 * - Fading `<main>` in would leave the content at `opacity: 0` in the server
 *   render, which is exactly what [[seo-metadata]] warns against.
 * - "Appearing through blur" is done with `backdrop-filter` on the curtain, not
 *   `filter` on a wrapper. Any non-`none` `filter` makes its element a
 *   containing block for `position: fixed` descendants, which would tear the
 *   controls panel and the 3D cursor out of the viewport — permanently, since
 *   even `blur(0px)` counts.
 *
 * The wave is drawn the same way as the background field it hands over to: one
 * device pixel per cell, scaled up with `image-rendering: pixelated`, quantised
 * to the same handful of shades.
 *
 * 📖 Docs: obsidian/frontend/components/common.md
 */

import { useEffect, useRef, useState } from "react";

import { subscribeToTicker } from "@/lib/animation/ticker";
import { useBackdropSettings } from "@/lib/backdrop-settings";
import { resolveColor, type Rgb } from "@/lib/css-color";
import { usePreloader } from "@/lib/preloader";

/**
 * Shortest the curtain is ever on screen, seconds.
 *
 * The wave still has to read as a wave — below about a second the flood front
 * crosses the screen faster than the dithered edge can be seen breaking up, and
 * the whole thing lands as a flash rather than a fill.
 */
const MIN_DURATION = 1.5;
/** The count stalls here until the page's fonts resolve. */
const READY_CEILING = 0.92;
/**
 * How long the curtain will wait before giving up.
 *
 * Not a nicety: a font request on a slow connection can take arbitrarily long
 * and `document.fonts.ready` never rejects. Without this the curtain sits at 92
 * forever.
 */
const MAX_WAIT = 8;
/**
 * Seconds spent clearing once the wave has filled the screen.
 *
 * Long enough for the blur to be seen letting go, short enough that the page
 * underneath is not kept waiting — every `Reveal` on it is gated on `done`.
 */
const CLEAR_DURATION = 0.55;
/** Peak blur behind the curtain, px. */
const BLUR = 26;
/** Cell edge, CSS px. Chunkier than the background field — it reads as an event. */
const CELL = 16;
/** Width of the dithered band at the wave front, in normalised radius. */
const EDGE_BAND = 0.09;
/** Corners are further than the edges, so the front has to pass 1 to fill them. */
const FRONT_REACH = 1.28;

/** Deterministic per-cell noise, so the dithered edge does not crawl. */
const hash = (column: number, row: number): number =>
  (((column * 73856093) ^ (row * 19349663)) >>> 0) % 1000 / 1000;

export const Preloader = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const blurRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const done = usePreloader((state) => state.done);
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return;

    const finish = usePreloader.getState().finish;

    // What the counter actually waits for. `document.fonts.ready` resolves once
    // every face the first paint asked for has loaded or failed, which is the
    // last thing that can still reflow the page under the reader.
    const markReady = () => usePreloader.getState().markReady();
    document.fonts.ready.then(markReady, markReady);

    // An accessibility promise: no curtain at all, nothing to sit through.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish();
      setMounted(false);
      return;
    }

    const paper = resolveColor("--surface-invert", [255, 255, 255]);
    const low = resolveColor("--backdrop-wave-low", [0, 58, 158]);
    const high = resolveColor("--backdrop-wave-high", [15, 93, 223]);
    const spread: Rgb = [high[0] - low[0], high[1] - low[1], high[2] - low[2]];

    let image: ImageData | null = null;
    let columns = 0;
    let rows = 0;

    const measure = (): void => {
      const nextColumns = Math.max(1, Math.ceil(window.innerWidth / CELL));
      const nextRows = Math.max(1, Math.ceil(window.innerHeight / CELL));
      if (nextColumns === columns && nextRows === rows) return;

      columns = nextColumns;
      rows = nextRows;
      canvas.width = columns;
      canvas.height = rows;
      image = context.createImageData(columns, rows);
    };

    const draw = (progress: number, seconds: number): void => {
      if (!image) return;
      const { data } = image;
      const { waveScale, levels } = useBackdropSettings.getState();

      const centreColumn = (columns - 1) / 2;
      const centreRow = (rows - 1) / 2;
      const reach = Math.hypot(centreColumn, centreRow) || 1;
      const steps = Math.max(1, levels - 1);
      const front = progress * FRONT_REACH;

      for (let row = 0; row < rows; row += 1) {
        const dy = (row - centreRow) / reach;

        for (let column = 0; column < columns; column += 1) {
          const dx = (column - centreColumn) / reach;
          const distance = Math.hypot(dx, dy);

          // A ragged front rather than a clean disc, then a dithered band just
          // inside it so the leading edge breaks into loose pixels.
          const angle = Math.atan2(dy, dx);
          const wobble =
            Math.sin(angle * 6 + seconds * 0.9) * 0.045 +
            Math.sin(angle * 11 - seconds * 0.6) * 0.03;
          const edge = front + wobble - distance;

          let flooded = edge > 0;
          if (flooded && edge < EDGE_BAND) flooded = hash(column, row) < edge / EDGE_BAND;

          const index = (row * columns + column) * 4;

          if (!flooded) {
            data[index] = paper[0];
            data[index + 1] = paper[1];
            data[index + 2] = paper[2];
            data[index + 3] = 255;
            continue;
          }

          // Same field the background paints, so the hand-over is seamless.
          const wave =
            Math.sin(column * 0.13 * waveScale + seconds * 0.9) +
            Math.sin(row * 0.15 * waveScale - seconds * 0.7) +
            Math.sin((column + row) * 0.07 * waveScale + seconds * 0.5);
          const level = Math.min(1, Math.max(0, (wave + 3) / 6));
          const eased = level * level * (3 - 2 * level);
          const stepped = Math.round(eased * steps) / steps;

          data[index] = low[0] + spread[0] * stepped;
          data[index + 1] = low[1] + spread[1] * stepped;
          data[index + 2] = low[2] + spread[2] * stepped;
          data[index + 3] = 255;
        }
      }

      context.putImageData(image, 0, 0);
    };

    measure();
    draw(0, 0);

    let elapsed = 0;
    let clearing = 0;
    let lastTime = performance.now();

    const unsubscribe = subscribeToTicker((time) => {
      const delta = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;
      elapsed += delta;

      measure();

      // Time-based, but capped until the fonts resolve — the count cannot reach
      // 100 over a page that is still about to reflow.
      const waited = usePreloader.getState().ready || elapsed > MAX_WAIT;
      const ceiling = waited ? 1 : READY_CEILING;
      const progress = Math.min(elapsed / MIN_DURATION, ceiling);

      draw(progress, elapsed);

      if (countRef.current) {
        countRef.current.textContent = String(Math.round(progress * 100)).padStart(3, "0");
        // The counter sits in a corner, which the wave reaches last: it is dark
        // on the white field, then white once the blue arrives under it.
        countRef.current.style.color =
          progress > 0.86 ? `rgb(${paper.join(",")})` : `rgb(${low.join(",")})`;
      }

      if (progress < 1) return;

      // The moment the fade starts, not the moment it ends — anything that
      // should be seen happening *through* the clear hangs off this.
      if (!clearing) usePreloader.getState().beginLift();

      clearing += delta;
      const cleared = Math.min(1, clearing / CLEAR_DURATION);
      // Ease-out, so it lets go quickly and settles.
      const eased = 1 - Math.pow(1 - cleared, 3);

      canvas.style.opacity = String(1 - eased);
      if (countRef.current) countRef.current.style.opacity = String(1 - eased);
      if (blurRef.current) {
        blurRef.current.style.backdropFilter = `blur(${(1 - eased) * BLUR}px)`;
        blurRef.current.style.opacity = String(1 - eased);
      }

      if (cleared < 1) return;
      unsubscribe();
      finish();
      setMounted(false);
    }, () => 0);

    return unsubscribe;
  }, []);

  if (!mounted || done) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-40">
      {/* Blur target. It carries no filter until the clear begins: an active
          `backdrop-filter` anywhere in this overlay softens the wave canvas
          itself even from behind it, and the whole point of the wave is hard
          pixel edges. It also means no full-screen blur runs during the two
          seconds nothing needs it. On a fixed overlay, never on an ancestor of
          the page — see the note at the top of this file. */}
      <div ref={blurRef} className="absolute inset-0" />

      <canvas ref={canvasRef} className="pixelated block size-full" />

      <span
        ref={countRef}
        className="font-display absolute bottom-shell-gutter right-shell-gutter text-[3rem] leading-none tabular-nums"
      >
        000
      </span>
    </div>
  );
};
