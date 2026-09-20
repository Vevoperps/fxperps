"use client";

import Image from "next/image";
import { useState } from "react";

import { Action } from "@/components/ui/action";
import { Label } from "@/components/ui/label";
import { Reveal } from "@/components/ui/reveal";
import { Section } from "@/components/ui/section";
import { SectionHead } from "@/components/ui/section-head";
import { rates } from "@/data/content";
import { brand } from "@/lib/brand";
import { decimalsFor, formatChange, useMarkets } from "@/views/home/use-markets";

/** Rows shown before the reader asks for the rest. */
const PREVIEW = 10;

/**
 * Live rates.
 *
 * Sorted by the size of the 24h move rather than alphabetically: the reason to
 * look at this table is to find what is moving, and a list in alphabetical
 * order buries that under the letter A.
 */
export const Rates = () => {
  const { rows, failed } = useMarkets();
  const [expanded, setExpanded] = useState(false);

  const sorted = [...(rows ?? [])].sort(
    (a, b) => Math.abs(b.change24h) - Math.abs(a.change24h),
  );
  const visible = expanded ? sorted : sorted.slice(0, PREVIEW);
  const liveCount = sorted.filter((row) => row.status !== "closed").length;

  return (
    <Section id={rates.head.id} tone="paper">
      <SectionHead data={rates.head} />

      <Reveal y={20} delay={180} className="mt-14 block">
        <div className="border border-rule-paper">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule-paper px-4 py-3">
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className={`size-2 ${liveCount ? "bg-accent" : "bg-faint"}`}
              />
              <Label strong>
                {rows
                  ? liveCount
                    ? `${liveCount} pairs live`
                    : rates.pausedLabel
                  : rates.emptyLabel}
              </Label>
            </span>
            <Label>{rates.note}</Label>
          </div>

          {failed && !rows ? (
            <p className="px-4 py-10 text-center text-sm text-dim-paper">
              live rates are unavailable right now.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-rule-paper">
                    {["Pair", "Currency", "Mark", "24h", "Funding", "Max lev"].map(
                      (head, index) => (
                        <th
                          key={head}
                          scope="col"
                          className={`label px-4 py-3 text-dim-paper ${
                            index >= 2 ? "text-right" : "text-left"
                          } ${index === 1 || index === 4 ? "hidden sm:table-cell" : ""}`}
                        >
                          {head}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-rule-paper last:border-b-0 transition-colors duration-[var(--duration-fast)] ease-entrance hover:bg-surface-paper-2"
                    >
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2 font-mono">
                          <Image
                            src={`/flags/${row.flag}.svg`}
                            alt=""
                            width={18}
                            height={13}
                            className="h-[13px] w-[18px] object-cover"
                          />
                          <b className="font-medium">{row.symbol}</b>
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 text-dim-paper sm:table-cell">
                        {row.name}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">
                        {row.mark.toFixed(decimalsFor(row.mark))}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-mono tabular-nums ${
                          row.change24h > 0
                            ? "text-accent"
                            : row.change24h < 0
                              ? "text-foreground"
                              : "text-dim-paper"
                        }`}
                      >
                        {formatChange(row.change24h, row.changeKnown !== false)}
                      </td>
                      <td className="hidden px-4 py-3 text-right font-mono tabular-nums text-dim-paper sm:table-cell">
                        {(row.fundingRate * 100).toFixed(4)}%
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">
                        {row.maxLeverage}x
                      </td>
                    </tr>
                  ))}
                  {visible.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-10 text-center text-sm text-dim-paper"
                      >
                        {rates.emptyLabel}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-rule-paper px-4 py-4">
            {sorted.length > PREVIEW && !expanded ? (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="label border border-rule-paper px-4 py-2.5 transition-colors duration-[var(--duration-fast)] ease-entrance hover:border-accent hover:text-accent"
              >
                {rates.showAll} ({sorted.length})
              </button>
            ) : (
              <span />
            )}
            <Action href={brand.links.app}>{rates.cta}</Action>
          </div>
        </div>
      </Reveal>
    </Section>
  );
};
