import {engine, explain, marketId, oneAtATime, provider, signer} from "./chain.js";
import {markets} from "./shared.js";

/**
 * Refreshes each market's reference mark, so the app can show a real 24h move.
 *
 * The engine stores a price, not a history. Rather than stand up an indexer
 * and a database to answer one column, each market keeps a single reference
 * mark that anyone may refresh once a window — and `snapshot` returns `false`
 * and changes nothing until that window has passed.
 *
 * **Every market is asked with `staticCall` first.** That runs the function
 * without sending it, so a market whose window is not up costs a read rather
 * than a reverted transaction, and on a normal round this loop sends nothing
 * at all.
 *
 * Like the rest of the keeper's work this is permissionless: if we stop, the
 * reference simply ages, the front end notices that `referenceAt` is stale and
 * shows a dash instead of a wrong number, and anybody else can take over.
 */

export const takeSnapshots = async (): Promise<void> => {
  /** In flight at once. Enough to be quick, few enough to stay predictable. */
  const BATCH = 8;

  const due: string[] = [];

  let notDue = 0;
  let unpriced = 0;

  for (const market of markets) {
    const id = marketId(market.symbol);

    try {
      // The transaction, run without sending it: `true` means the window is up
      // and the oracle can price this market right now.
      if (await engine.snapshot.staticCall(id)) {
        due.push(market.symbol);
      } else {
        notDue += 1;
      }
    } catch {
      // An unwired or stale feed reverts here — a different thing entirely
      // from a window that has not come round, and counted separately because
      // confusing the two hides an oracle that has stopped.
      unpriced += 1;
    }
  }

  let taken = 0;
  let failed = 0;

  /**
   * Sent in small batches rather than one at a time or all at once.
   *
   * One at a time took longer than the oracle's own staleness window on a
   * fresh deployment with sixty-four references to take — the marks went
   * stale halfway through and the rest of the round failed on a price the
   * keeper had posted a minute earlier. All at once collides on nonces: the
   * node answers "how many transactions does this account have" with a number
   * it has not caught up to. A small batch, with its nonces counted here and
   * its receipts collected before the next one starts, has neither problem.
   */
  for (let i = 0; i < due.length; i += BATCH) {
    const slice = due.slice(i, i + BATCH);

    // The whole batch is one job on the wallet's queue: the nonces are read,
    // spent and confirmed with nothing else signing in between. Read outside
    // the queue, as it was, and a price post landing in the gap invalidated
    // every nonce in the run at once.
    const results = await oneAtATime(async () => {
      const base = await provider.getTransactionCount(signer.address, "latest");

      const sent = await Promise.all(
        slice.map(async (symbol, offset) => {
          try {
            const transaction = await engine.snapshot(marketId(symbol), {nonce: base + offset});
            return {symbol, transaction};
          } catch (error) {
            console.error(`[ref] ${symbol}: ${explain(error)}`);
            return null;
          }
        }),
      );

      const settled: boolean[] = [];
      for (const one of sent) {
        if (!one) {
          settled.push(false);
          continue;
        }
        try {
          await one.transaction.wait();
          settled.push(true);
        } catch (error) {
          settled.push(false);
          console.error(`[ref] ${one.symbol}: ${explain(error)}`);
        }
      }
      return settled;
    });

    for (const ok of results) {
      if (ok) taken += 1;
      else failed += 1;
    }
  }

  if (taken > 0 || failed > 0 || unpriced > 0) {
    const parts = [`${taken} refreshed`, `${notDue} not due`];
    if (failed > 0) parts.push(`${failed} failed`);
    if (unpriced > 0) parts.push(`${unpriced} unpriced or stale`);
    console.log(`[ref] ${parts.join(", ")}`);
  }
};
