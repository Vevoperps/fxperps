/**
 * The three social marks the footer carries, drawn rather than imported.
 *
 * X, Telegram and Discord: the feed, the announcement channel and the room.
 * The repository is deliberately not among them.
 *
 * They are simple geometric glyphs of our own rather than traced platform
 * logos — an X is two crossed strokes, a plane is a folded triangle, a room is
 * a rounded mask with two eyes — sized to the text beside them and inheriting
 * its colour, so they dim and light with the row instead of sitting on it as
 * foreign artwork. Two of the three have no account behind them yet; the footer
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
        d="M8.2 4h7.6a6.2 6.2 0 0 1 6.2 6.2v3.6a6.2 6.2 0 0 1-6.2 6.2H8.2A6.2 6.2 0 0 1 2 13.8v-3.6A6.2 6.2 0 0 1 8.2 4Zm1 5.9a1.7 2.1 0 1 0 0 4.2 1.7 2.1 0 1 0 0-4.2Zm5.6 0a1.7 2.1 0 1 0 0 4.2 1.7 2.1 0 1 0 0-4.2Z"
      />
    </svg>
  );
};
