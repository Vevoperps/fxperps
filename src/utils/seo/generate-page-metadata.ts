/**
 * @fileoverview Standardised metadata + viewport generators for pages.
 *
 * `generateMetadata` builds a Next.js `Metadata` object — basic meta tags,
 * OpenGraph, Twitter cards, canonical URL, icons, robots. `metadataBase` is
 * always set (from `siteConfig`) so relative URLs (OG image, canonical)
 * resolve to absolute — required by social scrapers.
 *
 * `generateViewport` builds the `Viewport` export. `themeColor` lives here, not
 * in `Metadata` — Next deprecated it on the metadata object.
 */

import { Metadata, Viewport } from "next";

import { siteConfig } from "@/lib/site";

interface MetadataProps {
  title?: string;
  description?: string;
  /** Canonical path (e.g. `/about`) or absolute URL for this page. */
  url?: string;
  twitterHandle?: string;
  author?: string;
  siteName?: string;
}

export function generateMetadata({
  title = siteConfig.name,
  description = siteConfig.description,
  url = "/",
  twitterHandle = siteConfig.twitterHandle,
  author = siteConfig.author,
  siteName = siteConfig.name,
}: MetadataProps = {}): Metadata {
  return {
    // Resolves every relative URL below to an absolute one.
    metadataBase: new URL(siteConfig.url),
    title,
    description,
    authors: [{ name: author }],
    creator: author,
    publisher: author,
    alternates: {
      canonical: url,
    },
    // No `images` and no `icons` here on purpose. Both come from the file
    // conventions — `app/opengraph-image.tsx`, `app/icon.tsx`,
    // `app/apple-icon.tsx` — which generate them from the wordmark at build
    // time. A path named here would win and pin the site to a static asset.
    openGraph: {
      title,
      description,
      url,
      siteName,
      locale: "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      site: twitterHandle,
      creator: twitterHandle,
    },
    manifest: "/manifest.json",
    robots: {
      index: true,
      follow: true,
    },
  };
}

export function generateViewport(): Viewport {
  return {
    themeColor: siteConfig.themeColor,
    width: "device-width",
    initialScale: 1,
  };
}
