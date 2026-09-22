/**
 * Moving the page, through the thing that actually owns the page's position.
 *
 * **Why this is not `window.scrollTo`.** Lenis runs its own loop: every frame
 * it reads the position it believes the page should be at and writes that to
 * the document. A native scroll, an `href="#section"` jump, anything that sets
 * the position behind its back, is therefore undone on the very next frame.
 * The page twitches and stays where it was, which is exactly what a dead
 * anchor looks like.
 *
 * So every deliberate move goes through Lenis when Lenis is running, and falls
 * back to the browser only when it is not — on a route with smooth scrolling
 * off, or before the controller has mounted.
 */

import { useScroll } from "@/hooks/smooth-scroll/use-scroll";

/** A section id, a `#id`, an element, or an absolute offset in pixels. */
export type ScrollTarget = string | number | HTMLElement;

const asSelector = (target: string): string =>
  target.startsWith("#") ? target : `#${target}`;

export const scrollTo = (target: ScrollTarget, immediate = false): void => {
  const lenis = useScroll.getState().lenis;

  if (lenis) {
    lenis.scrollTo(typeof target === "string" ? asSelector(target) : target, {
      immediate,
      // A jump that lands under the fixed header has landed in the wrong
      // place. The bar is 3.25rem tall with its padding, so clear it.
      offset: typeof target === "number" ? 0 : -52,
      lock: true,
    });
    return;
  }

  const top =
    typeof target === "number"
      ? target
      : (() => {
          const node =
            typeof target === "string"
              ? document.getElementById(asSelector(target).slice(1))
              : target;
          if (!node) return null;
          return node.getBoundingClientRect().top + window.scrollY - 52;
        })();

  if (top === null) return;
  window.scrollTo({ top, behavior: immediate ? "instant" : "smooth" });
};
