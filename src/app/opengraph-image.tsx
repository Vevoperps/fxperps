/**
 * Open Graph / share card, generated from the wordmark.
 *
 * A root-level file convention, so it covers every route that does not override
 * it, and Next injects both the `og:image` and the Twitter card. That is why
 * `generateMetadata` no longer names an image: a hard-coded path there would
 * win and point back at the starter's placeholder.
 *
 * 1200 × 630 is the size every scraper crops from cleanly.
 *
 * 📖 Docs: obsidian/frontend/seo-metadata.md
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { brandMark, siteConfig } from "@/lib/site";

export const alt = `${siteConfig.name} - ${siteConfig.description}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const [sans, display] = await Promise.all([
    readFile(join(process.cwd(), "src/app/fonts/GeneralSans-Medium.otf")),
    readFile(join(process.cwd(), "src/app/fonts/Jersey25-Regular.ttf")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: brandMark.background,
          color: brandMark.foreground,
          padding: 72,
        }}
      >
        <div style={{ display: "flex", fontFamily: "General Sans", fontSize: 34 }}>
          {brandMark.wordmark}
        </div>

        <div
          style={{
            display: "flex",
            fontFamily: "Jersey",
            fontSize: 128,
            lineHeight: 0.8,
            letterSpacing: -2,
            maxWidth: 940,
          }}
        >
          {brandMark.tagline}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "General Sans", data: sans, weight: 500, style: "normal" },
        { name: "Jersey", data: display, weight: 400, style: "normal" },
      ],
    },
  );
}
