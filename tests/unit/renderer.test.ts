import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, loadProject } from '@nero/core';
import { CameraMove, SceneType, TransitionType } from '@nero/schemas';
import {
  IDENTITY_CAMERA,
  SUPPORTED_SCENE_TYPES,
  cameraState,
  composeTimeline,
  hash,
  layerTransform,
  noise1,
  rng,
  transitionProgress,
  transitionState,
  unsupportedScenes,
} from '@nero/renderer';

const DEMO = 'demo-redes-neurais';
const shot = (move: CameraMove, progress: number) => cameraState({ move, progress, timeSec: progress * 4, seed: 42, intensity: 'balanced' });

test('rng and hash are deterministic and stay inside [0, 1)', () => {
  const [a, b] = [rng(7), rng(7)];
  const seq = Array.from({ length: 500 }, () => a());
  assert.deepEqual(seq, Array.from({ length: 500 }, () => b()));
  assert.ok(seq.every((v) => v >= 0 && v < 1));
  assert.notDeepEqual(seq.slice(0, 5), Array.from({ length: 5 }, rng(8)));
  assert.equal(hash(3, 11), hash(3, 11));
  assert.ok(hash(3, 11) >= 0 && hash(3, 11) < 1);
});

test('noise is continuous, so camera drift can never jump between frames', () => {
  for (let f = 0; f < 600; f++) {
    const step = Math.abs(noise1(5, (f + 1) / 30) - noise1(5, f / 30));
    assert.ok(step < 0.12, `jump of ${step} at frame ${f}`);
  }
});

test('a static camera is the identity', () => {
  assert.deepEqual(shot('static', 0.5), IDENTITY_CAMERA);
});

test('push-in only ever moves closer; pull-out only ever moves away', () => {
  const steps = Array.from({ length: 21 }, (_, i) => i / 20);
  const push = steps.map((p) => shot('push-in', p).scale);
  const pull = steps.map((p) => shot('pull-out', p).scale);
  for (let i = 1; i < steps.length; i++) {
    assert.ok(push[i] > push[i - 1]);
    assert.ok(pull[i] < pull[i - 1]);
  }
  assert.ok(Math.abs(push[0] - 1) < 1e-9);
  assert.ok(Math.abs(pull[pull.length - 1] - 1) < 1e-9);
});

test('opposite pans and tilts travel in opposite directions', () => {
  assert.ok(shot('pan-left', 1).x > shot('pan-left', 0).x);
  assert.ok(shot('pan-right', 1).x < shot('pan-right', 0).x);
  assert.ok(shot('tilt-up', 1).y > shot('tilt-up', 0).y);
  assert.ok(shot('tilt-down', 1).y < shot('tilt-down', 0).y);
  assert.ok(shot('orbit', 1).yaw > shot('orbit', 0).yaw);
});

test('every camera move stays subtle and finite', () => {
  for (const move of CameraMove.options) {
    for (let i = 0; i <= 30; i++) {
      const c = cameraState({ move, progress: i / 30, timeSec: i / 5, seed: 9, intensity: 'intense' });
      for (const v of Object.values(c)) assert.ok(Number.isFinite(v), `${move} produced ${v}`);
      assert.ok(c.scale > 0.999 && c.scale < 1.2, `${move} scale ${c.scale}`);
      assert.ok(Math.abs(c.x) < 0.06 && Math.abs(c.y) < 0.06, `${move} offset ${c.x}, ${c.y}`);
    }
  }
});

test('parallax: nearer layers move further than distant ones', () => {
  const cam = shot('pan-right', 1);
  const far = layerTransform(cam, 0.2, 1920, 1080);
  const near = layerTransform(cam, 1.6, 1920, 1080);
  assert.ok(Math.abs(near.translateX) > Math.abs(far.translateX) * 7);
  // a depth-0 layer is locked to the frame
  const locked = layerTransform(cam, 0, 1920, 1080);
  assert.ok(locked.translateX === 0 && locked.translateY === 0 && locked.scale === 1 && locked.rotate === 0);
});

test('every transition starts hidden and ends as a clean, fully visible frame', () => {
  for (const type of TransitionType.options) {
    const end = transitionState(type, 1, 12, 5);
    assert.deepEqual(end, { opacity: 1, offsetX: 0, clipRight: 0, edge: null, black: 0, flash: 0, tear: 0 }, type);
    if (type === 'cut') continue;
    const start = transitionState(type, 0, 0, 5);
    assert.ok(start.opacity === 0 || start.clipRight === 1, `${type} shows the incoming scene at p=0`);
    for (let i = 0; i <= 20; i++) {
      const s = transitionState(type, i / 20, i, 5);
      for (const v of [s.opacity, s.clipRight, s.black, s.flash, s.tear]) assert.ok(v >= 0 && v <= 1, `${type} out of range at ${i / 20}`);
    }
  }
});

test('a cut is instantaneous and a zero-length transition is already complete', () => {
  assert.equal(transitionState('cut', 0).opacity, 1);
  assert.equal(transitionProgress(0, 0), 1);
  assert.equal(transitionProgress(6, 12), 0.5);
  assert.equal(transitionProgress(99, 12), 1);
});

test('a flash never whites out the frame', () => {
  for (let i = 0; i <= 40; i++) assert.ok(transitionState('flash', i / 40).flash <= 0.5);
});

test('demo project composes to exactly 15 s of 1080p30 through the real timeline builder', () => {
  const { timeline, warnings } = composeTimeline(loadProject(DEMO), load.editorial(DEMO));
  assert.equal(timeline.fps, 30);
  assert.equal(timeline.width, 1920);
  assert.equal(timeline.height, 1080);
  assert.equal(timeline.durationInFrames, 450);
  assert.equal(timeline.durationSec, 15);
  assert.deepEqual(unsupportedScenes(timeline), []);
  assert.ok(!warnings.some((w) => w.includes('no renderer yet')));

  // scenes tile the timeline with no gap, and each tail equals the next scene's transition
  timeline.scenes.forEach((s, i) => {
    const next = timeline.scenes[i + 1];
    assert.equal(s.from + s.durationInFrames, next ? next.from : timeline.durationInFrames);
    assert.equal(s.tailFrames, next ? next.transitionIn.frames : 0);
  });
  assert.ok(timeline.scenes.flatMap((s) => s.textOverlays).length >= 5);
});

test('scenes with narration are refused until a narration manifest exists', () => {
  const editorial = load.editorial(DEMO);
  editorial.scenes[1].narration = 'Uma rede neural aprende ajustando conexões.';
  assert.throws(() => composeTimeline(loadProject(DEMO), editorial), /narration manifest/);
});

test('unimplemented scene types are reported, never rendered silently', () => {
  const editorial = load.editorial(DEMO);
  editorial.scenes[1].type = 'digital_rain';
  const { timeline, warnings } = composeTimeline(loadProject(DEMO), editorial);
  assert.deepEqual(unsupportedScenes(timeline), [{ id: 's002', type: 'digital_rain' }]);
  assert.ok(warnings.some((w) => w.includes('s002') && w.includes('no renderer yet')));
  for (const t of SUPPORTED_SCENE_TYPES) assert.ok(SceneType.options.includes(t));
});
