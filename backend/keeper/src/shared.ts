import {readFileSync, existsSync} from "node:fs";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";

/**
 * The market table and the ABIs, read from `backend/shared` at runtime.
 *
 * They are read rather than imported so that one generated directory serves
 * the contracts, this keeper and the site without any of them owning a copy.
 * A second copy of a market table is a second answer to "what leverage does
 * USDTRY get", and the one that is wrong is always the one in production.
 */

const HERE = dirname(fileURLToPath(import.meta.url));

/** Works from `src/` under ts-node and from `dist/` after a build, and in the image. */
const SHARED = [
  resolve(HERE, "../../shared"),
  resolve(HERE, "../shared"),
  resolve(process.cwd(), "shared"),
].find((candidate) => existsSync(candidate));

if (!SHARED) {
  throw new Error("cannot find backend/shared — run `node tools/gen-market-table.mjs` from backend/");
}

const read = <T>(relative: string): T => JSON.parse(readFileSync(resolve(SHARED, relative), "utf8")) as T;

export interface MarketSpec {
  symbol: string;
  name: string;
  flag: string;
  maxLeverage: number;
  skewScale: number;
  maxOpenInterest: number;
  minMargin: number;
}

export const markets: MarketSpec[] = read<MarketSpec[]>("markets.json");

export const abi = {
  engine: read<unknown[]>("abi/PerpEngine.json"),
  pythOracle: read<unknown[]>("abi/PythOracle.json"),
  mockOracle: read<unknown[]>("abi/MockOracle.json"),
};
