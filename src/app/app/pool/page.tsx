import type { Metadata } from "next";

import { app } from "@/data/app";
import { AppPool } from "@/views/app/pool";

export const metadata: Metadata = { title: app.pool.title };

export default function Page() {
  return <AppPool />;
}
