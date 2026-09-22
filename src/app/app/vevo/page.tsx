import type { Metadata } from "next";

import { app } from "@/data/app";
import { AppVevo } from "@/views/app/vevo";

export const metadata: Metadata = { title: app.vevo.title };

export default function Page() {
  return <AppVevo />;
}
