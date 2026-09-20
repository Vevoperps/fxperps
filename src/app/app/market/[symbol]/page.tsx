import type { Metadata } from "next";

import { AppMarket } from "@/views/app/market";
import { PAIRS, marketOf, pairOf } from "@/lib/markets";

/**
 * Every listed pair is prerendered. Sixty-four static pages cost nothing to
 * build and mean a market opens instantly from a cold link, which is what a
 * shared pair link has to do.
 */
export const generateStaticParams = () =>
  PAIRS.map((pair) => ({ symbol: pair.symbol.toLowerCase() }));

export const generateMetadata = async ({
  params,
}: {
  params: Promise<{ symbol: string }>;
}): Promise<Metadata> => {
  const { symbol } = await params;
  const pair = pairOf(symbol);

  return {
    title: pair ? `${pair.symbol} · ${pair.name}` : "Market",
    description: pair
      ? `Perpetual futures on the US dollar against ${pair.name}, up to ${pair.maxLeverage}x.`
      : undefined,
  };
};

export default async function Page({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  // Rendered once here and handed to the client, so both renders agree on the
  // number and hydration has nothing to complain about.
  return <AppMarket symbol={symbol} snapshot={marketOf(symbol)} />;
}
