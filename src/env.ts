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

/**
 * Accepts a bare host where a URL is meant.
 *
 * Railway, Vercel and every other dashboard hands you the domain without a
 * scheme — `vevo-keeper.up.railway.app` — and pasting exactly what was shown
 * is the obvious thing to do. Rejecting it teaches nothing; there is only one
 * scheme it could mean.
 */
const withScheme = (v: unknown): unknown => {
  if (typeof v !== "string" || v.trim() === "") return undefined;
  const value = v.trim();
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
};

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
  KEEPER_URL: z.preprocess(withScheme, z.url().optional()),
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
  if (cachedServerEnv) return cachedServerEnv;

  const raw: Record<string, unknown> = {
    CONTACT_ENDPOINT: process.env.CONTACT_ENDPOINT,
    FX_URL: process.env.FX_URL,
    KEEPER_URL: process.env.KEEPER_URL,
    WARM_SECRET: process.env.WARM_SECRET,
  };

  const first = serverSchema.safeParse(raw);
  if (first.success) {
    cachedServerEnv = first.data;
    return cachedServerEnv;
  }

  /**
   * One bad optional variable must not take the others down with it.
   *
   * Every field here is optional or has a default, and they belong to
   * unrelated features. Parsing them as one object meant a mistyped
   * `KEEPER_URL` — a Railway domain pasted without its scheme — threw inside
   * `getServerEnv()`, and every caller inherited it: the rates reader caught
   * the throw, returned nothing, and sixty-one markets quietly showed their
   * placeholder price. The cause and the symptom were in different features
   * and nothing on screen connected them.
   *
   * So a field that will not parse is dropped, loudly, and the rest stand.
   * The feature that needed it degrades on its own terms — warming simply
   * does not happen — which is the failure the code already handles.
   */
  for (const issue of first.error.issues) {
    const key = issue.path[0];
    if (typeof key === "string") {
      console.error(`[env] ignoring ${key}: ${issue.message}`);
      delete raw[key];
    }
  }

  cachedServerEnv = serverSchema.parse(raw);
  return cachedServerEnv;
}
