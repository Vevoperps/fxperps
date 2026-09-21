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
  /** The mark one window ago, and when it was taken. Zero when never. */
  referencePrice: number;
  referenceAt: number;
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

/** The pool that takes the other side of every trade. */
export interface Pool {
  /** Settlement tokens backing the book. */
  assets: number;
  /** The part already promised to open positions' payout caps. */
  reserved: number;
  /** What a provider could withdraw right now. */
  free: number;
  /** How much of the pool is working, 0 to 1. */
  utilisation: number;
  /** The connected account's shares, and what they are worth. */
  shares: bigint;
  value: number;
  /** That account's share of the whole, 0 to 1. */
  ownership: number;
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
  referencePrice: bigint;
  referenceAt: bigint;
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
  poolReserved(): Promise<bigint>;
  poolFree(): Promise<bigint>;
  poolShares(): Promise<bigint>;
  sharesOf(account: string): Promise<bigint>;
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
    referencePrice: fromPrice(row.referencePrice),
    referenceAt: Number(row.referenceAt),
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

/**
 * The pool, and one account's part of it.
 *
 * `address` is optional because the pool's own numbers are public and worth
 * showing to somebody who has not connected anything yet — the size of the
 * book they would be backing is the first thing a provider wants to know.
 */
export const readPool = async (address?: string): Promise<Pool> => {
  const { decimals } = await settlementMeta();
  const engine = readEngine();

  const [assetsRaw, reservedRaw, totalShares, mine] = await Promise.all([
    engine.poolAssets(),
    engine.poolReserved(),
    engine.poolShares(),
    address ? engine.sharesOf(address) : Promise.resolve(0n),
  ]);

  const assets = fromAmount(assetsRaw, decimals);
  const reserved = fromAmount(reservedRaw, decimals);

  // Shares are 1e18 whatever the token is, so the ratio is taken on the raw
  // integers and only the result becomes a number.
  const ownership = totalShares === 0n ? 0 : Number((mine * 10n ** 18n) / totalShares) / 1e18;

  return {
    assets,
    reserved,
    free: Math.max(0, assets - reserved),
    utilisation: assets === 0 ? 0 : Math.min(1, reserved / assets),
    shares: mine,
    value: assets * ownership,
    ownership,
  };
};

// ------------------------------------------------------------------ activity

/** One thing this account did, as the chain recorded it. */
export interface Activity {
  kind: "closed" | "reduced" | "liquidated" | "deposit" | "withdraw";
  /** The pair, for the three position kinds. */
  symbol?: string;
  /** Settlement tokens that moved: a payout, a transfer, a liquidation reward. */
  amount: number;
  pnl?: number;
  fee?: number;
  funding?: number;
  price?: number;
  block: number;
  at?: number;
  hash: string;
}

interface LogRow {
  args: Record<string, unknown> & { [index: number]: unknown };
  blockNumber: number;
  transactionHash: string;
}

interface LoggingEngine {
  queryFilter(filter: unknown, from: number, to: number): Promise<LogRow[]>;
  filters: {
    PositionClosed(account?: string): unknown;
    PositionReduced(account?: string): unknown;
    PositionLiquidated(account?: string): unknown;
    Deposited(account?: string): unknown;
    Withdrawn(account?: string): unknown;
  };
}

/** The engine names markets by hash, so the way back is a table we already have. */
const symbolByHash = (symbols: string[]): Map<string, string> =>
  new Map(symbols.map((symbol) => [marketId(symbol), symbol]));

/**
 * What one account has done, newest first.
 *
 * Read from the contract's own events rather than from a database, because the
 * events are the record and anything else would be a second copy of it that
 * can disagree. A node that refuses the block range gives back an empty list
 * rather than an error: an empty history tab is a much smaller lie than a
 * broken screen.
 */
export const readActivity = async (
  address: string,
  symbols: string[],
  limit = 40,
): Promise<Activity[]> => {
  const { decimals } = await settlementMeta();
  const engine = readEngine() as unknown as LoggingEngine;
  const names = symbolByHash(symbols);

  let head: number;
  try {
    head = await reader().getBlockNumber();
  } catch {
    return [];
  }

  const from = venue.deployBlock;

  const pull = async (filter: unknown): Promise<LogRow[]> => {
    try {
      return await engine.queryFilter(filter, from, head);
    } catch {
      return [];
    }
  };

  const [closed, reduced, liquidated, deposits, withdrawals] = await Promise.all([
    pull(engine.filters.PositionClosed(address)),
    pull(engine.filters.PositionReduced(address)),
    pull(engine.filters.PositionLiquidated(address)),
    pull(engine.filters.Deposited(address)),
    pull(engine.filters.Withdrawn(address)),
  ]);

  const amount = (value: unknown): number =>
    fromAmount(BigInt(value as string | bigint), decimals);

  const rows: Activity[] = [];

  for (const log of closed) {
    rows.push({
      kind: "closed",
      symbol: names.get(String(log.args[1])),
      price: fromPrice(BigInt(log.args.exitPrice as bigint)),
      amount: amount(log.args.payout),
      pnl: amount(log.args.pnl),
      funding: amount(log.args.funding),
      fee: amount(log.args.fee),
      block: log.blockNumber,
      hash: log.transactionHash,
    });
  }

  for (const log of reduced) {
    rows.push({
      kind: "reduced",
      symbol: names.get(String(log.args[1])),
      price: fromPrice(BigInt(log.args.exitPrice as bigint)),
      amount: amount(log.args.payout),
      pnl: amount(log.args.pnl),
      funding: amount(log.args.funding),
      fee: amount(log.args.fee),
      block: log.blockNumber,
      hash: log.transactionHash,
    });
  }

  for (const log of liquidated) {
    rows.push({
      kind: "liquidated",
      symbol: names.get(String(log.args[1])),
      price: fromPrice(BigInt(log.args.exitPrice as bigint)),
      amount: 0,
      block: log.blockNumber,
      hash: log.transactionHash,
    });
  }

  for (const log of deposits) {
    rows.push({
      kind: "deposit",
      amount: amount(log.args.amount),
      block: log.blockNumber,
      hash: log.transactionHash,
    });
  }

  for (const log of withdrawals) {
    rows.push({
      kind: "withdraw",
      amount: amount(log.args.amount),
      block: log.blockNumber,
      hash: log.transactionHash,
    });
  }

  rows.sort((a, b) => b.block - a.block);
  const recent = rows.slice(0, limit);

  // Timestamps, for the blocks that survived the cut only — a block lookup per
  // event would be dozens of round trips to date a list nobody scrolls.
  const blocks = [...new Set(recent.map((row) => row.block))];
  const times = new Map<number, number>();

  await Promise.all(
    blocks.map(async (block) => {
      try {
        const found = await reader().getBlock(block);
        if (found) times.set(block, Number(found.timestamp));
      } catch {
        // A pruned or unavailable block just goes undated.
      }
    }),
  );

  return recent.map((row) => {
    const at = times.get(row.block);
    return at === undefined ? row : { ...row, at };
  });
};
