import type { Metadata } from "next";

import { HandbookView } from "@/views/handbook";
import { tradingGuide } from "@/data/books";

export const metadata: Metadata = {
  title: `${tradingGuide.name} / ${tradingGuide.title}`,
  description:
    "Funding, skew, leverage caps and the arithmetic behind an open position.",
  alternates: { canonical: "/docs/trading" },
};

export default function TradingGuide() {
  return <HandbookView book={tradingGuide} />;
}
