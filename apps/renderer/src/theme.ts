import type { Timeline } from '@nero/schemas';

/** Black, violet and electric blue. Warm colours are deliberately absent. */
export const palette = {
  void: '#030208',
  ink: '#0a0817',
  dusk: '#15102b',
  violet: '#8b5cf6',
  violetDeep: '#5b21b6',
  violetSoft: '#c4b5fd',
  blue: '#2f6bff',
  electric: '#4cc9ff',
  text: '#ece9ff',
  textDim: '#9a94c4',
} as const;

export const fonts = {
  display: '"Chakra Petch", "Segoe UI", sans-serif',
  mono: '"IBM Plex Mono", Consolas, monospace',
} as const;

/** Multiplier applied to glow, particle counts and overlay strength. */
export const intensityFactor: Record<Timeline['intensity'], number> = { restrained: 0.7, balanced: 1, intense: 1.25 };

/** Title-safe margin as a fraction of the frame. */
export const SAFE = 0.07;
