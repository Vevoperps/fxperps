import { Contract, JsonRpcProvider } from "ethers";

import { PERP_ENGINE_ABI, SETTLEMENT_ABI } from "./abi";
import { fromAmount, fromPrice, marketId } from "./units";
import { venue } from "./venue";

/**
 * Reading the venue. No wallet, no signing, no browser required.
 *
 * Deliberately separate from `engine.ts`, which is client-only because it
 * needs a wallet to sign with: the reads have to run on the server too, since
 * the rates table is served by `/api/markets` and one RPC call per request
 * beats sixty-four RPC calls per visitor.
 *
 * Every function returns plain numbers. Fixed-point belongs in the contract; a
 * component that has to remember whether a number is 1e18 or 1e6 will
 * eventually forget.
 */

/** The batch view the rates table and the pair pages read. */
export interface ChainMarket {
  symbol: string;
  listed: boolean;
  paused: boolean;
  /** False when the oracle cannot price it right now. */
  priced: boolean;
  mark: number;
  /** Fractional per 8h. Positive means longs pay. */
  fundingRate: number;
  longOpenInterest: number;
  shortOpenInterest: number;
  maxLeverage: number;
}

/** One open position, priced now. */
export interface ChainPosition {
  symbol: string;
  isLong: boolean;
  margin: number;
  notional: number;
  payoutCap: number;
  entryPrice: number;
  mark: number;
  pnl: number;
  accruedFunding: number;
  equity: number;
  maintenance: number;
  liquidationPrice: number;
  liquidatable: boolean;
  openedAt: number;
}

export interface Account {
  /** Free balance inside the venue, withdrawable. */
  free: number;
  /** Settlement tokens still in the wallet. */
  wallet: number;
  /** How much the engine may pull, in token units. */
  allowance: bigint;
}

interface MarketRow {
  id: string;
  maxLeverage: bigint;
  longOpenInterest: bigint;
  shortOpenInterest: bigint;
  markPrice: bigint;
  fundingRate: bigint;
  listed: boolean;
  paused: boolean;
  priced: boolean;
}

interface PositionRow {
  position: {
    margin: bigint;
    notional: bigint;
    payoutCap: bigint;
    entryPrice: bigint;
    entryFunding: bigint;
    openedAt: bigint;
    isLong: boolean;
    open: boolean;
  };
  markPrice: bigint;
  pnl: bigint;
  accruedFunding: bigint;
  equity: bigint;
  maintenance: bigint;
  liquidationPrice: bigint;
  liquidatable: boolean;
}

interface ReadableEngine {
  marketsView(ids: string[]): Promise<MarketRow[]>;
  positionsView(account: string, ids: string[]): Promise<PositionRow[]>;
  balanceOf(account: string): Promise<bigint>;
  poolAssets(): Promise<bigint>;
  poolFree(): Promise<bigint>;
}

interface ReadableToken {
  decimals(): Promise<bigint>;
  symbol(): Promise<string>;
  balanceOf(account: string): Promise<bigint>;
  allowance(owner: string, spender: string): Promise<bigint>;
}

/** Thrown when something asks the chain a question on an unconfigured venue. */
export class VenueNotLive extends Error {
  constructor() {
    super("the venue has no address configured");
    this.name = "VenueNotLive";
  }
}

let provider: JsonRpcProvider | null = null;

export const reader = (): JsonRpcProvider => {
  if (!venue.live || !venue.rpcUrl) throw new VenueNotLive();
  provider ??= new JsonRpcProvider(venue.rpcUrl, venue.chainId, {
    staticNetwork: true,
  });
  return provider;
};

export const readEngine = (): ReadableEngine =>
  new Contract(
    venue.engine as string,
    PERP_ENGINE_ABI as unknown as string[],
    reader(),
  ) as unknown as ReadableEngine;

export const readToken = (): ReadableToken =>
  new Contract(
    venue.settlement as string,
    SETTLEMENT_ABI as unknown as string[],
    reader(),
  ) as unknown as ReadableToken;

/**
 * The settlement token's decimals and symbol, read once.
 *
 * Assuming six would be right for most dollar stablecoins and catastrophic for
 * the one that is eighteen, so it is asked rather than assumed — and cached,
 * because it cannot change.
 */
let meta: Promise<{ decimals: number; symbol: string }> | null = null;

export const settlementMeta = (): Promise<{
  decimals: number;
  symbol: string;
}> => {
  meta ??= (async () => {
    const token = readToken();
    const [decimals, symbol] = await Promise.all([
      token.decimals(),
      token.symbol(),
    ]);
    return { decimals: Number(decimals), symbol };
  })();
  return meta;
};

/** Every market asked for, priced, in one call. */
export const readChainMarkets = async (
  symbols: string[],
): Promise<ChainMarket[]> => {
  const { decimals } = await settlementMeta();
  const rows = await readEngine().marketsView(symbols.map(marketId));

  return rows.map((row, index) => ({
    symbol: symbols[index] as string,
    listed: row.listed,
    paused: row.paused,
    priced: row.priced,
    mark: fromPrice(row.markPrice),
    fundingRate: fromPrice(row.fundingRate),
    longOpenInterest: fromAmount(row.longOpenInterest, decimals),
    shortOpenInterest: fromAmount(row.shortOpenInterest, decimals),
    maxLeverage: Number(row.maxLeverage),
  }));
};

/** Only the markets this account actually has something open on. */
export const readChainPositions = async (
  account: string,
  symbols: string[],
): Promise<ChainPosition[]> => {
  const { decimals } = await settlementMeta();
  const rows = await readEngine().positionsView(account, symbols.map(marketId));

  return rows
    .map((row, index) => ({ row, symbol: symbols[index] as string }))
    .filter(({ row }) => row.position.open)
    .map(({ row, symbol }) => ({
      symbol,
      isLong: row.position.isLong,
      margin: fromAmount(row.position.margin, decimals),
      notional: fromAmount(row.position.notional, decimals),
      payoutCap: fromAmount(row.position.payoutCap, decimals),
      entryPrice: fromPrice(row.position.entryPrice),
      mark: fromPrice(row.markPrice),
      pnl: fromAmount(row.pnl, decimals),
      accruedFunding: fromAmount(row.accruedFunding, decimals),
      equity: fromAmount(row.equity, decimals),
      maintenance: fromAmount(row.maintenance, decimals),
      liquidationPrice: fromPrice(row.liquidationPrice),
      liquidatable: row.liquidatable,
      openedAt: Number(row.position.openedAt),
    }));
};

export const readAccount = async (address: string): Promise<Account> => {
  const { decimals } = await settlementMeta();
  const token = readToken();

  const [free, wallet, allowance] = await Promise.all([
    readEngine().balanceOf(address),
    token.balanceOf(address),
    token.allowance(address, venue.engine as string),
  ]);

  return {
    free: fromAmount(free, decimals),
    wallet: fromAmount(wallet, decimals),
    allowance,
  };
};
