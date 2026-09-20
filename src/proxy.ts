import { NextResponse, type NextRequest } from "next/server";

import { GATE_COOKIE, gateEnabled, gateToken } from "@/lib/gate";

/**
 * Pre-launch gate.
 *
 * `proxy.ts`, not `middleware.ts`: Next 16 renamed the convention and warns on
 * the old filename at build time (see ADR in `obsidian/workflows/`).
 *
 * Every request that would render a page is rewritten to `/gate` until the
 * visitor's cookie carries the token derived from the current password.
 *
 * **Rewrite, not redirect.** The URL the visitor typed stays in the address
 * bar, so once they enter the code the page they actually asked for is one
 * reload away, and no `/gate?from=…` round-trip is needed.
 *
 * `/api/gate` is exempt for the obvious reason — it is how the cookie gets
 * issued. Everything under `_next` and the generated icon routes is excluded
 * by the matcher rather than here, so the gate screen can load its own CSS and
 * fonts, and so a share of the closed site still renders a card.
 */
export default function proxy(request: NextRequest) {
  const url = request.nextUrl;

  // No password configured, no curtain. A clone of this repository runs
  // without one; production sets `SITE_PASSWORD` and gets the gate back.
  if (!gateEnabled()) {
    if (url.pathname === "/gate") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  const passed = request.cookies.get(GATE_COOKIE)?.value === gateToken();

  // Already through: keep `/gate` from being a reachable page, so a stale tab
  // or a bookmarked gate URL lands on the site instead of asking again.
  if (passed) {
    if (url.pathname === "/gate") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (url.pathname === "/gate" || url.pathname === "/api/gate") {
    return NextResponse.next();
  }

  return NextResponse.rewrite(new URL("/gate", request.url));
}

export const config = {
  matcher: [
    /**
     * Everything except the framework's own assets and the files that have to
     * resolve before the gate can paint.
     *
     * `_next/static` and `_next/image` carry the CSS, the JS and the fonts;
     * `favicon`/`icon`/`apple-icon`/`opengraph-image` are Next's generated
     * icon routes; `assets` and `flags` are the static image directories.
     *
     * The `public/` directories are not an oversight. `next/image` fetches the
     * source file back through the server with no cookies of its own, so a
     * gated `/assets/**` answers the optimiser with the gate's HTML and every
     * icon on the page turns into "the requested resource isn't a valid
     * image". Decorative PNGs are not what the curtain is hiding.
     */
    "/((?!_next/static|_next/image|favicon|icon|apple-icon|opengraph-image|assets|flags|manifest.json|robots.txt|sitemap.xml).*)",
  ],
};
