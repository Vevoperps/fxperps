import { brand } from "@/lib/brand";

/**
 * Where the venue lives, and whether it exists yet.
 *
 * The app is built to run in two states and to be honest about which one it is
 * in. With no addresses configured it is the preview: generated marks, a
 * ticket that prices correctly and refuses to submit, a banner that says so.
 * With them, every screen reads the chain and every button works. Nothing in
 * between, and no button that looks live over a feature that is not.
 *
 * The addresses are `NEXT_PUBLIC_` on purpose — a contract address is public
 * the moment it is deployed, and the browser cannot talk to a chain it is not
 * allowed to know the address of. Nothing secret is ever put here; the app has
 * no server-side key and never signs anything itself.
 */

const read = (value: string | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const engine = read(process.env.NEXT_PUBLIC_ENGINE_ADDRESS);
const settlement = read(process.env.NEXT_PUBLIC_SETTLEMENT_ADDRESS);
const rpcUrl = read(process.env.NEXT_PUBLIC_RPC_URL);
const chainId = Number(read(process.env.NEXT_PUBLIC_CHAIN_ID) ?? brand.chain.id);

/** A deployed address is 20 bytes of hex and nothing else. */
const isAddress = (value: string | null): value is string =>
  value !== null && /^0x[0-9a-fA-F]{40}$/.test(value);

export const venue = {
  /**
   * True only when every piece needed to read and write is present.
   *
   * Every live path in the app is behind this one flag, so the preview cannot
   * drift into half-working: either the venue is configured and the app trades,
   * or it is not and the app says so.
   */
  live: isAddress(engine) && isAddress(settlement) && rpcUrl !== null,

  engine: isAddress(engine) ? engine : null,
  settlement: isAddress(settlement) ? settlement : null,
  rpcUrl,
  chainId,

  /** What a wallet needs to add the chain if it does not know it. */
  chain: {
    chainId: `0x${chainId.toString(16)}`,
    chainName: brand.chain.name,
    rpcUrls: rpcUrl ? [rpcUrl] : [],
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  },

  /**
   * A local chain is a development chain, and the app says so out loud.
   *
   * 31337 is Anvil's. Nobody should ever see this in production, and if they
   * do, the banner is the cheapest possible way to find out.
   */
  isLocal: chainId === 31337 || chainId === 1337,
} as const;

/** The id the engine knows a pair by is the hash of its symbol. */
export type MarketId = string;
