"use client";

/**
 * The demo player: a framed 16:9 panel that loads YouTube only when asked.
 *
 * **A facade, not an embed.** Dropping an `<iframe>` on the page costs a
 * megabyte of YouTube's player and a set of third-party cookies for every
 * visitor, most of whom never press play. So the frame is ours until the click,
 * and only then does the iframe mount — with `autoplay=1`, so the press that
 * paid for it is the press that starts it.
 *
 * With no id configured the same frame renders as a labelled placeholder. That
 * is deliberate: an empty embed is a broken-looking black box, while this reads
 * as a slot waiting for its recording.
 *
 * 📖 Docs: obsidian/frontend/components/common.md
 */

import { useState } from "react";

import { Label } from "@/components/ui/label";
import { install } from "@/data/content";

const { video } = install;

export const VideoFrame = () => {
  const [playing, setPlaying] = useState(false);
  const id = video.youtubeId;

  return (
    <figure className="w-full border border-rule-ink bg-surface-ink shadow-[0_2rem_4rem_-2rem_rgba(0,0,0,0.55)]">
      {/* Title bar — the same chrome the code card had, so the section keeps
          its place in the page's language. */}
      <header className="flex items-center justify-between border-b border-rule-ink px-4 py-3 text-ink-on-ink">
        <Label tone="ink" strong>
          {video.file}
        </Label>
        <Label tone="ink">{video.duration}</Label>
      </header>

      <div className="relative aspect-video w-full overflow-hidden bg-surface-ink-2">
        {playing && id ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 size-full border-0"
          />
        ) : (
          <>
            {/* The dotted ground, dimmed, so the empty frame is a surface
                rather than a void. */}
            <span
              aria-hidden
              className="dotfield absolute inset-0 text-dim-ink"
            />

            {id ? (
              <button
                type="button"
                onClick={() => setPlaying(true)}
                aria-label={`${video.play} - ${video.title}`}
                className="group absolute inset-0 flex items-center justify-center"
              >
                <span className="flex items-center gap-3 bg-surface-paper px-5 py-3.5 text-foreground transition-colors duration-[var(--duration-fast)] ease-entrance group-hover:bg-accent group-hover:text-ink-on-ink">
                  <span aria-hidden className="size-2 bg-accent group-hover:bg-surface-paper" />
                  <span className="label">{video.play}</span>
                </span>
              </button>
            ) : (
              /*
                No recording yet, so this is the shape of one: the play target
                a viewer expects, drawn and inert, with the caption saying why
                it does nothing. A bare dot in an empty rectangle read as a
                broken embed; this reads as a slot waiting to be filled.
              */
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-5">
                <span
                  aria-hidden
                  className="flex h-12 w-[4.5rem] items-center justify-center rounded-[0.75rem] bg-ink-on-ink/15"
                >
                  <span className="ml-1 border-y-[0.5rem] border-l-[0.85rem] border-y-transparent border-l-ink-on-ink/60" />
                </span>
                <Label tone="ink">{video.placeholder}</Label>
              </span>
            )}
          </>
        )}

        {/* Corner marks, as on the closing card — they are what makes a plain
            rectangle read as a frame. */}
        {["left-3 top-3", "right-3 top-3", "left-3 bottom-3", "right-3 bottom-3"].map(
          (position) => (
            <span
              key={position}
              aria-hidden
              className={`pointer-events-none absolute size-2 bg-ink-on-ink/70 ${position}`}
            />
          ),
        )}
      </div>
    </figure>
  );
};
