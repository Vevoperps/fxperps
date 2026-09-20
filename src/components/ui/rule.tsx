"use client";

/**
 * A hairline that draws itself across the section as it comes into view.
 *
 * The reference's whole structure is carried by rules, so the one motion that
 * belongs on every section is the rule arriving — it reads as the page being
 * ruled rather than as another thing fading in. Slow and unhurried: the line is
 * the longest travel on the screen, so it gets the softest spring.
 *
 * `scaleX` on a `w-full` element, never an animated `width`, so a line that
 * spans the viewport costs no layout.
 */

import { Inview } from "@/components/animation/springs/in-view";
import { usePreloader } from "@/lib/preloader";

/** Slower than `Reveal`'s: a long line settling should take its time. */
const DRAW = { tension: 90, friction: 26 };

export const Rule = ({
  className = "",
  delay = 0,
}: {
  /** Colour and width come from the caller — this only owns the motion. */
  className?: string;
  delay?: number;
}) => {
  const done = usePreloader((state) => state.done);

  return (
    <Inview
      tag="span"
      mode="once"
      enabled={done}
      aria-hidden="true"
      className={`block h-px origin-left ${className}`}
      from={{ scaleX: 0 }}
      to={{ scaleX: 1 }}
      delayIn={delay}
      config={DRAW}
    />
  );
};
