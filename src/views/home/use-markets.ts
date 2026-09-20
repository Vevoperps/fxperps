"use client";

import { useEffect, useState } from "react";

import type { Market } from "@/lib/markets";

/** How often the page asks for new marks. The reference's own cadence. */
const POLL_MS = 15000;

/**
 * The page's one live subscription.
 *
 * Both the ticker and the table read from this, so they can never disagree
 * about what a pair is worth — one fetch, one interval, one answer.
 */
export const useMarkets = (): {
  rows: Market[] | null;
  failed: boolean;
  /** True once the endpoint is reading the engine rather than generating. */
  onchain: boolean;
} => {
  const [rows, setRows] = useState<Market[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [onchain, setOnchain] = useState(false);

  useEffect(() => {
    let alive = true;

    const load = () =>
      fetch("/api/markets", { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : Promise.reject()))
        .then((payload: { markets: Market[]; onchain?: boolean }) => {
          if (!alive) return;
          setRows(payload.markets.filter((market) => market.type === "fx"));
          setOnchain(payload.onchain === true);
          setFailed(false);
        })
        .catch(() => {
          if (alive) setFailed(true);
        });

    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  return { rows, failed, onchain };
};

/**
 * Decimals that suit the magnitude.
 *
 * A rate of 16 284 rupiah and one of 0.9182 euro are the same kind of number
 * and want completely different precision; four decimals on the rupiah is
 * noise, two on the euro loses the move.
 */
export const decimalsFor = (mark: number): number =>
  mark >= 1000 ? 2 : mark >= 10 ? 3 : 4;

export const formatChange = (change: number, known = true): string =>
  known ? `${change > 0 ? "+" : ""}${(change * 100).toFixed(2)}%` : "—";
