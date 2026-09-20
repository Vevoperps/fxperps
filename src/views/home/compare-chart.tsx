"use client";

/**
 * The weekend, hour by hour, split by a handle you can drag.
 *
 * Left of the handle is what a currency market looks like when the desks are
 * shut — a few thin grey bars and then nothing. Right of it is the same hours
 * with the venue open. Dragging is the argument: the reader sets how much of
 * the weekend they are willing to sit out and watches the grey eat the chart.
 *
 * **The bars are seeded, not random.** This component renders on the server
 * too, so `Math.random()` would produce one chart in the HTML and a different
 * one after hydration — React would then either warn or silently keep the
 * server's. A hash of the bar index gives the same jitter in both places.
 *
 * The handle is a real slider: a range input, visually hidden but focusable, so
 * it can be moved with a keyboard and read by a screen reader. Dragging the
 * chart itself is pointer sugar on top of it.
 */

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { Label } from "@/components/ui/label";
import { performance as perf } from "@/data/content";

/** Deterministic 0–1 noise for one bar. */
const jitter = (index: number): number => {
  let hash = (index + 1) * 2654435761;
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 2246822519);
  hash ^= hash >>> 13;
  return (hash >>> 0) / 4294967295;
};

/**
 * Bar height, 0–1.
 *
 * Both sides share one curve so the chart reads as a single series that simply
 * stops being served: it climbs out of the close, settles, and carries a little
 * noise on top.
 */
const height = (index: number, total: number): number => {
  const t = index / Math.max(1, total - 1);
  const ramp = Math.min(1, 0.22 + t * 1.5);
  const swell = 0.78 + Math.sin(t * 7.2) * 0.07 + Math.sin(t * 2.3) * 0.05;
  return Math.max(0.06, Math.min(1, ramp * swell * (0.86 + jitter(index) * 0.2)));
};

export const CompareChart = () => {
  const [split, setSplit] = useState(perf.compare.split);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const total = perf.compare.bars;

  const setFromPointer = (clientX: number): void => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    if (!rect.width) return;
    const next = (clientX - rect.left) / rect.width;
    setSplit(Math.min(0.92, Math.max(0.04, next)));
  };

  const onDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    setFromPointer(event.clientX);
  };

  const onMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!dragging.current) return;
    setFromPointer(event.clientX);
  };

  const onUp = (event: ReactPointerEvent<HTMLDivElement>): void => {
    dragging.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <figure className="mt-16">
      <div
        ref={trackRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="relative h-[20rem] cursor-ew-resize touch-none select-none sm:h-[26rem]"
      >
        {/* Vertical guides, one per tick, behind the bars. */}
        <div aria-hidden className="absolute inset-0 flex justify-between">
          {perf.compare.ticks.map((tick) => (
            <span
              key={tick}
              className="w-px border-l border-dashed border-rule-ink/60"
            />
          ))}
        </div>

        <div className="absolute inset-0 flex items-end gap-px">
          {Array.from({ length: total }, (_, index) => {
            const open = index / total >= split;
            return (
              <span
                key={index}
                aria-hidden
                style={{
                  height: `${(open ? height(index, total) : height(index, total) * 0.34) * 100}%`,
                }}
                className={`flex-1 ${open ? "bg-accent" : "bg-rule-ink"}`}
              />
            );
          })}
        </div>

        {/* The handle: a full-height rule, a grab block, and the two labels
            that say which side is which. */}
        <div
          aria-hidden
          style={{ left: `${split * 100}%` }}
          className="pointer-events-none absolute inset-y-0 w-px bg-accent"
        >
          <span className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-stretch">
            <span className="label flex items-center whitespace-nowrap bg-surface-paper px-3 py-2 text-foreground">
              {perf.compare.before}&nbsp;&lt;
            </span>
            <span className="w-4 shrink-0 bg-accent" />
            <span className="label flex items-center whitespace-nowrap bg-surface-paper px-3 py-2 text-accent">
              &gt;&nbsp;{perf.compare.after}
            </span>
          </span>
        </div>
      </div>

      <div className="mt-3 flex justify-between border-t border-rule-ink pt-3">
        {perf.compare.ticks.map((tick) => (
          <Label key={tick} tone="ink">
            {tick}
          </Label>
        ))}
      </div>

      <figcaption className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <Label tone="ink">{perf.compare.caption}</Label>

        {/* The same value, as a control anything but a mouse can use. */}
        <label className="flex items-center gap-3">
          <span className="sr-only">
            {perf.compare.before} / {perf.compare.after}
          </span>
          <input
            type="range"
            min={4}
            max={92}
            value={Math.round(split * 100)}
            onChange={(event) => setSplit(Number(event.target.value) / 100)}
            className="h-1 w-40 cursor-ew-resize appearance-none bg-rule-ink accent-[var(--accent)]"
          />
        </label>
      </figcaption>
    </figure>
  );
};
