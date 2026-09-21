import {engine, explain, marketId, provider, signer} from "./chain.js";
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
  const pending: Array<{symbol: string; wait: () => Promise<unknown>}> = [];

  let notDue = 0;
  let unpriced = 0;

  // The nonce is counted here rather than asked for per transaction.
  //
  // ethers reads the account's pending count before each send, and a node
  // answering that question while thirty transactions are still in flight
  // answers with a number it has not caught up to — so two of them leave with
  // the same nonce and the second is rejected. Reading it once and counting up
  // is the whole fix. A send that fails does not consume one.
  let nonce = await provider.getTransactionCount(signer.address, "pending");

  for (const market of markets) {
    const id = marketId(market.symbol);

    try {
      // The transaction, run without sending it: `true` means the window is up
      // and the oracle can price this market right now.
      const due = await engine.snapshot.staticCall(id);
      if (!due) {
        notDue += 1;
        continue;
      }
    } catch {
      // An unwired or stale feed reverts here — a different thing entirely
      // from a window that has not come round, and counted separately because
      // confusing the two hides an oracle that has stopped.
      unpriced += 1;
      continue;
    }

    try {
      // Sent, not awaited to completion. The first run of a fresh deployment
      // has sixty-four references to take, and waiting for each receipt in
      // turn took longer than the oracle's own staleness window — the marks
      // went stale halfway through the loop and the rest of the round failed
      // on a price it had just posted. Sending first and collecting the
      // receipts afterwards turns minutes into seconds.
      const transaction = await engine.snapshot(id, {nonce});
      nonce += 1;
      pending.push({symbol: market.symbol, wait: () => transaction.wait()});
    } catch (error) {
      console.error(`[ref] ${market.symbol}: ${explain(error)}`);
    }
  }

  let taken = 0;

  for (const one of pending) {
    try {
      await one.wait();
      taken += 1;
    } catch (error) {
      console.error(`[ref] ${one.symbol}: ${explain(error)}`);
    }
  }

  if (taken > 0 || unpriced > 0) {
    const parts = [`${taken} refreshed`, `${notDue} not due`];
    if (unpriced > 0) parts.push(`${unpriced} unpriced or stale`);
    console.log(`[ref] ${parts.join(", ")}`);
  }
};
