"use client";

import { useEffect, useState } from "react";

import { HoverType } from "@/components/ui/hover-type";
import { brand } from "@/lib/brand";
import { nav } from "@/data/content";
import { subscribeToTicker } from "@/lib/animation/ticker";

/**
 * The fixed bar.
 *
 * The reference boxes every item and butts them together, so the nav reads as a
 * row of cells rather than a row of words — one shared hairline between
 * neighbours, chevrons wrapped around whichever is current. The active item is
 * driven by the scroll rather than by the URL: a hash route still points at the
 * last thing clicked while the reader is three sections further down.
 */
export const SiteHeader = () => {
  const [active, setActive] = useState<string>(nav[0].id);


  useEffect(() => {
    let current = "";
    return subscribeToTicker(
      () => {
        // The section whose top has most recently crossed a third of the
        // viewport — the same "what am I actually looking at" line the eye uses.
        const line = window.innerHeight / 3;
        let found: string = nav[0].id;
        for (const item of nav) {
          const node = document.getElementById(item.id);
          if (node && node.getBoundingClientRect().top <= line) found = item.id;
        }
        if (found !== current) {
          current = found;
          setActive(found);
        }
      },
      () => 100,
    );
  }, []);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-start justify-between p-3 sm:p-4">
      <nav
        aria-label="Main navigation"
        className="pointer-events-auto flex bg-surface-paper"
      >
        {nav.map((item) => {
          const on = item.id === active;
          return (
            <a
              key={item.id}
              href={`#${item.id}`}
              aria-current={on ? "true" : undefined}
              className={`label border-y border-r first:border-l ${
                on
                  ? "border-accent bg-accent text-ink-on-ink"
                  : "border-rule-paper text-accent hover:bg-surface-paper-2"
              } px-3 py-2.5 transition-colors duration-[var(--duration-fast)] ease-entrance`}
            >
              {on ? <span className="mr-1 opacity-60">&lt;</span> : null}
              <HoverType text={item.label} />
              {on ? <span className="ml-1 opacity-60">&gt;</span> : null}
            </a>
          );
        })}
      </nav>

      <a
        href={brand.links.app ?? "#markets"}
        className="label pointer-events-auto flex items-center gap-3 border border-rule-paper bg-surface-paper px-3 py-2.5 text-accent transition-colors duration-[var(--duration-fast)] ease-entrance hover:bg-accent hover:text-ink-on-ink"
      >
        <span aria-hidden>↗</span>
        <HoverType text={brand.links.app ? "Launch app" : "Coming soon"} />
      </a>
    </header>
  );
};
