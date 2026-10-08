import React, { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { OverlayEffect } from '@nero/schemas';
import { fract, hash, noise1, rgba, rng } from '../math';
import { SAFE, fonts, palette } from '../theme';

/** One seeded noise tile, shifted to a new offset every frame. Far cheaper than an SVG turbulence filter. */
function useGrainTile(): string {
  return useMemo(() => {
    const size = 256;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(size, size);
    const r = rng(90210);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = r() > 0.5 ? 255 : 0;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = r() * 255;
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL('image/png');
  }, []);
}

/** Film grain. Besides the look, it dithers the dark gradients so H.264 does not band them. */
const Grain: React.FC<{ strength: number }> = ({ strength }) => {
  const frame = useCurrentFrame();
  const tile = useGrainTile();
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url(${tile})`,
        backgroundPosition: `${Math.floor(hash(11, frame) * 256)}px ${Math.floor(hash(13, frame) * 256)}px`,
        opacity: 0.055 * strength,
      }}
    />
  );
};

const Vignette: React.FC = () => (
  <AbsoluteFill style={{ background: `radial-gradient(120% 100% at 50% 50%, rgba(0,0,0,0) 42%, rgba(0,0,0,0.5) 82%, rgba(0,0,0,0.82) 100%)` }} />
);

const Scanlines: React.FC<{ strength: number }> = ({ strength }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.9) 0px, rgba(0,0,0,0.9) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) 4px)',
        backgroundPositionY: (frame * 0.5) % 4,
        opacity: 0.16 * strength,
      }}
    />
  );
};

const Fog: React.FC<{ seed: number; strength: number }> = ({ seed, strength }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const x1 = 30 + t * 2.4 + noise1(seed, t * 0.2) * 4;
  const x2 = 70 - t * 1.8 + noise1(seed + 5, t * 0.2) * 4;
  return (
    <AbsoluteFill
      style={{
        background: [
          `radial-gradient(55% 22% at ${x1}% 74%, ${rgba(palette.violet, 0.2 * strength)} 0%, ${rgba(palette.violet, 0)} 100%)`,
          `radial-gradient(60% 20% at ${x2}% 86%, ${rgba(palette.blue, 0.18 * strength)} 0%, ${rgba(palette.blue, 0)} 100%)`,
        ].join(', '),
        mixBlendMode: 'screen',
      }}
    />
  );
};

/** A soft diagonal band of light crossing the frame once per shot. */
const LightLeak: React.FC<{ strength: number; totalFrames: number }> = ({ strength, totalFrames }) => {
  const frame = useCurrentFrame();
  const x = -40 + (frame / Math.max(1, totalFrames)) * 180;
  return (
    <AbsoluteFill
      style={{
        // one hue and a symmetric falloff: a hue change inside the band reads as a hard seam
        background: `linear-gradient(105deg, ${rgba(palette.violetSoft, 0)} ${x - 34}%, ${rgba(palette.violetSoft, 0.05 * strength)} ${x - 14}%, ${rgba(palette.violetSoft, 0.085 * strength)} ${x}%, ${rgba(palette.violetSoft, 0.05 * strength)} ${x + 14}%, ${rgba(palette.violetSoft, 0)} ${x + 34}%)`,
        mixBlendMode: 'screen',
      }}
    />
  );
};

/** Sparse signal dropouts: a few thin bars for two or three frames, a couple of times per shot. */
const Glitch: React.FC<{ seed: number; strength: number }> = ({ seed, strength }) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const burst = Math.floor(frame / 3);
  if (hash(seed, burst) > 0.07 * strength) return null;
  return (
    <AbsoluteFill>
      {[0, 1, 2].map((i) => {
        const y = hash(seed + i * 17, burst) * height;
        const h = 2 + hash(seed + i * 31, burst) * 9;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${hash(seed + i * 5, burst) * 40}%`,
              width: `${30 + hash(seed + i * 7, burst) * 50}%`,
              top: y,
              height: h,
              background: rgba(i === 1 ? palette.violet : palette.electric, 0.22),
              mixBlendMode: 'screen',
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const HEX = '0123456789ABCDEF';

/** A narrow column of scrolling hex along the right edge. */
const DataStream: React.FC<{ seed: number }> = ({ seed }) => {
  const frame = useCurrentFrame();
  const rows = 26;
  const scroll = Math.floor(frame / 4);
  return (
    <div
      style={{
        position: 'absolute',
        right: `${SAFE * 100}%`,
        top: '18%',
        fontFamily: fonts.mono,
        fontSize: 15,
        lineHeight: '25px',
        letterSpacing: '0.18em',
        color: palette.electric,
        textAlign: 'right',
        maskImage: 'linear-gradient(180deg, transparent 0%, black 25%, black 75%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, black 25%, black 75%, transparent 100%)',
      }}
    >
      {Array.from({ length: rows }, (_, i) => {
        const row = i + scroll;
        const word = Array.from({ length: 8 }, (_, k) => HEX[Math.floor(hash(seed + row * 8 + k, 3) * 16)]).join('');
        return (
          <div key={i} style={{ opacity: 0.12 + hash(seed, row) * 0.3 }}>
            {word}
          </div>
        );
      })}
    </div>
  );
};

const Bracket: React.FC<{ corner: 'tl' | 'tr' | 'bl' | 'br' }> = ({ corner }) => {
  const m = `${SAFE * 55}%`;
  const size = 34;
  const line = `1.5px solid ${rgba(palette.electric, 0.55)}`;
  const top = corner[0] === 't';
  const left = corner[1] === 'l';
  return (
    <div
      style={{
        position: 'absolute',
        width: size,
        height: size,
        [top ? 'top' : 'bottom']: m,
        [left ? 'left' : 'right']: m,
        [top ? 'borderTop' : 'borderBottom']: line,
        [left ? 'borderLeft' : 'borderRight']: line,
      }}
    />
  );
};

/** Viewfinder furniture: corner brackets and a running timecode. */
const HudFrame: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pad = (n: number) => String(n).padStart(2, '0');
  const tc = `${pad(Math.floor(frame / fps / 60))}:${pad(Math.floor(frame / fps) % 60)}:${pad(frame % fps)}`;
  const label: React.CSSProperties = {
    position: 'absolute',
    fontFamily: fonts.mono,
    fontSize: 15,
    letterSpacing: '0.22em',
    color: rgba(palette.electric, 0.6),
  };
  return (
    <AbsoluteFill>
      {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
        <Bracket key={c} corner={c} />
      ))}
      <div style={{ ...label, right: `${SAFE * 100}%`, top: `${SAFE * 78}%` }}>NVS · {tc}</div>
      <div style={{ ...label, right: `${SAFE * 100}%`, bottom: `${SAFE * 78}%`, opacity: 0.55 + 0.45 * Math.round(fract(frame / fps)) }}>● SINAL</div>
    </AbsoluteFill>
  );
};

/** Finishing pass applied over a shot, outside the camera so it stays locked to the lens. */
export const Overlays: React.FC<{ effects: OverlayEffect[]; seed: number; strength: number; totalFrames: number }> = ({
  effects,
  seed,
  strength,
  totalFrames,
}) => {
  const on = (e: OverlayEffect) => effects.includes(e);
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {on('fog') && <Fog seed={seed} strength={strength} />}
      {on('light-leak') && <LightLeak strength={strength} totalFrames={totalFrames} />}
      {on('data-stream') && <DataStream seed={seed} />}
      {on('hud-frame') && <HudFrame />}
      {on('glitch') && <Glitch seed={seed} strength={strength} />}
      {on('scanlines') && <Scanlines strength={strength} />}
      {on('vignette') && <Vignette />}
      {on('grain') && <Grain strength={strength} />}
    </AbsoluteFill>
  );
};
