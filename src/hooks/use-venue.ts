"use client";

import { useCallback, useEffect, useState } from "react";
import { create } from "zustand";

import type { AccountSnapshot } from "@/app/api/account/route";
import type { VenueInfo } from "@/app/api/venue/route";
import { apiFetch } from "@/lib/api-client";
import type { ChainPosition } from "@/lib/chain/read";
import { venue } from "@/lib/chain/venue";
import { useWallet } from "@/lib/chain/wallet";

/**
 * The app's view of one account on the chain.
 *
 * **Every read goes through `/api/*`.** The browser never opens an RPC
 * connection of its own — that is the project's rule for third-party calls,
 * and here it also means the app works against an RPC that refuses
 * cross-origin requests, and that sixty-four markets cost one server-side
 * `positionsView` rather than sixty-four fetches from every open tab.
 *
 * One refresh counter, two hooks. Every write bumps it, so closing a position
 * on the ticket updates the balance in the portfolio at the foot of the same
 * screen without either component knowing the other exists.
 */

/** How often an account re-reads itself while nothing is happening. */
const POLL_MS = 12000;

interface Refresh {
  version: number;
  bump: () => void;
}

/** Bumped after every write. Anything reading the chain watches it. */
export const useRefresh = create<Refresh>((set) => ({
  version: 0,
  bump: () => set((was) => ({ version: was.version + 1 })),
}));

/** The settlement token's decimals and symbol, fetched once per page load. */
let info: Promise<VenueInfo> | null = null;

const venueInfo = (): Promise<VenueInfo> => {
  info ??= apiFetch<VenueInfo>("/api/venue");
  return info;
};

export interface VenueAccount {
  snapshot: AccountSnapshot | null;
  decimals: number;
  symbol: string;
  /** True while the venue is live and a wallet is connected. */
  ready: boolean;
  reload: () => void;
}

export const useVenueAccount = (): VenueAccount => {
  const address = useWallet((state) => state.address);
  const version = useRefresh((state) => state.version);

  const [snapshot, setSnapshot] = useState<AccountSnapshot | null>(null);
  const [meta, setMeta] = useState({ decimals: 6, symbol: "" });

  const ready = venue.live && address !== null;

  useEffect(() => {
    if (!venue.live) return;
    let alive = true;
    venueInfo()
      .then((found) => {
        if (alive) setMeta({ decimals: found.decimals, symbol: found.symbol });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!ready || !address) {
      setSnapshot(null);
      return;
    }

    let alive = true;
    const load = () =>
      apiFetch<AccountSnapshot>(`/api/account?address=${address}`)
        .then((found) => alive && setSnapshot(found))
        .catch(() => undefined);

    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [address, ready, version]);

  const reload = useCallback(() => useRefresh.getState().bump(), []);

  return {
    snapshot,
    decimals: meta.decimals,
    symbol: meta.symbol,
    ready,
    reload,
  };
};

/** The pool, as the API serialises it: shares are a decimal string. */
export interface PoolSnapshot {
  assets: number;
  reserved: number;
  free: number;
  utilisation: number;
  shares: string;
  value: number;
  ownership: number;
}

/**
 * The pool, polled.
 *
 * It reads with or without a connected wallet: the pool's size is public, and
 * somebody deciding whether to back the book should see what they would be
 * backing before they connect anything.
 */
export const useVenuePool = (): { pool: PoolSnapshot | null } => {
  const address = useWallet((state) => state.address);
  const version = useRefresh((state) => state.version);
  const [pool, setPool] = useState<PoolSnapshot | null>(null);

  useEffect(() => {
    if (!venue.live) {
      setPool(null);
      return;
    }

    let alive = true;
    const query = address ? `?address=${address}` : "";
    const load = () =>
      apiFetch<PoolSnapshot>(`/api/pool${query}`)
        .then((found) => alive && setPool(found))
        .catch(() => undefined);

    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [address, version]);

  return { pool };
};

/**
 * The open position on one pair, if there is one.
 *
 * It reads the same snapshot the portfolio does rather than asking the chain
 * again, so the ticket and the table can never disagree about what is open.
 */
export const usePosition = (symbol?: string): ChainPosition | null => {
  const { snapshot } = useVenueAccount();
  if (!symbol || !snapshot) return null;
  return snapshot.positions.find((one) => one.symbol === symbol) ?? null;
};
