/**
 * Turns the site's market table into the deploy script's market table.
 *
 * `src/lib/markets.ts` is the one place the product decides which pairs exist
 * and how much leverage each one gets. Re-typing those 64 rows into Solidity
 * by hand is how the app and the chain end up disagreeing about what USDTRY
 * is allowed to do, so the Solidity is generated from the TypeScript instead
 * and regenerated whenever the table changes.
 *
 * Run from `backend/`:  node tools/gen-market-table.mjs
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const SOURCE = path.resolve(HERE, "../../src/lib/markets.ts");
const TARGET = path.resolve(HERE, "../contracts/script/MarketTable.sol");
const SHARED = path.resolve(HERE, "../shared/markets.json");

const source = fs.readFileSync(SOURCE, "utf8");
const body = source.slice(source.indexOf("export const PAIRS"));

const pattern =
  /symbol:\s*"([A-Z]+)"[\s\S]*?name:\s*"([^"]+)"[\s\S]*?flag:\s*"([a-z]+)"[\s\S]*?base:\s*([0-9.]+)[\s\S]*?maxLeverage:\s*(\d+)/g;

const pairs = [];
for (let match; (match = pattern.exec(body)); ) {
  pairs.push({
    symbol: match[1],
    name: match[2],
    flag: match[3],
    base: Number(match[4]),
    maxLeverage: Number(match[5]),
  });
}

/** A plausible mid, as 1e18. Used only to seed a local chain. */
const wad = (value) => `${BigInt(Math.round(value * 1e8)) * 10n ** 10n}`;

if (pairs.length === 0) throw new Error("no pairs parsed — has markets.ts changed shape?");

/**
 * Risk tiers, in whole settlement dollars.
 *
 * `skewScale` is the imbalance at which funding reaches its 0.75% cap, and
 * `maxOpenInterest` is the most notional one side may carry. Both are smaller
 * on a thin pair than on a major, because the same 500k of one-way flow means
 * something very different in USDJPY than it does in USDUGX.
 */
const tierFor = (maxLeverage) => {
  if (maxLeverage >= 20) return { skewScale: 2_000_000, maxOpenInterest: 5_000_000 };
  if (maxLeverage >= 10) return { skewScale: 500_000, maxOpenInterest: 1_000_000 };
  return { skewScale: 100_000, maxOpenInterest: 250_000 };
};

const MIN_MARGIN = 10;

const rows = pairs
  .map((pair) => {
    const tier = tierFor(pair.maxLeverage);
    return [
      `        table[${String(pairs.indexOf(pair)).padStart(2)}] = Row({`,
      `            symbol: "${pair.symbol}",`,
      `            maxLeverage: ${pair.maxLeverage},`,
      `            skewScale: ${tier.skewScale.toLocaleString("en-US").replace(/,/g, "_")},`,
      `            maxOpenInterest: ${tier.maxOpenInterest.toLocaleString("en-US").replace(/,/g, "_")},`,
      `            minMargin: ${MIN_MARGIN},`,
      `            seedPrice: ${wad(pair.base)}`,
      `        }); // ${pair.name}`,
    ].join("\n");
  })
  .join("\n");

const file = `// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title MarketTable
 * @notice Every pair the venue lists, and what each one is allowed to do.
 *
 * GENERATED FILE — do not edit by hand.
 * Source: src/lib/markets.ts. Regenerate with \`node tools/gen-market-table.mjs\`.
 *
 * Sizes are in whole settlement dollars; the deploy script scales them by the
 * settlement token's own decimals, so this table never has to know them.
 */
library MarketTable {
    struct Row {
        string symbol;
        uint32 maxLeverage;
        uint128 skewScale;
        uint128 maxOpenInterest;
        uint128 minMargin;
        /// @dev A plausible mid, 1e18. Only ever used to seed a local chain.
        uint256 seedPrice;
    }

    uint256 internal constant COUNT = ${pairs.length};

    function rows() internal pure returns (Row[] memory table) {
        table = new Row[](COUNT);

${rows}
    }
}
`;

fs.writeFileSync(TARGET, file);

// The same table, for the Node services. The keeper needs the symbol list to
// ask Pyth what it can price, and the market id the engine knows each pair by
// is `keccak256(symbol)` — which is computed there rather than stored here, so
// there is nothing to get out of step.
fs.mkdirSync(path.dirname(SHARED), {recursive: true});
fs.writeFileSync(
  SHARED,
  `${JSON.stringify(
    pairs.map((pair) => ({
      symbol: pair.symbol,
      name: pair.name,
      flag: pair.flag,
      maxLeverage: pair.maxLeverage,
      ...tierFor(pair.maxLeverage),
      minMargin: MIN_MARGIN,
      seedPrice: wad(pair.base),
    })),
    null,
    2,
  )}\n`,
);

console.log(`wrote ${pairs.length} markets to:`);
console.log(`  ${path.relative(process.cwd(), TARGET)}`);
console.log(`  ${path.relative(process.cwd(), SHARED)}`);
