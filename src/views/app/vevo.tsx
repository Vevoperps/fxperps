"use client";

import { useState } from "react";

import { Label } from "@/components/ui/label";
import { TypeIn } from "@/components/ui/type-in";
import { app } from "@/data/app";
import { brand } from "@/lib/brand";
import { venue } from "@/lib/chain/venue";
import { PreviewBanner } from "@/views/app/app-shell";

/**
 * The token screen: what $VEVO is, and the one thing it will do.
 *
 * **Nothing here is live, and the screen says so in each place rather than
 * once at the top.** The staking vault is not deployed, so the inputs accept
 * typing and the buttons refuse, with the reason printed beside them. A screen
 * that looked live and reverted on signature would be worse than one that is
 * honest about being early.
 *
 * **Every number is a slot.** Supply, the distribution split and the stake a
 * tier asks for are decisions nobody has made. They read `tba` until they are
 * real, because a plausible figure printed on a token page is a claim, and a
 * claim that has to be retracted is how a project loses the room.
 *
 * What is settled is stated plainly: fees flow to stakers, and margin stays in
 * the dollar stablecoin. The last block on the page explains why, since it is
 * the question every holder asks first.
 */

const { vevo } = app;

/** A figure, or the mark that says it does not exist yet. */
const Figure = ({ value }: { value: string | null }) =>
  value ? (
    <b className="font-mono text-lg font-medium tabular-nums">{value}</b>
  ) : (
    <span className="font-mono text-lg text-faint uppercase">{vevo.tba}</span>
  );

const Panel = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section className="flex flex-col gap-5 border border-rule-ink p-6 sm:p-8">
    <Label tone="ink" strong>
      {title}
    </Label>
    {children}
  </section>
);

/** The soft state every action on this page is in. */
const NotYet = ({ reason }: { reason: string }) => (
  <p className="border-l-2 border-rule-ink bg-surface-ink-2 px-4 py-3">
    <Label tone="ink">{reason}</Label>
  </p>
);

export const AppVevo = () => {
  const [amount, setAmount] = useState("");
  const [copied, setCopied] = useState(false);

  const address = brand.token.address;

  const copy = () => {
    if (!address) return;
    void navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  };

  return (
    <>
      <PreviewBanner />

      <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-10 px-5 py-12 sm:px-8">
        <header className="flex flex-col gap-4">
          <span className="flex items-center gap-2">
            <span
              aria-hidden
              className="label bg-accent px-2 py-1.5 pt-2 text-ink-on-ink"
            >
              05
            </span>
            <Label tone="ink">{vevo.title}</Label>
          </span>

          <h1 className="text-[1.75rem] font-medium leading-[1.1] tracking-tight sm:text-[2.25rem]">
            <TypeIn block text={vevo.heading[0]} delay={120} />
            <TypeIn
              block
              text={vevo.heading[1]}
              delay={120 + vevo.heading[0].length * 17}
              className="text-dim-ink"
            />
          </h1>

          <p className="max-w-[60ch] text-sm leading-relaxed text-dim-ink">
            {vevo.lede}
          </p>
        </header>

        <div className="grid gap-px bg-rule-ink lg:grid-cols-2">
          {/* The token itself. */}
          <div className="bg-surface-ink">
            <Panel title={vevo.facts.title}>
              <dl className="flex flex-col gap-4">
                <div className="flex items-baseline justify-between gap-4">
                  <dt>
                    <Label tone="ink">{vevo.facts.ticker}</Label>
                  </dt>
                  <dd>
                    <Figure value={`$${brand.token.ticker}`} />
                  </dd>
                </div>

                <div className="flex items-baseline justify-between gap-4">
                  <dt>
                    <Label tone="ink">{vevo.facts.chain}</Label>
                  </dt>
                  <dd>
                    <Figure value={venue.network.name} />
                  </dd>
                </div>

                <div className="flex items-baseline justify-between gap-4">
                  <dt>
                    <Label tone="ink">{vevo.facts.supply}</Label>
                  </dt>
                  <dd>
                    <Figure value={vevo.facts.supplyValue} />
                  </dd>
                </div>

                <div className="flex flex-col gap-2 border-t border-rule-ink pt-4">
                  <dt>
                    <Label tone="ink">{vevo.facts.contract}</Label>
                  </dt>
                  <dd className="flex flex-wrap items-center gap-3">
                    {address ? (
                      <>
                        <code className="break-all font-mono text-xs text-ink-on-ink">
                          {address}
                        </code>
                        <button
                          type="button"
                          onClick={copy}
                          className="label border border-rule-ink px-3 py-2 text-dim-ink transition-colors duration-[var(--duration-fast)] ease-entrance hover:border-accent hover:text-accent"
                        >
                          {copied ? vevo.facts.copied : vevo.facts.copy}
                        </button>
                        {venue.network.explorer ? (
                          <a
                            href={`${venue.network.explorer}/address/${address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="label text-accent underline-offset-4 hover:underline"
                          >
                            {vevo.facts.explorer}
                          </a>
                        ) : null}
                      </>
                    ) : (
                      <span className="font-mono text-xs text-faint uppercase">
                        {vevo.facts.contractSoon}
                      </span>
                    )}
                  </dd>
                </div>
              </dl>
            </Panel>
          </div>

          {/* How the supply is split. */}
          <div className="bg-surface-ink">
            <Panel title={vevo.distribution.title}>
              <dl className="flex flex-col gap-4">
                {vevo.distribution.rows.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-baseline justify-between gap-4"
                  >
                    <dt>
                      <Label tone="ink">{row.label}</Label>
                    </dt>
                    <dd>
                      <Figure value={row.share === null ? null : `${row.share}%`} />
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="text-xs leading-relaxed text-faint">
                {vevo.distribution.note}
              </p>
            </Panel>
          </div>
        </div>

        {/* Staking. The whole point of the token. */}
        <Panel title={vevo.staking.title}>
          <p className="max-w-[68ch] text-sm leading-relaxed text-dim-ink">
            {vevo.staking.lede}
          </p>

          <div className="grid gap-px bg-rule-ink sm:grid-cols-3">
            {(
              [
                [vevo.staking.staked, null],
                [vevo.staking.rewards, null],
                [vevo.staking.totalStaked, null],
              ] as const
            ).map(([label, value]) => (
              <div
                key={label}
                className="flex flex-col gap-1.5 bg-surface-ink p-5"
              >
                <Label tone="ink">{label}</Label>
                <Figure value={value} />
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <Label tone="ink">{vevo.staking.stakeLabel}</Label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(event) =>
                  setAmount(event.target.value.replace(/[^0-9.]/g, ""))
                }
                aria-label={vevo.staking.stakeLabel}
                className="min-w-[10rem] flex-1 border border-rule-ink bg-surface-ink-2 px-4 py-3 font-mono text-sm tabular-nums text-dim-ink placeholder:text-faint"
              />
              {[vevo.staking.stake, vevo.staking.unstake, vevo.staking.claim].map(
                (action) => (
                  <span
                    key={action}
                    title={vevo.staking.soon}
                    className="label cursor-not-allowed border border-rule-ink px-4 py-3 text-faint"
                  >
                    {action}
                  </span>
                ),
              )}
            </div>
          </div>

          <NotYet reason={vevo.staking.soon} />

          <p className="max-w-[68ch] text-xs leading-relaxed text-faint">
            {vevo.staking.why}
          </p>
        </Panel>

        {/* Fee tiers. */}
        <Panel title={vevo.tiers.title}>
          <p className="max-w-[68ch] text-sm leading-relaxed text-dim-ink">
            {vevo.tiers.lede}
          </p>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] border-collapse">
              <thead>
                <tr className="border-b border-rule-ink">
                  {[
                    vevo.tiers.columns.tier,
                    vevo.tiers.columns.stake,
                    vevo.tiers.columns.fee,
                  ].map((column) => (
                    <th key={column} className="px-4 py-3 text-left">
                      <Label tone="ink">{column}</Label>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vevo.tiers.rows.map((row) => (
                  <tr key={row.tier} className="border-b border-rule-ink">
                    <td className="px-4 py-4">
                      <Label tone="ink" strong>
                        {row.tier}
                      </Label>
                    </td>
                    <td className="px-4 py-4">
                      <Figure value={row.stake} />
                    </td>
                    <td className="px-4 py-4">
                      <Figure value={row.fee} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <NotYet reason={vevo.tiers.soon} />
        </Panel>

        {/* The question every holder asks. */}
        <Panel title={vevo.honesty.title}>
          <p className="max-w-[72ch] text-sm leading-relaxed text-dim-ink">
            {vevo.honesty.body}
          </p>
        </Panel>
      </div>
    </>
  );
};
