/**
 * Site-wide configuration — the single source of truth for SEO.
 *
 * Consumed by the metadata generator, `robots.ts`, `sitemap.ts`, and the
 * JSON-LD structured-data helper.
 *
 * Everything here is *derived* from `brand.ts` rather than restated, so the
 * rebrand stays a one-file change. Only values SEO needs and the brand layer
 * has no opinion about (the theme colour, the search-result description) are
 * written out here.
 */
import { publicEnv } from "@/env";
import { brand } from "@/lib/brand";

export const siteConfig = {
  /** Capitalised for the tab strip and the share card: a product name is
   * written the way people say it, even where the wordmark is lowercase. */
  name: brand.name.charAt(0).toUpperCase() + brand.name.slice(1),
  description:
    "Perpetual futures on 64 currencies against the dollar. 24/7, up to 25× leverage, one balance, settled onchain.",
  /**
   * Public origin, no trailing slash. Drives canonical URLs, OG tags, the
   * sitemap, and JSON-LD. `NEXT_PUBLIC_SITE_URL` wins in preview deployments,
   * where the origin is not the canonical domain.
   */
  url: publicEnv.NEXT_PUBLIC_SITE_URL ?? brand.url,
  twitterHandle: brand.links.x ?? `@${brand.name}`,
  author: brand.name,
  /**
   * Browser theme-color (address bar / PWA). The hero blue, so the chrome
   * blends into the page rather than framing it. Literal because `next/og` and
   * the viewport export both run without a stylesheet — keep in step with
   * `--raw-color-blue-500`.
   */
  themeColor: "#0055ff",
} as const;

/**
 * Brand colours for the generated icon and share image.
 *
 * Duplicated from `globals.css` on purpose: `next/og` rasterises in a Node
 * context with no stylesheet and no CSS custom properties, so the tokens cannot
 * reach it. Keep in step with `--raw-color-blue-500` and `--raw-color-white`.
 */
export const brandMark = {
  background: "#0055ff",
  foreground: "#ffffff",
  /** The wordmark, and the single glyph the favicon is cropped to. */
  wordmark: `${brand.name}.`,
  glyph: brand.name.charAt(0).toUpperCase(),
  /**
   * Short line for the share card.
   *
   * Not `siteConfig.description` — that is written for search results and runs
   * long enough to overflow a 1200 × 630 card at display size.
   */
  tagline: "FX perps, onchain, 24/7.",
} as const;
