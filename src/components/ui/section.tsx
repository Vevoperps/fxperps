import type { ReactNode } from "react";

import type { Tone } from "@/components/ui/tone";
import { toneClasses } from "@/components/ui/tone";

/**
 * A page section: full-bleed surface, hairline top border, one content column.
 *
 * The reference never uses a shadow, a radius or a gap between blocks — the
 * whole structure is carried by one-pixel rules, so sections butt directly
 * against each other and the border *is* the separation.
 */
export const Section = ({
  id,
  tone = "paper",
  children,
  className = "",
}: {
  id?: string;
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) => {
  const t = toneClasses(tone);
  return (
    <section
      id={id}
      className={`border-t ${t.rule} ${t.surface} ${className}`}
    >
      <div className="mx-auto w-full max-w-[90rem] px-5 py-20 sm:px-8 sm:py-28">
        {children}
      </div>
    </section>
  );
};
