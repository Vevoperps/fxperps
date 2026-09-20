import Image from "next/image";
import Link from "next/link";

import { Label } from "@/components/ui/label";
import { Reveal } from "@/components/ui/reveal";
import { Section } from "@/components/ui/section";
import { SectionHead } from "@/components/ui/section-head";
import { coverage } from "@/data/content";

/**
 * Every pair, grouped by region.
 *
 * Sixty-four rows is a lot of page, so each region announces its own count and
 * the rows themselves are as small as they can be while staying tappable — the
 * point of this section is that the list is long, and hiding that behind a
 * "show more" would be hiding the product's main claim.
 */
export const Coverage = () => (
  <Section id={coverage.head.id} tone="paper">
    <SectionHead data={coverage.head} />

    <p className="mt-8 max-w-[52ch] text-sm leading-relaxed text-dim-paper">
      {coverage.lede}
    </p>

    <div className="mt-14 border-t border-rule-paper">
      {coverage.regions.map((region, index) => (
        <Reveal
          key={region.id}
          y={18}
          delay={index * 70}
          className="border-b border-rule-paper py-10"
        >
          <div className="flex flex-wrap items-baseline gap-4">
            <h3 className="text-xl font-medium tracking-tight">
              {region.name}
            </h3>
            <Label strong>{region.pairs.length} pairs</Label>
            <span className="h-px flex-1 bg-rule-paper" />
            <Label>{region.blurb}</Label>
          </div>

          <ul className="mt-6 grid gap-px bg-rule-paper sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {region.pairs.map((pair) => (
              <li key={pair.symbol} className="bg-surface-paper">
                {/* Every country opens its own market. The cell is the link,
                    so the whole row is the target rather than the symbol. */}
                <Link
                  href={`/app/market/${pair.symbol.toLowerCase()}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition-colors duration-[var(--duration-fast)] ease-entrance hover:bg-surface-paper-2 hover:text-accent"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Image
                      src={`/flags/${pair.flag}.svg`}
                      alt=""
                      width={18}
                      height={13}
                      className="h-[13px] w-[18px] shrink-0 object-cover"
                    />
                    <span className="truncate text-sm">{pair.country}</span>
                  </span>
                  <span className="shrink-0 font-mono text-xs text-dim-paper">
                    {pair.symbol}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Reveal>
      ))}
    </div>
  </Section>
);
