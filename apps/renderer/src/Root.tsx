import React from 'react';
import { Composition } from 'remotion';
import { Documentary, DocumentaryProps } from './Documentary';

export const COMPOSITION_ID = 'NeroDocumentary';

/** The composition takes its size, frame rate and length from the timeline it is given. */
export const Root: React.FC = () => (
  <Composition
    id={COMPOSITION_ID}
    component={Documentary}
    width={1920}
    height={1080}
    fps={30}
    durationInFrames={150}
    defaultProps={{ timeline: null } as DocumentaryProps}
    calculateMetadata={({ props }) =>
      props.timeline
        ? { width: props.timeline.width, height: props.timeline.height, fps: props.timeline.fps, durationInFrames: props.timeline.durationInFrames }
        : {}
    }
  />
);
