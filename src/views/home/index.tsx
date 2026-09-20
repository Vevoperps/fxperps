import { Closing } from "@/views/home/closing";
import { Coverage } from "@/views/home/coverage";
import { Docs } from "@/views/home/docs";
import { Faq } from "@/views/home/faq";
import { Hero } from "@/views/home/hero";
import { HowItWorks } from "@/views/home/how-it-works";
import { Install } from "@/views/home/install";
import { KeyValue } from "@/views/home/key-value";
import { Performance } from "@/views/home/performance";
import { Pricing } from "@/views/home/pricing";
import { Rates } from "@/views/home/rates";
import { Seam } from "@/views/home/seam";
import { SiteHeader } from "@/views/home/site-header";
import { Ticker } from "@/views/home/ticker";
import { Ticket } from "@/views/home/ticket";

/**
 * Home — the whole page.
 *
 * A Server Component. Only the four pieces that need the browser are client
 * leaves: the header (it follows the scroll), the ticker and the rates table
 * (they poll), and the closing band (it moves). Everything else is rendered on
 * the server and never ships a line of JavaScript.
 *
 * Section order is the order below, and the `[N.xx/yy]` markers number
 * themselves from `SECTION_ORDER` in `data/content.ts` — so moving a section
 * here means moving it there, and nothing else.
 */
export const HomeView = () => (
  <main className="relative z-0">
    <SiteHeader />
    <Hero />
    <Ticker />
    <KeyValue />
    <Seam label="Performance" above="paper" below="ink" />
    <Performance />
    <Seam label="How it works" above="ink" below="paper-2" />
    <HowItWorks />
    <Install />
    <Seam label="Your ticket" above="paper" below="ink" />
    <Ticket />
    <Seam label="Live rates" above="ink" below="paper" />
    <Rates />
    <Coverage />
    <Seam label="Fees" above="paper" below="ink" />
    <Pricing />
    <Seam label="Documentation" above="ink" below="paper" />
    <Docs />
    <Faq />
    <Closing />
  </main>
);
