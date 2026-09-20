"use client";

/**
 * The blocks that drift behind the app's opening screen.
 *
 * The reference scatters flat rectangles around its headline and moves them
 * slowly enough that you notice only on the second look. Same idea, our
 * palette: a few blue tints and one white, drifting on long sines.
 *
 * They are `div`s rather than a canvas because there are eight of them and each
 * writes one `transform` per frame — cheaper than clearing and refilling a
 * full-screen canvas, and it keeps them behind the type without a stacking
 * fight. `translate3d` only: nothing here touches layout.
 */

import { useEffect, useRef } from "react";

import { subscribeToTicker } from "@/lib/animation/ticker";

interface Block {
  /** Position and size as viewport percentages. */
  left: number;
  top: number;
  width: number;
  height: number;
  /** Drift radius, px, and the seconds it takes to go round. */
  radius: number;
  period: number;
  className: string;
}

const BLOCKS: Block[] = [
  { left: 6, top: 18, width: 3.2, height: 9, radius: 14, period: 19, className: "bg-accent-soft/35" },
  { left: 12, top: 26, width: 9, height: 4, radius: 18, period: 23, className: "bg-accent/30" },
  { left: 13, top: 44, width: 8.5, height: 7, radius: 12, period: 27, className: "bg-accent/45" },
  { left: 4, top: 62, width: 4, height: 3.4, radius: 16, period: 21, className: "bg-accent-soft/40" },
  { left: 83, top: 14, width: 2.4, height: 11, radius: 13, period: 25, className: "bg-ink-on-ink/25" },
  { left: 88, top: 22, width: 8, height: 7, radius: 20, period: 18, className: "bg-accent/25" },
  { left: 91, top: 44, width: 4, height: 12, radius: 15, period: 29, className: "bg-accent-soft/30" },
  { left: 76, top: 58, width: 5, height: 4, radius: 11, period: 24, className: "bg-ink-on-ink/15" },
];

export const FloatingBlocks = () => {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const nodes = Array.from(host.children) as HTMLElement[];
    let seconds = 0;
    let time = performance.now();

    return subscribeToTicker((now) => {
      seconds += Math.min((now - time) / 1000, 0.05);
      time = now;

      nodes.forEach((node, index) => {
        const block = BLOCKS[index];
        if (!block) return;
        const turn = (seconds / block.period) * Math.PI * 2 + index;
        // An ellipse rather than a circle, wider than it is tall, so the drift
        // reads as sideways float instead of orbiting.
        node.style.transform = `translate3d(${Math.cos(turn) * block.radius}px,${
          Math.sin(turn * 1.3) * block.radius * 0.55
        }px,0)`;
      });
    }, () => 0);
  }, []);

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {BLOCKS.map((block, index) => (
        <span
          key={index}
          className={`absolute block will-change-transform ${block.className}`}
          style={{
            left: `${block.left}%`,
            top: `${block.top}%`,
            width: `${block.width}%`,
            height: `${block.height}%`,
          }}
        />
      ))}
    </div>
  );
};
