import type { CameraMove, Timeline } from '@nero/schemas';
import { easeInOutSine, lerp, noise1 } from './math';

/**
 * Virtual camera. The camera never moves pixels directly: each visual layer declares a depth
 * and is displaced proportionally (see layerTransform), which is what produces parallax.
 */
export interface CameraState {
  /** horizontal displacement of a depth-1 layer, as a fraction of frame width */
  x: number;
  /** vertical displacement of a depth-1 layer, as a fraction of frame height */
  y: number;
  /** zoom of a depth-1 layer */
  scale: number;
  /** roll in degrees */
  rotate: number;
  /** rotation around the vertical axis in radians; consumed by true-3D layers */
  yaw: number;
}

export const IDENTITY_CAMERA: CameraState = { x: 0, y: 0, scale: 1, rotate: 0, yaw: 0 };

const INTENSITY: Record<Timeline['intensity'], number> = { restrained: 0.65, balanced: 1, intense: 1.3 };

export interface CameraInput {
  move: CameraMove;
  /** 0..1 across the whole shot (including the tail under the next transition) */
  progress: number;
  /** seconds since the shot started; drives the organic micro-drift */
  timeSec: number;
  seed: number;
  intensity: Timeline['intensity'];
}

export function cameraState({ move, progress, timeSec, seed, intensity }: CameraInput): CameraState {
  if (move === 'static') return IDENTITY_CAMERA;
  const k = INTENSITY[intensity];
  // mostly linear (a dolly at constant speed) with soft ends so cuts never land on a jerk
  const p = lerp(progress, easeInOutSine(progress), 0.45);
  const span = lerp(-1, 1, p);
  const cam: CameraState = { ...IDENTITY_CAMERA };

  switch (move) {
    case 'push-in':
      cam.scale = lerp(1, 1 + 0.13 * k, p);
      break;
    case 'pull-out':
      cam.scale = lerp(1 + 0.13 * k, 1, p);
      break;
    // a camera panning left makes the scene travel to the right, and so on
    case 'pan-left':
      cam.x = span * 0.035 * k;
      cam.scale = 1.03;
      break;
    case 'pan-right':
      cam.x = -span * 0.035 * k;
      cam.scale = 1.03;
      break;
    case 'tilt-up':
      cam.y = span * 0.03 * k;
      cam.scale = 1.03;
      break;
    case 'tilt-down':
      cam.y = -span * 0.03 * k;
      cam.scale = 1.03;
      break;
    case 'orbit':
      cam.yaw = span * 0.3 * k;
      cam.x = -span * 0.012 * k;
      cam.scale = lerp(1.02, 1.07, p);
      break;
    case 'drift':
      cam.scale = lerp(1.02, 1 + 0.06 * k, p);
      cam.x = noise1(seed, timeSec * 0.22) * 0.012 * k;
      cam.y = noise1(seed + 7, timeSec * 0.19) * 0.009 * k;
      break;
  }

  // handheld micro-drift: barely visible, but it keeps locked-off moves from feeling synthetic
  cam.x += noise1(seed + 101, timeSec * 0.55) * 0.0018 * k;
  cam.y += noise1(seed + 202, timeSec * 0.5) * 0.0015 * k;
  cam.rotate = noise1(seed + 303, timeSec * 0.3) * 0.12 * k;
  return cam;
}

export interface LayerTransform {
  translateX: number;
  translateY: number;
  scale: number;
  rotate: number;
}

/** Pixel transform for a layer at `depth` (0 = infinitely far, 1 = subject plane, >1 = foreground). */
export function layerTransform(cam: CameraState, depth: number, width: number, height: number): LayerTransform {
  return {
    translateX: cam.x * depth * width,
    translateY: cam.y * depth * height,
    scale: 1 + (cam.scale - 1) * depth,
    rotate: cam.rotate * depth,
  };
}
