"use client";

/**
 * The name, set as four tiles that light one after another.
 *
 * The reference closes its page with its logotype drawn as flat blocks in
 * different tints — no illustration, no gradient, just geometry big enough to
 * be the last thing on the page. Ours is the same move with letters: one tile
 * per letter, each in its own blue, and a light walking across them.
 *
 * It shares the seam's mechanic on purpose. The page opens on a grid that
 * lights under the cursor, it is stitched together by seams whose blocks light
 * one at a time, and it ends on the name doing the same thing. One idea, three
 * places.
 *
 * Hovering takes the light over: point at a tile and it is the lit one until
 * the cursor leaves.
 */

import { useEffect, useRef, useState } from "react";

import { brand } from "@/lib/brand";

/** Seconds the light spends on one tile. */
const DWELL = 1.15;

/** Resting tint per position, palest to fullest. */
const TINTS = [
  "bg-accent/25",
  "bg-accent/45",
  "bg-accent/15",
  "bg-accent/35",
];

export const WordmarkBlocks = () => {
  const letters = [...brand.name];
  const [lit, setLit] = useState(0);
  const [held, setHeld] = useState<number | null>(null);

  useEffect(() => {
    if (held !== null) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = setInterval(
      () => setLit((index) => (index + 1) % letters.length),
      DWELL * 1000,
    );
    return () => clearInterval(timer);
  }, [held, letters.length]);

  const active = held ?? lit;

  return (
    <div
      className="flex items-end gap-3 sm:gap-4"
      onPointerLeave={() => setHeld(null)}
      aria-label={brand.name}
      role="img"
    >
      {letters.map((letter, index) => {
        const on = index === active;

        return (
          <span
            key={`${letter}-${index}`}
            onPointerEnter={() => setHeld(index)}
            className={`flex aspect-square w-[4.5rem] items-end justify-start p-3 transition-colors duration-[var(--duration-slow)] ease-entrance sm:w-[7rem] sm:p-4 ${
              on ? "bg-accent" : TINTS[index % TINTS.length]
            }`}
          >
            <span
              aria-hidden
              className={`text-[2rem] font-medium leading-none tracking-tight transition-colors duration-[var(--duration-slow)] ease-entrance sm:text-[3rem] ${
                on ? "text-ink-on-ink" : "text-surface-paper"
              }`}
            >
              {letter}
            </span>
          </span>
        );
      })}
    </div>
  );
};
