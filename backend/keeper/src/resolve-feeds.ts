import {writeFileSync} from "node:fs";
import {resolve} from "node:path";

import {hermes} from "./hermes.js";
import {markets} from "./shared.js";

/**
 * Asks Pyth which of our pairs it can actually price, and writes the answer
 * out for `SetFeeds.s.sol` to deploy.
 *
 * **Nothing here is guessed.** A Pyth feed id is 32 bytes with no structure to
 * check against, so an id typed from a blog post that turns out to belong to a
 * different pair produces a market that prices perfectly and is completely
 * wrong. The ids come from Pyth's own index or they do not go on chain.
 *
 * ## The convention, and why half the feeds are inverted
 *
 * Every market on this venue is quoted as *local currency per one dollar* —
 * USDJPY, USDEUR, USDTRY — because that is the number a trader reading a
 * frontier pair wants and it keeps all 64 pairs pointing the same way. The
 * market does not: Pyth publishes EUR/USD and GBP/USD the other way up. Those
 * feeds are marked `invert` and the oracle contract takes the reciprocal, so
 * the inversion happens in exactly one place.
 *
 * ## Expect gaps
 *
 * Pyth covers the majors and a fair part of the emerging markets. It does not
 * cover most of the frontier currencies this venue lists, so this will report
 * a long unmatched list. Those markets stay listed and unpriced — every call
 * to them reverts — until a second source is wired in behind the same
 * `IOracle` interface.
 *
 * Run:  npm run build && npm run resolve-feeds
 */

interface HermesFeed {
  id: string;
  attributes?: {
    base?: string;
    quote_currency?: string;
    asset_type?: string;
    symbol?: string;
  };
}

const TARGET = resolve(process.cwd(), "../contracts/script/feeds.json");

/**
 * The pair a feed prices, as `BASE/QUOTE`.
 *
 * Hermes does not carry a `base` attribute on its FX feeds — only `symbol`
 * (`FX.USD/JPY`) and `quote_currency`. Reading `base` alone matched nothing at
 * all, silently, and wrote an empty `feeds.json`: the failure looked exactly
 * like "Pyth does not cover any of our pairs". The symbol is parsed first and
 * the attributes are the fallback, not the other way round.
 *
 * `FX.Index.EUR/USD` and `FX.USDXY` are index products rather than a spot
 * rate, and are skipped: they price something related to the pair, not the
 * pair.
 */
const pairOf = (feed: HermesFeed): string | null => {
  const symbol = feed.attributes?.symbol?.toUpperCase();

  if (symbol?.startsWith("FX.") && !symbol.startsWith("FX.INDEX.")) {
    const [base, quote] = symbol.slice("FX.".length).split("/");
    if (base && quote) return `${base}/${quote}`;
  }

  const base = feed.attributes?.base?.toUpperCase();
  const quote = feed.attributes?.quote_currency?.toUpperCase();
  return base && quote ? `${base}/${quote}` : null;
};

const main = async (): Promise<void> => {
  const response = await hermes("/v2/price_feeds?asset_type=fx");

  const feeds = (await response.json()) as HermesFeed[];

  // Indexed both ways round, so one lookup answers "do you have this pair, in
  // either direction".
  const index = new Map<string, string>();
  for (const feed of feeds) {
    const pair = pairOf(feed);
    if (!pair) continue;
    index.set(pair, feed.id.startsWith("0x") ? feed.id : `0x${feed.id}`);
  }

  if (index.size === 0) {
    throw new Error("hermes returned no usable fx pairs — the response shape changed, do not trust an empty feeds.json");
  }

  const resolved: Record<string, {id: string; invert: boolean; source: string}> = {};
  const missing: string[] = [];

  for (const market of markets) {
    // Our symbols are all USD-first: "USDJPY" is JPY per one USD.
    const other = market.symbol.slice(3);

    const direct = index.get(`USD/${other}`);
    const inverse = index.get(`${other}/USD`);

    if (direct) {
      resolved[market.symbol] = {id: direct, invert: false, source: `FX.USD/${other}`};
    } else if (inverse) {
      resolved[market.symbol] = {id: inverse, invert: true, source: `FX.${other}/USD`};
    } else {
      missing.push(market.symbol);
    }
  }

  writeFileSync(TARGET, `${JSON.stringify(resolved, null, 2)}\n`);

  const found = Object.keys(resolved).length;
  console.log(`pyth fx feeds indexed: ${index.size}`);
  console.log(`matched: ${found} of ${markets.length}`);
  console.log(`  inverted: ${Object.values(resolved).filter((entry) => entry.invert).length}`);
  console.log(`unmatched (${missing.length}): ${missing.join(" ")}`);
  console.log(`\nwrote ${TARGET}`);
  console.log("review it, then: forge script script/SetFeeds.s.sol:SetFeeds --broadcast");
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
