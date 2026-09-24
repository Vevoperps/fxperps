/**
 * Validated environment variables.
 *
 * `publicEnv` holds `NEXT_PUBLIC_*` values — inlined into the client bundle,
 * safe in the browser. `getServerEnv()` holds server-only values (secrets) —
 * never read it from client code; on the client those values are `undefined`.
 *
 * A missing/invalid variable fails fast with a clear zod error rather than
 * surfacing as a confusing runtime bug later.
 */

import { z } from "zod";

/**
 * Treat an empty env var as unset.
 *
 * `cp .env.example .env` leaves declared-but-blank keys (`CONTACT_ENDPOINT=`),
 * which reach us as `""` — and `""` is not `undefined`, so an `.optional()`
 * schema would reject it as "Invalid URL". Without this, the documented setup
 * flow would break every optional variable the moment someone copied the
 * example file.
 */
const optionalUrl = () =>
  z.preprocess((v) => (v === "" ? undefined : v), z.url().optional());

const publicSchema = z.object({
  NEXT_PUBLIC_SITE_URL: optionalUrl(),
});

const serverSchema = z.object({
  /** Optional upstream the contact endpoint forwards leads to (CRM / webhook). */
  CONTACT_ENDPOINT: optionalUrl(),

  /**
   * The conventional FX source, quoted base=USD.
   *
   * The same one the keeper publishes from, on purpose: a rate the site shows
   * and a mark the chain later carries should not come from two different
   * opinions about what a currency is worth. It holds nothing secret — it is
   * server-side only because the browser has no business making sixty-four
   * visitors' worth of requests to somebody else's API.
   */
  FX_URL: z.url().default("https://api.fxratesapi.com/latest"),

  /**
   * Where the keeper listens, and the secret it answers to.
   *
   * Both absent, asking for a pair to be warmed is a no-op and the venue still
   * works — the majors and anything already open stay priced. Set them and the
   * gap closes: a visitor landing on an untouched pair gets it priced within a
   * round instead of waiting for somebody else to trade it.
   *
   * Server-only, and deliberately not `NEXT_PUBLIC_`: the browser asks this
   * app, this app asks the keeper. A secret that reaches a bundle is not one.
   */
  KEEPER_URL: optionalUrl(),
  WARM_SECRET: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().min(16).optional(),
  ),
});

/** Public env — safe to read anywhere (server or client). */
export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});

let cachedServerEnv: z.infer<typeof serverSchema> | undefined;

/**
 * Server-only env. Call from route handlers / server code only — parsed
 * lazily so the client bundle never evaluates it.
 */
export function getServerEnv() {
  cachedServerEnv ??= serverSchema.parse({
    CONTACT_ENDPOINT: process.env.CONTACT_ENDPOINT,
    FX_URL: process.env.FX_URL,
    KEEPER_URL: process.env.KEEPER_URL,
    WARM_SECRET: process.env.WARM_SECRET,
  });
  return cachedServerEnv;
}
