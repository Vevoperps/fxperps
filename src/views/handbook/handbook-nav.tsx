"use client";

/**
 * The contents rail, with the chapter you are reading marked in the accent.
 *
 * It follows the scroll rather than the URL hash: a hash only changes when a
 * link is clicked, so a reader who scrolls would watch the rail stay pointed at
 * wherever they last clicked, which is worse than no marker at all.
 *
 * The rule for "reading" is the chapter whose top is the last one above a line
 * a third of the way down the screen — the same rule a person uses. It is
 * computed off the shared ticker with a cheap guard, because the answer changes
 * about once per chapter and not once per frame.
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { subscribeToTicker } from "@/lib/animation/ticker";
import type { Book } from "@/data/books";

export const HandbookNav = ({ book }: { book: Book }) => {
  const [current, setCurrent] = useState(book.chapters[0].id);
  const ids = useRef<string[]>(book.chapters.map((chapter) => chapter.id));

  useEffect(() => {
    let last = "";

    return subscribeToTicker(() => {
      const line = window.innerHeight * 0.32;
      let found = ids.current[0];

      for (const id of ids.current) {
        const node = document.getElementById(id);
        if (!node) continue;
        if (node.getBoundingClientRect().top <= line) found = id;
      }

      if (found === last) return;
      last = found;
      setCurrent(found);
    }, () => 0);
  }, []);

  return (
    <nav className="flex flex-col gap-7">
      {book.nav.map((group, index) => (
        <div key={group.group} className="flex flex-col gap-3">
          <span className="text-sm font-medium tracking-tight">
            <span className="text-dim-paper">{index + 1}. </span>
            {group.group}
          </span>

          <ul className="flex flex-col gap-2 border-l border-rule-paper pl-4">
            {group.links.map((link) => {
              const active = link.id === current;

              return (
                <li key={link.id} className="relative">
                  {/* The marker sits on the rail itself, so the active row is
                      pointed at rather than merely coloured. */}
                  {active ? (
                    <span
                      aria-hidden
                      className="absolute -left-4 top-1/2 h-4 w-[2px] -translate-y-1/2 bg-accent"
                    />
                  ) : null}

                  <Link
                    href={`#${link.id}`}
                    aria-current={active ? "location" : undefined}
                    className={`block text-sm transition-colors duration-[var(--duration-fast)] ease-entrance hover:text-accent ${
                      active ? "text-accent" : "text-dim-paper"
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
};
