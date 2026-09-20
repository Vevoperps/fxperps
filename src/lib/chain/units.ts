import { formatUnits, id, parseUnits } from "ethers";

/**
 * Moving between the chain's integers and the screen's numbers.
 *
 * Two scales are in play and mixing them is the classic way to lose a factor
 * of a thousand: **prices are always 1e18**, whatever the pair, and **amounts
 * are in the settlement token's own decimals**, which the app reads off the
 * token rather than assuming. The engine's own arithmetic is immune to this —
 * a pnl is a notional scaled by a ratio of two prices, so the scale cancels —
 * but the moment a number reaches a screen it has to be the right one.
 */

/** Prices, everywhere, at every pair. */
export const PRICE_DECIMALS = 18;

/** `keccak256("USDJPY")` — how the engine names a market. */
export const marketId = (symbol: string): string => id(symbol.toUpperCase());

export const fromPrice = (value: bigint): number =>
  Number(formatUnits(value, PRICE_DECIMALS));

export const toPrice = (value: number): bigint =>
  parseUnits(value.toFixed(PRICE_DECIMALS), PRICE_DECIMALS);

/** Settlement amounts. `decimals` comes from the token, never from a guess. */
export const fromAmount = (value: bigint, decimals: number): number =>
  Number(formatUnits(value, decimals));

/**
 * Parses what somebody typed.
 *
 * Anything past the token's own precision is dropped rather than rounded up:
 * a deposit is not the place to invent a fraction of a cent the user did not
 * have.
 */
export const toAmount = (value: string, decimals: number): bigint => {
  const cleaned = value.trim().replace(/,/g, "");
  if (!cleaned || !/^\d*\.?\d*$/.test(cleaned)) return 0n;

  const [whole, fraction = ""] = cleaned.split(".");
  const trimmed = fraction.slice(0, decimals);
  return parseUnits(`${whole || "0"}.${trimmed || "0"}`, decimals);
};

/** For display, at the precision money is read in. */
export const money = (value: number): string =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** The same, signed, for a result that can go either way. */
export const signed = (value: number): string =>
  `${value >= 0 ? "+" : "−"}${money(Math.abs(value))}`;
