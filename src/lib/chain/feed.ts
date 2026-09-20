import { PAIRS, type Market, readMarks } from "@/lib/markets";

import { readChainMarkets } from "./read";
import { venue } from "./venue";

/**
 * The one place the app decides where marks come from.
 *
 * `readMarks` generates them; `readChainMarkets` reads the engine. This picks
 * whichever is real and hands back the same `Market` shape either way, so the
 * ticker, the table and the pair pages never have to know which they are
 * looking at — and never have to change when the answer does.
 *
 * **A chain read that fails falls back to generated marks and says so.** The
 * alternative is a blank table when an RPC node hiccups, which teaches a user
 * that the venue is broken when it is the node that is.
 */

export interface Feed {
  markets: Market[];
  /** True when these came off the chain rather than out of the generator. */
  onchain: boolean;
}

/**
 * A note on the 24h column.
 *
 * The engine stores a mark, not a history, so a chain read genuinely does not
 * know yesterday's price. Rather than print a made-up number, the row is
 * flagged `changeKnown: false` and the table shows a dash. A real 24h column
 * needs an indexer over the oracle's own history; that is a separate piece of
 * work, not something to invent here.
 */
export const readFeed = async (): Promise<Feed> => {
  if (!venue.live) return { markets: readMarks(), onchain: false };

  try {
    const rows = await readChainMarkets(PAIRS.map((pair) => pair.symbol));

    const markets = rows.map((row, index) => {
      const pair = PAIRS[index] as (typeof PAIRS)[number];

      return {
        id: pair.symbol.toLowerCase(),
        symbol: pair.symbol,
        name: pair.name,
        flag: pair.flag,
        type: "fx" as const,
        mark: row.priced ? row.mark : pair.base,
        change24h: 0,
        changeKnown: false,
        fundingRate: row.fundingRate,
        maxLeverage: row.maxLeverage || pair.maxLeverage,
        status: !row.listed
          ? ("closed" as const)
          : row.paused
            ? ("paused" as const)
            : row.priced
              ? ("live" as const)
              : ("closed" as const),
        longOpenInterest: row.longOpenInterest,
        shortOpenInterest: row.shortOpenInterest,
      } satisfies Market;
    });

    return { markets, onchain: true };
  } catch {
    return { markets: readMarks(), onchain: false };
  }
};
