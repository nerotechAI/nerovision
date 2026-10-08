import React, { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { fract, lerp, rng } from '../math';
import { palette } from '../theme';
import { useCamera } from './CameraRig';
import { drawGlow, useCanvas } from './canvas';

interface Particle {
  x: number;
  y: number;
  z: number;
  radius: number;
  phase: number;
  twinkle: number;
  vx: number;
  vy: number;
  color: string;
}

const DEFAULT_COLORS = [palette.violet, palette.violet, palette.blue, palette.electric, palette.violetSoft];

/**
 * Volumetric dust. Each particle has its own depth, so the camera produces true parallax inside
 * the field; particles in front of the subject plane (z > 1) defocus into large, faint bokeh.
 */
export const ParticleField: React.FC<{
  seed: number;
  count?: number;
  /** depth range; values above 1 sit in front of the subject */
  zRange?: [number, number];
  /** drift speed multiplier */
  speed?: number;
  opacity?: number;
  colors?: string[];
}> = ({ seed, count = 140, zRange = [0.15, 1], speed = 1, opacity = 1, colors = DEFAULT_COLORS }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const cam = useCamera();

  const particles = useMemo<Particle[]>(() => {
    const r = rng(seed);
    return Array.from({ length: count }, () => {
      const z = lerp(zRange[0], zRange[1], Math.pow(r(), 1.6));
      return {
        x: r(),
        y: r(),
        z,
        radius: lerp(1.2, 3.4, r()),
        phase: r() * Math.PI * 2,
        twinkle: lerp(0.4, 1.5, r()),
        vx: (r() - 0.5) * 0.012,
        vy: -lerp(0.004, 0.02, r()),
        color: colors[Math.floor(r() * colors.length)],
      };
    });
  }, [seed, count, zRange[0], zRange[1], colors]);

  const ref = useCanvas(
    (ctx, w, h) => {
      const t = frame / fps;
      const margin = 0.12;
      const span = 1 + margin * 2;
      ctx.globalCompositeOperation = 'lighter';
      for (const p of particles) {
        const u = fract(p.x + p.vx * t * speed * p.z + cam.x * p.z + 4) * span - margin;
        const v = fract(p.y + p.vy * t * speed * p.z + cam.y * p.z + 4) * span - margin;
        const zoom = 1 + (cam.scale - 1) * p.z;
        const sx = w / 2 + (u * w - w / 2) * zoom;
        const sy = h / 2 + (v * h - h / 2) * zoom;
        const defocus = Math.max(0, p.z - 1);
        const radius = p.radius * (0.5 + p.z) * (1 + defocus * 9) * 3.2;
        const flicker = 0.55 + 0.45 * Math.sin(p.phase + t * p.twinkle);
        const alpha = opacity * flicker * lerp(0.35, 0.95, Math.min(1, p.z)) / (1 + defocus * 5);
        drawGlow(ctx, p.color, sx, sy, radius, alpha);
      }
    },
    [frame, particles, cam, speed, opacity, fps],
  );

  return <canvas ref={ref} width={width} height={height} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />;
};
