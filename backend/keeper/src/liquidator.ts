import type {EventLog, Log} from "ethers";

import {engine, explain, marketIds, oneAtATime, provider} from "./chain.js";
import {config} from "./config.js";

/**
 * Closes positions that have fallen through their maintenance margin.
 *
 * **It is a race we are allowed to lose.** `liquidate` is permissionless and
 * pays its caller out of what is left of the position, so anybody may run
 * this, and a venue whose liquidations depend on one operator's bot staying up
 * is a venue with a single point of insolvency. Ours going down means somebody
 * else collects the fee.
 *
 * The scan is event-driven. Open positions are learned from `PositionOpened`
 * and forgotten on `PositionClosed` or `PositionLiquidated`, so the work each
 * round is proportional to what is actually open rather than to the 64 markets
 * or to every address that has ever traded.
 *
 * Every candidate is checked twice: once against `positionView`, which is a
 * read, and once with `liquidate.staticCall`, which is the transaction itself
 * run without sending it. A liquidation that would revert is never paid for.
 */

interface Open {
  account: string;
  market: string;
}

const open = new Map<string, Open>();
const key = (account: string, market: string): string => `${account.toLowerCase()}:${market}`;

let scannedTo = 0;

/** Some RPCs refuse a wide `eth_getLogs`, so the history is walked in slices. */
const WINDOW = 5_000;

const catchUp = async (): Promise<void> => {
  const head = await provider.getBlockNumber();
  if (scannedTo === 0) scannedTo = config.START_BLOCK;

  while (scannedTo < head) {
    const to = Math.min(scannedTo + WINDOW, head);

    const [opened, closed, liquidated] = await Promise.all([
      engine.queryFilter(engine.filters.PositionOpened(), scannedTo, to),
      engine.queryFilter(engine.filters.PositionClosed(), scannedTo, to),
      engine.queryFilter(engine.filters.PositionLiquidated(), scannedTo, to),
    ]);

    // Both events index `account` first and `market` second, so one reader
    // serves all three.
    const parties = (event: EventLog | Log): Open => ({
      account: String((event as EventLog).args[0]),
      market: String((event as EventLog).args[1]),
    });

    for (const event of opened) {
      const position = parties(event);
      open.set(key(position.account, position.market), position);
    }
    for (const event of [...closed, ...liquidated]) {
      const position = parties(event);
      open.delete(key(position.account, position.market));
    }

    scannedTo = to + 1;
  }
};

export const sweep = async (): Promise<void> => {
  await catchUp();
  if (open.size === 0) return;

  let checked = 0;
  let closed = 0;

  for (const position of [...open.values()]) {
    checked += 1;

    let liquidatable = false;
    try {
      const view = await engine.positionView(position.account, position.market);

      if (!view.position.open) {
        open.delete(key(position.account, position.market));
        continue;
      }
      liquidatable = view.liquidatable;
    } catch {
      // A market whose oracle is stale or unwired reverts on read. That is the
      // correct behaviour, and not something to fill the log with every round.
      continue;
    }

    if (!liquidatable) continue;

    const symbol = marketIds.get(position.market) ?? position.market;

    try {
      // The transaction, run without sending it. If it would revert — because
      // somebody else got there first, or the price moved back — we find out
      // for free.
      await engine.liquidate.staticCall(position.account, position.market);
    } catch (error) {
      console.log(`[liq] ${symbol} ${position.account}: skipped, ${explain(error)}`);
      continue;
    }

    try {
      const receipt = await oneAtATime(async () => {
        const transaction = await engine.liquidate(position.account, position.market);
        return transaction.wait();
      });
      open.delete(key(position.account, position.market));
      closed += 1;
      console.log(`[liq] ${symbol} ${position.account} closed in block ${receipt?.blockNumber ?? "?"}`);
    } catch (error) {
      console.error(`[liq] ${symbol} ${position.account}: ${explain(error)}`);
    }
  }

  if (closed > 0 || checked > 0) {
    console.log(`[liq] ${checked} open, ${closed} liquidated, scanned to ${scannedTo}`);
  }
};
