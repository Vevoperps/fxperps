import { CompareChart } from "@/views/home/compare-chart";
import { Counter } from "@/views/home/counter";
import { Section } from "@/components/ui/section";
import { SectionHead } from "@/components/ui/section-head";
import { performance as perf } from "@/data/content";

/**
 * The four figures, then the one comparison the product rests on.
 *
 * The figures sit in a 2 × 2 panel beside the heading rather than in a band
 * under it: four numbers in a row read as a stat bar, four in a square read as
 * a readout, and a readout is what belongs next to a chart.
 *
 * The chart is its own client component — see `compare-chart.tsx`.
 */
export const Performance = () => (
  <Section id={perf.head.id} tone="ink">
    <SectionHead
      data={perf.head}
      tone="ink"
      aside={
        <dl className="grid w-full border border-rule-ink sm:w-[26rem] sm:grid-cols-2">
          {perf.metrics.map((metric) => (
            <div
              key={metric.caption}
              className="border-b border-rule-ink p-6 last:border-b-0 sm:border-r sm:[&:nth-child(2n)]:border-r-0 sm:[&:nth-last-child(-n+2)]:border-b-0"
            >
              <dt className="sr-only">{metric.caption}</dt>
              <dd>
                <Counter
                  value={metric.value}
                  className="block text-[2rem] font-medium leading-none tracking-tight"
                />
                <span className="mt-3 block text-sm text-dim-ink">
                  {metric.caption}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      }
    />

    <CompareChart />
  </Section>
);
