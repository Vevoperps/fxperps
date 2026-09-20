/**
 * The two social marks the footer carries, drawn rather than imported.
 *
 * Only X and GitHub: a row of six platform icons is a row of six logos nobody
 * clicks, and the two that a trading venue is actually judged on are the feed
 * and the code.
 *
 * They are simple geometric glyphs of our own — an X is two crossed strokes and
 * the GitHub mark is a rounded silhouette — sized to the text beside them and
 * inheriting its colour, so they dim and light with the row instead of sitting
 * on it as foreign artwork.
 */

export type SocialKind = "x" | "github";

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

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-[1.15rem] fill-current"
    >
      <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48l-.01-1.7c-2.78.6-3.37-1.34-3.37-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85l-.01 2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
    </svg>
  );
};
