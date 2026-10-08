import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion';
import type { Timeline } from '@nero/schemas';
import { TransitionIn } from './components/TransitionIn';
import { useFonts } from './fonts';
import { progress, smoothstep } from './math';
import { Scene } from './scenes';
import { palette } from './theme';

export interface DocumentaryProps {
  timeline: Timeline | null;
  [key: string]: unknown;
}

const FADE_OUT_FRAMES = 14;

/**
 * Plays a Timeline exactly as @nero/timeline laid it out: each scene owns [from, from + duration),
 * keeps rendering for `tailFrames` underneath its successor, and the successor composites itself
 * on top for `transitionIn.frames`.
 */
export const Documentary: React.FC<DocumentaryProps> = ({ timeline }) => {
  const frame = useCurrentFrame();
  const ready = useFonts();
  if (!timeline) {
    return (
      <AbsoluteFill style={{ backgroundColor: palette.void, color: palette.text, alignItems: 'center', justifyContent: 'center', fontSize: 40, fontFamily: 'sans-serif' }}>
        Nenhuma timeline carregada. Use: npm run render -- &lt;projeto&gt;
      </AbsoluteFill>
    );
  }
  const fadeOut = smoothstep(progress(frame, timeline.durationInFrames - FADE_OUT_FRAMES, timeline.durationInFrames - 1));
  return (
    <AbsoluteFill style={{ backgroundColor: palette.void }}>
      {ready &&
        timeline.scenes.map((scene) => (
          <Sequence key={scene.id} name={`${scene.id} · ${scene.type}`} from={scene.from} durationInFrames={scene.durationInFrames + scene.tailFrames}>
            <TransitionIn type={scene.transitionIn.type} frames={scene.transitionIn.frames} seed={scene.seed}>
              <Scene scene={scene} intensity={timeline.intensity} />
            </TransitionIn>
          </Sequence>
        ))}
      {fadeOut > 0 && <AbsoluteFill style={{ backgroundColor: '#000', opacity: fadeOut }} />}
    </AbsoluteFill>
  );
};
