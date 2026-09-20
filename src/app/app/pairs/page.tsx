import type { Metadata } from "next";

import { AppPairs } from "@/views/app/pairs";
import { app } from "@/data/app";

export const metadata: Metadata = { title: app.pairs.title };

export default function Page() {
  return <AppPairs />;
}
