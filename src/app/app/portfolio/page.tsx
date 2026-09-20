import type { Metadata } from "next";

import { PreviewBanner } from "@/views/app/app-shell";
import { Portfolio } from "@/views/app/portfolio";
import { app } from "@/data/app";

export const metadata: Metadata = { title: app.portfolio.title };

export default function Page() {
  return (
    <>
      <PreviewBanner />
      <section className="mx-auto w-full max-w-[90rem] px-5 py-14 sm:px-8">
        <Portfolio />
      </section>
    </>
  );
}
