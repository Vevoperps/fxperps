import type { ReactNode } from "react";

import type { SectionHead as SectionHeadData } from "@/data/content";
import { SECTION_COUNT, sectionIndex } from "@/data/content";
import { Action } from "@/components/ui/action";
import { brand } from "@/lib/brand";
import { Reveal } from "@/components/ui/reveal";
import { Rule } from "@/components/ui/rule";
import { TypeIn } from "@/components/ui/type-in";
import type { Tone } from "@/components/ui/tone";
import { toneClasses } from "@/components/ui/tone";

/**
 * The marker and heading every section opens with.
 *
 * `[N.04/10] > HOW IT WORKS` then a hairline to the right edge, then a
 * two-line heading with an optional action beside it. The number is derived
 * from the section's position in `SECTION_ORDER`, so re-ordering the page
 * re-numbers it — there is no number to forget to update.
 */
export const SectionHead = ({
  data,
  tone = "paper",
  aside,
}: {
  data: SectionHeadData;
  tone?: Tone;
  /**
   * A block that sits to the right of the heading instead of beside it — the
   * figures panel on the performance section. When it is present the action
   * moves under the heading, because the right-hand side is taken.
   */
  aside?: ReactNode;
}) => {
  const t = toneClasses(tone);
  const index = sectionIndex(data.id);

  return (
    <header className="flex flex-col gap-10">
      <Reveal y={12} className="flex items-center gap-4">
        <span className="label whitespace-nowrap">
          <span className={t.dim}>[N.</span>
          <span>{String(index).padStart(2, "0")}</span>
          <span className={t.dim}>
            /{String(SECTION_COUNT).padStart(2, "0")}]
          </span>
        </span>
        <Rule className={`w-8 ${t.hairline}`} delay={80} />
        <TypeIn
          text={`> ${data.label}`}
          className={`label whitespace-nowrap ${t.dim}`}
          delay={120}
        />
        <Rule className={`flex-1 ${t.hairline}`} delay={160} />
      </Reveal>

      <div
        className={
          aside
            ? "grid items-start gap-10 lg:grid-cols-[1fr_auto]"
            : "flex flex-wrap items-end justify-between gap-6"
        }
      >
        <div className={aside ? "flex flex-col items-start gap-8" : "contents"}>
          <Reveal y={20} delay={80}>
            {/* Typed rather than faded: the reference announces every section
                the same way, and a heading that writes itself is the one place
                the mono language reaches the display type. */}
            <h2 className="max-w-[24ch] text-[2.25rem] font-medium leading-[1.05] tracking-tight sm:text-[3rem]">
              <TypeIn block text={data.heading[0]} delay={220} />
              <TypeIn
                block
                text={data.heading[1]}
                delay={220 + data.heading[0].length * 17}
                className={t.dim}
              />
            </h2>
          </Reveal>
          {data.action ? (
            <Reveal y={20} delay={140}>
              <Action tone={tone} href={brand.links.app}>
                {data.action}
              </Action>
            </Reveal>
          ) : null}
        </div>

        {aside ? (
          <Reveal y={20} delay={180} className="w-full lg:w-auto">
            {aside}
          </Reveal>
        ) : null}
      </div>
    </header>
  );
};
