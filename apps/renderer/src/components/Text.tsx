import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { TextOverlay } from '@nero/schemas';
import { easeOutCubic, easeOutExpo, hash, progress, rgba } from '../math';
import { SAFE, fonts, palette } from '../theme';
import { NeonLine } from './Lighting';

const GLOW = `0 0 2px ${rgba(palette.electric, 0.55)}, 0 0 26px ${rgba(palette.violet, 0.6)}, 0 0 70px ${rgba(palette.blue, 0.3)}`;

/** Text that focuses in letter by letter: each glyph rises, sharpens and fades up on a stagger. */
export const RevealText: React.FC<{ text: string; startFrame: number; style?: React.CSSProperties; perChar?: number }> = ({
  text,
  startFrame,
  style,
  perChar,
}) => {
  const frame = useCurrentFrame();
  const total = text.replace(/\s/g, '').length;
  // long lines reveal faster per glyph so the whole line always lands in under a second
  const step = perChar ?? Math.min(1.5, 24 / Math.max(1, total));
  let n = 0;
  return (
    <span style={style}>
      {text.split(' ').map((word, w) => (
        <span key={w} style={{ display: 'inline-block', whiteSpace: 'nowrap', marginRight: '0.28em' }}>
          {Array.from(word).map((ch, c) => {
            const e = easeOutCubic(progress(frame, startFrame + n * step, startFrame + n * step + 15));
            n++;
            return (
              <span
                key={c}
                style={{
                  display: 'inline-block',
                  opacity: e,
                  transform: `translateY(${((1 - e) * 0.42).toFixed(4)}em)`,
                  filter: e < 1 ? `blur(${((1 - e) * 9).toFixed(2)}px)` : undefined,
                }}
              >
                {ch}
              </span>
            );
          })}
        </span>
      ))}
    </span>
  );
};

const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVXZ0123456789#/<>';

/** Text that "decodes": glyphs cycle through noise and lock in from left to right. */
export const DecodeText: React.FC<{ text: string; startFrame: number; durationFrames?: number; style?: React.CSSProperties }> = ({
  text,
  startFrame,
  durationFrames = 22,
  style,
}) => {
  const frame = useCurrentFrame();
  const p = progress(frame, startFrame, startFrame + durationFrames);
  const locked = Math.floor(p * text.length);
  const shown = Array.from(text)
    .map((ch, i) => {
      if (i < locked || ch === ' ') return ch;
      if (i > locked + 3) return ' ';
      return GLYPHS[Math.floor(hash(i * 31 + 7, Math.floor(frame / 2)) * GLYPHS.length)];
    })
    .join('');
  return <span style={{ whiteSpace: 'pre', opacity: p > 0 ? 1 : 0, ...style }}>{shown}</span>;
};

const OverlayItem: React.FC<{ overlay: TextOverlay; start: number }> = ({ overlay, start }) => {
  const frame = useCurrentFrame();
  const line = easeOutExpo(progress(frame, start + 4, start + 30));
  const base: React.CSSProperties = { fontFamily: fonts.display, color: palette.text };

  switch (overlay.style) {
    case 'title':
      return (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: `0 ${SAFE * 150}%` }}>
          <RevealText
            text={overlay.text}
            startFrame={start}
            style={{ ...base, fontSize: 98, fontWeight: 600, lineHeight: 1.1, letterSpacing: '0.015em', textAlign: 'center', textShadow: GLOW }}
          />
          <NeonLine width={360} grow={line} style={{ marginTop: 38 }} />
        </AbsoluteFill>
      );
    case 'quote':
      return (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: `0 ${SAFE * 200}%` }}>
          <NeonLine width={120} grow={line} thickness={1.5} style={{ marginBottom: 34 }} />
          <RevealText
            text={overlay.text}
            startFrame={start}
            style={{ ...base, fontSize: 64, fontWeight: 400, lineHeight: 1.22, textAlign: 'center', textShadow: GLOW }}
          />
        </AbsoluteFill>
      );
    case 'lower-third':
      return (
        <div style={{ position: 'absolute', left: `${SAFE * 100}%`, bottom: '11.5%', maxWidth: '62%', display: 'flex', alignItems: 'stretch' }}>
          <div
            style={{
              width: 3,
              marginRight: 26,
              transform: `scaleY(${line.toFixed(4)})`,
              background: `linear-gradient(180deg, ${palette.electric}, ${palette.violet})`,
              boxShadow: `0 0 16px ${rgba(palette.blue, 0.8)}`,
            }}
          />
          <RevealText
            text={overlay.text}
            startFrame={start}
            style={{ ...base, fontSize: 44, fontWeight: 500, lineHeight: 1.25, textShadow: `0 2px 24px ${rgba(palette.void, 0.9)}, ${GLOW}` }}
          />
        </div>
      );
    case 'tag':
      return (
        <div style={{ position: 'absolute', left: `${SAFE * 100}%`, top: '9.5%', display: 'flex', alignItems: 'center' }}>
          <div
            style={{
              width: 9,
              height: 9,
              marginRight: 18,
              background: palette.violet,
              boxShadow: `0 0 12px ${palette.violet}`,
              opacity: progress(frame, start, start + 6),
            }}
          />
          <DecodeText
            text={overlay.text.toUpperCase()}
            startFrame={start}
            style={{ fontFamily: fonts.mono, fontSize: 21, fontWeight: 500, letterSpacing: '0.34em', color: palette.electric }}
          />
        </div>
      );
    case 'stat':
      return (
        <div style={{ position: 'absolute', right: `${SAFE * 100}%`, top: '34%', textAlign: 'right' }}>
          <RevealText text={overlay.text} startFrame={start} style={{ ...base, fontSize: 150, fontWeight: 700, color: palette.electric, textShadow: GLOW }} />
        </div>
      );
    case 'caption':
      return (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: '7.5%', textAlign: 'center' }}>
          <RevealText text={overlay.text} startFrame={start} style={{ ...base, fontSize: 30, fontWeight: 400, color: palette.textDim, letterSpacing: '0.04em' }} />
        </div>
      );
  }
};

/** Renders a scene's text overlays at their cue times and clears them before the scene hands over. */
export const TextOverlays: React.FC<{ overlays: TextOverlay[]; durationInFrames: number }> = ({ overlays, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const out = 1 - progress(frame, durationInFrames - 12, durationInFrames - 2);
  return (
    <AbsoluteFill style={{ opacity: out }}>
      {overlays.map((o, i) => (
        <OverlayItem key={i} overlay={o} start={Math.round((o.atSec ?? 0.4) * fps)} />
      ))}
    </AbsoluteFill>
  );
};
