"use client";

/**
 * A label that retypes itself under the cursor.
 *
 * The scroll-triggered `TypeIn` announces a section once; this is the same
 * gesture as a reply. Point at a nav cell and it types itself out again, which
 * turns a hover state into something the interface *does* rather than a colour
 * that changes.
 *
 * **It writes to the DOM directly rather than holding the progress in state.**
 * These labels live in the site header, whose active cell is recomputed off the
 * scroll ten times a second — every one of those re-renders would land in the
 * middle of a typing run. Refs and `textContent` take the animation out of
 * React's hands entirely, so a parent re-render cannot strand a label
 * half-typed or empty.
 *
 * Two further rules keep it from being annoying:
 *
 * - **The width never moves.** A copy of the final string, hidden with
 *   `visibility`, holds the box open, so a row of cells cannot shuffle while
 *   one of them animates.
 * - **Touch never sees it.** A device with no hover would otherwise get a label
 *   that types on tap, which reads as a glitch.
 *
 * 📖 Docs: obsidian/frontend/components/common.md
 */

import { useCallback, useEffect, useRef } from "react";

/** Per character, ms. Quick: this answers a cursor, it does not perform. */
const TYPE = 22;

export const HoverType = ({ text }: { text: string }) => {
  const copyRef = useRef<HTMLSpanElement>(null);
  const overlayRef = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hoverable = useRef(false);

  useEffect(() => {
    hoverable.current = window.matchMedia("(hover: hover)").matches;
    return () => clearTimeout(timer.current);
  }, []);

  /** Puts the label back the way it renders when nothing is happening. */
  const rest = useCallback(() => {
    clearTimeout(timer.current);
    if (copyRef.current) copyRef.current.style.visibility = "";
    if (overlayRef.current) {
      overlayRef.current.style.display = "none";
      overlayRef.current.textContent = "";
    }
  }, []);

  const start = useCallback(() => {
    const copy = copyRef.current;
    const overlay = overlayRef.current;
    if (!hoverable.current || !copy || !overlay) return;

    clearTimeout(timer.current);
    copy.style.visibility = "hidden";
    overlay.style.display = "";
    overlay.textContent = "";

    let length = 0;
    const step = (): void => {
      length += 1;
      overlay.textContent = text.slice(0, length);
      if (length < text.length) {
        timer.current = setTimeout(step, TYPE);
        return;
      }
      rest();
    };

    timer.current = setTimeout(step, TYPE);
  }, [text, rest]);

  return (
    <span
      onPointerEnter={start}
      onPointerLeave={rest}
      className="relative inline-block"
    >
      <span ref={copyRef}>{text}</span>

      {/* The typed layer. Present from the first render and simply not
          displayed, so a hover never waits on React to mount anything. */}
      <span
        ref={overlayRef}
        aria-hidden
        style={{ display: "none" }}
        className="absolute left-0 top-0 whitespace-pre"
      />
    </span>
  );
};
