"use client";

/**
 * The page's one entrance: a block slides up into place as it comes into view.
 *
 * **It is in-view, not on-mount.** Playing every entrance when the curtain
 * lifts means everything below the fold finishes animating while nobody is
 * looking, and the rest of the page then arrives already assembled — which is
 * exactly what made the scroll feel flat. `Inview` (mode `once`) holds each
 * block at `from` until it crosses the viewport, so the page keeps assembling
 * itself the whole way down and every section gets its own arrival.
 *
 * Two things make that safe to do:
 *
 * - **It is gated on `done` as well.** `enabled` stays false for the whole
 *   curtain, so nothing above the fold burns its entrance behind an opaque
 *   overlay, and the order below the curtain is the order the reader sees.
 * - **Only `opacity` and `transform` move.** The markup is in the document at
 *   full size from the first paint either way, which keeps this off the list of
 *   things [[seo-metadata]] warns about, and a transform ancestor is harmless
 *   here — the controls panel that used to be a `fixed` descendant of `<main>`
 *   is gone, and the 3D cursor and background field are its siblings.
 *
 * 📖 Docs: obsidian/frontend/home-hero.md
 */

import type { ReactNode } from "react";

import { Inview } from "@/components/animation/springs/in-view";
import { usePreloader } from "@/lib/preloader";
import type { Tags } from "@/types/springs";

export interface RevealProps {
  children: ReactNode;
  className?: string;
  tag?: Tags;
  /** Milliseconds after the block comes into view — used to stagger a row. */
  delay?: number;
  /** Offset it travels in from, px. Sign gives the direction. */
  x?: number;
  y?: number;
  /** Blocks arriving from further away want a slower spring. */
  config?: Record<string, number>;
  /**
   * Tag-specific attributes. `Inview` forwards anything it does not recognise
   * to the element it renders, but its prop type only covers `HTMLAttributes`,
   * so the few used here are declared.
   */
  href?: string;
  type?: "button";
  onClick?: () => void;
  "aria-expanded"?: boolean;
  "aria-controls"?: string;
}

/**
 * Heavy and unhurried, with no overshoot.
 *
 * A bouncier spring reads as playful; this one reads as weight. The difference
 * between the two is most of what "premium" means in a page entrance.
 */
const SETTLE = { tension: 170, friction: 30 };

/** Travel, px. Far enough to be a move, short enough not to be a swoop. */
const RISE = 28;

export const Reveal = ({
  children,
  className,
  tag = "div",
  delay = 0,
  x = 0,
  y = RISE,
  config = SETTLE,
  ...rest
}: RevealProps) => {
  const done = usePreloader((state) => state.done);

  return (
    <Inview
      tag={tag}
      mode="once"
      enabled={done}
      className={className}
      {...rest}
      from={{ opacity: 0, x, y }}
      to={{ opacity: 1, x: 0, y: 0 }}
      delayIn={delay}
      config={config}
    >
      {children}
    </Inview>
  );
};
