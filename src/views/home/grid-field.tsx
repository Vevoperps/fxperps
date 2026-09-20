"use client";

/**
 * The dark panel's grid, and the cells the cursor lights as it crosses them.
 *
 * One canvas draws both, because they are the same grid: a CSS gradient for
 * the rules plus DOM nodes for the lit cells would mean a hundred elements
 * whose opacity changes every frame. Here the whole field is one texture and
 * one draw call per frame — and only on the frames where something is still
 * fading.
 *
 * **Energy, not transitions.** Each cell holds a value that the pointer sets to
 * 1 and every frame multiplies down. That is what makes a trail: cells the
 * cursor left a moment ago are still part-lit, and the decay is exponential so
 * the tail thins out instead of ending. The segment between the last pointer
 * position and this one is filled in too, or a fast flick would light three
 * cells out of thirty and read as a stutter.
 *
 * 📖 Docs: obsidian/frontend/home-hero.md
 */

import { useEffect, useRef } from "react";

import { subscribeToTicker } from "@/lib/animation/ticker";
import { resolveColor } from "@/lib/css-color";

/** Cell edge, rem — the reference's grid is large and square. */
const CELL_REM = 6.25;
/** Seconds for a lit cell to fall to ~37% brightness. */
const TAU = 0.5;
/** Brightest a cell gets, as alpha over the ink surface. */
const PEAK = 0.55;
/** Below this a cell is off; it also decides when the loop can stop drawing. */
const FLOOR = 0.004;

export const GridField = ({ className = "" }: { className?: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const accent = resolveColor("--accent", [0, 85, 255]);
    const rule = resolveColor("--rule-on-ink", [71, 71, 71]);
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let cell = 100;
    let columns = 0;
    let rows = 0;
    let energy = new Float32Array(0);
    /** Skips the draw entirely on frames where nothing has changed. */
    let dirty = true;
    let lit = false;
    let last: { column: number; row: number } | null = null;

    const measure = (): void => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const root = parseFloat(getComputedStyle(document.documentElement).fontSize);
      const nextCell = Math.max(24, CELL_REM * (root || 16));
      const nextColumns = Math.ceil(rect.width / nextCell);
      const nextRows = Math.ceil(rect.height / nextCell);
      const ratio = Math.min(window.devicePixelRatio || 1, 2);

      if (
        nextColumns !== columns ||
        nextRows !== rows ||
        canvas.width !== Math.round(rect.width * ratio)
      ) {
        cell = nextCell;
        columns = nextColumns;
        rows = nextRows;
        energy = new Float32Array(columns * rows);
        canvas.width = Math.round(rect.width * ratio);
        canvas.height = Math.round(rect.height * ratio);
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        dirty = true;
      }
    };

    const light = (column: number, row: number): void => {
      if (column < 0 || row < 0 || column >= columns || row >= rows) return;
      energy[row * columns + column] = 1;
      lit = true;
      dirty = true;
    };

    const onPointer = (event: PointerEvent): void => {
      if (still) return;
      const rect = canvas.getBoundingClientRect();
      const column = Math.floor((event.clientX - rect.left) / cell);
      const row = Math.floor((event.clientY - rect.top) / cell);

      // Walk from wherever the pointer was last seen, so a quick diagonal
      // leaves a continuous trail rather than two lonely squares.
      if (last) {
        const steps = Math.max(
          Math.abs(column - last.column),
          Math.abs(row - last.row),
        );
        for (let step = 1; step < steps; step += 1) {
          const t = step / steps;
          light(
            Math.round(last.column + (column - last.column) * t),
            Math.round(last.row + (row - last.row) * t),
          );
        }
      }

      light(column, row);
      last = { column, row };
    };

    const onLeave = (): void => {
      last = null;
    };

    const draw = (): void => {
      const rect = canvas.getBoundingClientRect();
      context.clearRect(0, 0, rect.width, rect.height);

      if (lit) {
        const fill = `rgba(${accent[0]},${accent[1]},${accent[2]},`;
        for (let row = 0; row < rows; row += 1) {
          for (let column = 0; column < columns; column += 1) {
            const value = energy[row * columns + column];
            if (value < FLOOR) continue;
            // Squared, so the tail dims faster than the head and the newest
            // cell stays clearly the brightest one.
            context.fillStyle = `${fill}${(value * value * PEAK).toFixed(3)})`;
            context.fillRect(column * cell, row * cell, cell, cell);
          }
        }
      }

      context.strokeStyle = `rgba(${rule[0]},${rule[1]},${rule[2]},0.38)`;
      context.lineWidth = 1;
      context.beginPath();
      for (let column = 1; column <= columns; column += 1) {
        const x = Math.round(column * cell) + 0.5;
        context.moveTo(x, 0);
        context.lineTo(x, rect.height);
      }
      for (let row = 1; row <= rows; row += 1) {
        const y = Math.round(row * cell) + 0.5;
        context.moveTo(0, y);
        context.lineTo(rect.width, y);
      }
      context.stroke();
    };

    measure();
    draw();

    canvas.addEventListener("pointermove", onPointer);
    canvas.addEventListener("pointerleave", onLeave);
    window.addEventListener("resize", measure);

    let previous = performance.now();

    const unsubscribe = subscribeToTicker((time) => {
      const delta = Math.min((time - previous) / 1000, 0.05);
      previous = time;

      if (lit) {
        const decay = Math.exp(-delta / TAU);
        let alive = false;
        for (let index = 0; index < energy.length; index += 1) {
          const value = energy[index] * decay;
          if (value < FLOOR) {
            energy[index] = 0;
            continue;
          }
          energy[index] = value;
          alive = true;
        }
        lit = alive;
        dirty = true;
      }

      if (!dirty) return;
      measure();
      draw();
      dirty = lit;
    }, () => 0);

    return () => {
      canvas.removeEventListener("pointermove", onPointer);
      canvas.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", measure);
      unsubscribe();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`absolute inset-0 block size-full ${className}`}
    />
  );
};
