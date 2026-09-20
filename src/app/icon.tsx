/**
 * Favicon, generated from the wordmark at build time.
 *
 * A Next file convention: the `<link rel="icon">` is injected automatically, so
 * nothing in `generateMetadata` needs to name it. Drawn rather than shipped as a
 * PNG so it is always the real brand mark and the real brand blue — the starter's
 * placeholder icons were neither.
 *
 * `next/og` rasterises in Node with no stylesheet, which is why the colours come
 * from `brandMark` and the face is read off disk instead of using tokens or
 * `next/font`.
 *
 * 📖 Docs: obsidian/frontend/seo-metadata.md
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { brand } from "@/lib/brand";
import { brandMark } from "@/lib/site";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default async function Icon() {
  const font = await readFile(
    join(process.cwd(), "src/app/fonts/GeneralSans-Medium.otf"),
  );

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: brandMark.background,
        color: brandMark.foreground,
        fontFamily: "General Sans",
        fontSize: 42,
        letterSpacing: -2,
        // The wordmark runs past both edges rather than sitting inside the
        // tile. At 16px in a tab strip nobody reads a favicon, they
        // recognise a shape, and a full-bleed mark on the brand blue is a
        // stronger shape than one letter floating in a square.
        overflow: "hidden",
        whiteSpace: "nowrap",
      }}
    >
      {brand.name}
    </div>,
    {
      ...size,
      fonts: [
        { name: "General Sans", data: font, weight: 500, style: "normal" },
      ],
    },
  );
}
