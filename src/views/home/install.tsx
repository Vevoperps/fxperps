import { Action } from "@/components/ui/action";
import { Label } from "@/components/ui/label";
import { Reveal } from "@/components/ui/reveal";
import { Rule } from "@/components/ui/rule";
import { TypeIn } from "@/components/ui/type-in";
import { Section } from "@/components/ui/section";
import { VideoFrame } from "@/views/home/video-frame";
import { SECTION_COUNT, sectionIndex, install } from "@/data/content";
import { brand } from "@/lib/brand";

/**
 * The demo, on a dotted ground, sliding in from the left.
 *
 * The frame is deliberately *not* centred in its panel: it sits low and
 * overhangs, which is what makes the dotted field read as a surface the frame
 * was dropped onto rather than a box it was placed in.
 *
 * The header is written out rather than using `SectionHead`: the reference puts
 * this section's heading on the right of its panel, not above it.
 */
export const Install = () => (
  <Section id={install.head.id} tone="paper">
    <Reveal y={12} className="flex items-center gap-4">
      <span className="label whitespace-nowrap">
        <span className="text-dim-paper">[N.</span>
        <span>{String(sectionIndex(install.head.id)).padStart(2, "0")}</span>
        <span className="text-dim-paper">
          /{String(SECTION_COUNT).padStart(2, "0")}]
        </span>
      </span>
      <Rule className="w-8 bg-rule-paper" delay={80} />
      <TypeIn
        text={`> ${install.head.label}`}
        className="label text-dim-paper"
        delay={120}
      />
      <Rule className="flex-1 bg-rule-paper" delay={160} />
    </Reveal>

    <div className="mt-14 grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
      <div className="dotfield-panel relative flex min-h-[24rem] items-end overflow-hidden border border-rule-paper p-8 sm:p-10">
        <Reveal
          x={-56}
          y={0}
          delay={140}
          config={{ tension: 150, friction: 30 }}
          className="w-full"
        >
          <div className="w-full translate-y-6">
            <VideoFrame />
          </div>
        </Reveal>
      </div>

      <div className="flex flex-col items-start gap-8">
        <Reveal y={24}>
          <h2 className="max-w-[18ch] text-[2.25rem] font-medium leading-[1.05] tracking-tight sm:text-[3rem]">
            {install.head.heading[0]}
            <br />
            <span className="text-dim-paper">{install.head.heading[1]}</span>
          </h2>
        </Reveal>

        <Reveal y={24} delay={90}>
          <p className="max-w-[44ch] text-sm leading-relaxed text-dim-paper">
            {install.note}
          </p>
        </Reveal>

        <Reveal y={24} delay={150}>
          <Action href={brand.links.app}>{install.head.action}</Action>
        </Reveal>
      </div>
    </div>
  </Section>
);
