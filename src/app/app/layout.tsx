import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppShell } from "@/views/app/app-shell";
import { brand } from "@/lib/brand";

/**
 * The app's own frame.
 *
 * `noindex` for the whole subtree: this is a product surface, not a page to be
 * found in a search result, and the marketing site is what should rank.
 */
export const metadata: Metadata = {
  title: { default: `${brand.name} app`, template: `%s / ${brand.name}` },
  robots: { index: false, follow: false },
};

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
