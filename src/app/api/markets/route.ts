import { NextResponse } from "next/server";

import { readFeed } from "@/lib/chain/feed";

/**
 * The page's only live endpoint.
 *
 * The ticker and the rates table both poll this every 15 seconds, so it must
 * never be cached — `force-dynamic` plus a no-store header, because a CDN that
 * caches this serves a table that has stopped moving and nothing on the page
 * would say so.
 *
 * It is also the one place that reads the chain on the visitor's behalf. Sixty
 * four markets in one `marketsView` call, once per request, instead of every
 * browser opening its own RPC connection — and `onchain` travels with the
 * payload so the page can say which feed it is showing.
 */
export const dynamic = "force-dynamic";

export const GET = async () => {
  const feed = await readFeed();

  return NextResponse.json(
    { markets: feed.markets, onchain: feed.onchain },
    { headers: { "cache-control": "no-store" } },
  );
};
