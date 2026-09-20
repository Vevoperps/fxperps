/**
 * Resolve a CSS custom property to concrete RGB channels.
 *
 * Via a probe element and `color`, not `getPropertyValue`: the latter hands back
 * the *specified* value, which for a Tier-2 token is another `var()` reference.
 * Assigning it to `color` makes the browser do the substitution and hand back
 * `rgb(...)`.
 *
 * Shared by the two canvases that paint with the design tokens — the pixel-wave
 * background and the preloader curtain — because neither can read the cascade
 * once it is drawing into an `ImageData` buffer.
 *
 * 📖 Docs: obsidian/frontend/components/common.md
 */

export type Rgb = [number, number, number];

export const resolveColor = (token: string, fallback: Rgb): Rgb => {
  const probe = document.createElement("span");
  probe.style.display = "none";
  probe.style.color = `var(${token})`;
  document.body.appendChild(probe);

  const computed = getComputedStyle(probe).color;
  probe.remove();

  const channels = computed.match(/\d+(\.\d+)?/g);
  if (!channels || channels.length < 3) return fallback;

  return [Number(channels[0]), Number(channels[1]), Number(channels[2])];
};
