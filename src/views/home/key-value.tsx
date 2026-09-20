"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { Num } from "@/components/ui/num";
import { Reveal } from "@/components/ui/reveal";
import { Section } from "@/components/ui/section";
import { SectionHead } from "@/components/ui/section-head";
import { keyValue } from "@/data/content";

/**
 * Three cards, one of them open at a time.
 *
 * The open card is the whole mechanic: its icon switches from the line drawing
 * to the blue pixel one and its paragraph appears. The others keep the drawing
 * and show only a title, so the row reads as one thing being looked at rather
 * than three things competing.
 *
 * It advances on its own and hovering takes it over — the rotation is there so
 * the mechanic is visible to someone who never moves the cursor, and it stops
 * the moment they do, because a card that keeps changing under the pointer is
 * infuriating to read.
 *
 * **Why CSS transitions and not springs.** Opening a card is a discrete
 * two-state change on `opacity` alone (ADR-0014). The card's height is fixed
 * for the same reason: the paragraph fading in must not push the row's height
 * around, or the section below it would jump every few seconds.
 */

/** How long a card stays open before the next one takes over, ms. */
const DWELL = 3600;

export const KeyValue = () => {
  const [active, setActive] = useState(0);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (held) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = setInterval(
      () => setActive((index) => (index + 1) % keyValue.items.length),
      DWELL,
    );
    return () => clearInterval(timer);
  }, [held]);

  return (
    <Section id={keyValue.head.id} tone="paper">
      <SectionHead data={keyValue.head} />

      <div
        className="mt-16 grid gap-px border border-rule-paper bg-rule-paper lg:grid-cols-3"
        onPointerLeave={() => setHeld(false)}
      >
        {keyValue.items.map((item, index) => {
          const open = index === active;

          return (
            // See the note in `how-it-works.tsx`: the static cell paints the
            // background, the contents are what move.
            <div
              key={item.n}
              className="bg-surface-paper transition-colors duration-[var(--duration-normal)] ease-entrance hover:bg-surface-paper-2"
            >
            <Reveal y={28} delay={index * 110} className="h-full">
              <article
                onPointerEnter={() => {
                  setHeld(true);
                  setActive(index);
                }}
                className="flex h-full min-h-[24rem] flex-col p-8"
              >
                <div className="flex items-start justify-between">
                  {/* Both icons are in the layout at once and cross-fade, so
                      nothing reflows and neither one arrives late. */}
                  <span className="relative block size-[7.5rem]">
                    {(["line", "pixel"] as const).map((variant) => (
                      <Image
                        key={variant}
                        src={`/assets/icons/${item.icon}-${variant}.png`}
                        alt=""
                        width={240}
                        height={240}
                        className={`absolute inset-0 size-full object-contain object-left transition-opacity duration-[var(--duration-normal)] ease-entrance ${
                          (variant === "pixel") === open
                            ? "opacity-100"
                            : "opacity-0"
                        }`}
                      />
                    ))}
                  </span>
                  <Num value={item.n} />
                </div>

                <h3 className="mt-10 text-xl font-medium leading-tight tracking-tight">
                  {item.title}
                </h3>

                <p
                  aria-hidden={!open}
                  className={`mt-3 max-w-[38ch] text-sm leading-relaxed text-dim-paper transition-opacity duration-[var(--duration-normal)] ease-entrance ${
                    open ? "opacity-100" : "opacity-0"
                  }`}
                >
                  {item.body}
                </p>

                <span className="label mt-auto w-fit bg-surface-paper-2 px-2 py-1.5 pt-2 text-dim-paper">
                  {item.kicker}
                </span>
              </article>
            </Reveal>
            </div>
          );
        })}
      </div>
    </Section>
  );
};
