"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

import { Num } from "@/components/ui/num";
import { SectionHead } from "@/components/ui/section-head";
import { subscribeToTicker } from "@/lib/animation/ticker";
import { howItWorks } from "@/data/content";

/**
 * Four steps, pinned to the middle of the screen while the scroll fills them.
 *
 * The section is a tall track with a sticky screen inside it. What the reader
 * experiences: the row arrives, **stops** in the centre and stays there while
 * the page keeps scrolling; each card lights in turn as it does; the fourth
 * finishes and only then does the track run out and the page move on. Scrolling
 * back up runs the whole thing in reverse, because the scroll position *is* the
 * animation's clock rather than something that starts it.
 *
 * Each card's slice of that clock runs three phases, in this order:
 *
 * 1. **it arrives** — rises into place,
 * 2. **it lights** — the paragraph appears and the blue rule fills,
 * 3. **its lower half opens** — the title turns accent and the pixel icon
 *    replaces the line drawing.
 *
 * Splitting the card in two like that is the reference's trick: the bottom band
 * arriving after the rule has crossed it makes the row read as four things
 * being switched on, not four things fading in.
 *
 * **Nothing here goes through React.** The frame handler writes `transform`,
 * `opacity` and `color` onto nodes it kept refs to; a `setState` per frame
 * would re-render the section sixty times a second for values React has no
 * opinion about. Only `transform` and `opacity` animate, so no frame costs a
 * layout.
 *
 * 📖 Docs: obsidian/frontend/components/common.md
 */

/** How tall the scroll track is, in screens. The pin lasts this minus one. */
const TRACK_SCREENS = 3.2;
/** Progress spent settling before the first card may light. */
const SETTLE = 0.1;
/** Progress kept at the end so the finished row is seen before it leaves. */
const REST = 0.12;
/** Share of a card's slice spent arriving, before it may light. */
const LAND = 0.34;
/** Share of a card's slice after which its lower half opens. */
const LOWER = 0.66;
/** How far a card travels in, px. */
const RISE = 40;
/** Cards overlap their slices, so the fold reads as continuous. */
const OVERLAP = 0.3;

/** Ease-out cubic: quick to arrive, slow to settle. */
const ease = (t: number): number => 1 - Math.pow(1 - t, 3);
const clamp = (v: number): number => Math.min(1, Math.max(0, v));

export const HowItWorks = () => {
  const trackRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const barRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const bodyRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const lowerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const titleRefs = useRef<(HTMLHeadingElement | null)[]>([]);
  const lineRefs = useRef<(HTMLImageElement | null)[]>([]);
  const pixelRefs = useRef<(HTMLImageElement | null)[]>([]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const total = howItWorks.steps.length;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const paint = (raw: number): void => {
      // The pin's first and last moments are dead time on purpose: the row gets
      // to be still for a beat at each end instead of animating the instant it
      // arrives and the instant before it leaves.
      const progress = clamp((raw - SETTLE) / (1 - SETTLE - REST));

      const span = 1 / (total - (total - 1) * OVERLAP);
      const step = span * (1 - OVERLAP);

      for (let index = 0; index < total; index += 1) {
        const local = clamp((progress - index * step) / span);

        const arrive = ease(clamp(local / LAND));
        const light = ease(clamp((local - LAND) / (LOWER - LAND)));
        const lower = ease(clamp((local - LOWER) / (1 - LOWER)));

        const card = cardRefs.current[index];
        if (card) {
          card.style.transform = `translate3d(0,${(1 - arrive) * RISE}px,0)`;
          card.style.opacity = String(arrive);
        }

        const body = bodyRefs.current[index];
        if (body) body.style.opacity = String(light);

        const bar = barRefs.current[index];
        if (bar) bar.style.transform = `scaleX(${light})`;

        // The lower band: it rises into its own row once the rule has crossed.
        const band = lowerRefs.current[index];
        if (band) {
          band.style.opacity = String(lower);
          band.style.transform = `translate3d(0,${(1 - lower) * 14}px,0)`;
        }

        const title = titleRefs.current[index];
        if (title) {
          title.style.color =
            lower > 0.5 ? "var(--accent)" : "var(--dim-on-paper)";
        }

        // Two images in one slot: the line drawing is the step before its turn,
        // the blue pixel version is what it becomes. They cross-fade.
        const line = lineRefs.current[index];
        if (line) line.style.opacity = String(1 - lower);

        const pixel = pixelRefs.current[index];
        if (pixel) pixel.style.opacity = String(lower);
      }
    };

    if (still) {
      paint(1);
      return;
    }

    paint(0);

    let last = -1;

    return subscribeToTicker(() => {
      const rect = track.getBoundingClientRect();
      // How far through the pin we are: 0 when the track's top hits the top of
      // the screen, 1 when its bottom is about to.
      const travel = rect.height - window.innerHeight;
      const progress = clamp(-rect.top / Math.max(1, travel));

      if (Math.abs(progress - last) < 0.0012) return;
      last = progress;
      paint(progress);
    }, () => 0);
  }, []);

  return (
    <section
      id={howItWorks.head.id}
      className="border-t border-rule-paper bg-surface-paper-2"
    >
      <div
        ref={trackRef}
        className="relative"
        style={{ height: `${TRACK_SCREENS * 100}vh` }}
      >
        {/* The pinned screen. Everything the reader watches happens inside
            these bounds while the track scrolls past underneath. */}
        <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden">
          <div className="mx-auto w-full max-w-[90rem] px-5 sm:px-8">
            <SectionHead data={howItWorks.head} />

            <ol className="mt-12 grid gap-px border border-rule-paper bg-rule-paper lg:grid-cols-4">
              {howItWorks.steps.map((step, index) => (
                // The cell is painted by a static `li` and only its contents
                // move: a moving element cannot also be the thing that covers
                // the grid's hairline background, or the empty slot flashes
                // grey while the card is still on its way in.
                <li
                  key={step.n}
                  className="flex flex-col bg-surface-paper transition-colors duration-[var(--duration-normal)] ease-entrance hover:bg-surface-paper-2"
                >
                  <div
                    ref={(node) => {
                      cardRefs.current[index] = node;
                    }}
                    className="flex h-full flex-col will-change-transform"
                    style={{ opacity: 0 }}
                  >
                    <div className="flex min-h-[8.5rem] flex-col p-6">
                      <Num value={step.n} />
                      <p
                        ref={(node) => {
                          bodyRefs.current[index] = node;
                        }}
                        style={{ opacity: 0 }}
                        className="mt-7 max-w-[32ch] text-sm leading-relaxed text-dim-paper"
                      >
                        {step.body}
                      </p>
                    </div>

                    {/* The rule, on a dashed track so an unfilled step reads as
                        pending rather than as a divider. */}
                    <span aria-hidden className="track-dots block h-[3px] w-full">
                      <span
                        ref={(node) => {
                          barRefs.current[index] = node;
                        }}
                        className="block h-full w-full origin-left bg-accent will-change-transform"
                        style={{ transform: "scaleX(0)" }}
                      />
                    </span>

                    <div
                      ref={(node) => {
                        lowerRefs.current[index] = node;
                      }}
                      style={{ opacity: 0 }}
                      className="flex flex-1 items-start justify-between gap-4 p-6 will-change-transform"
                    >
                      <h3
                        ref={(node) => {
                          titleRefs.current[index] = node;
                        }}
                        style={{ color: "var(--dim-on-paper)" }}
                        className="text-lg font-medium leading-tight tracking-tight"
                      >
                        {step.title}
                      </h3>

                      <span className="relative block size-[4rem] shrink-0 self-end">
                        <Image
                          ref={(node) => {
                            lineRefs.current[index] = node;
                          }}
                          src={`/assets/icons/${step.icon}-line.png`}
                          alt=""
                          width={240}
                          height={240}
                          className="absolute inset-0 size-full object-contain"
                        />
                        <Image
                          ref={(node) => {
                            pixelRefs.current[index] = node;
                          }}
                          src={`/assets/icons/${step.icon}-pixel.png`}
                          alt=""
                          width={240}
                          height={240}
                          style={{ opacity: 0 }}
                          className="absolute inset-0 size-full object-contain"
                        />
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
};
