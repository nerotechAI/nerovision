import React, { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { easeOutCubic, easeOutExpo, hash, noise1, progress, rgba } from '../math';
import { fonts, palette } from '../theme';
import { DecodeText } from './Text';

/** Projection instability: a steady shimmer plus a rare, brief dropout. */
function useFlicker(seed: number): number {
  const frame = useCurrentFrame();
  const shimmer = 0.94 + 0.06 * noise1(seed, frame * 0.35);
  const dropout = hash(seed + 99, Math.floor(frame / 2)) < 0.025 ? 0.72 : 1;
  return shimmer * dropout;
}

/** A floating glass panel. It opens from a horizontal seam, then holds with a slow scan bar. */
export const HoloPanel: React.FC<{
  title: string;
  appearAt: number;
  seed: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ title, appearAt, seed, style, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const open = easeOutExpo(progress(frame, appearAt, appearAt + 18));
  const content = progress(frame, appearAt + 10, appearAt + 22);
  const flicker = useFlicker(seed);
  const scan = ((frame / fps) * 0.3 + hash(seed, 1)) % 1;
  if (open <= 0) return null;
  return (
    <div
      style={{
        position: 'absolute',
        transform: `scaleY(${Math.max(0.004, open).toFixed(4)})`,
        opacity: flicker * Math.min(1, open * 4),
        background: `linear-gradient(160deg, ${rgba(palette.violet, 0.13)} 0%, ${rgba(palette.blue, 0.05)} 60%, ${rgba(palette.electric, 0.08)} 100%)`,
        border: `1px solid ${rgba(palette.electric, 0.42)}`,
        boxShadow: `0 0 28px ${rgba(palette.blue, 0.28)}, inset 0 0 46px ${rgba(palette.violet, 0.14)}`,
        overflow: 'hidden',
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `repeating-linear-gradient(0deg, ${rgba(palette.electric, 0.07)} 0px, ${rgba(palette.electric, 0.07)} 1px, transparent 1px, transparent 5px)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: `${scan * 120 - 10}%`,
          height: 70,
          background: `linear-gradient(180deg, transparent, ${rgba(palette.electric, 0.1)}, transparent)`,
        }}
      />
      <div style={{ position: 'relative', padding: '26px 30px', opacity: content }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            fontFamily: fonts.mono,
            fontSize: 15,
            letterSpacing: '0.3em',
            color: palette.electric,
            paddingBottom: 16,
            marginBottom: 22,
            borderBottom: `1px solid ${rgba(palette.electric, 0.25)}`,
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: 7, marginRight: 14, background: palette.violet, boxShadow: `0 0 10px ${palette.violet}` }} />
          {title}
        </div>
        {children}
      </div>
    </div>
  );
};

export const Readout: React.FC<{ label: string; value: string; appearAt: number }> = ({ label, value, appearAt }) => {
  const frame = useCurrentFrame();
  const e = easeOutCubic(progress(frame, appearAt, appearAt + 12));
  return (
    <div style={{ marginBottom: 24, opacity: e, transform: `translateX(${((1 - e) * -14).toFixed(2)}px)` }}>
      <div style={{ fontFamily: fonts.mono, fontSize: 14, letterSpacing: '0.26em', color: palette.textDim, marginBottom: 6 }}>{label.toUpperCase()}</div>
      <DecodeText
        text={value}
        startFrame={appearAt + 3}
        durationFrames={16}
        style={{ fontFamily: fonts.display, fontSize: 36, fontWeight: 600, color: palette.text, textShadow: `0 0 18px ${rgba(palette.violet, 0.7)}` }}
      />
    </div>
  );
};

/** A scrolling activity trace built from seeded sines; decorative, it encodes no data. */
export const SignalTrace: React.FC<{ seed: number; width: number; height: number; appearAt: number }> = ({ seed, width, height, appearAt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const drawn = easeOutCubic(progress(frame, appearAt, appearAt + 30));
  const points = 90;
  const d = Array.from({ length: Math.max(2, Math.floor(points * drawn)) }, (_, i) => {
    const u = i / (points - 1);
    const s = u * 9 + t * 1.6;
    const y = Math.sin(s * 1.3) * 0.34 + Math.sin(s * 3.1 + 1) * 0.2 + noise1(seed, s * 2.4) * 0.3;
    return `${i === 0 ? 'M' : 'L'}${(u * width).toFixed(1)},${(height / 2 - y * height * 0.5).toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      <line x1={0} x2={width} y1={height / 2} y2={height / 2} stroke={rgba(palette.electric, 0.18)} strokeDasharray="2 8" />
      <path d={d} fill="none" stroke={rgba(palette.blue, 0.3)} strokeWidth={7} strokeLinejoin="round" />
      <path d={d} fill="none" stroke={palette.electric} strokeWidth={1.8} strokeLinejoin="round" />
    </svg>
  );
};

export const LevelBars: React.FC<{ seed: number; count: number; height: number; appearAt: number }> = ({ seed, count, height, appearAt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7, height }}>
      {Array.from({ length: count }, (_, i) => {
        const grow = easeOutCubic(progress(frame, appearAt + i * 1.2, appearAt + i * 1.2 + 14));
        const level = 0.25 + 0.75 * (0.5 + 0.5 * noise1(seed + i * 13, (frame / fps) * 1.3));
        return (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${level * grow * 100}%`,
              background: `linear-gradient(180deg, ${palette.electric}, ${rgba(palette.violet, 0.35)})`,
              opacity: 0.85,
            }}
          />
        );
      })}
    </div>
  );
};

type Segment = [number, number, number, number];

/** A wireframe sphere, rotated in 3D and projected each frame; the far hemisphere is drawn dimmer. */
export const WireSphere: React.FC<{ radius: number; yaw: number; appearAt: number }> = ({ radius, yaw, appearAt }) => {
  const frame = useCurrentFrame();
  const born = easeOutExpo(progress(frame, appearAt, appearAt + 26));

  const curves = useMemo(() => {
    const steps = 40;
    const out: [number, number, number][][] = [];
    for (let m = 0; m < 8; m++) {
      const a = (m / 8) * Math.PI;
      out.push(Array.from({ length: steps + 1 }, (_, i) => {
        const b = (i / steps) * Math.PI * 2;
        return [Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a)];
      }));
    }
    for (const lat of [-60, -30, 0, 30, 60]) {
      const y = Math.sin((lat * Math.PI) / 180);
      const r = Math.cos((lat * Math.PI) / 180);
      out.push(Array.from({ length: steps + 1 }, (_, i) => {
        const b = (i / steps) * Math.PI * 2;
        return [Math.cos(b) * r, y, Math.sin(b) * r];
      }));
    }
    return out;
  }, []);

  const tilt = 0.36;
  const [cy, sy, ct, st] = [Math.cos(yaw), Math.sin(yaw), Math.cos(tilt), Math.sin(tilt)];
  const project = ([x, y, z]: [number, number, number]): [number, number, number] => {
    const x1 = x * cy + z * sy;
    const z1 = -x * sy + z * cy;
    return [x1 * radius, (y * ct - z1 * st) * radius, y * st + z1 * ct];
  };

  const front: Segment[] = [];
  const back: Segment[] = [];
  for (const curve of curves) {
    const pts = curve.map(project);
    for (let i = 0; i < pts.length - 1; i++) {
      const seg: Segment = [pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]];
      (pts[i][2] + pts[i + 1][2] < 0 ? front : back).push(seg);
    }
  }
  const path = (segs: Segment[]) => segs.map(([a, b, c, d]) => `M${a.toFixed(1)},${b.toFixed(1)}L${c.toFixed(1)},${d.toFixed(1)}`).join('');
  const size = radius * 2 + 40;

  return (
    <svg width={size} height={size} viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`} style={{ overflow: 'visible', opacity: born, transform: `scale(${(0.7 + 0.3 * born).toFixed(4)})` }}>
      <circle r={radius * 1.02} fill={rgba(palette.violetDeep, 0.16)} />
      <path d={path(back)} stroke={rgba(palette.violet, 0.22)} strokeWidth={1} fill="none" />
      <path d={path(front)} stroke={rgba(palette.blue, 0.35)} strokeWidth={4} fill="none" />
      <path d={path(front)} stroke={palette.electric} strokeWidth={1.2} fill="none" />
    </svg>
  );
};

/** Instrument rings around a subject: counter-rotating dashed tracks, a tick scale and a sweeping gauge. */
export const HoloRings: React.FC<{ radius: number; appearAt: number }> = ({ radius, appearAt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const born = easeOutExpo(progress(frame, appearAt, appearAt + 30));
  const gauge = easeOutCubic(progress(frame, appearAt + 12, appearAt + 60));
  const size = radius * 2 + 80;
  const r3 = radius * 0.86;
  const circ = 2 * Math.PI * r3;
  return (
    <svg width={size} height={size} viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`} style={{ overflow: 'visible', opacity: born }}>
      <g transform={`rotate(${t * 9})`}>
        <circle r={radius} fill="none" stroke={rgba(palette.electric, 0.5)} strokeWidth={1.2} strokeDasharray="2 14" />
      </g>
      <g transform={`rotate(${-t * 5})`}>
        <circle r={radius * 0.93} fill="none" stroke={rgba(palette.violet, 0.55)} strokeWidth={1.5} strokeDasharray={`${radius * 0.9} ${radius * 0.5}`} />
      </g>
      <g transform="rotate(-90)">
        <circle r={r3} fill="none" stroke={rgba(palette.electric, 0.12)} strokeWidth={5} />
        <circle r={r3} fill="none" stroke={palette.electric} strokeWidth={5} strokeDasharray={`${circ * 0.62 * gauge} ${circ}`} />
      </g>
      {Array.from({ length: 72 }, (_, i) => {
        const a = (i / 72) * Math.PI * 2;
        const len = i % 6 === 0 ? 14 : 6;
        const r1 = radius * 1.07;
        return (
          <line
            key={i}
            x1={Math.cos(a) * r1}
            y1={Math.sin(a) * r1}
            x2={Math.cos(a) * (r1 + len * born)}
            y2={Math.sin(a) * (r1 + len * born)}
            stroke={rgba(palette.violetSoft, i % 6 === 0 ? 0.6 : 0.28)}
            strokeWidth={1}
          />
        );
      })}
    </svg>
  );
};
