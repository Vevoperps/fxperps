/**
 * Apple touch icon, generated from the wordmark.
 *
 * Same construction as `icon.tsx` at the size iOS pins to a home screen. Kept
 * as its own file because the convention is per-size and the glyph needs more
 * breathing room here than it does in a 16px tab.
 *
 * 📖 Docs: obsidian/frontend/seo-metadata.md
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { brandMark } from "@/lib/site";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  const font = await readFile(join(process.cwd(), "src/app/fonts/GeneralSans-Medium.otf"));

  return new ImageResponse(
    (
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
          fontSize: 116,
          letterSpacing: -2,
        }}
      >
        {brandMark.glyph}
      </div>
    ),
    { ...size, fonts: [{ name: "General Sans", data: font, weight: 500, style: "normal" }] },
  );
}
