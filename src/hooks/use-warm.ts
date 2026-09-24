"use client";

import { useEffect } from "react";

/**
 * Tells the venue that somebody is standing on this pair's page.
 *
 * A mark is written on chain only for markets that carry risk, so a pair
 * nobody has traded is quoted but not yet fillable. This is the nudge that
 * changes that: it posts the symbol to our own API, which passes it to the
 * keeper, and the next price round includes this pair.
 *
 * **It is fire and forget.** Nothing on screen waits for it or reads its
 * answer. The rate is already showing, and the market becomes tradeable when a
 * mark exists — which the page learns from the chain on its next poll, not
 * from this call. So a keeper that is down, a secret that is unset or a
 * network that drops all look the same here: nothing happens, and the page is
 * exactly as useful as it was.
 *
 * **It repeats while the page is open.** The keeper forgets an ask after a few
 * minutes, on purpose — otherwise one curious visitor pins a pair warm all
 * day. Somebody genuinely reading the page keeps saying so.
 */

/** Comfortably inside the keeper's own ten minutes. */
const REMIND = 4 * 60 * 1000;

export const useWarm = (symbol: string | undefined, warming: boolean): void => {
  useEffect(() => {
    if (!symbol || !warming) return;

    let stopped = false;

    const ask = () => {
      void fetch("/api/warm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ symbol }),
        keepalive: true,
      }).catch(() => {
        // Deliberate: see above. There is nothing for the page to do about it.
      });
    };

    ask();
    const timer = window.setInterval(() => {
      if (!stopped) ask();
    }, REMIND);

    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [symbol, warming]);
};
