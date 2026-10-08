import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { SceneType, Timeline, TimelineScene } from '@nero/schemas';
import { CameraRig, Layer, useCamera } from '../components/CameraRig';
import { DataCity } from '../components/DataCity';
import { HoloPanel, HoloRings, LevelBars, Readout, SignalTrace, WireSphere } from '../components/Hologram';
import { Backdrop, LightOrb, NeonLine } from '../components/Lighting';
import { NeuralNetwork } from '../components/NeuralNetwork';
import { Overlays } from '../components/Overlays';
import { ParticleField } from '../components/ParticleField';
import { RevealText, TextOverlays } from '../components/Text';
import { easeOutExpo, progress, rgba } from '../math';
import { FALLBACK_SCENE_TYPE, isSupported } from '../support';
import { fonts, intensityFactor, palette } from '../theme';

export interface SceneProps {
  scene: TimelineScene;
  /** 0.7 / 1 / 1.25 from the timeline's visual intensity */
  k: number;
}

const ParticleScene: React.FC<SceneProps> = ({ scene, k }) => (
  <>
    <Backdrop seed={scene.seed} />
    <Layer depth={0.3}>
      <LightOrb x={0.5} y={0.5} size={0.7} color={palette.violetDeep} strength={0.7 * k} seed={scene.seed} />
    </Layer>
    <ParticleField seed={scene.seed} count={Math.round(240 * k)} zRange={[0.1, 1]} />
    <ParticleField seed={scene.seed + 1} count={14} zRange={[1.15, 1.9]} opacity={0.8} />
  </>
);

const NeuralScene: React.FC<SceneProps> = ({ scene, k }) => (
  <>
    <Backdrop seed={scene.seed} />
    <ParticleField seed={scene.seed} count={Math.round(110 * k)} zRange={[0.1, 0.7]} opacity={0.7} />
    <Layer depth={0.45}>
      <LightOrb x={0.5} y={0.5} size={0.8} color={palette.violetDeep} strength={0.85 * k} seed={scene.seed} />
    </Layer>
    <Layer depth={1}>
      <NeuralNetwork seed={scene.seed} glow={k} />
    </Layer>
    <ParticleField seed={scene.seed + 1} count={10} zRange={[1.2, 1.9]} opacity={0.7} />
  </>
);

const InterfaceScene: React.FC<SceneProps> = ({ scene, k }) => {
  const cam = useCamera();
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const u = width / 1920;
  const readouts = scene.data.hud?.readouts ?? [];
  return (
    <>
      <Backdrop seed={scene.seed} key1={palette.blue} key2={palette.violetDeep} />
      <ParticleField seed={scene.seed} count={Math.round(80 * k)} zRange={[0.1, 0.6]} opacity={0.6} />
      <Layer depth={0.75} style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'relative', top: '-3%', transform: `scale(${u})` }}>
          <LightOrb x={0.5} y={0.5} size={0.3} color={palette.blue} strength={0.9 * k} seed={scene.seed} />
          <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
            <HoloRings radius={292} appearAt={4} />
          </div>
          <WireSphere radius={196} yaw={(frame / fps) * 0.5 + cam.yaw} appearAt={0} />
        </div>
      </Layer>
      <Layer depth={1.2} style={{ perspective: 1700 * u }}>
        <div style={{ position: 'absolute', inset: 0, transform: `scale(${u})`, transformOrigin: '0 0', width: 1920, height: 1080, transformStyle: 'preserve-3d' }}>
          {readouts.length > 0 && (
            <HoloPanel title="NÚCLEO · ESTADO" appearAt={10} seed={scene.seed} style={{ left: 132, top: 232, width: 400, transformOrigin: '0 50%', rotate: 'y 17deg' }}>
              {readouts.slice(0, 4).map((r, i) => (
                <Readout key={i} label={r.label} value={r.value} appearAt={20 + i * 5} />
              ))}
            </HoloPanel>
          )}
          <HoloPanel title="ATIVIDADE SINÁPTICA" appearAt={16} seed={scene.seed + 3} style={{ right: 132, top: 268, width: 400, transformOrigin: '100% 50%', rotate: 'y -17deg' }}>
            <SignalTrace seed={scene.seed} width={340} height={130} appearAt={30} />
            <div style={{ height: 30 }} />
            <LevelBars seed={scene.seed} count={22} height={92} appearAt={36} />
          </HoloPanel>
        </div>
      </Layer>
      <ParticleField seed={scene.seed + 1} count={8} zRange={[1.3, 1.9]} opacity={0.6} />
    </>
  );
};

const ParallaxScene: React.FC<SceneProps> = ({ scene, k }) => (
  <>
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${palette.void} 0%, ${palette.ink} 45%, ${palette.dusk} 100%)` }} />
    <ParticleField seed={scene.seed} count={Math.round(60 * k)} zRange={[0.05, 0.3]} opacity={0.5} speed={0.4} />
    <DataCity seed={scene.seed} />
    <ParticleField seed={scene.seed + 1} count={Math.round(50 * k)} zRange={[0.8, 1.6]} opacity={0.55} />
  </>
);

const TypographyScene: React.FC<SceneProps> = ({ scene, k }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const t = frame / fps;
  return (
    <>
      <Backdrop seed={scene.seed} strength={0.8} />
      <Layer depth={0.5} style={{ alignItems: 'center', justifyContent: 'center' }}>
        {[0, 1, 2].map((i) => {
          // slow concentric rings: each expands and thins out, then recycles
          const life = (t * 0.16 + i / 3) % 1;
          const d = height * (0.5 + life * 1.1);
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                width: d,
                height: d,
                borderRadius: '50%',
                border: `1px solid ${rgba(i === 1 ? palette.electric : palette.violet, 0.3 * Math.sin(Math.PI * life))}`,
              }}
            />
          );
        })}
      </Layer>
      <ParticleField seed={scene.seed} count={Math.round(120 * k)} zRange={[0.1, 1]} opacity={0.75} />
      <ParticleField seed={scene.seed + 1} count={8} zRange={[1.3, 1.9]} opacity={0.6} />
    </>
  );
};

const ChapterCardScene: React.FC<SceneProps> = ({ scene, k }) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const u = width / 1920;
  const number = String(scene.chapterNumber).padStart(2, '0');
  const line = easeOutExpo(progress(frame, 8, 44));
  const ghost = easeOutExpo(progress(frame, 0, 50));
  return (
    <>
      <Backdrop seed={scene.seed} />
      <ParticleField seed={scene.seed} count={Math.round(90 * k)} zRange={[0.1, 0.8]} opacity={0.7} />
      <Layer depth={0.4} style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            fontFamily: fonts.display,
            fontWeight: 700,
            fontSize: 640 * u,
            lineHeight: 1,
            color: 'transparent',
            WebkitTextStroke: `${1.5 * u}px ${rgba(palette.violet, 0.34 * ghost)}`,
            transform: `scale(${(1.08 - 0.08 * ghost).toFixed(4)})`,
          }}
        >
          {number}
        </div>
      </Layer>
      <Layer depth={1} style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: fonts.mono, fontSize: 22 * u, letterSpacing: '0.5em', color: palette.electric, marginBottom: 30 * u, opacity: progress(frame, 6, 20) }}>
          CAPÍTULO {number}
        </div>
        <RevealText
          text={scene.chapterTitle}
          startFrame={10}
          style={{
            fontFamily: fonts.display,
            fontSize: 108 * u,
            fontWeight: 600,
            letterSpacing: '0.03em',
            color: palette.text,
            textAlign: 'center',
            textShadow: `0 0 2px ${rgba(palette.electric, 0.55)}, 0 0 30px ${rgba(palette.violet, 0.65)}, 0 0 80px ${rgba(palette.blue, 0.32)}`,
          }}
        />
        <NeonLine width={560 * u} grow={line} style={{ marginTop: 40 * u }} />
      </Layer>
      <ParticleField seed={scene.seed + 1} count={8} zRange={[1.3, 1.9]} opacity={0.6} />
    </>
  );
};

const REGISTRY: Partial<Record<SceneType, React.FC<SceneProps>>> = {
  chapter_card: ChapterCardScene,
  neural_network: NeuralScene,
  particle_field: ParticleScene,
  futuristic_interface: InterfaceScene,
  parallax_25d: ParallaxScene,
  typography: TypographyScene,
};

/** One shot: camera, scene body, text, then the finishing overlays locked to the lens. */
export const Scene: React.FC<{ scene: TimelineScene; intensity: Timeline['intensity'] }> = ({ scene, intensity }) => {
  const totalFrames = scene.durationInFrames + scene.tailFrames;
  const k = intensityFactor[intensity];
  const Body = REGISTRY[isSupported(scene.type) ? scene.type : FALLBACK_SCENE_TYPE]!;
  return (
    <AbsoluteFill style={{ backgroundColor: palette.void, overflow: 'hidden' }}>
      <CameraRig move={scene.camera} seed={scene.seed} intensity={intensity} totalFrames={totalFrames}>
        <Body scene={scene} k={k} />
        <Layer depth={0.06}>
          <TextOverlays overlays={scene.textOverlays} durationInFrames={scene.durationInFrames} />
        </Layer>
      </CameraRig>
      <Overlays effects={scene.overlays} seed={scene.seed} strength={k} totalFrames={totalFrames} />
    </AbsoluteFill>
  );
};
