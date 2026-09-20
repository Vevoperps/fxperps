import Image from "next/image";
import Link from "next/link";

import { Label } from "@/components/ui/label";
import { TypeIn } from "@/components/ui/type-in";
import { PreviewBanner } from "@/views/app/app-shell";
import { app } from "@/data/app";
import { coverage } from "@/data/content";
import { PAIRS } from "@/lib/markets";

/** Leverage cap per symbol, so the list can print it beside each country. */
const CAPS = new Map(PAIRS.map((pair) => [pair.symbol, pair.maxLeverage]));

/**
 * Every pair, grouped by region.
 *
 * A flat list of sixty-four symbols is unreadable, and a search box is the
 * wrong answer for someone who does not yet know what they are looking for —
 * so it is grouped the way a trader thinks about currencies, by part of the
 * world, with the leverage cap printed beside each one because that is the
 * number that decides whether a pair is worth opening.
 */
export const AppPairs = () => (
  <>
    <PreviewBanner />

    <section className="mx-auto w-full max-w-[90rem] px-5 py-14 sm:px-8">
      <Label tone="ink">{app.pairs.title}</Label>

      <h1 className="mt-5 max-w-[20ch] text-[2.25rem] font-medium leading-[1.05] tracking-tight sm:text-[3rem]">
        <TypeIn block text={app.pairs.heading} delay={200} />
      </h1>

      <p className="mt-5 max-w-[52ch] text-sm leading-relaxed text-dim-ink">
        {app.pairs.lede}
      </p>

      <div className="mt-14 flex flex-col gap-12">
        {coverage.regions.map((region) => (
          <section key={region.id}>
            <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-rule-ink pb-3">
              <h2 className="text-lg font-medium uppercase tracking-tight">
                {region.name}
              </h2>
              <Label tone="ink">
                {app.pairs.count(region.pairs.length)} · {region.blurb}
              </Label>
            </header>

            <ul className="grid sm:grid-cols-2 lg:grid-cols-4">
              {region.pairs.map((pair) => (
                <li key={pair.symbol}>
                  <Link
                    href={`/app/market/${pair.symbol.toLowerCase()}`}
                    className="flex items-center gap-3 border-b border-dashed border-rule-ink py-3.5 pr-4 transition-colors duration-[var(--duration-fast)] ease-entrance hover:bg-surface-ink-2 hover:text-accent"
                  >
                    <Image
                      src={`/flags/${pair.flag}.svg`}
                      alt=""
                      width={24}
                      height={16}
                      className="h-4 w-6 shrink-0 object-cover"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {pair.country}
                    </span>
                    <Label tone="ink">{CAPS.get(pair.symbol) ?? 5}x</Label>
                    <span className="font-mono text-xs text-accent">
                      {pair.symbol}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  </>
);
