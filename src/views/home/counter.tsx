"use client";

import { useEffect, useRef } from "react";

/**
 * A number that counts up the first time it is seen.
 *
 * Parses `prefix + digits + suffix`, so `25x`, `0.05%`, `±0.75%` and `24/7`
 * all work without being told which part to animate, and the decimal places
 * come from the text rather than from a prop — whatever was written is what
 * lands.
 *
 * Runs on rAF directly rather than a spring: it must finish exactly on the
 * written value, and a spring that overshoots `0.05%` shows a number the page
 * is claiming is a fee.
 */
const DURATION = 1600;
const PATTERN = /^([^\d]*)(\d+(?:\.\d+)?)(.*)$/;

export const Counter = ({
  value,
  className = "",
}: {
  value: string;
  className?: string;
}) => {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const match = PATTERN.exec(value);
    if (!match) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const [, prefix, digits, suffix] = match;
    const target = Number(digits);
    const places = digits.split(".")[1]?.length ?? 0;

    let frame = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);
          const start = performance.now();
          const step = (now: number) => {
            const t = Math.min(1, (now - start) / DURATION);
            const eased = 1 - Math.pow(1 - t, 3);
            node.textContent = `${prefix}${(target * eased).toFixed(places)}${suffix}`;
            if (t < 1) frame = requestAnimationFrame(step);
          };
          frame = requestAnimationFrame(step);
        }
      },
      { threshold: 0.4 },
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value]);

  // Rendered at its final value, so the server output and a reader with motion
  // turned off both get the real number.
  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {value}
    </span>
  );
};
