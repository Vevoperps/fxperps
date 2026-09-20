import type {ContractTransactionResponse, DeferredTopicFilter, EventLog, Log} from "ethers";

/**
 * The slices of each contract this keeper actually calls.
 *
 * ethers builds its contract handles dynamically, so every method comes back
 * as "possibly undefined" and every return value as `any`. Declaring the few
 * methods used here turns both into real types: a renamed function fails the
 * build instead of failing at three in the morning against a live book.
 */

export interface PositionViewResult {
  position: {open: boolean; margin: bigint; notional: bigint; isLong: boolean};
  markPrice: bigint;
  pnl: bigint;
  accruedFunding: bigint;
  equity: bigint;
  maintenance: bigint;
  liquidationPrice: bigint;
  liquidatable: boolean;
}

export interface EngineContract {
  positionView(account: string, market: string): Promise<PositionViewResult>;
  liquidate: {
    (account: string, market: string): Promise<ContractTransactionResponse>;
    staticCall(account: string, market: string): Promise<bigint>;
  };
  poke(market: string): Promise<ContractTransactionResponse>;
  queryFilter(filter: DeferredTopicFilter, from: number, to: number): Promise<Array<EventLog | Log>>;
  filters: {
    PositionOpened(): DeferredTopicFilter;
    PositionClosed(): DeferredTopicFilter;
    PositionLiquidated(): DeferredTopicFilter;
  };
}

/** `PythOracle.feeds(market)` — id, maxAge, maxConfidenceBps, invert, set. */
export type FeedRow = [string, bigint, bigint, boolean, boolean];

export interface PythOracleContract {
  feeds(market: string): Promise<FeedRow>;
}

export interface MockOracleContract {
  setPrices(markets: string[], values: bigint[]): Promise<ContractTransactionResponse>;
}

export interface PythContract {
  getUpdateFee(updateData: string[]): Promise<bigint>;
  updatePriceFeeds(updateData: string[], overrides: {value: bigint}): Promise<ContractTransactionResponse>;
}
