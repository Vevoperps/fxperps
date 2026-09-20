import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError, handle } from "@/lib/api";
import { GATE_COOKIE, gatePassword, gateToken } from "@/lib/gate";

/**
 * Issues the gate cookie.
 *
 * The password is compared server-side and never reaches the client bundle —
 * the browser only ever learns "yes" or "no" and receives an httpOnly cookie
 * holding the derived token, not the phrase.
 *
 * `force-dynamic` because a cached POST response would hand the next visitor
 * someone else's `Set-Cookie`.
 */
export const dynamic = "force-dynamic";

const gateSchema = z.object({
  password: z.string().min(1).max(200),
});

/** A year — the gate is a launch curtain, not a session boundary. */
const MAX_AGE = 60 * 60 * 24 * 365;

export const POST = handle(async (req) => {
  const { password } = gateSchema.parse(await req.json());

  // Per request, not per NODE_ENV: `next start` runs in production mode on
  // plain http, and a `secure` cookie is silently dropped there — which would
  // make the gate unopenable on a local production build.
  const https =
    req.headers.get("x-forwarded-proto") === "https" ||
    req.nextUrl.protocol === "https:";

  // With no password configured there is no gate to open, and nothing should
  // be able to mint a cookie for one.
  const expected = gatePassword();
  if (expected === null || password.trim() !== expected) {
    throw new ApiError(401, "invalid_code", "Invalid access code.");
  }

  const response = NextResponse.json({ data: { granted: true } }, { status: 200 });

  response.cookies.set({
    name: GATE_COOKIE,
    value: gateToken(),
    httpOnly: true,
    sameSite: "lax",
    secure: https,
    path: "/",
    maxAge: MAX_AGE,
  });

  return response;
});
