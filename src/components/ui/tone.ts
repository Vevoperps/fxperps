/**
 * Which surface a block is standing on.
 *
 * The page alternates between an ink panel and a paper one, and nearly every
 * primitive needs to know which: a hairline that reads on `#1a1a1a` is
 * invisible on white, and the dim grey that reads on white disappears on ink.
 * Passing the tone down beats duplicating each component per surface.
 */
export type Tone = "ink" | "paper";

export const toneClasses = (tone: Tone) =>
  tone === "ink"
    ? {
        surface: "bg-surface-ink text-ink-on-ink",
        rule: "border-rule-ink",
        ruleColor: "text-rule-ink",
        dim: "text-dim-ink",
        hairline: "bg-rule-ink",
      }
    : {
        surface: "bg-surface-paper text-foreground",
        rule: "border-rule-paper",
        ruleColor: "text-rule-paper",
        dim: "text-dim-paper",
        hairline: "bg-rule-paper",
      };
