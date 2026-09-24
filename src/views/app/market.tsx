"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { useWarm } from "@/hooks/use-warm";
import { Label } from "@/components/ui/label";
import { TypeIn } from "@/components/ui/type-in";
import { PreviewBanner } from "@/views/app/app-shell";
import { PriceChart } from "@/views/app/price-chart";
import { Portfolio } from "@/views/app/portfolio";
import { Ticket } from "@/views/app/ticket";
import {
  decimalsFor,
  formatChange,
  useMarkets,
} from "@/views/home/use-markets";
import { app } from "@/data/app";
import { money } from "@/lib/chain/units";
import type { Market } from "@/lib/markets";
import { marketOf, pairOf } from "@/lib/markets";

/**
 * One pair's terminal: the price, the chart, the ticket, and the balance it
 * would come out of.
 *
 * Laid out as one column of blocks rather than a panel grid. A professional
 * terminal packs six panes onto one screen because its user is watching all
 * six; someone arriving here is looking at one pair, so the chart and the
 * ticket get the fold and everything else is below it, in the order it is
 * needed: what this market is, then what it would cost, then what you hold.
 *
 * The mark comes from the same `/api/markets` subscription the board uses, so
 * the terminal, the table and the landing page can never disagree about a
 * price. Until the first poll lands it renders the generated mark from the
 * server, which is the same number.
 */
export const AppMarket = ({
  symbol,
  snapshot,
}: {
  symbol: string;
  /**
   * The mark as the server rendered it.
   *
   * It is a prop rather than something the client computes for itself because
   * the generator is a function of the clock: computed twice, once when the
   * page was built and once on hydration, it produces two different numbers
   * and React throws a hydration mismatch. Handed down, both renders agree,
   * and the effect below replaces it with a fresh one a tick later.
   */
  snapshot?: Market;
}) => {
  const pair = pairOf(symbol);
  const { rows, onchain } = useMarkets();
  const [fallback, setFallback] = useState<Market | undefined>(snapshot);

  // The snapshot is as old as the build; this refreshes it once on mount so a
  // cold page is not quoting last week before the first poll returns.
  useEffect(() => {
    setFallback(marketOf(symbol));
  }, [symbol]);

  // Before the early return below, because a hook cannot be called after one.
  // The chain rows are the only honest source for this: the static snapshot
  // carries a status from the generator, which knows nothing about what has a
  // mark on chain right now.
  const chainRow = pair
    ? rows?.find((row) => row.symbol === pair.symbol)
    : undefined;
  useWarm(pair?.symbol, onchain && chainRow?.status === "warming");

  if (!pair) {
    return (
      <>
        <PreviewBanner />
        <section className="mx-auto w-full max-w-[90rem] px-5 py-24 sm:px-8">
          <h1 className="text-[2rem] font-medium tracking-tight">
            {app.market.notFound}
          </h1>
          <Link
            href="/app/pairs"
            className="label mt-6 inline-flex items-center gap-2 text-accent"
          >
            {app.market.back} <span aria-hidden>→</span>
          </Link>
        </section>
      </>
    );
  }

  const live = rows?.find((row) => row.symbol === pair.symbol) ?? fallback;
  const mark = live?.mark ?? pair.base;
  const change = live?.change24h ?? 0;
  const changeKnown = live?.changeKnown !== false;
  const funding = live?.fundingRate ?? 0;
  const decimals = decimalsFor(mark);
  const currency = pair.symbol.slice(3);

  // On the chain these are real; in the preview there is nothing open and
  // nothing to be open, so the row says "Preview" rather than "0.00".
  const openInterest = onchain
    ? (live?.longOpenInterest ?? 0) + (live?.shortOpenInterest ?? 0)
    : null;
  const state = onchain
    ? (app.market.state[live?.status ?? "live"] ?? app.market.state.live)
    : app.market.state.preview;
  const session = onchain ? app.market.sessionLive : app.market.session;

  return (
    <>
      <PreviewBanner />

      <section className="mx-auto w-full max-w-[90rem] px-5 py-10 sm:px-8">
        <Link
          href="/app/pairs"
          className="label flex w-max items-center gap-2 text-dim-ink transition-colors duration-[var(--duration-fast)] ease-entrance hover:text-accent"
        >
          <span aria-hidden>&lt;</span>
          {app.market.back}
        </Link>

        <div className="mt-8 grid gap-px border border-rule-ink bg-rule-ink lg:grid-cols-[1fr_20rem]">
          {/* The market itself. */}
          <div className="flex flex-col bg-surface-ink">
            <header className="flex flex-col gap-3 p-5">
              <Label tone="ink">{app.market.kind}</Label>

              <div className="flex flex-wrap items-center gap-3">
                <Image
                  src={`/flags/${pair.flag}.svg`}
                  alt=""
                  width={32}
                  height={22}
                  className="h-[22px] w-8 object-cover"
                />
                <h1 className="text-[2.25rem] font-medium leading-none tracking-tight sm:text-[3rem]">
                  <TypeIn block text={pair.symbol} delay={180} />
                </h1>
                <span className="text-sm text-dim-ink">
                  US dollar / {pair.name}
                </span>
                <span
                  className={`label border px-2 py-1.5 pt-2 ${
                    onchain && live?.status === "live"
                      ? "border-accent text-accent"
                      : "border-rule-ink text-dim-ink"
                  }`}
                >
                  {state}
                </span>
              </div>

              <p className="max-w-[60ch] text-xs leading-relaxed text-dim-ink">
                {app.market.describe(pair.symbol, currency)}
              </p>

              <dl className="mt-3 flex flex-wrap gap-x-10 gap-y-4">
                {[
                  [app.market.stats.last, mark.toFixed(decimals), "big"],
                  [
                    app.market.stats.change,
                    formatChange(change, changeKnown),
                    "accent",
                  ],
                  [
                    app.market.stats.funding,
                    `${(funding * 100).toFixed(4)}%`,
                    "plain",
                  ],
                  [
                    app.market.stats.interest,
                    openInterest === null ? "·" : money(openInterest),
                    "plain",
                  ],
                  [app.market.stats.session, session, "plain"],
                ].map(([term, value, weight]) => (
                  <div key={term} className="flex flex-col gap-1">
                    <Label tone="ink">{term}</Label>
                    <dd
                      className={
                        weight === "big"
                          ? "font-mono text-[1.75rem] font-medium leading-none tabular-nums"
                          : weight === "accent"
                            ? `font-mono text-sm tabular-nums ${
                                change > 0
                                  ? "text-accent"
                                  : change < 0
                                    ? "text-ink-on-ink"
                                    : "text-dim-ink"
                              }`
                            : "font-mono text-sm tabular-nums text-dim-ink"
                      }
                    >
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </header>

            <div className="border-t border-rule-ink">
              <PriceChart symbol={pair.symbol} />
            </div>
          </div>

          <div className="bg-surface-ink">
            <Ticket
              mark={mark}
              maxLeverage={pair.maxLeverage}
              symbol={pair.symbol}
              warming={onchain && live?.status === "warming"}
            />
          </div>
        </div>
      </section>

      {/* What this market is, as a row of the board it came from. */}
      <section className="mx-auto w-full max-w-[90rem] px-5 pb-14 sm:px-8">
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className="label bg-accent px-2 py-1.5 pt-2 text-ink-on-ink"
          >
            02
          </span>
          <Label tone="ink">Markets</Label>
        </span>

        <h2 className="mt-3 text-[1.75rem] font-medium leading-[1.1] tracking-tight sm:text-[2.25rem]">
          <TypeIn block text={app.market.marketsTitle[0]} delay={120} />
          <TypeIn
            block
            text={app.market.marketsTitle[1]}
            delay={120 + app.market.marketsTitle[0].length * 17}
            className="text-dim-ink"
          />
        </h2>

        <p className="mt-4 max-w-[52ch] text-sm leading-relaxed text-dim-ink">
          {app.market.marketsLede}
        </p>

        <div className="mt-6 overflow-x-auto border border-rule-ink">
          <table className="w-full min-w-[52rem] border-collapse font-mono text-xs">
            <thead>
              <tr className="border-b border-rule-ink">
                {Object.values(app.market.columns).map((column, index) => (
                  <th
                    key={column}
                    scope="col"
                    className={`label px-4 py-3 font-normal text-dim-ink ${
                      index > 0 ? "text-right" : "text-left"
                    }`}
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="transition-colors duration-[var(--duration-fast)] ease-entrance hover:bg-surface-ink-2">
                <td className="px-4 py-4">
                  <b className="font-medium text-accent">{pair.symbol}</b>
                  <span className="text-dim-ink"> US dollar / {pair.name}</span>
                </td>
                <td className="px-4 py-4 text-right">
                  <span
                    className={`label border px-2 py-1 ${
                      onchain && live?.status === "live"
                        ? "border-accent text-accent"
                        : "border-rule-ink text-dim-ink"
                    }`}
                  >
                    {state}
                  </span>
                </td>
                <td className="px-4 py-4 text-right tabular-nums">
                  {mark.toFixed(decimals)}
                </td>
                <td
                  className={`px-4 py-4 text-right tabular-nums ${
                    change > 0 ? "text-accent" : "text-dim-ink"
                  }`}
                >
                  {formatChange(change, changeKnown)}
                </td>
                <td className="px-4 py-4 text-right tabular-nums text-dim-ink">
                  {(funding * 100).toFixed(4)}%
                </td>
                <td className="px-4 py-4 text-right tabular-nums text-dim-ink">
                  {onchain ? money(live?.longOpenInterest ?? 0) : "·"}
                </td>
                <td className="px-4 py-4 text-right tabular-nums text-dim-ink">
                  {onchain ? money(live?.shortOpenInterest ?? 0) : "·"}
                </td>
                <td className="px-4 py-4 text-right text-dim-ink">
                  {session}
                </td>
                <td className="px-4 py-4 text-right tabular-nums">
                  {pair.maxLeverage}x
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="mt-4 max-w-[60ch] text-xs leading-relaxed text-faint">
          {app.ticket.capNote(pair.maxLeverage)}
        </p>
      </section>

      <section className="mx-auto w-full max-w-[90rem] px-5 pb-20 sm:px-8">
        <Portfolio compact />
      </section>
    </>
  );
};
