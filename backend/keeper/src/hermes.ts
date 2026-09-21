import {config} from "./config.js";

/**
 * Every call to Hermes, in one place, because they all need the same header.
 *
 * Pyth closed the public Hermes API on **26 August 2026**: the on-chain
 * contracts stay permissionless — anybody can still push a signed price — but
 * fetching the signed price to push now needs a key. That is the whole change,
 * and it turns a keeper that used to need nothing into one that needs an
 * account.
 *
 * `Authorization: Bearer <key>` is the documented form. A key is free, from
 * https://pythdata.app/signup.
 */
export const hermes = async (path: string): Promise<Response> => {
  const headers: Record<string, string> = {accept: "application/json"};

  if (config.PYTH_API_KEY) {
    headers.authorization = `Bearer ${config.PYTH_API_KEY}`;
  }

  const response = await fetch(`${config.HERMES_URL}${path}`, {headers});

  // Worth naming precisely: a bare "401" sends you looking for a bug in the
  // request, and there is none — the endpoint simply is not public any more.
  if (response.status === 401) {
    throw new Error(
      "hermes 401: since 2026-08-26 every hermes.pyth.network request needs a Pyth API key. " +
        "Set PYTH_API_KEY in the keeper's .env — a key is free at https://pythdata.app/signup. " +
        "The on-chain contracts need no key; only fetching the signed prices does.",
    );
  }

  // Every other failure carries Pyth's own message in the body, and that
  // message is the whole diagnosis — a 403 saying "wrong product" and a 403
  // saying "quota exceeded" are entirely different problems wearing the same
  // number. Reading it costs one await and saves an afternoon.
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const detail = body.trim().slice(0, 400);
    throw new Error(`hermes ${response.status} ${response.statusText}${detail ? ` — ${detail}` : ""}`);
  }

  return response;
};
