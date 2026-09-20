"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

import { subscribeToTicker } from "@/lib/animation/ticker";
import { decimalsFor, formatChange, useMarkets } from "@/views/home/use-markets";
import { PAIRS } from "@/lib/markets";

/** World units a second. Slow enough to read a symbol as it goes past. */
const SPEED = 42;

/**
 * The strip of pairs that runs under the hero.
 *
 * The track is rendered twice and wraps at exactly half its own width, so the
 * loop has no seam — the copy arrives where the original left.
 *
 * Driven from the shared ticker rather than a CSS keyframe (which the project
 * bans) or a spring (which is for motion that settles). This is continuous and
 * responds to nothing, so it is the same case the pixel field makes: one
 * subscription on the app-wide rAF, writing one transform.
 */
export const Ticker = () => {
  const { rows } = useMarkets();
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let offset = 0;
    let last = performance.now();

    return subscribeToTicker((time) => {
      const track = trackRef.current;
      if (!track) return;
      const delta = Math.min((time - last) / 1000, 0.05);
      last = time;
      // Half the track is one full copy of the list.
      const span = track.scrollWidth / 2;
      if (span > 0) {
        offset = (offset + SPEED * delta) % span;
        track.style.transform = `translate3d(${-offset}px,0,0)`;
      }
    }, () => 0);
  }, []);
  const live = (rows ?? []).filter((row) => row.mark > 0);
  const items = live.length
    ? live
    : PAIRS.slice(0, 24).map((pair) => ({
        symbol: pair.symbol,
        flag: pair.flag,
        mark: 0,
        change24h: 0,
      }));

  return (
    <div className="overflow-hidden border-y border-rule-paper bg-surface-paper-2 py-3">
      <div ref={trackRef} className="flex w-max gap-10 will-change-transform">
        {[...items, ...items].map((item, index) => (
          <span
            key={`${item.symbol}-${index}`}
            className="flex items-center gap-2 whitespace-nowrap font-mono text-xs"
          >
            <Image
              src={`/flags/${item.flag}.svg`}
              alt=""
              width={18}
              height={13}
              className="h-[13px] w-[18px] object-cover"
            />
            <b className="font-medium">{item.symbol}</b>
            {item.mark ? (
              <>
                <span className="text-dim-paper">
                  {item.mark.toFixed(decimalsFor(item.mark))}
                </span>
                <span
                  className={
                    item.change24h > 0
                      ? "text-accent"
                      : item.change24h < 0
                        ? "text-foreground"
                        : "text-dim-paper"
                  }
                >
                  {formatChange(item.change24h)}
                </span>
              </>
            ) : (
              <span className="text-faint">24/7</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
};
