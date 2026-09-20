import Link from "next/link";

import { Label } from "@/components/ui/label";
import { Reveal } from "@/components/ui/reveal";
import { TypeIn } from "@/components/ui/type-in";
import type { Block } from "@/data/books";
import type { LegalPage } from "@/data/legal";
import { legalPages } from "@/data/legal";

/**
 * A legal page: one column, numbered sections, and a contents list at the top.
 *
 * Deliberately not the handbook's layout. A handbook is read in order with a
 * rail to keep your place; a legal page is read once in full or jumped into at
 * one clause, so the contents sit at the top where a link can be copied and the
 * column is narrow enough that a long sentence is still a sentence.
 *
 * The blue does the same work it does in the handbooks: the section number, the
 * rule under each heading, the term at the head of a list row and the left edge
 * of a note. Body text is never blue, which is what keeps a page of it readable.
 */
const Blocks = ({ blocks }: { blocks: Block[] }) => (
  <div className="mt-6 flex flex-col gap-5">
    {blocks.map((block, position) => {
      if (block.kind === "list") {
        return (
          <Reveal
            key={position}
            y={14}
            delay={40}
            tag="ul"
            className="flex flex-col gap-3"
          >
            {block.items?.map((item) => (
              <li
                key={item.term}
                className="flex gap-3 text-[0.9375rem] leading-relaxed"
              >
                <span
                  aria-hidden
                  className="mt-[0.55em] size-[5px] shrink-0 bg-accent"
                />
                <span>
                  <b className="font-medium text-accent">{item.term}</b>
                  <span className="text-dim-paper"> {item.body}</span>
                </span>
              </li>
            ))}
          </Reveal>
        );
      }

      if (block.kind === "note") {
        return (
          <Reveal
            key={position}
            y={14}
            delay={40}
            className="border-l-2 border-accent bg-accent/[0.06] px-5 py-4 text-[0.9375rem] leading-relaxed"
          >
            {block.body}
          </Reveal>
        );
      }

      return (
        <Reveal
          key={position}
          y={14}
          delay={40}
          tag="p"
          className="text-[0.9375rem] leading-relaxed text-dim-paper"
        >
          {block.body}
        </Reveal>
      );
    })}
  </div>
);

export const LegalView = ({ page }: { page: LegalPage }) => (
  <main className="bg-surface-paper">
    <div className="mx-auto w-full max-w-[52rem] px-5 py-14 sm:px-8 sm:py-20">
      <Link
        href="/"
        className="label flex w-max items-center gap-2 text-dim-paper transition-colors duration-[var(--duration-fast)] ease-entrance hover:text-accent"
      >
        <span aria-hidden>&lt;</span>
        {page.back}
      </Link>

      <header className="mt-10 border-b border-rule-paper pb-10">
        <Label>Legal</Label>
        <h1 className="mt-4 text-[2.25rem] font-medium leading-[1.06] tracking-tight sm:text-[3rem]">
          <TypeIn block text={page.title} delay={200} />
        </h1>
        <p className="mt-4 max-w-[52ch] text-[0.9375rem] leading-relaxed text-dim-paper">
          {page.lede}
        </p>
        <p className="label mt-6 text-faint">Last updated {page.updated}</p>
      </header>

      {/* The contents. At the top rather than in a rail: this is a page people
          land in at one clause, and a list of anchors is the fastest way to the
          clause they were sent. */}
      <Reveal y={16} className="mt-10 border border-rule-paper p-6">
        <Label>{page.contents}</Label>
        <ol className="mt-4 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
          {page.sections.map((section, index) => (
            <li key={section.id} className="flex gap-3 text-sm">
              <span className="label shrink-0 text-accent">
                {String(index + 1).padStart(2, "0")}
              </span>
              <Link
                href={`#${section.id}`}
                className="text-dim-paper transition-colors duration-[var(--duration-fast)] ease-entrance hover:text-accent"
              >
                {section.title}
              </Link>
            </li>
          ))}
        </ol>
      </Reveal>

      {page.sections.map((section, index) => (
        <section
          key={section.id}
          id={section.id}
          className="scroll-mt-8 border-rule-paper pt-12 [&+section]:border-t"
        >
          <Reveal y={18} className="flex flex-col gap-4">
            <span className="flex items-center gap-3">
              <span className="label bg-accent px-2 py-1.5 pt-2 text-ink-on-ink">
                {String(index + 1).padStart(2, "0")}
              </span>
            </span>

            <h2 className="max-w-[26ch] text-[1.5rem] font-medium leading-[1.15] tracking-tight sm:text-[1.875rem]">
              {section.title}
            </h2>

            <span aria-hidden className="block h-[2px] w-16 bg-accent" />
          </Reveal>

          <div className="pb-12">
            <Blocks blocks={section.blocks} />
          </div>
        </section>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-rule-paper pt-8">
        <Link
          href="/"
          className="label flex items-center gap-3 border-b border-rule-paper pb-3 text-dim-paper transition-colors duration-[var(--duration-fast)] ease-entrance hover:border-accent hover:text-accent"
        >
          <span aria-hidden>&lt;</span>
          {page.back}
        </Link>

        {legalPages
          .filter((other) => other.path !== page.path)
          .map((other) => (
            <Link
              key={other.path}
              href={other.path}
              className="label flex items-center gap-3 border-b border-accent pb-3 text-accent"
            >
              {other.name}
              <span aria-hidden>→</span>
            </Link>
          ))}
      </div>
    </div>
  </main>
);
