import { brand } from "@/lib/brand";

/**
 * What to call the chain the app is actually pointed at.
 *
 * The name used to come straight from `brand.chain`, which is the chain this
 * venue is *for* — and that was wrong the moment the first deployment went
 * somewhere else. A banner reading "live on robinhood chain" over an Arbitrum
 * Sepolia deployment is not a cosmetic slip: it is the app telling a visitor
 * which chain their money is on, incorrectly.
 *
 * So the name is derived from the configured id, and an id nobody has named
 * prints as the number rather than as a guess.
 */

export interface Network {
  name: string;
  /** True where the tokens are not worth anything. */
  testnet: boolean;
  /** Block explorer origin, no trailing slash. */
  explorer: string | null;
}

const KNOWN: Record<number, Network> = {
  1: { name: "Ethereum", testnet: false, explorer: "https://etherscan.io" },
  42161: { name: "Arbitrum One", testnet: false, explorer: "https://arbiscan.io" },
  8453: { name: "Base", testnet: false, explorer: "https://basescan.org" },

  // Robinhood Chain, an Arbitrum Orbit rollup. Both ids are named because the
  // testnet is where this deployment gets proved, and a page that cannot tell
  // the two apart is a page that cannot warn anybody which one they are on.
  4663: {
    name: "Robinhood Chain",
    testnet: false,
    explorer: "https://robinhoodchain.blockscout.com",
  },
  46630: {
    name: "Robinhood Chain Testnet",
    testnet: true,
    explorer: "https://explorer.testnet.chain.robinhood.com",
  },

  11155111: { name: "Sepolia", testnet: true, explorer: "https://sepolia.etherscan.io" },
  421614: {
    name: "Arbitrum Sepolia",
    testnet: true,
    explorer: "https://sepolia.arbiscan.io",
  },
  84532: { name: "Base Sepolia", testnet: true, explorer: "https://sepolia.basescan.org" },

  31337: { name: "a local development chain", testnet: true, explorer: null },
  1337: { name: "a local development chain", testnet: true, explorer: null },
};

/**
 * A rebrand can aim this venue at a chain the table does not name. That case
 * falls back to the brand's own wording rather than to a bare number — but it
 * is a fallback, not an entry, because the table also knows the explorer and
 * whether the money on that chain is real.
 *
 * Anything else prints as its id. `testnet: true` there is the safe default:
 * the worst outcome is a testnet banner over a real deployment nobody
 * configured, which is visible; the reverse is silent.
 */
export const networkOf = (chainId: number): Network => {
  const known = KNOWN[chainId];
  if (known) return known;

  if (chainId === brand.chain.id) {
    return { name: brand.chain.name, testnet: false, explorer: null };
  }

  return { name: `chain ${chainId}`, testnet: true, explorer: null };
};
