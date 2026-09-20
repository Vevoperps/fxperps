import type { ReactNode } from "react";

import type { Tone } from "@/components/ui/tone";
import { toneClasses } from "@/components/ui/tone";

/** The mono caps micro-label. Dim by default; `strong` keeps it at full ink. */
export const Label = ({
  children,
  tone = "paper",
  strong = false,
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  strong?: boolean;
  className?: string;
}) => {
  const t = toneClasses(tone);
  return (
    <span className={`label ${strong ? "" : t.dim} ${className}`}>
      {children}
    </span>
  );
};

/** A boxed mono chip — `V1.0-BETA`, a tag, a count. */
export const Chip = ({
  children,
  tone = "paper",
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) => {
  const t = toneClasses(tone);
  return (
    <span
      className={`label border px-2 py-1 ${t.rule} ${t.dim} ${className}`}
    >
      {children}
    </span>
  );
};
