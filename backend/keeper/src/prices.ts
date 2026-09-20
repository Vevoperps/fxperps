import {Contract} from "ethers";

import {explain, marketId, provider, signer} from "./chain.js";
import {config, usingMockOracle} from "./config.js";
import {abi, markets} from "./shared.js";
import type {MockOracleContract, PythContract, PythOracleContract} from "./types.js";

/**
 * Keeps the chain's idea of every rate current.
 *
 * Pyth is **pull-based**: the prices exist off chain, signed, and somebody has
 * to pay to put them on chain before a contract can read one. That somebody is
 * this. Nothing here decides a price — the payload is signed by Pyth's
 * publishers and verified by Pyth's own contract on arrival, so a compromised
 * keeper can post a stale bundle or none at all, and cannot post a false one.
 *
 * On a deployment still running the mock oracle, the same loop writes the
 * parsed prices in directly. That path is testnet only and says so on every
 * start-up, because an operator who can set the mark is an operator who can
 * liquidate anyone.
 */

const PYTH_ABI = [
  "function getUpdateFee(bytes[] updateData) view returns (uint256)",
  "function updatePriceFeeds(bytes[] updateData) payable",
];

interface ParsedPrice {
  id: string;
  price: {price: string; conf: string; expo: number; publish_time: number};
}

interface HermesUpdate {
  binary: {encoding: string; data: string[]};
  parsed?: ParsedPrice[];
}

interface Wired {
  symbol: string;
  market: string;
  feed: string;
  invert: boolean;
}

const WAD = 10n ** 18n;

let wired: Wired[] | null = null;

/**
 * Reads the feed wiring off the oracle rather than a local file.
 *
 * What the keeper pushes has to be what the engine reads, and the only
 * authority on that is the oracle contract itself.
 */
const readWiring = async (): Promise<Wired[]> => {
  if (wired) return wired;

  const oracle = new Contract(
    config.ORACLE_ADDRESS,
    abi.pythOracle as never,
    provider,
  ) as unknown as PythOracleContract;

  const found: Wired[] = [];

  for (const market of markets) {
    const id = marketId(market.symbol);

    if (usingMockOracle) {
      found.push({symbol: market.symbol, market: id, feed: "", invert: false});
      continue;
    }

    const feed = await oracle.feeds(id);
    if (!feed[4]) continue; // not set
    found.push({symbol: market.symbol, market: id, feed: feed[0], invert: feed[3]});
  }

  wired = found;
  return found;
};

const fetchUpdates = async (feedIds: string[]): Promise<HermesUpdate> => {
  const query = feedIds.map((feed) => `ids[]=${feed}`).join("&");
  const response = await fetch(`${config.HERMES_URL}/v2/updates/price/latest?${query}&parsed=true`);
  if (!response.ok) throw new Error(`hermes ${response.status} ${response.statusText}`);
  return (await response.json()) as HermesUpdate;
};

/** `price * 10^expo`, as 1e18, inverted where the pair is quoted the other way. */
const toWad = (raw: string, expo: number, invert: boolean): bigint => {
  const shift = BigInt(18 + expo);
  const value = shift >= 0n ? BigInt(raw) * 10n ** shift : BigInt(raw) / 10n ** -shift;
  if (value === 0n) throw new Error("zero price");
  return invert ? (WAD * WAD) / value : value;
};

export const pushPrices = async (): Promise<void> => {
  const feeds = await readWiring();

  if (usingMockOracle) {
    await pushMock(feeds);
    return;
  }

  if (feeds.length === 0) {
    console.warn("[prices] no feeds wired on the oracle — run SetFeeds first");
    return;
  }

  const pyth = new Contract(config.PYTH_ADDRESS as string, PYTH_ABI, signer) as unknown as PythContract;
  const update = await fetchUpdates(feeds.map((feed) => feed.feed));
  const data = update.binary.data.map((hex) => (hex.startsWith("0x") ? hex : `0x${hex}`));

  const fee = await pyth.getUpdateFee(data);
  const transaction = await pyth.updatePriceFeeds(data, {value: fee});
  const receipt = await transaction.wait();

  console.log(`[prices] ${feeds.length} feeds posted, fee ${fee}, block ${receipt?.blockNumber ?? "?"}`);
};

/** The testnet path: parsed prices written straight into the mock oracle. */
const pushMock = async (feeds: Wired[]): Promise<void> => {
  const {readFileSync, existsSync} = await import("node:fs");
  const path = new URL("../../contracts/script/feeds.json", import.meta.url);

  if (!existsSync(path)) {
    console.warn("[prices] mock oracle, but no feeds.json — run `npm run resolve-feeds`");
    return;
  }

  const table = JSON.parse(readFileSync(path, "utf8")) as Record<string, {id: string; invert: boolean}>;
  const usable = feeds.filter((feed) => table[feed.symbol] !== undefined);
  if (usable.length === 0) return;

  const update = await fetchUpdates(usable.map((feed) => table[feed.symbol]!.id));
  const parsed = new Map((update.parsed ?? []).map((entry) => [`0x${entry.id.replace(/^0x/, "")}`, entry]));

  const ids: string[] = [];
  const values: bigint[] = [];

  for (const feed of usable) {
    const entry = parsed.get(table[feed.symbol]!.id);
    if (!entry) continue;
    try {
      ids.push(feed.market);
      values.push(toWad(entry.price.price, entry.price.expo, table[feed.symbol]!.invert));
    } catch (error) {
      ids.pop();
      console.warn(`[prices] ${feed.symbol}: ${explain(error)}`);
    }
  }

  if (ids.length === 0) return;

  const oracle = new Contract(
    config.ORACLE_ADDRESS,
    abi.mockOracle as never,
    signer,
  ) as unknown as MockOracleContract;
  const transaction = await oracle.setPrices(ids, values);
  await transaction.wait();

  console.log(`[prices] MOCK oracle: ${ids.length} marks written`);
};

/**
 * Note on `poke`: the keeper does not run it on a schedule, and does not need
 * to. Funding is integrated from the last accrual using the open interest of
 * that interval, and every open, close and liquidation accrues before it
 * touches the book — so the intervals always line up with the moments the
 * skew actually changed. `poke` exists so that anyone can refresh a market
 * nobody has traded, not because the arithmetic drifts without it.
 */
