/**
 * The pre-launch password gate.
 *
 * One shared place for the password and the cookie, because three different
 * runtimes need to agree on them: the middleware (edge), the API route (node)
 * and nothing on the client — the browser only ever sees the cookie.
 *
 * **The cookie never holds the password.** It holds a token derived from it, so
 * a glance at devtools does not hand someone the phrase, and rotating the
 * password invalidates every cookie already issued without any extra work.
 *
 * This is a "not ready yet" curtain, not a security boundary: it keeps the site
 * out of search results and out of the hands of anyone who stumbles on the URL.
 * Anything that must actually stay secret belongs behind real auth.
 */

export const GATE_COOKIE = "vp_gate";

/**
 * The password, from the environment only.
 *
 * **There is deliberately no default.** A curtain whose key is written in the
 * source is not a curtain once the source is public, and this repository is —
 * so an unset `SITE_PASSWORD` means the gate is off rather than that it is
 * open to anyone who can read a file.
 *
 * Set it in the Vercel project's environment variables before the first
 * deploy. Changing it invalidates every cookie already issued, so everyone is
 * asked again, which is also how you revoke access.
 */
export const gatePassword = (): string | null => {
  const value = process.env.SITE_PASSWORD?.trim();
  return value ? value : null;
};

/** False when no password is configured: the site is simply open. */
export const gateEnabled = (): boolean => gatePassword() !== null;

/**
 * FNV-1a, 32-bit.
 *
 * Synchronous on purpose: the middleware runs on the edge for every request and
 * `crypto.subtle` is async, which would make the whole matcher await a digest
 * it does not need. This is not password storage — the value never leaves our
 * own cookie and the only thing it must do is differ from the password itself.
 */
const token = (value: string): string => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

/**
 * The value a passing cookie must carry.
 *
 * Empty when the gate is off, which no cookie can equal — callers check
 * `gateEnabled()` first, so the comparison is never reached in that state.
 */
export const gateToken = (): string => {
  const password = gatePassword();
  return password === null ? "" : token(`vevoperps:${password}`);
};
