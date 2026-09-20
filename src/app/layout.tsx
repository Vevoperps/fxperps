import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import localFont from "next/font/local";

import {
  generateMetadata,
  generateViewport,
} from "@/utils/seo/generate-page-metadata";
import { getSiteStructuredData } from "@/utils/seo/structured-data";

import { LazyCookie } from "@/components/common/Cookie";
import { AdaptiveGrid } from "@/components/common/grid";
import { Preloader } from "@/components/common/preloader";
import { ReducedMotion } from "@/components/common/reduced-motion";
import { ScrollLayout } from "@/layouts/scroll-layout";

import "@/app/globals.css";

/**
 * Three faces, each with one job.
 *
 * Geist for everything that is read, Geist Mono for everything that is a
 * *label* — section markers, table heads, chips, stat captions, buttons — and a
 * pixel face for the load counter and the few places a digit should look like
 * it came off a board rather than out of a paragraph.
 *
 * All three are open, which is the reason for this particular trio: the
 * reference's own display family is proprietary and could not have shipped.
 */
const pixel = localFont({
  src: "./fonts/Jersey25-Regular.ttf",
  variable: "--font-pixel",
  weight: "400",
  style: "normal",
  display: "swap",
});

export const metadata: Metadata = generateMetadata();
export const viewport: Viewport = generateViewport();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} ${pixel.variable} font-sans`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(getSiteStructuredData()),
          }}
        />
        <ScrollLayout>
          <AdaptiveGrid />
          <ReducedMotion />
          <Preloader />
          <LazyCookie />
          {children}
        </ScrollLayout>
      </body>
    </html>
  );
}
