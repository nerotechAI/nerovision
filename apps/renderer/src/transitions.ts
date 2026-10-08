import type { TransitionType } from '@nero/schemas';
import { clamp, easeInOutCubic, hash, smoothstep } from './math';

/**
 * How the *incoming* scene is composited over the outgoing one at transition progress p (0..1).
 * The outgoing scene keeps rendering underneath for `tailFrames`, so a transition only ever
 * has to describe the layer on top.
 */
export interface TransitionState {
  /** opacity of the incoming scene */
  opacity: number;
  /** horizontal displacement of the incoming scene, px */
  offsetX: number;
  /** fraction of the incoming scene hidden from the right edge (wipe), 0..1 */
  clipRight: number;
  /** 0..1 position of the wipe's leading edge, or null when there is none */
  edge: number | null;
  /** opacity of a black plate drawn over both scenes */
  black: number;
  /** opacity of a light plate drawn over both scenes */
  flash: number;
  /** 0..1 strength of digital tearing artefacts */
  tear: number;
}

const DONE: TransitionState = { opacity: 1, offsetX: 0, clipRight: 0, edge: null, black: 0, flash: 0, tear: 0 };

export function transitionProgress(frame: number, frames: number): number {
  return frames <= 0 ? 1 : clamp(frame / frames);
}

export function transitionState(type: TransitionType, p: number, frame = 0, seed = 0): TransitionState {
  if (type === 'cut' || p >= 1) return DONE;
  const t = clamp(p);
  // peaks at the midpoint, zero at both ends
  const mid = 1 - Math.abs(2 * t - 1);

  switch (type) {
    case 'crossfade':
      return { ...DONE, opacity: easeInOutCubic(t) };
    case 'dip-black':
      return { ...DONE, opacity: t < 0.5 ? 0 : 1, black: smoothstep(mid) };
    case 'flash':
      return { ...DONE, opacity: smoothstep((t - 0.3) / 0.4), flash: Math.pow(mid, 1.6) * 0.5 };
    case 'wipe': {
      const e = easeInOutCubic(t);
      return { ...DONE, clipRight: 1 - e, edge: e };
    }
    case 'glitch': {
      // the signal "locks on": dropouts get rarer as p grows, and the picture settles sideways
      const locked = hash(seed, frame) < t * 1.15;
      const tear = (1 - t) * (1 - t);
      return {
        ...DONE,
        opacity: t === 0 ? 0 : locked ? 1 : 0.18 * t,
        offsetX: (hash(seed + 1, frame) * 2 - 1) * 42 * tear,
        tear,
      };
    }
  }
}
