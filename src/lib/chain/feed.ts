import { PAIRS, type Market, readMarks } from "@/lib/markets";

import { readChainMarkets } from "./read";
import { readRates } from "./rates";
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
 * How far a reference mark may have drifted and still be called "24h".
 *
 * The engine stores one reference price per market, refreshed by anyone once a
 * day. A keeper that is late makes it older than a day, and at some point
 * "24h" stops being an honest label for it — so past this the row is flagged
 * unknown and the table shows a dash instead of a number measured against last
 * week.
 */
const REFERENCE_MAX_AGE = 36 * 60 * 60;
const REFERENCE_MIN_AGE = 60 * 60;

/** The 24h move, when the reference behind it is fresh enough to say so. */
const changeFrom = (
  mark: number,
  reference: number,
  takenAt: number,
  now: number,
): { change24h: number; changeKnown: boolean } => {
  const age = now - takenAt;

  if (
    reference <= 0 ||
    takenAt === 0 ||
    age > REFERENCE_MAX_AGE ||
    age < REFERENCE_MIN_AGE
  ) {
    return { change24h: 0, changeKnown: false };
  }

  return { change24h: (mark - reference) / reference, changeKnown: true };
};

export const readFeed = async (): Promise<Feed> => {
  if (!venue.live) return { markets: readMarks(), onchain: false };

  try {
    // Both at once: the chain read decides what can be traded, the rate read
    // decides what can be shown, and one waiting on the other would double the
    // slowest part of a route that is polled every fifteen seconds.
    const [rows, rates] = await Promise.all([
      readChainMarkets(PAIRS.map((pair) => pair.symbol)),
      readRates(),
    ]);

    const now = Math.floor(Date.now() / 1000);

    const markets = rows.map((row, index) => {
      const pair = PAIRS[index] as (typeof PAIRS)[number];

      // The chain's mark when it has one, the live rate when it does not.
      // `pair.base` is the last resort and it is a number out of a config
      // file, so it is used only when both the chain and the feed are silent —
      // at which point the status below says so rather than dressing it up.
      const quoted = rates.by.get(pair.symbol);
      const mark = row.priced ? row.mark : (quoted ?? pair.base);
      const known = row.priced || quoted !== undefined;

      const moved = known
        ? changeFrom(mark, row.referencePrice, row.referenceAt, now)
        : { change24h: 0, changeKnown: false };

      return {
        id: pair.symbol.toLowerCase(),
        symbol: pair.symbol,
        name: pair.name,
        flag: pair.flag,
        type: "fx" as const,
        mark,
        ...moved,
        fundingRate: row.fundingRate,
        maxLeverage: row.maxLeverage || pair.maxLeverage,
        // Four states, and the difference between the middle two is the whole
        // point: `warming` is quoted and about to be tradeable, `closed` is
        // nothing to show. Calling the first one closed is what made sixty-one
        // working markets look shut.
        status: !row.listed
          ? ("closed" as const)
          : row.paused
            ? ("paused" as const)
            : row.priced
              ? ("live" as const)
              : quoted !== undefined
                ? ("warming" as const)
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
