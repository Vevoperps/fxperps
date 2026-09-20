import { Num } from "@/components/ui/num";
import { Counter } from "@/views/home/counter";
import { Label } from "@/components/ui/label";
import { Reveal } from "@/components/ui/reveal";
import { Section } from "@/components/ui/section";
import { SectionHead } from "@/components/ui/section-head";
import { pricing } from "@/data/content";

/**
 * The three things a trade can cost, each stated as a figure.
 *
 * The middle plan carries the accent border the reference gives its featured
 * card — here it marks funding, which is the only one of the three that is not
 * a flat number and therefore the one worth reading.
 */
export const Pricing = () => (
  <Section id={pricing.head.id} tone="ink">
    <SectionHead data={pricing.head} tone="ink" />

    <div className="mt-16 grid gap-px bg-rule-ink lg:grid-cols-3">
      {pricing.plans.map((plan, index) => (
        <Reveal
          key={plan.n}
          y={24}
          delay={index * 90}
          className={`flex flex-col gap-6 bg-surface-ink p-8 ${
            "featured" in plan && plan.featured
              ? "outline outline-1 -outline-offset-1 outline-accent"
              : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <Label tone="ink" strong>
              {plan.name}
            </Label>
            <Num value={plan.n} tone="ink" />
          </div>

          <p className="flex items-baseline gap-2">
            <Counter
              value={plan.value}
              className="text-[2.75rem] font-medium leading-none tracking-tight"
            />
            <span className="text-sm text-dim-ink">{plan.unit}</span>
          </p>

          <ul className="mt-2 flex flex-col gap-3 border-t border-rule-ink pt-6">
            {plan.includes.map((line) => (
              <li key={line} className="flex items-start gap-3 text-sm text-dim-ink">
                <span aria-hidden className="mt-1.5 size-[5px] shrink-0 bg-accent" />
                {line}
              </li>
            ))}
          </ul>
        </Reveal>
      ))}
    </div>
  </Section>
);
