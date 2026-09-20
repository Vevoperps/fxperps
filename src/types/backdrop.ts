/**
 * Types for the pixel-wave background and its panel section.
 *
 * 📖 Docs: obsidian/frontend/components/common.md
 */

export interface BackdropSettings {
  /** Edge of one wave block, in CSS pixels. */
  cellSize: number;
  /** Multiplies all three wave frequencies — higher packs more waves into the viewport. */
  waveScale: number;
  /** Wave cycles per second. */
  speed: number;
  /** Flat shades the wave is quantised to. This is what makes it read as pixels. */
  levels: number;
  /** Reach of the cursor ripple, in CSS pixels. */
  cursorRadius: number;
  rippleAmplitude: number;
  rippleFrequency: number;
  rippleSpeed: number;
  /**
   * How quickly the ripple centre catches the pointer, per frame at 60fps.
   *
   * Low values are the point: the field is meant to lag behind the cursor and
   * settle after it, not track it. 1 would pin it to the pointer exactly.
   */
  rippleFollow: number;
}
