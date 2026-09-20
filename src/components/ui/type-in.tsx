"use client";

/**
 * A line of mono text that types itself out when it reaches the viewport.
 *
 * Every section on the reference announces itself the same way: the marker
 * above the heading does not fade in, it gets typed, one character at a time,
 * with a block cursor that disappears once the line is finished. It is the
 * detail that makes a page of rules and mono labels read as a terminal rather
 * than as a brochure.
 *
 * Three things keep it honest:
 *
 * - **The full text is in the DOM from the first paint**, inside a visually
 *   hidden span. A crawler and a screen reader get the whole label; only the
 *   sighted, motion-happy reader watches it arrive.
 * - **The width is reserved.** The visible layer is absolutely placed over a
 *   spacer holding the final string, so nothing beside it — the rules, the
 *   heading — shifts a pixel while the characters land.
 * - **It types once, on entering view**, and leaves the cursor behind when it
 *   is done. A label that retypes itself every scroll is a distraction.
 *
 * 📖 Docs: obsidian/frontend/components/common.md
 */

import { useEffect, useRef, useState } from "react";

/** Per character, ms. Fast: this is a label, not a sentence. */
const TYPE = 34;
/** Per character for a heading, ms. Quicker, because the line is long. */
const TYPE_FAST = 17;
/** Held before the cursor is dropped, ms. */
const LINGER = 420;

export const TypeIn = ({
  text,
  className = "",
  delay = 0,
  block = false,
}: {
  text: string;
  className?: string;
  /** Milliseconds after the line comes into view. */
  delay?: number;
  /**
   * A heading line rather than a label: it lays out as a block, types faster,
   * and its cursor is sized to the type it sits in.
   */
  block?: boolean;
}) => {
  const hostRef = useRef<HTMLSpanElement>(null);
  const [typed, setTyped] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    setTyped(0);

    let timer: ReturnType<typeof setTimeout>;
    let length = 0;

    const step = (): void => {
      length += 1;
      setTyped(length);
      if (length < text.length) {
        timer = setTimeout(step, block ? TYPE_FAST : TYPE);
        return;
      }
      timer = setTimeout(() => setDone(true), LINGER);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        timer = setTimeout(step, delay);
      },
      { threshold: 0.6 },
    );

    observer.observe(host);

    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [text, delay, block]);

  return (
    <span
      ref={hostRef}
      className={`relative ${block ? "block" : "inline-block"} ${className}`}
    >
      {/* Reserves the line's width, and is what anything but a browser reads. */}
      <span className={typed === null ? undefined : "invisible"}>{text}</span>

      {typed === null ? null : (
        <span aria-hidden className="absolute left-0 top-0 whitespace-pre">
          {text.slice(0, typed)}
          {done ? null : (
            <span
              className={
                block
                  ? "ml-[0.08em] inline-block h-[0.62em] w-[0.28em] bg-accent"
                  : "ml-[0.1em] inline-block h-[0.85em] w-[0.5em] translate-y-[0.12em] bg-accent"
              }
            />
          )}
        </span>
      )}
    </span>
  );
};
