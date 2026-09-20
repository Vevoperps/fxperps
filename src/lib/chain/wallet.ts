"use client";

import { BrowserProvider, type JsonRpcSigner } from "ethers";
import { create } from "zustand";

import { venue } from "./venue";

/**
 * The wallet connection, in one store the whole app reads.
 *
 * It was a local `useState` inside the connect button, which is fine until the
 * ticket also needs to know whether anybody is connected. One store, one
 * truth, and the button becomes a view of it rather than the owner of it.
 *
 * **Wallets are discovered, not listed.** EIP-6963 has every installed wallet
 * announce itself with its own name and its own icon, so the picker shows what
 * is actually on this machine instead of four logos, three of which are not
 * installed.
 *
 * The provider itself is kept outside the store. It is a live object with
 * listeners attached, not state, and putting it in the store would have every
 * subscriber re-render whenever ethers touched it.
 */

/** What a wallet announces about itself under EIP-6963. */
export interface ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

export interface Eip1193 {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (
    event: string,
    handler: (...args: unknown[]) => void,
  ) => void;
}

export interface Announced {
  info: ProviderInfo;
  provider: Eip1193;
}

interface WalletState {
  wallets: Announced[];
  address: string | null;
  chainId: number | null;
  /** The uuid of the wallet currently showing its prompt, if any. */
  connecting: string | null;
  error: string | null;

  connect: (wallet: Announced) => Promise<void>;
  disconnect: () => void;
  /** Moves the wallet onto the venue's chain, adding it if it is unknown. */
  ensureChain: () => Promise<boolean>;
  setError: (message: string | null) => void;
}

/** The connected provider. Live object, deliberately not state. */
let connected: Eip1193 | null = null;

/**
 * Which wallet was last used, so a reload can pick it up again.
 *
 * Only the wallet's own identifier is kept — never an address, never anything
 * that could be used to recognise the visitor. It is a convenience, and it is
 * wrapped because a browser in private mode throws on the first read.
 */
const REMEMBERED = "vevo:wallet";

const remember = (rdns: string | null): void => {
  try {
    if (rdns) window.localStorage.setItem(REMEMBERED, rdns);
    else window.localStorage.removeItem(REMEMBERED);
  } catch {
    // Storage is blocked. Reconnecting will simply need a click.
  }
};

const remembered = (): string | null => {
  try {
    return window.localStorage.getItem(REMEMBERED);
  } catch {
    return null;
  }
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === "string") return Number.parseInt(value, 16);
  if (typeof value === "number") return value;
  return null;
};

export const useWallet = create<WalletState>((set, get) => ({
  wallets: [],
  address: null,
  chainId: null,
  connecting: null,
  error: null,

  setError: (message) => set({ error: message }),

  connect: async (wallet) => {
    set({ connecting: wallet.info.uuid, error: null });
    try {
      const accounts = (await wallet.provider.request({
        method: "eth_requestAccounts",
      })) as string[];

      const account = accounts?.[0];
      if (!account) return;

      const chain = toNumber(
        await wallet.provider.request({ method: "eth_chainId" }),
      );

      detach();
      connected = wallet.provider;
      attach(wallet.provider, set);
      remember(wallet.info.rdns);

      set({ address: account, chainId: chain, connecting: null });
    } catch {
      // A refused prompt is the commonest outcome and is not an error worth
      // shouting about. It is said once, in the sheet, and cleared on retry.
      set({ connecting: null, error: "refused" });
    }
  },

  disconnect: () => {
    detach();
    connected = null;
    remember(null);
    set({ address: null, chainId: null, error: null });
  },

  ensureChain: async () => {
    if (!connected) return false;
    if (get().chainId === venue.chainId) return true;

    try {
      await connected.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: venue.chain.chainId }],
      });
      set({ chainId: venue.chainId });
      return true;
    } catch {
      // 4902 is "unknown chain", but wallets are inconsistent about surfacing
      // it, so the add is simply tried and its own failure is the answer.
      try {
        await connected.request({
          method: "wallet_addEthereumChain",
          params: [venue.chain],
        });
        set({ chainId: venue.chainId });
        return true;
      } catch {
        set({ error: "chain" });
        return false;
      }
    }
  },
}));

type Setter = (partial: Partial<WalletState>) => void;

let onAccounts: ((...args: unknown[]) => void) | null = null;
let onChain: ((...args: unknown[]) => void) | null = null;

const attach = (provider: Eip1193, set: Setter): void => {
  onAccounts = (...args) => {
    const accounts = args[0] as string[] | undefined;
    if (!accounts?.length) {
      detach();
      connected = null;
      set({ address: null, chainId: null });
      return;
    }
    set({ address: accounts[0] });
  };

  onChain = (...args) => set({ chainId: toNumber(args[0]) });

  provider.on?.("accountsChanged", onAccounts);
  provider.on?.("chainChanged", onChain);
};

const detach = (): void => {
  if (!connected) return;
  if (onAccounts) connected.removeListener?.("accountsChanged", onAccounts);
  if (onChain) connected.removeListener?.("chainChanged", onChain);
  onAccounts = null;
  onChain = null;
};

/**
 * Starts EIP-6963 discovery.
 *
 * Both halves have to be in place before the request goes out, because the
 * announcement is a reply to it. Returns its own teardown.
 */
export const discoverWallets = (): (() => void) => {
  const seen = new Map<string, Announced>();
  const wanted = remembered();

  const onAnnounce = (event: Event): void => {
    const detail = (event as CustomEvent<Announced>).detail;
    if (!detail?.info?.uuid || seen.has(detail.info.uuid)) return;
    seen.set(detail.info.uuid, detail);
    useWallet.setState({ wallets: [...seen.values()] });

    // Pick the connection back up after a reload, silently.
    //
    // `eth_accounts` is the non-prompting half of the pair: it answers with
    // the accounts this site has already been granted and with nothing at all
    // otherwise, so this can never open a dialog the visitor did not ask for.
    // Only the wallet they last used is tried, and only while nothing else is
    // connected.
    if (detail.info.rdns !== wanted || connected) return;

    void (async () => {
      try {
        const accounts = (await detail.provider.request({
          method: "eth_accounts",
        })) as string[];

        const account = accounts?.[0];
        if (!account || connected) return;

        const chain = toNumber(
          await detail.provider.request({ method: "eth_chainId" }),
        );

        connected = detail.provider;
        attach(detail.provider, (partial) => useWallet.setState(partial));
        useWallet.setState({ address: account, chainId: chain });
      } catch {
        // A wallet that refuses to answer is simply one the visitor will
        // have to click.
      }
    })();
  };

  window.addEventListener("eip6963:announceProvider", onAnnounce);
  window.dispatchEvent(new Event("eip6963:requestProvider"));

  return () =>
    window.removeEventListener("eip6963:announceProvider", onAnnounce);
};

/** The signer for the connected wallet, or null if nobody is connected. */
export const getSigner = async (): Promise<JsonRpcSigner | null> => {
  if (!connected) return null;
  const provider = new BrowserProvider(connected, "any");
  return provider.getSigner();
};
