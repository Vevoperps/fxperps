import type { Metadata } from "next";

import { GateView } from "@/views/gate";

/**
 * The gate is what every URL renders until the code is entered, so this is the
 * page search engines would see while the site is closed. `noindex` keeps the
 * project out of results until it is actually announced.
 */
export const metadata: Metadata = {
  title: "Access",
  robots: { index: false, follow: false },
};

export default function Gate() {
  return <GateView />;
}
