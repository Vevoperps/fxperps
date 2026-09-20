"use client";

import { useEffect, useRef } from "react";

import { subscribeToTicker } from "@/lib/animation/ticker";
import { resolveColor } from "@/lib/css-color";

/**
 * The field behind the closing panel: candles scattered over the brand blue.
 *
 * The reference's last screen is a flat field of its own colour with market
 * marks drifting across it — the product's material used as wallpaper. Ours is
 * the same idea in our own terms: wicks and bodies, in white at several
 * weights, grouped into clusters rather than spread evenly, because a market
 * chart is dense in places and empty in others and an even field reads as a
 * texture rather than as a market.
 *
 * **Every candle animates, and none of them animate together.** Each carries
 * its own phase and its own period, so the field breathes rather than pulses.
 * Nothing here is random at runtime: the layout comes off a deterministic hash,
 * which is what lets the server and the browser agree and what stops the field
 * reshuffling on every re-render.
 *
 * One canvas, one subscription to the shared ticker, and no frame at all while
 * the panel is off screen.
 *
 * 📖 Docs: obsidian/frontend/components/common.md
 */

/** Candles in the field. Enough to read as a market, few enough to stay calm. */
const COUNT = 120;
/** Clusters they are grouped into. */
const CLUSTERS = 7;
/** How far a candle strays from its cluster's centre, as a share of the panel. */
const SCATTER = 0.14;
/** Body width, px. */
const BODY = 7;
/** Seconds for the slowest and quickest candle to complete one cycle. */
const SLOW = 11;
const FAST = 5;

/** Deterministic noise — the same field on the server and in the browser. */
const hash = (n: number): number => {
  let value = (n + 1) * 2654435761;
  value ^= value >>> 15;
  value = Math.imul(value, 2246822519);
  value ^= value >>> 13;
  return (value >>> 0) / 4294967295;
};

interface Candle {
  x: number;
  y: number;
  /** Half the wick's length, as a share of the panel's height. */
  reach: number;
  /** Half the body's length, same units. */
  body: number;
  phase: number;
  rate: number;
  /** 0 is the faintest weight, 2 the brightest. */
  weight: number;
}

export const CandleField = ({
  bias = "edges",
}: {
  /**
   * Where the clusters sit.
   *
   * `edges` keeps the middle of the panel clear for centred copy; `right`
   * packs them into the right half, for a block whose text is on the left.
   */
  bias?: "edges" | "right";
} = {}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    const ink = resolveColor("--ink-on-ink", [255, 255, 255]);
    const soft = resolveColor("--accent-soft", [0, 153, 255]);

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

    // The layout, built once. Clusters first, then candles scattered around
    // them, so the field has dense passages and quiet ones.
    const candles: Candle[] = [];
    for (let index = 0; index < COUNT; index += 1) {
      const cluster = index % CLUSTERS;
      // A mark behind a headline is a mark fighting it, so the clusters are
      // kept off wherever the copy stands.
      const roll = hash(cluster * 31 + 7);
      const cx =
        bias === "right"
          ? 0.36 + roll * 0.6
          : cluster % 2
            ? 0.66 + roll * 0.3
            : 0.02 + roll * 0.26;
      const cy = 0.18 + hash(cluster * 71 + 13) * 0.64;

      candles.push({
        x: cx + (hash(index * 17 + 3) - 0.5) * SCATTER * 2,
        y: cy + (hash(index * 23 + 5) - 0.5) * SCATTER,
        reach: 0.035 + hash(index * 41 + 11) * 0.075,
        body: 0.012 + hash(index * 59 + 19) * 0.04,
        phase: hash(index * 83 + 29) * Math.PI * 2,
        rate: (Math.PI * 2) / (SLOW + (FAST - SLOW) * hash(index * 97 + 31)),
        weight: Math.floor(hash(index * 103 + 37) * 3),
      });
    }

    const paint = (clock: number): void => {
      context.clearRect(0, 0, width, height);

      for (const candle of candles) {
        const swing = Math.sin(clock * candle.rate + candle.phase);
        const x = Math.round(candle.x * width) + 0.5;
        const y = candle.y * height + swing * height * 0.022;
        const reach = candle.reach * height * (0.7 + Math.abs(swing) * 0.5);
        const body = candle.body * height * (0.8 + Math.abs(swing) * 0.4);

        // The wick: always the faintest thing on the panel, so the bodies are
        // what the eye lands on.
        context.strokeStyle = `rgba(${ink[0]},${ink[1]},${ink[2]},0.3)`;
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(x, y - reach);
        context.lineTo(x, y + reach);
        context.stroke();

        const colour = candle.weight === 2 ? soft : ink;
        const alpha =
          candle.weight === 0 ? 0.22 : candle.weight === 1 ? 0.5 : 0.8;
        context.fillStyle = `rgba(${colour[0]},${colour[1]},${colour[2]},${alpha})`;
        context.fillRect(x - BODY / 2, y - body, BODY, body * 2);
      }
    };

    measure();

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still) {
      paint(0);
      const onStill = () => {
        measure();
        paint(0);
      };
      window.addEventListener("resize", onStill);
      return () => window.removeEventListener("resize", onStill);
    }

    let clock = 0;
    let last = performance.now();
    let visible = true;

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
      },
      { rootMargin: "120px" },
    );
    observer.observe(canvas);

    const onResize = () => {
      measure();
      paint(clock);
    };
    window.addEventListener("resize", onResize);
    paint(0);

    const unsubscribe = subscribeToTicker(
      (time) => {
        const delta = Math.min((time - last) / 1000, 0.05);
        last = time;
        if (!visible || document.hidden) return;
        clock += delta;
        paint(clock);
      },
      () => 0,
    );

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", onResize);
      unsubscribe();
    };
  }, [bias]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 block size-full"
    />
  );
};
