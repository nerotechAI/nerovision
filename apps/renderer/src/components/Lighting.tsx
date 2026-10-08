import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { noise1, rgba } from '../math';
import { palette } from '../theme';
import { Layer } from './CameraRig';

/** A neon light source: an additive radial falloff that breathes slowly. Positions are 0..1 of the frame. */
export const LightOrb: React.FC<{ x: number; y: number; size: number; color: string; strength?: number; seed?: number }> = ({
  x,
  y,
  size,
  color,
  strength = 1,
  seed = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const breathe = 0.85 + 0.15 * noise1(seed, (frame / fps) * 0.4);
  const d = size * width;
  return (
    <div
      style={{
        position: 'absolute',
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        width: d,
        height: d,
        marginLeft: -d / 2,
        marginTop: -d / 2,
        background: `radial-gradient(closest-side, ${rgba(color, 0.5 * strength * breathe)} 0%, ${rgba(color, 0.16 * strength * breathe)} 38%, ${rgba(color, 0)} 100%)`,
        mixBlendMode: 'screen',
      }}
    />
  );
};

/** Deep-space base plate: near-black with two coloured light pools, placed far behind everything. */
export const Backdrop: React.FC<{ seed: number; strength?: number; key1?: string; key2?: string }> = ({
  seed,
  strength = 1,
  key1 = palette.violetDeep,
  key2 = palette.blue,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const ax = 24 + noise1(seed, t * 0.12) * 6;
  const ay = 30 + noise1(seed + 1, t * 0.1) * 5;
  const bx = 78 + noise1(seed + 2, t * 0.11) * 6;
  const by = 72 + noise1(seed + 3, t * 0.09) * 5;
  return (
    <AbsoluteFill style={{ backgroundColor: palette.void }}>
      <Layer depth={0.12}>
        <div
          style={{
            position: 'absolute',
            inset: '-12%',
            background: [
              `radial-gradient(42% 46% at ${ax}% ${ay}%, ${rgba(key1, 0.42 * strength)} 0%, ${rgba(key1, 0)} 100%)`,
              `radial-gradient(40% 44% at ${bx}% ${by}%, ${rgba(key2, 0.3 * strength)} 0%, ${rgba(key2, 0)} 100%)`,
              `linear-gradient(180deg, ${palette.void} 0%, ${palette.ink} 55%, ${palette.void} 100%)`,
            ].join(', '),
          }}
        />
      </Layer>
    </AbsoluteFill>
  );
};

/** A hairline of light with a soft halo, grown from its centre. `grow` is 0..1. */
export const NeonLine: React.FC<{ width: number; grow: number; thickness?: number; style?: React.CSSProperties }> = ({
  width,
  grow,
  thickness = 2,
  style,
}) => (
  <div
    style={{
      width,
      height: thickness,
      transform: `scaleX(${grow.toFixed(4)})`,
      background: `linear-gradient(90deg, ${rgba(palette.violet, 0)} 0%, ${palette.violet} 22%, ${palette.electric} 78%, ${rgba(palette.electric, 0)} 100%)`,
      boxShadow: `0 0 14px ${rgba(palette.violet, 0.75)}, 0 0 36px ${rgba(palette.blue, 0.45)}`,
      opacity: Math.min(1, grow * 3),
      ...style,
    }}
  />
);
