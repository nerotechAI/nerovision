import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import type { TransitionType } from '@nero/schemas';
import { hash, rgba } from '../math';
import { palette } from '../theme';
import { transitionProgress, transitionState } from '../transitions';

/** Composites an incoming scene over whatever is underneath, for the first `frames` of its life. */
export const TransitionIn: React.FC<{ type: TransitionType; frames: number; seed: number; children: React.ReactNode }> = ({
  type,
  frames,
  seed,
  children,
}) => {
  const frame = useCurrentFrame();
  const s = transitionState(type, transitionProgress(frame, frames), frame, seed);
  return (
    <AbsoluteFill>
      {s.black > 0 && <AbsoluteFill style={{ backgroundColor: '#000', opacity: s.black }} />}
      <AbsoluteFill
        style={{
          opacity: s.opacity,
          transform: s.offsetX ? `translateX(${s.offsetX.toFixed(2)}px)` : undefined,
          clipPath: s.clipRight > 0 ? `inset(0 ${(s.clipRight * 100).toFixed(3)}% 0 0)` : undefined,
        }}
      >
        {children}
      </AbsoluteFill>
      {s.edge !== null && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${s.edge * 100}%`,
            width: 3,
            marginLeft: -1.5,
            background: palette.electric,
            boxShadow: `0 0 18px ${palette.electric}, 0 0 60px ${rgba(palette.violet, 0.9)}, -40px 0 90px ${rgba(palette.blue, 0.35)}`,
          }}
        />
      )}
      {s.tear > 0.02 &&
        [0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: `${hash(seed + i * 13, frame) * 100}%`,
              height: 3 + hash(seed + i * 29, frame) * 26 * s.tear,
              background: rgba(i % 2 ? palette.violet : palette.electric, 0.32 * s.tear),
              transform: `translateX(${((hash(seed + i * 7, frame) - 0.5) * 120 * s.tear).toFixed(1)}px)`,
              mixBlendMode: 'screen',
            }}
          />
        ))}
      {s.flash > 0 && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(75% 75% at 50% 50%, ${rgba(palette.text, s.flash)} 0%, ${rgba(palette.violet, s.flash * 0.6)} 55%, ${rgba(palette.blue, s.flash * 0.2)} 100%)`,
            mixBlendMode: 'screen',
          }}
        />
      )}
    </AbsoluteFill>
  );
};
