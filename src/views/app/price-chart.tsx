"use client";

import { useEffect, useRef, useState } from "react";

import { resolveColor, type Rgb } from "@/lib/css-color";
import { tradingViewSymbol } from "@/lib/tradingview";

/**
 * The terminal's chart: TradingView's advanced chart, on the pair.
 *
 * **Why not our own candles.** This used to draw a deterministic series
 * generated from the symbol — it looked like a market and was not one, which
 * was fine beside simulated marks and is not fine beside a live venue. The
 * chain stores one price and one daily reference, not a history, so real
 * candles have to come from somewhere that keeps them.
 *
 * **What this is honest about.** The candles are TradingView's, from the
 * interbank feed; the mark above them is what the venue will actually fill at,
 * posted by the oracle. The two track each other and are not the same number,
 * and the line under the chart says so rather than leaving a trader to work it
 * out from a mismatch in the fourth decimal.
 *
 * The widget is an iframe, so nothing inside it takes our fonts or our spring
 * engine. What it does take is the palette: the tokens are resolved at mount
 * and handed over, so it sits in the page rather than on it.
 *
 * 📖 Docs: obsidian/frontend/components/common.md
 */

const hex = ([r, g, b]: Rgb): string =>
  `#${[r, g, b].map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;

/** Long enough that a slow network is not called a failure. */
const GIVE_UP = 8000;

export const PriceChart = ({ symbol }: { symbol: string }) => {
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const node = host.current;
    if (!node) return;

    setFailed(false);
    node.replaceChildren();

    const surface = hex(resolveColor("--surface-ink", [11, 11, 11]));
    const rule = hex(resolveColor("--rule-on-ink", [71, 71, 71]));

    const frame = document.createElement("div");
    frame.className = "tradingview-widget-container__widget";
    frame.style.height = "100%";
    frame.style.width = "100%";
    node.append(frame);

    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.type = "text/javascript";

    // Configuration travels as the script tag's own text, which is how this
    // embed is built. `withdateranges` is what puts 1D / 5D / 1M / 6M / 1Y
    // along the bottom; the side toolbar and the symbol switcher are off
    // because this page is about one pair.
    script.text = JSON.stringify({
      symbol: tradingViewSymbol(symbol),
      interval: "60",
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      withdateranges: true,
      hide_side_toolbar: true,
      hide_top_toolbar: false,
      allow_symbol_change: false,
      save_image: false,
      details: false,
      calendar: false,
      backgroundColor: surface,
      gridColor: rule,
      autosize: true,
      support_host: "https://www.tradingview.com",
    });

    node.append(script);

    // The embed writes an iframe into the container. If one never appears the
    // script was blocked — an extension, a network, a corporate proxy — and a
    // blank rectangle with no explanation is the worst of the outcomes.
    const timer = window.setTimeout(() => {
      if (!node.querySelector("iframe")) setFailed(true);
    }, GIVE_UP);

    return () => {
      window.clearTimeout(timer);
      node.replaceChildren();
    };
  }, [symbol]);

  return (
    <figure className="m-0">
      <div
        ref={host}
        className="tradingview-widget-container h-[22rem] w-full sm:h-[28rem]"
      />

      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-rule-ink px-4 py-2 font-mono text-[0.6875rem] tracking-wide text-dim-ink uppercase">
        <span>
          {failed
            ? "chart unavailable — the data provider did not load"
            : "candles: tradingview interbank feed"}
        </span>
        <span>fills use the venue&apos;s own mark, above</span>
      </figcaption>
    </figure>
  );
};
