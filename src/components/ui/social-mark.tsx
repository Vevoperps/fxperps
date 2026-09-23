/**
 * The three social marks the footer carries, drawn rather than imported.
 *
 * X, Telegram and Discord: the feed, the announcement channel and the room.
 * The repository is deliberately not among them.
 *
 * They are drawn by hand rather than imported from a logo pack: sized to the
 * text beside them, inheriting its colour, so they dim and light with the row
 * instead of sitting on it as foreign artwork. Each is one path, and the two
 * that have holes in them (the crossbar of the X, the eyes of the mask) cut
 * those holes with `fill-rule="evenodd"` rather than stacking a background
 * coloured shape on top, so they survive any background the footer takes.
 *
 * Two of the three have no account behind them yet; the footer
 * renders those dimmed and unclickable rather than hiding them, so the row
 * keeps its shape on the day the handles exist.
 */

export type SocialKind = "x" | "telegram" | "discord";

export const SocialMark = ({ kind }: { kind: SocialKind }) => {
  if (kind === "x") {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="size-[1.05rem] fill-current"
      >
        <path d="M17.2 3h3.3l-7.2 8.2L22 21h-6.6l-5.2-6.6L4.3 21H1l7.7-8.8L1.4 3H8l4.7 6.1L17.2 3Zm-1.2 16h1.8L8.1 4.9H6.2L16 19Z" />
      </svg>
    );
  }

  if (kind === "telegram") {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="size-[1.15rem] fill-current"
      >
        <path d="M22.4 2.4 1.9 11.1l6.6 2.3L19.4 5.4l-8.6 8.8v5.4l3.3-4 4.7 3.4Z" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-[1.15rem] fill-current"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 5.35 10.75 3.8C8.3 4.1 6.2 5 4.6 6.4 2.6 9.55 1.55 13.2 1.7 17c1.5 2 3.7 3.2 6.05 3.7l1.45-2.35c.85.25 1.8.37 2.8.37s1.95-.12 2.8-.37l1.45 2.35c2.35-.5 4.55-1.7 6.05-3.7.15-3.8-.9-7.45-2.9-10.6C17.8 5 15.7 4.1 13.25 3.8ZM8.9 10.05a1.95 2.3 0 1 0 0 4.6 1.95 2.3 0 1 0 0-4.6Zm6.2 0a1.95 2.3 0 1 0 0 4.6 1.95 2.3 0 1 0 0-4.6Z"
      />
    </svg>
  );
};
