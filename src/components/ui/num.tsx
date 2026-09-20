import type { Tone } from "@/components/ui/tone";
import { toneClasses } from "@/components/ui/tone";

/**
 * `//001` — the reference numbers everything, and always like this.
 *
 * Mono, and the slashes are dimmer than the digits so the number reads as the
 * content and the prefix as punctuation.
 */
export const Num = ({
  value,
  tone = "paper",
  className = "",
}: {
  value: string;
  tone?: Tone;
  className?: string;
}) => {
  const t = toneClasses(tone);
  return (
    <span className={`font-mono text-xs tracking-wider ${className}`}>
      <span className={t.dim}>{"//"}</span>
      {value}
    </span>
  );
};
