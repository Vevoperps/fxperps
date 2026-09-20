"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { subscribeToTicker } from "@/lib/animation/ticker";
import { resolveColor } from "@/lib/css-color";
import type { RangeId } from "@/lib/markets";
import { RANGES, readSeries } from "@/lib/markets";
import { decimalsFor } from "@/views/home/use-markets";

/**
 * The terminal's chart: candles on a canvas, one range at a time.
 *
 * **Canvas, not SVG.** A year of candles is a few hundred elements, and at
 * this size each one is three rectangles; as DOM that is a thousand nodes the
 * browser lays out on every resize, and as canvas it is one element and a
 * loop. The axes and the last-price tag are DOM, because they are text.
 *
 * **It draws on demand.** The series only changes when the range changes or
 * the mark moves, so the canvas redraws on those and on a resize, not on a
 * frame loop. The one thing that does run per frame is the reveal: the candles
 * wipe in from the left the first time the chart comes into view, on the shared
 * ticker rather than a loop of its own.
 *
 * 📖 Docs: obsidian/frontend/components/common.md
 */

/** Seconds the wipe takes. */
const REVEAL = 0.9;
/** Share of the chart's height kept clear above and below the extremes. */
const PAD = 0.12;
/** Gap between two candles, as a share of a slot. */
const GAP = 0.32;

const ease = (t: number): number => 1 - Math.pow(1 - t, 3);

export const PriceChart = ({
  symbol,
  mark,
}: {
  symbol: string;
  /** The live mark. The series is rebuilt when it moves, so the last candle
      always closes where the board says the pair is. */
  mark: number;
}) => {
  const [range, setRange] = useState<RangeId>("1d");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // A pure function of the pair, the range and the live mark, so the same
  // three inputs always draw the same picture and a re-render never reshuffles
  // the chart under the reader.
  const candles = useMemo(
    () => readSeries(symbol, range, mark),
    [symbol, range, mark],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    const up = resolveColor("--accent", [0, 85, 255]);
    const down = resolveColor("--ink-on-ink", [255, 255, 255]);
    const rule = resolveColor("--rule-on-ink", [71, 71, 71]);

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

    const draw = (shown: number): void => {
      context.clearRect(0, 0, width, height);
      if (!candles.length || !width || !height) return;

      let low = Infinity;
      let high = -Infinity;
      for (const candle of candles) {
        if (candle.low < low) low = candle.low;
        if (candle.high > high) high = candle.high;
      }
      const span = high - low || 1;
      const top = high + span * PAD;
      const bottom = low - span * PAD;
      const y = (value: number): number =>
        ((top - value) / (top - bottom)) * height;

      // Four horizontal guides. Dotted rather than solid: a grid that competes
      // with the candles is a grid that gets read first.
      context.strokeStyle = `rgba(${rule[0]},${rule[1]},${rule[2]},0.55)`;
      context.setLineDash([2, 4]);
      context.lineWidth = 1;
      for (let line = 1; line <= 4; line += 1) {
        const at = Math.round((height / 5) * line) + 0.5;
        context.beginPath();
        context.moveTo(0, at);
        context.lineTo(width, at);
        context.stroke();
      }
      context.setLineDash([]);

      const slot = width / candles.length;
      const body = Math.max(1, slot * (1 - GAP));
      const visible = Math.ceil(candles.length * shown);

      for (let index = 0; index < visible; index += 1) {
        const candle = candles[index];
        const rising = candle.close >= candle.open;
        const colour = rising ? up : down;
        const x = index * slot + slot / 2;

        context.strokeStyle = `rgb(${colour[0]},${colour[1]},${colour[2]})`;
        context.fillStyle = `rgb(${colour[0]},${colour[1]},${colour[2]})`;

        // The wick first, so the body sits over it rather than beside it.
        context.beginPath();
        context.moveTo(Math.round(x) + 0.5, y(candle.high));
        context.lineTo(Math.round(x) + 0.5, y(candle.low));
        context.stroke();

        const openY = y(candle.open);
        const closeY = y(candle.close);
        context.fillRect(
          x - body / 2,
          Math.min(openY, closeY),
          body,
          Math.max(1, Math.abs(closeY - openY)),
        );
      }
    };

    measure();

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still) {
      draw(1);
      const onStill = () => {
        measure();
        draw(1);
      };
      window.addEventListener("resize", onStill);
      return () => window.removeEventListener("resize", onStill);
    }

    let shown = 0;
    let last = performance.now();
    let seen = false;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) seen = true;
      },
      { rootMargin: "80px" },
    );
    observer.observe(canvas);

    const onResize = () => {
      measure();
      draw(shown);
    };
    window.addEventListener("resize", onResize);

    draw(0);

    const unsubscribe = subscribeToTicker(
      (time) => {
        const delta = Math.min((time - last) / 1000, 0.05);
        last = time;
        if (!seen || shown >= 1) return;
        shown = Math.min(1, shown + delta / REVEAL);
        draw(ease(shown));
      },
      () => 0,
    );

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", onResize);
      unsubscribe();
    };
    // The series is in the deps, so a new print repaints the last candle.
  }, [candles, symbol, range]);

  const last = candles.at(-1)?.close ?? mark;
  const decimals = decimalsFor(mark || 1);

  let low = Infinity;
  let high = -Infinity;
  for (const candle of candles) {
    if (candle.low < low) low = candle.low;
    if (candle.high > high) high = candle.high;
  }
  const span = high - low || 1;
  const top = high + span * PAD;
  const bottom = low - span * PAD;
  const ticks = [0, 1, 2, 3, 4, 5].map(
    (step) => top - ((top - bottom) / 5) * step,
  );
  // Where the tag sits, as a share of the chart's height: on the last close,
  // not in the middle, because a price tag that does not point at the price is
  // decoration.
  const tagAt = ((top - last) / (top - bottom)) * 100;

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule-ink px-4 py-2.5">
        <div className="flex items-center gap-1">
          {RANGES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setRange(entry.id)}
              aria-pressed={range === entry.id}
              className={`label px-2.5 py-1.5 transition-colors duration-[var(--duration-fast)] ease-entrance ${
                range === entry.id
                  ? "border-b-2 border-accent text-accent"
                  : "border-b-2 border-transparent text-dim-ink hover:text-ink-on-ink"
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>
        <span className="label text-dim-ink">
          24/7 · local currency per usd
        </span>
      </div>

      <div className="relative flex">
        <div className="relative min-w-0 flex-1">
          <canvas
            ref={canvasRef}
            aria-hidden
            className="block h-[17rem] w-full sm:h-[21rem]"
          />

          {/* The live print, tagged on the right edge the way a terminal does. */}
          <span
            style={{ top: `${tagAt}%` }}
            className="label absolute right-0 -translate-y-1/2 bg-accent px-1.5 py-1 pt-1.5 text-ink-on-ink"
          >
            {last.toFixed(decimals)}
          </span>
        </div>

        <div className="flex w-[4.5rem] shrink-0 flex-col justify-between border-l border-rule-ink py-1 pl-2">
          {ticks.map((tick) => (
            <span key={tick} className="label text-faint">
              {tick.toFixed(decimals)}
            </span>
          ))}
        </div>
      </div>

      <p className="sr-only">
        {`Price chart for ${symbol}, ${range}. Last ${last.toFixed(decimals)}.`}
      </p>
    </div>
  );
};
