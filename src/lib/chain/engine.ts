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

const signerOrThrow = async () => {
  const signer = await getSigner();
  if (!signer) throw new Error("no wallet connected");
  return signer;
};

/**
 * What every transaction pays, decided here rather than by the wallet.
 *
 * **Why the app sets this at all.** On Arbitrum's rollups `eth_gasPrice` can
 * answer with a number *below* the chain's own `baseFeePerGas`. A wallet that
 * trusts that answer — MetaMask does — builds a transaction the same node then
 * refuses, with `max fee per gas less than block base fee`. Nothing is wrong
 * with the wallet or the balance; the estimate is simply stale by one block.
 *
 * So the fee is quoted from the block header, which cannot disagree with
 * itself, with room for the base fee to climb before the transaction lands.
 * Under EIP-1559 the surplus is not spent: the chain charges the base fee and
 * the tip, and refunds the rest, so bidding high costs nothing and only buys
 * tolerance for a rising fee.
 */
interface FeeOverrides {
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
}

/** 0.01 gwei. Arbitrum's sequencer orders by arrival, so the tip is a formality. */
const PRIORITY_FEE = 10_000_000n;

/** 0.1 gwei, for the case where a node reports no base fee at all. */
const FEE_FLOOR = 100_000_000n;

/** How many times the current base fee to allow for. */
const HEADROOM = 4n;

const fees = async (): Promise<FeeOverrides> => {
  const signer = await signerOrThrow();
  const block = await signer.provider.getBlock("latest");

  const base = block?.baseFeePerGas ?? 0n;
  const bid = base * HEADROOM + PRIORITY_FEE;

  return {
    maxFeePerGas: bid > FEE_FLOOR ? bid : FEE_FLOOR,
    maxPriorityFeePerGas: PRIORITY_FEE,
  };
};

interface WritableEngine {
  deposit(
    amount: bigint,
    overrides: FeeOverrides,
  ): Promise<ContractTransactionResponse>;
  addLiquidity(
    amount: bigint,
    overrides: FeeOverrides,
  ): Promise<ContractTransactionResponse>;
  removeLiquidity(
    shares: bigint,
    overrides: FeeOverrides,
  ): Promise<ContractTransactionResponse>;
  withdraw(
    amount: bigint,
    overrides: FeeOverrides,
  ): Promise<ContractTransactionResponse>;
  openPosition(
    market: string,
    isLong: boolean,
    margin: bigint,
    leverage: bigint,
    overrides: FeeOverrides,
  ): Promise<ContractTransactionResponse>;
  closePosition(
    market: string,
    overrides: FeeOverrides,
  ): Promise<ContractTransactionResponse>;
  reducePosition(
    market: string,
    notionalToClose: bigint,
    overrides: FeeOverrides,
  ): Promise<ContractTransactionResponse>;
  addMargin(
    market: string,
    amount: bigint,
    overrides: FeeOverrides,
  ): Promise<ContractTransactionResponse>;
}

interface WritableToken {
  allowance(owner: string, spender: string): Promise<bigint>;
  approve(
    spender: string,
    amount: bigint,
    overrides: FeeOverrides,
  ): Promise<ContractTransactionResponse>;
}

interface Faucet {
  mint(
    to: string,
    amount: bigint,
    overrides: FeeOverrides,
  ): Promise<ContractTransactionResponse>;
}

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

  const transaction = await token.approve(
    venue.engine as string,
    MaxUint256,
    await fees(),
  );
  await transaction.wait();
};

export const deposit = async (amount: bigint): Promise<void> => {
  await approveIfNeeded(amount);
  const transaction = await (await writeEngine()).deposit(amount, await fees());
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
  const transaction = await (
    await writeEngine()
  ).addLiquidity(amount, await fees());
  await transaction.wait();
};

/** Redeem shares. Only the part of the pool no open position has reserved. */
export const removeLiquidity = async (shares: bigint): Promise<void> => {
  const transaction = await (
    await writeEngine()
  ).removeLiquidity(shares, await fees());
  await transaction.wait();
};

export const withdraw = async (amount: bigint): Promise<void> => {
  const transaction = await (
    await writeEngine()
  ).withdraw(amount, await fees());
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
  ).openPosition(
    marketId(symbol),
    isLong,
    margin,
    BigInt(leverage),
    await fees(),
  );
  await transaction.wait();
};

export const closePosition = async (symbol: string): Promise<void> => {
  const transaction = await (
    await writeEngine()
  ).closePosition(marketId(symbol), await fees());
  await transaction.wait();
};

export const reducePosition = async (
  symbol: string,
  notional: bigint,
): Promise<void> => {
  const transaction = await (
    await writeEngine()
  ).reducePosition(marketId(symbol), notional, await fees());
  await transaction.wait();
};

export const addMargin = async (
  symbol: string,
  amount: bigint,
): Promise<void> => {
  const transaction = await (
    await writeEngine()
  ).addMargin(marketId(symbol), amount, await fees());
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

  const transaction = await token.mint(to, amount, await fees());
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

/**
 * Everywhere a cause can hide.
 *
 * A wallet's rejection arrives wrapped: ethers puts its own summary on the
 * outside and the node's words two or three objects down. Read only the
 * outside and the whole message can come back as `could not coalesce error`,
 * which describes ethers' difficulty and not the user's.
 */
interface ErrorShape {
  shortMessage?: string;
  reason?: string;
  message?: string;
  error?: { message?: string };
  data?: { message?: string };
  info?: { error?: { message?: string } };
}

const causes = (error: unknown): string[] => {
  const shape = (error ?? {}) as ErrorShape;
  return [
    shape.info?.error?.message,
    shape.error?.message,
    shape.data?.message,
    shape.reason,
    shape.shortMessage,
    shape.message,
  ].filter((part): part is string => typeof part === "string" && part !== "");
};

export const explainRevert = (error: unknown): string => {
  const parts = causes(error);
  const text = parts.join(" ");

  for (const [name, plain] of Object.entries(REASONS)) {
    if (text.includes(name)) return plain;
  }

  if (/user rejected|ACTION_REJECTED/i.test(text)) return "you cancelled it";
  if (/insufficient funds/i.test(text)) return "not enough gas in the wallet";

  // The chain priced the transaction below its own base fee. The app quotes
  // the fee from the block header precisely so this cannot happen, so if it
  // still does, the wallet overrode it — and saying which knob to turn is more
  // use than repeating the node's wording.
  if (/max fee per gas less than block base fee/i.test(text)) {
    return "the wallet bid below the network's base fee — raise the max fee in its advanced gas settings, or try again";
  }

  // Nothing recognised it. Say so, and hand over what the chain actually
  // said — an unexplained failure with the cause thrown away is the one
  // outcome nobody can act on, neither the person hitting the button nor
  // whoever they report it to. The innermost cause is first, so it is the one
  // quoted.
  const detail = parts[0]?.trim();
  return detail
    ? `the transaction did not go through — ${detail.slice(0, 160)}`
    : "the transaction did not go through";
};
