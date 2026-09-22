/**
 * Placeholder copy for the home page.
 *
 * Ported from the Figma hero, with every string rewritten except the company
 * name — the design's own copy was placeholder ("Designed to mean purpose.",
 * four identical "$4B+ / Processed" tiles). This copy describes what the page
 * actually is: a real-time chess scene. Replace with real copy.
 *
 * 📖 Docs: obsidian/frontend/html-semantics.md
 */

export interface NavLink {
  label: string;
  href: string;
}

export interface Stat {
  value: string;
  label: string;
}

export interface HomeCopy {
  company: string;
  /** Visually hidden — the page's one `<h1>` for crawlers and screen readers. */
  title: string;
  nav: NavLink[];
  contact: NavLink;
  /** Rendered as two lines, matching the design's two-line headline. */
  headline: string[];
  description: string;
  action: string;
  stats: Stat[];
}

export const homeCopy: HomeCopy = {
  company: "Voxelelia.",
  title: "Voxelelia, a chess board rendered in real time",
  nav: [
    { label: "Pieces", href: "#pieces" },
    { label: "Openings", href: "#openings" },
    { label: "Archive", href: "#archive" },
    { label: "Studio", href: "#studio" },
  ],
  contact: { label: "Say hello", href: "#contact" },
  headline: ["Play the board", "in real time."],
  description:
    "Twelve pieces under real physics, lit and rendered in the browser. Move the cursor, and the board answers.",
  action: "Start a match",
  stats: [
    { value: "60", label: "Frames a second" },
    { value: "12", label: "Pieces in orbit" },
    { value: "1", label: "King at centre" },
    { value: "∞", label: "Board states" },
  ],
};
