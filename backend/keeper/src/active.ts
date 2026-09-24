import {engine, marketId} from "./chain.js";
import {config} from "./config.js";
import {markets} from "./shared.js";
import {warmSymbols} from "./warm.js";

/**
 * Which pairs are worth keeping priced on chain right now.
 *
 * **The problem this solves is the venue's largest running cost.** A mark is
 * rewritten for two reasons: it moved, or it is about to go stale. The second
 * reason does not care whether anybody is trading the pair, so sixty-four
 * markets are refreshed twice every staleness window, forever, at rest. At the
 * fees this chain charges that came to roughly a hundred dollars a day for a
 * venue whose pool held twenty — measured, not guessed.
 *
 * **The insight is that an on-chain mark is only load bearing for a market
 * somebody is in or about to enter.** The rates a visitor browses, the chart,
 * the sixty pairs nobody has touched — none of them fill anything. They come
 * from the same rate feed this keeper reads, served through the site's own
 * API, and cost nothing. Only the price a position opens, closes and
 * liquidates at has to be on chain, and that is a handful of markets.
 *
 * So the set is: **everything carrying open interest**, because a trader who
 * cannot close is a trader trapped, plus **`ALWAYS_FRESH`**, so the pairs a
 * visitor is most likely to open are already tradeable when they arrive rather
 * than a round behind, plus **whatever the site has asked for** — somebody is
 * standing on that pair's page right now, and they are the reason any of this
 * exists.
 *
 * **It fails open.** If the read does not come back, every market is treated
 * as active. Overspending is a bill; leaving an open position unpriced is
 * somebody unable to get out, and the two are not comparable.
 */

interface MarketRow {
  id: string;
  longOpenInterest: bigint;
  shortOpenInterest: bigint;
}

interface EngineWithView {
  marketsView(ids: string[]): Promise<MarketRow[]>;
}

const view = (): EngineWithView => engine as unknown as EngineWithView;

/** Symbol by id, so the answer comes back in the caller's own words. */
const symbolOf = new Map<string, string>(markets.map((market) => [marketId(market.symbol), market.symbol]));

const always = new Set(config.ALWAYS_FRESH);

/**
 * Only the open-interest half is cached.
 *
 * That half costs a call and changes when somebody opens a position. The other
 * two — the always-on list and whatever the site just asked for — are free to
 * read and are the whole point of being quick: a visitor who lands on a pair
 * should wait one round, not one cache.
 */
let cachedRisk: Set<string> | null = null;
let cachedAt = 0;

/** Every listed pair. The answer when the chain will not say otherwise. */
const everything = (): Set<string> => new Set(markets.map((market) => market.symbol));

const atRisk = async (): Promise<Set<string>> => {
  const now = Date.now();
  if (cachedRisk && now - cachedAt < config.ACTIVE_REFRESH * 1000) return cachedRisk;

  // One call for all sixty-four. `marketsView` exists precisely so the app
  // does not make sixty-four round trips to draw one table.
  const rows = await view().marketsView([...symbolOf.keys()]);

  const open = new Set<string>();
  for (const row of rows) {
    if (row.longOpenInterest === 0n && row.shortOpenInterest === 0n) continue;
    const symbol = symbolOf.get(row.id);
    if (symbol) open.add(symbol);
  }

  cachedRisk = open;
  cachedAt = now;
  return open;
};

export const activeSymbols = async (): Promise<Set<string>> => {
  try {
    return new Set([...always, ...warmSymbols(), ...(await atRisk())]);
  } catch (error) {
    // Loud, because the fallback is the expensive one and a keeper quietly
    // paying ten times over is worse than one that says why.
    console.warn(`[active] open interest unreadable, keeping every pair fresh: ${String(error)}`);
    cachedRisk = null;
    return everything();
  }
};
