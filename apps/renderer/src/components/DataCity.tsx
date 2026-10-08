import React from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { lerp, mixHex, rgba, rng } from '../math';
import { palette } from '../theme';
import { Layer } from './CameraRig';
import { drawGlow, useCanvas } from './canvas';
import { LightOrb } from './Lighting';

interface Plane {
  depth: number;
  towers: number;
  /** tower height range as a fraction of the frame height */
  heights: [number, number];
  /** tower width range in px at 1080p */
  widths: [number, number];
  /** 0 = pure silhouette, 1 = fully dissolved into the haze */
  haze: number;
  lit: number;
  blur: number;
}

const PLANES: Plane[] = [
  { depth: 0.22, towers: 30, heights: [0.2, 0.46], widths: [46, 110], haze: 0.62, lit: 0.1, blur: 0 },
  { depth: 0.5, towers: 18, heights: [0.3, 0.62], widths: [80, 170], haze: 0.34, lit: 0.16, blur: 0 },
  { depth: 0.95, towers: 10, heights: [0.4, 0.8], widths: [130, 250], haze: 0.12, lit: 0.2, blur: 0 },
  // out-of-focus pillars right in front of the lens sell the depth more than anything else
  { depth: 1.7, towers: 2, heights: [0.9, 1.0], widths: [110, 190], haze: 0, lit: 0, blur: 9 },
];

/** Canvas overscan on each side, so camera pans never reveal an edge. */
const OVERSCAN = 0.22;

/** One depth plane of the city. Static, so it is painted once and only transformed afterwards. */
const TowerPlane: React.FC<{ plane: Plane; seed: number }> = ({ plane, seed }) => {
  const { width, height } = useVideoConfig();
  const cw = Math.round(width * (1 + OVERSCAN * 2));
  const ref = useCanvas(
    (ctx, w, h) => {
      const r = rng(seed);
      const unit = h / 1080;
      const scale = lerp(0.6, 1, Math.min(1, plane.depth));
      if (plane.blur) ctx.filter = `blur(${plane.blur * unit}px)`;
      for (let i = 0; i < plane.towers; i++) {
        const tw = lerp(plane.widths[0], plane.widths[1], r()) * unit;
        const th = lerp(plane.heights[0], plane.heights[1], r()) * h;
        const x = ((i + 0.15 + r() * 0.7) / plane.towers) * w - tw / 2;
        const y = h - th;
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        // lit from behind and above: the crown catches the glow, the base sinks into the haze
        const body = ctx.createLinearGradient(0, y, 0, h);
        body.addColorStop(0, mixHex(palette.void, '#2a2260', plane.haze + 0.08));
        body.addColorStop(1, mixHex(palette.void, '#120e2c', plane.haze));
        ctx.fillStyle = body;
        ctx.fillRect(x, y, tw, th + 2);
        // a narrower crown breaks the box silhouette on roughly half of the towers
        const crown = r() > 0.5 ? tw * lerp(0.35, 0.7, r()) : 0;
        const crownH = crown ? lerp(20, 90, r()) * unit : 0;
        if (crown) ctx.fillRect(x + (tw - crown) / 2, y - crownH, crown, crownH + 1);
        const antenna = r() > 0.6;
        if (antenna) ctx.fillRect(x + tw / 2 - unit, y - crownH - 70 * unit, 2 * unit, 70 * unit);

        // rim light from the glow behind the skyline
        ctx.fillStyle = rgba(palette.violetSoft, lerp(0.22, 0.05, plane.haze));
        ctx.fillRect(x, y, 1.5 * unit, th);

        if (plane.lit > 0) {
          // lit storeys are drawn as broken horizontal data lines rather than window dots:
          // it reads as server architecture, not as an office skyline
          const rowH = 13 * unit * scale;
          const pad = 9 * unit * scale;
          const rows = Math.floor((th - rowH) / rowH);
          for (let row = 1; row < rows; row++) {
            if (r() > plane.lit * 2.2) continue;
            const start = r() * 0.6;
            const len = lerp(0.12, 1 - start, r());
            const tone = r();
            ctx.fillStyle = rgba(tone < 0.55 ? palette.violet : palette.electric, lerp(0.6, 0.22, plane.haze) * lerp(0.3, 1, r()));
            ctx.fillRect(x + pad + start * (tw - pad * 2), y + row * rowH, len * (tw - pad * 2), 1.6 * unit * scale);
            if (r() < 0.22) {
              ctx.fillStyle = rgba(palette.text, lerp(0.9, 0.4, plane.haze));
              ctx.fillRect(x + pad + r() * (tw - pad * 2), y + row * rowH - unit, 3 * unit * scale, 3 * unit * scale);
            }
          }
          if (r() > 0.55) {
            // a vertical neon seam, capped with a beacon
            const sx = x + tw * lerp(0.2, 0.8, r());
            ctx.fillStyle = rgba(palette.electric, lerp(0.7, 0.25, plane.haze));
            ctx.fillRect(sx, y + 6 * unit, 2 * unit, th * lerp(0.3, 0.7, r()));
            ctx.globalCompositeOperation = 'lighter';
            drawGlow(ctx, palette.electric, sx + unit, y + 6 * unit, 26 * unit, lerp(0.8, 0.3, plane.haze));
          }
          if (antenna) {
            ctx.globalCompositeOperation = 'lighter';
            drawGlow(ctx, palette.violet, x + tw / 2, y - crownH - 70 * unit, 20 * unit, 0.9);
          }
        } else {
          // foreground pillars carry a single hard neon edge
          ctx.fillStyle = rgba(palette.violet, 0.38);
          ctx.fillRect(x + tw - 5 * unit, y, 4 * unit, th);
        }
      }
    },
    [seed, plane, width, height],
  );
  return (
    <canvas
      ref={ref}
      width={cw}
      height={height}
      style={{ position: 'absolute', left: `${-OVERSCAN * 100}%`, top: 0, width: `${(1 + OVERSCAN * 2) * 100}%`, height: '100%' }}
    />
  );
};

const Haze: React.FC<{ color: string; alpha: number; top: number }> = ({ color, alpha, top }) => (
  <div
    style={{
      position: 'absolute',
      left: '-25%',
      right: '-25%',
      top: `${top * 100}%`,
      bottom: '-5%',
      background: `linear-gradient(180deg, ${rgba(color, 0)} 0%, ${rgba(color, alpha)} 70%, ${rgba(color, alpha * 0.6)} 100%)`,
      mixBlendMode: 'screen',
    }}
  />
);

/** A layered skyline of data towers: four depth planes separated by haze and backlit by one large glow. */
export const DataCity: React.FC<{ seed: number }> = ({ seed }) => (
  <AbsoluteFill>
    <Layer depth={0.1}>
      <LightOrb x={0.58} y={0.6} size={0.85} color={palette.violet} strength={1.5} seed={seed} />
      <LightOrb x={0.4} y={0.74} size={0.6} color={palette.blue} strength={1} seed={seed + 1} />
    </Layer>
    {PLANES.map((plane, i) => (
      <Layer key={i} depth={plane.depth}>
        <TowerPlane plane={plane} seed={seed + i * 97} />
        {i < 3 && <Haze color={i === 0 ? palette.violet : palette.blue} alpha={0.2 - i * 0.05} top={0.5 + i * 0.1} />}
      </Layer>
    ))}
  </AbsoluteFill>
);
