import { Num } from "@/components/ui/num";
import { Reveal } from "@/components/ui/reveal";
import { Section } from "@/components/ui/section";
import { SectionHead } from "@/components/ui/section-head";
import { faq } from "@/data/content";

/**
 * Native `<details>`, one per question.
 *
 * No JS: the element already does disclosure, keyboard access and find-in-page
 * for free, and a hand-rolled accordion loses all three.
 */
export const Faq = () => (
  <Section id={faq.head.id} tone="paper">
    <SectionHead data={faq.head} />

    <div className="mt-16 border-t border-rule-paper">
      {faq.items.map((item, index) => (
        <Reveal
          key={item.n}
          tag="div"
          y={16}
          delay={index * 60}
          className="border-b border-rule-paper"
        >
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-6 py-6 [&::-webkit-details-marker]:hidden">
              <Num value={item.n} className="shrink-0" />
              <h3 className="flex-1 text-lg font-medium tracking-tight">
                {item.q}
              </h3>
              <span
                aria-hidden
                className="shrink-0 font-mono text-dim-paper transition-transform duration-[var(--duration-fast)] ease-entrance group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="max-w-[72ch] pb-8 pl-[4.5rem] text-sm leading-relaxed text-dim-paper">
              {item.a}
            </p>
          </details>
        </Reveal>
      ))}
    </div>
  </Section>
);
