import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { ApiError, handle } from "@/lib/api";
import { readPool, type Pool } from "@/lib/chain/read";
import { venue } from "@/lib/chain/venue";

/**
 * The pool that takes the other side of every trade.
 *
 * The address is optional on purpose. The pool's own size, what is reserved
 * against open positions and how much of it is working are public facts, and
 * they are the first thing somebody deciding whether to provide liquidity
 * wants to see — before connecting anything.
 */
export const dynamic = "force-dynamic";

export type { Pool };

const query = z.object({
  address: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/, "expected an address")
    .optional(),
});

export const GET = handle(async (request: NextRequest) => {
  if (!venue.live) {
    throw new ApiError(503, "venue_not_live", "The venue has no address yet.");
  }

  const raw = request.nextUrl.searchParams.get("address");
  const { address } = query.parse(raw ? { address: raw } : {});

  const pool = await readPool(address).catch(() => {
    throw new ApiError(
      503,
      "chain_unreachable",
      "The chain is not answering right now.",
    );
  });

  return NextResponse.json(
    { data: { ...pool, shares: pool.shares.toString() } },
    { headers: { "cache-control": "no-store" } },
  );
});
