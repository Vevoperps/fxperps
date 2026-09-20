import { NextResponse } from "next/server";

import { handle } from "@/lib/api";
import { settlementMeta } from "@/lib/chain/read";
import { venue } from "@/lib/chain/venue";

/**
 * What the venue is, and what its settlement token is called.
 *
 * The browser never opens an RPC connection of its own — every chain read in
 * this app goes through `/api/*`, which is the rule the rest of the project
 * already follows for third-party calls. It also means the app works against
 * an RPC that does not allow cross-origin requests, which most private ones do
 * not, and that a wrong `decimals` can never be papered over by a silently
 * failed fetch.
 */
export const dynamic = "force-dynamic";

export interface VenueInfo {
  live: boolean;
  chainId: number;
  isLocal: boolean;
  decimals: number;
  symbol: string;
}

export const GET = handle(async (): Promise<NextResponse> => {
  const base = {
    live: venue.live,
    chainId: venue.chainId,
    isLocal: venue.isLocal,
  };

  // An RPC that is down must not take the page down with it: the shape of the
  // answer is the same, the token's own details are simply not known yet.
  const info: VenueInfo = venue.live
    ? { ...base, ...(await settlementMeta().catch(() => ({ decimals: 6, symbol: "" }))) }
    : { ...base, decimals: 6, symbol: "" };

  return NextResponse.json(
    { data: info },
    { headers: { "cache-control": "no-store" } },
  );
});
