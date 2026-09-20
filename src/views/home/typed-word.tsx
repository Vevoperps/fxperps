"use client";

/**
 * The bracketed word a terminal types, deletes and retypes.
 *
 * Deliberately not a spring: this is a discrete sequence of characters on a
 * clock, not a value settling, and the project's spring rule is about motion
 * that eases. Everything here is a timeout chain plus one blinking block.
 *
 * Three details carry the effect:
 *
 * - **The closing bracket only appears when the word is whole.** Mid-typing you
 *   see `[curren` — an unclosed bracket is what makes it read as being typed
 *   rather than faded in.
 * - **The cursor is solid while the machine is typing and blinks only when it
 *   rests.** A cursor that blinks through its own typing reads as two
 *   animations fighting; one that goes solid the moment a key lands reads as a
 *   terminal.
 * - **The box is a grid, not an absolute overlay.** Both layers share one grid
 *   cell: the invisible longest word holds the width open so the line never
 *   reflows, and the visible text inherits the heading's own `text-align`, so
 *   it sits left in the hero and centred in the closing card. The overlay
 *   version pinned the text to the left edge of the reserved box, which is why
 *   the centred heading looked off-axis.
 *
 * Reduced motion gets the first word, closed, with no cursor.
 *
 * 📖 Docs: obsidian/frontend/home-hero.md
 */

import { useEffect, useRef, useState } from "react";

/** Per character, ms. */
const TYPE = 115;
const ERASE = 55;
/** How long a finished word is held before it is taken apart again. */
const HOLD = 3400;
/** Cursor blink half-period, ms. */
const BLINK = 560;

export const TypedWord = ({
  words,
  className = "",
}: {
  words: readonly string[];
  className?: string;
}) => {
  const [text, setText] = useState(words[0]);
  const [closed, setClosed] = useState(true);
  const [resting, setResting] = useState(true);
  const [still, setStill] = useState(true);
  const cursorRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setStill(false);

    let word = 0;
    let length = words[0].length;
    /**
     * An explicit phase, not a boolean.
     *
     * With one `erasing` flag there is no way to express "finished typing and
     * now resting": the moment the last character landed the flag had to be
     * flipped for the next step, which made the word's completion and the start
     * of its deletion the same instant. So the hold never happened, the closing
     * bracket never appeared and the cursor never got to blink — the thing just
     * typed and un-typed itself without pause. Hence three phases.
     */
    let phase: "typing" | "holding" | "erasing" = "holding";
    let timer: ReturnType<typeof setTimeout>;

    const render = (): void => {
      setText(words[word].slice(0, Math.max(0, length)));
      setClosed(phase === "holding");
      setResting(phase === "holding");
    };

    const step = (): void => {
      if (phase === "holding") {
        // The rest is over; start taking the word apart.
        phase = "erasing";
        length -= 1;
      } else if (phase === "erasing") {
        length -= 1;
        if (length <= 0) {
          // Straight to the next word's first character. Resting on an empty
          // `[` for a beat looks like the thing broke.
          word = (word + 1) % words.length;
          length = 1;
          phase = "typing";
        }
      } else {
        length += 1;
        if (length >= words[word].length) {
          length = words[word].length;
          phase = "holding";
        }
      }

      render();

      timer = setTimeout(
        step,
        phase === "holding" ? HOLD : phase === "erasing" ? ERASE : TYPE,
      );
    };

    timer = setTimeout(step, HOLD);

    // The blink runs off its own interval rather than a CSS keyframe, which the
    // project bans, and writes `opacity` directly so it never re-renders the
    // heading. While the machine is typing the cursor is forced solid — see the
    // note at the top of this file.
    const blink = setInterval(() => {
      const cursor = cursorRef.current;
      if (!cursor) return;
      if (cursor.dataset.resting !== "true") {
        cursor.style.opacity = "1";
        return;
      }
      cursor.style.opacity = cursor.style.opacity === "0" ? "1" : "0";
    }, BLINK);

    return () => {
      clearTimeout(timer);
      clearInterval(blink);
    };
  }, [words]);

  const widest = words.reduce((a, b) => (a.length >= b.length ? a : b));

  return (
    <span className={`inline-grid align-baseline ${className}`}>
      {/* Both children occupy the same cell: the first sizes it, the second is
          what you read. */}
      <span
        aria-hidden
        className="invisible whitespace-pre [grid-area:1/1]"
      >
        [{widest}]
      </span>

      <span className="whitespace-pre [grid-area:1/1]">
        [{text}
        {closed ? "]" : ""}
        {still ? null : (
          <span
            ref={cursorRef}
            data-resting={resting}
            aria-hidden
            className="ml-[0.08em] inline-block h-[0.66em] w-[0.26em] translate-y-[0.01em] bg-accent align-baseline"
          />
        )}
      </span>
    </span>
  );
};
