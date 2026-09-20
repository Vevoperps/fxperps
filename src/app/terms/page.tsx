import type { Metadata } from "next";

import { LegalView } from "@/views/legal";
import { terms } from "@/data/legal";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: terms.title,
  description: `The rules for using ${brand.name}, in plain language.`,
  alternates: { canonical: terms.path },
};

export default function Terms() {
  return <LegalView page={terms} />;
}
