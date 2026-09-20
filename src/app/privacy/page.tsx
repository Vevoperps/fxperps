import type { Metadata } from "next";

import { LegalView } from "@/views/legal";
import { privacy } from "@/data/legal";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: privacy.title,
  description: `What ${brand.name} collects, why, and what happens to it.`,
  alternates: { canonical: privacy.path },
};

export default function Privacy() {
  return <LegalView page={privacy} />;
}
