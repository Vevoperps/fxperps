import {Contract, JsonRpcProvider, Wallet, id} from "ethers";

import {config} from "./config.js";
import {abi, markets} from "./shared.js";
import type {EngineContract} from "./types.js";

/**
 * One provider, one signer, one contract handle, shared by every task.
 *
 * The signer here is deliberately powerless. `poke` and `liquidate` are the
 * only things it ever calls, neither can move a balance that is not already
 * due to be moved, and both are open to anyone — so the worst a stolen keeper
 * key buys is the right to do the venue's maintenance at its own expense.
 */

export const provider = new JsonRpcProvider(config.RPC_URL, config.CHAIN_ID, {
  staticNetwork: true,
});

export const signer = new Wallet(config.KEEPER_KEY, provider);

export const engine = new Contract(
  config.ENGINE_ADDRESS,
  abi.engine as never,
  signer,
) as unknown as EngineContract;

/** The id the engine knows a pair by: `keccak256(symbol)`. */
export const marketId = (symbol: string): string => id(symbol);

/** Every listed pair, by the id the chain uses. */
export const marketIds = new Map<string, string>(markets.map((market) => [marketId(market.symbol), market.symbol]));

export const explain = (error: unknown): string => {
  if (error instanceof Error) {
    const named = (error as {shortMessage?: string}).shortMessage;
    return named ?? error.message;
  }
  return String(error);
};

/** Waits, without pulling in a dependency to do it. */
export const sleep = (seconds: number): Promise<void> =>
  new Promise((done) => setTimeout(done, seconds * 1000));

/**
 * Runs a task forever, on an interval, and never lets one bad round stop it.
 *
 * A keeper that exits on the first RPC hiccup is a keeper that is down every
 * time the node restarts. Errors are logged and the loop carries on; the
 * contracts are correct without it either way, so a gap costs latency rather
 * than money.
 */
export const every = async (seconds: number, name: string, task: () => Promise<void>): Promise<never> => {
  for (;;) {
    const started = Date.now();
    try {
      await task();
    } catch (error) {
      console.error(`[${name}] ${explain(error)}`);
    }
    await sleep(Math.max(0, seconds - (Date.now() - started) / 1000));
  }
};

/**
 * One transaction at a time from this wallet.
 *
 * The keeper runs three loops at once — prices, liquidations, reference marks
 * — and all three sign with the same key. A nonce belongs to the account, not
 * to the loop, so two loops that send at the same moment ask the node for "how
 * many transactions has this account sent" and both get the same answer. One
 * lands and the other comes back `nonce has already been used`, which reads
 * like a bug in the sender and is really a bug in the scheduling.
 *
 * The snapshot round made this loud: it reserves a run of nonces for a batch
 * of eight, and a single price transaction slipping in between the read and
 * the sends invalidated the whole run — fifty markets failing in a row while
 * the price loop reported success two lines above.
 *
 * So every send goes through here, and the wallet does one thing at a time.
 * The cost is that a liquidation can wait behind a price post for the length
 * of one block; the benefit is that neither can poison the other. Batching
 * still works: a whole batch, sent and awaited, is one job.
 */
let tail: Promise<unknown> = Promise.resolve();

export const oneAtATime = <T>(job: () => Promise<T>): Promise<T> => {
  // `then(job, job)` so a failed job does not stop the queue behind it.
  const result = tail.then(job, job);
  tail = result.catch(() => undefined);
  return result;
};
