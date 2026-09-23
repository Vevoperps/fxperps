import type { Book } from "@/data/books";

/**
 * A page of a handbook, drawn at thumbnail size from the handbook itself.
 *
 * It renders the book's own rail and its first chapter, word for word, shrunk
 * until it reads as a page rather than as text. Nothing here is a placeholder:
 * change a sentence in `data/books.ts` and the preview on the landing page
 * changes with it, which is the only way a preview stays honest.
 *
 * Why not a screenshot: a screenshot of docs that do not exist yet is a lie,
 * and one of docs that do goes stale the first time they are edited. Drawing
 * costs no image request and stays crisp at any zoom.
 */
export const DocPreview = ({ book }: { book: Book }) => {
  const chapter = book.chapters[0];
  const paragraphs = chapter.blocks.filter((block) => block.kind === "text");

  // A chapter that opens on plain prose would leave half the page blank and the
  // two cards uneven, so the figures and the list are taken from the first
  // chapter that has them. Still the book's own words, just not all from page
  // one — which is what a page of a book looks like anyway.
  const blocks = book.chapters.flatMap((entry) => entry.blocks);
  const list = blocks.find((block) => block.kind === "list");
  const figures = blocks.find((block) => block.kind === "figures");

  return (
    <span
      aria-hidden
      className="flex h-full w-full bg-surface-paper text-[5px] leading-[1.5]"
    >
      {/* The rail, with the book's real groups. */}
      <span className="flex w-[27%] shrink-0 flex-col gap-2 border-r border-rule-paper p-2.5">
        <span className="block text-[5px] font-medium tracking-tight">
          {book.name}
        </span>

        {book.nav.slice(0, 5).map((group, index) => (
          <span key={group.group} className="flex flex-col gap-[3px]">
            <span className="block text-[4px] font-medium text-foreground">
              {index + 1}. {group.group}
            </span>
            {group.links.map((link, position) => (
              <span
                key={link.id}
                className={`block truncate text-[4px] ${
                  index === 0 && position === 0 ? "text-accent" : "text-faint"
                }`}
              >
                {link.label}
              </span>
            ))}
          </span>
        ))}
      </span>

      {/* The page. */}
      <span className="flex min-w-0 flex-1 flex-col gap-1.5 overflow-hidden p-3">
        <span className="flex items-center gap-1">
          <span className="bg-accent px-[3px] py-[2px] text-[3.5px] uppercase tracking-[0.18em] text-ink-on-ink">
            01
          </span>
          <span className="text-[3.5px] uppercase tracking-[0.18em] text-faint">
            {chapter.eyebrow}
          </span>
        </span>

        <span className="block text-[7.5px] font-medium leading-[1.1] tracking-tight text-foreground">
          {chapter.title}
        </span>
        <span aria-hidden className="block h-[1.5px] w-5 bg-accent" />

        {/*
          Four, not two. The page is a fixed rectangle and two paragraphs left
          its bottom third blank, so the thumbnail read as a document that had
          failed to load rather than as one seen from far away.
        */}
        {paragraphs.slice(0, 4).map((block, index) => (
          <span
            key={index}
            className="block text-[4px] leading-[1.6] text-dim-paper"
          >
            {block.body}
          </span>
        ))}

        {figures ? (
          <span className="mt-[2px] flex gap-[2px]">
            {figures.figures?.slice(0, 4).map((figure) => (
              <span
                key={figure.caption}
                className="flex flex-1 flex-col gap-[1px] border border-rule-paper px-[3px] py-[2px]"
              >
                <b className="text-[5px] font-medium leading-none text-accent">
                  {figure.value}
                </b>
                <span className="truncate text-[3px] uppercase tracking-[0.14em] text-faint">
                  {figure.caption}
                </span>
              </span>
            ))}
          </span>
        ) : null}

        {list ? (
          <span className="mt-[2px] flex flex-col gap-[3px]">
            {list.items?.slice(0, 5).map((item) => (
              <span key={item.term} className="flex gap-[3px]">
                <span
                  aria-hidden
                  className="mt-[2px] size-[2.5px] shrink-0 bg-accent"
                />
                <span className="block text-[4px] leading-[1.5]">
                  <b className="font-medium text-accent">{item.term}</b>
                  <span className="text-dim-paper"> {item.body}</span>
                </span>
              </span>
            ))}
          </span>
        ) : null}
      </span>
    </span>
  );
};
