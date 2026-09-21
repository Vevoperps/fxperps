import {engine, explain, marketId} from "./chain.js";
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
  let taken = 0;
  let skipped = 0;

  for (const market of markets) {
    const id = marketId(market.symbol);

    try {
      // The transaction, run without sending it: `true` means the window is up
      // and the oracle can price this market right now.
      const due = await engine.snapshot.staticCall(id);
      if (!due) {
        skipped += 1;
        continue;
      }
    } catch {
      // An unwired or stale feed reverts here. That is the correct failure and
      // not worth a log line every round.
      skipped += 1;
      continue;
    }

    try {
      const transaction = await engine.snapshot(id);
      await transaction.wait();
      taken += 1;
    } catch (error) {
      console.error(`[ref] ${market.symbol}: ${explain(error)}`);
    }
  }

  if (taken > 0) {
    console.log(`[ref] ${taken} references refreshed, ${skipped} not due`);
  }
};
