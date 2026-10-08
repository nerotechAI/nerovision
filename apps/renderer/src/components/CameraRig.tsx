import React, { createContext, useContext, useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { CameraMove, Timeline } from '@nero/schemas';
import { CameraState, IDENTITY_CAMERA, cameraState, layerTransform } from '../camera';

const CameraContext = createContext<CameraState>(IDENTITY_CAMERA);

/** Current camera, for layers that do their own depth projection (canvases). */
export const useCamera = (): CameraState => useContext(CameraContext);

export const CameraRig: React.FC<{
  move: CameraMove;
  seed: number;
  intensity: Timeline['intensity'];
  /** frames the shot is on screen, tail included */
  totalFrames: number;
  children: React.ReactNode;
}> = ({ move, seed, intensity, totalFrames, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cam = useMemo(
    () => cameraState({ move, progress: Math.min(1, frame / Math.max(1, totalFrames - 1)), timeSec: frame / fps, seed, intensity }),
    [move, frame, totalFrames, fps, seed, intensity],
  );
  return <CameraContext.Provider value={cam}>{children}</CameraContext.Provider>;
};

/** A plane at a given depth. 0 = locked to the frame, 1 = subject plane, >1 = foreground. */
export const Layer: React.FC<{ depth: number; style?: React.CSSProperties; children: React.ReactNode }> = ({ depth, style, children }) => {
  const cam = useCamera();
  const { width, height } = useVideoConfig();
  const t = layerTransform(cam, depth, width, height);
  return (
    <AbsoluteFill
      style={{
        transform: `translate3d(${t.translateX.toFixed(3)}px, ${t.translateY.toFixed(3)}px, 0) scale(${t.scale.toFixed(5)}) rotate(${t.rotate.toFixed(4)}deg)`,
        transformOrigin: '50% 50%',
        ...style,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
