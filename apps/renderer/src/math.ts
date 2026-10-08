/**
 * Deterministic math for the renderer. Every frame is rendered in isolation (and in parallel),
 * so nothing here may depend on Math.random(), time, or state carried between frames.
 */

export const clamp = (v: number, min = 0, max = 1): number => Math.min(max, Math.max(min, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const fract = (v: number): number => v - Math.floor(v);

/** 0→1 progress of `v` inside [a, b], clamped. */
export const progress = (v: number, a: number, b: number): number => (b === a ? (v >= b ? 1 : 0) : clamp((v - a) / (b - a)));

export const smoothstep = (t: number): number => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};
export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - clamp(t), 3);
export const easeOutExpo = (t: number): number => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(t)));
export const easeInOutCubic = (t: number): number => {
  const x = clamp(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
export const easeInOutSine = (t: number): number => -(Math.cos(Math.PI * clamp(t)) - 1) / 2;

/** Seeded PRNG (mulberry32). Same seed → same sequence, on every machine. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stateless hash → [0, 1). Use when a value is needed for one (seed, index) pair only. */
export function hash(seed: number, i = 0): number {
  let h = (seed ^ Math.imul(i + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth 1D value noise in [-1, 1]; continuous in `t`, so it is safe for camera drift. */
export function noise1(seed: number, t: number): number {
  const i = Math.floor(t);
  const f = smoothstep(t - i);
  return lerp(hash(seed, i), hash(seed, i + 1), f) * 2 - 1;
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${clamp(alpha).toFixed(4)})`;
}

export function mixHex(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const c = (x: number, y: number) => Math.round(lerp(x, y, clamp(t)));
  return `#${[c(r1, r2), c(g1, g2), c(b1, b2)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
