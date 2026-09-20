import type { Metadata } from "next";

import { HandbookView } from "@/views/handbook";
import { documentation } from "@/data/books";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: `${documentation.name} / ${documentation.title}`,
  description: `How ${brand.name} prices, funds and liquidates a position, written out plainly.`,
  alternates: { canonical: "/docs" },
};

export default function Docs() {
  return <HandbookView book={documentation} />;
}
