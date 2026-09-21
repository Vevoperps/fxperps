"use client";

import {
  Contract,
  MaxUint256,
  type ContractTransactionResponse,
} from "ethers";

import { FAUCET_ABI, PERP_ENGINE_ABI, SETTLEMENT_ABI } from "./abi";
import { marketId } from "./units";
import { venue } from "./venue";
import { getSigner } from "./wallet";

/**
 * Everything the app writes to the chain, and nothing else.
 *
 * Reading lives in `read.ts`, which runs on the server too. This half needs a
 * wallet, so it is client-only, and there are exactly seven calls in it:
 * approve, deposit, withdraw, open, close, reduce and add margin. The app
 * holds no key and signs nothing on anybody's behalf.
 */

interface WritableEngine {
  deposit(amount: bigint): Promise<ContractTransactionResponse>;
  addLiquidity(amount: bigint): Promise<ContractTransactionResponse>;
  removeLiquidity(shares: bigint): Promise<ContractTransactionResponse>;
  withdraw(amount: bigint): Promise<ContractTransactionResponse>;
  openPosition(
    market: string,
    isLong: boolean,
    margin: bigint,
    leverage: bigint,
  ): Promise<ContractTransactionResponse>;
  closePosition(market: string): Promise<ContractTransactionResponse>;
  reducePosition(
    market: string,
    notionalToClose: bigint,
  ): Promise<ContractTransactionResponse>;
  addMargin(
    market: string,
    amount: bigint,
  ): Promise<ContractTransactionResponse>;
}

interface WritableToken {
  allowance(owner: string, spender: string): Promise<bigint>;
  approve(
    spender: string,
    amount: bigint,
  ): Promise<ContractTransactionResponse>;
}

interface Faucet {
  mint(to: string, amount: bigint): Promise<ContractTransactionResponse>;
}

const signerOrThrow = async () => {
  const signer = await getSigner();
  if (!signer) throw new Error("no wallet connected");
  return signer;
};

const writeEngine = async (): Promise<WritableEngine> =>
  new Contract(
    venue.engine as string,
    PERP_ENGINE_ABI as unknown as string[],
    await signerOrThrow(),
  ) as unknown as WritableEngine;

const writeToken = async (): Promise<WritableToken> =>
  new Contract(
    venue.settlement as string,
    SETTLEMENT_ABI as unknown as string[],
    await signerOrThrow(),
  ) as unknown as WritableToken;

/**
 * Approves the engine, once, if it needs approving.
 *
 * An unlimited approval to a contract that can only pull what the caller has
 * just asked it to pull, and that the caller can withdraw from at any moment,
 * is the right trade against making somebody sign twice for every deposit.
 */
export const approveIfNeeded = async (amount: bigint): Promise<void> => {
  const signer = await signerOrThrow();
  const token = await writeToken();

  const allowance = await token.allowance(
    await signer.getAddress(),
    venue.engine as string,
  );
  if (allowance >= amount) return;

  const transaction = await token.approve(venue.engine as string, MaxUint256);
  await transaction.wait();
};

export const deposit = async (amount: bigint): Promise<void> => {
  await approveIfNeeded(amount);
  const transaction = await (await writeEngine()).deposit(amount);
  await transaction.wait();
};

/**
 * Back the venue's side of the book.
 *
 * Same approval as a deposit — the engine holds one token and pulls it the
 * same way — but the money goes into the pool rather than into a balance, and
 * what comes back is shares of it.
 */
export const addLiquidity = async (amount: bigint): Promise<void> => {
  await approveIfNeeded(amount);
  const transaction = await (await writeEngine()).addLiquidity(amount);
  await transaction.wait();
};

/** Redeem shares. Only the part of the pool no open position has reserved. */
export const removeLiquidity = async (shares: bigint): Promise<void> => {
  const transaction = await (await writeEngine()).removeLiquidity(shares);
  await transaction.wait();
};

export const withdraw = async (amount: bigint): Promise<void> => {
  const transaction = await (await writeEngine()).withdraw(amount);
  await transaction.wait();
};

export const openPosition = async (
  symbol: string,
  isLong: boolean,
  margin: bigint,
  leverage: number,
): Promise<void> => {
  const transaction = await (
    await writeEngine()
  ).openPosition(marketId(symbol), isLong, margin, BigInt(leverage));
  await transaction.wait();
};

export const closePosition = async (symbol: string): Promise<void> => {
  const transaction = await (await writeEngine()).closePosition(
    marketId(symbol),
  );
  await transaction.wait();
};

export const reducePosition = async (
  symbol: string,
  notional: bigint,
): Promise<void> => {
  const transaction = await (
    await writeEngine()
  ).reducePosition(marketId(symbol), notional);
  await transaction.wait();
};

export const addMargin = async (
  symbol: string,
  amount: bigint,
): Promise<void> => {
  const transaction = await (
    await writeEngine()
  ).addMargin(marketId(symbol), amount);
  await transaction.wait();
};

/**
 * The testnet faucet.
 *
 * `mint` exists on the mock settlement token and on nothing else, so it is
 * offered only on a local chain rather than shown and then failing.
 */
export const faucet = async (to: string, amount: bigint): Promise<void> => {
  // Test networks, not just local ones. The faucet is a function on the mock
  // settlement token; where the token is real there is nothing to call, and a
  // deployment against a real token has no business minting it.
  if (!venue.network.testnet) {
    throw new Error("the faucet exists only on a test network");
  }

  const token = new Contract(
    venue.settlement as string,
    FAUCET_ABI as unknown as string[],
    await signerOrThrow(),
  ) as unknown as Faucet;

  const transaction = await token.mint(to, amount);
  await transaction.wait();
};

/**
 * Turns a revert into something a person can act on.
 *
 * The engine's errors are named for exactly this: `InsufficientLiquidity`
 * means the pool cannot back this position's payout cap, which is a completely
 * different problem from `InsufficientBalance`, and a user told "transaction
 * failed" learns neither.
 */
const REASONS: Record<string, string> = {
  InsufficientBalance: "not enough free balance",
  InsufficientLiquidity: "the pool cannot back that payout cap right now",
  LeverageTooHigh: "above this pair's leverage cap",
  MarginTooSmall: "below this pair's minimum margin",
  MarketIsPaused: "this market is paused",
  OpenInterestCap: "this side of the book is full",
  PositionAlreadyOpen: "you already have a position on this pair",
  NoPosition: "nothing open on this pair",
  UnknownMarket: "this pair is not listed",
  NotLiquidatable: "that position is still above its maintenance margin",
  ZeroAmount: "enter an amount",
};

export const explainRevert = (error: unknown): string => {
  const shape = error as {
    shortMessage?: string;
    reason?: string;
    message?: string;
  };

  const text = [shape.reason, shape.shortMessage, shape.message]
    .filter(Boolean)
    .join(" ");

  for (const [name, plain] of Object.entries(REASONS)) {
    if (text.includes(name)) return plain;
  }

  if (/user rejected|ACTION_REJECTED/i.test(text)) return "you cancelled it";
  if (/insufficient funds/i.test(text)) return "not enough gas in the wallet";

  // Nothing recognised it. Say so, and hand over what the chain actually
  // said — an unexplained failure with the cause thrown away is the one
  // outcome nobody can act on, neither the person hitting the button nor
  // whoever they report it to.
  const detail = (shape.shortMessage ?? shape.reason ?? shape.message ?? "").trim();
  return detail
    ? `the transaction did not go through — ${detail.slice(0, 160)}`
    : "the transaction did not go through";
};
