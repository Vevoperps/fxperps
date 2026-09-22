import { Action } from "@/components/ui/action";
import { Reveal } from "@/components/ui/reveal";
import { Rule } from "@/components/ui/rule";
import { TypeIn } from "@/components/ui/type-in";
import { Section } from "@/components/ui/section";
import { VideoFrame } from "@/views/home/video-frame";
import { SECTION_COUNT, sectionIndex, install } from "@/data/content";
import { brand } from "@/lib/brand";

/**
 * The demo: heading, one line of support, and the player.
 *
 * **Why this is one centred column and not two.** The section used to put the
 * frame in a half-width panel beside its text, which capped the video at a
 * third of the screen and left the recording unreadable at the size anyone
 * actually watches it. A demo is the one thing on the page that has to be big,
 * so the text sits above it, centred and narrow enough to read, and the frame
 * takes the full column beneath.
 *
 * The heading is written out rather than using `SectionHead`, which stacks its
 * parts to the left.
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

    <div className="mx-auto mt-14 flex w-full max-w-[72rem] flex-col items-center gap-10">
      <div className="flex flex-col items-center gap-6 text-center">
        <Reveal y={24}>
          <h2 className="max-w-[20ch] text-[2.25rem] font-medium leading-[1.05] tracking-tight sm:text-[3rem]">
            {install.head.heading[0]}{" "}
            <span className="text-dim-paper">{install.head.heading[1]}</span>
          </h2>
        </Reveal>

        <Reveal y={24} delay={90}>
          <p className="max-w-[52ch] text-sm leading-relaxed text-dim-paper">
            {install.note}
          </p>
        </Reveal>
      </div>

      {/*
        The dotted ground stays, but as a mount the frame sits centred on
        rather than a box it overhangs. The padding is what keeps the field
        visible as a surface at this width.
      */}
      <Reveal
        y={28}
        delay={140}
        config={{ tension: 150, friction: 30 }}
        className="w-full"
      >
        <div className="dotfield-panel border border-rule-paper p-4 sm:p-8">
          <VideoFrame />
        </div>
      </Reveal>

      <Reveal y={24} delay={200}>
        <Action href={brand.links.app}>{install.head.action}</Action>
      </Reveal>
    </div>
  </Section>
);
