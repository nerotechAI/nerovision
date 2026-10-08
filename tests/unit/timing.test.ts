import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertContiguous, computeSceneTimings, formatChapterTime, transitionFrames } from '@nero/timeline';

test('scene duration = leadIn + speech + pause, never stretched', () => {
  const t = computeSceneTimings([{ id: 's001', speechSec: 4.2, minDurationSec: 2, pauseAfterSec: 0.35 }], 30, 0.12);
  assert.equal(t[0].durationFrames, Math.round((0.12 + 4.2 + 0.35) * 30));
  assert.equal(t[0].narrationStartSec, 0.12);
  assert.equal(t[0].narrationDurationSec, 4.2);
});

test('visual-only beats use minDurationSec', () => {
  const t = computeSceneTimings([{ id: 's001', speechSec: null, minDurationSec: 3, pauseAfterSec: 1 }], 30, 0.12);
  assert.equal(t[0].durationFrames, 90);
  assert.equal(t[0].narrationStartSec, null);
});

test('short speech is padded up to minDurationSec', () => {
  const t = computeSceneTimings([{ id: 's001', speechSec: 0.5, minDurationSec: 2.5, pauseAfterSec: 0.3 }], 30, 0.1);
  assert.equal(t[0].durationFrames, 75);
});

test('cumulative rounding never drifts and leaves no gaps (1000 scenes)', () => {
  const scenes = Array.from({ length: 1000 }, (_, i) => ({ id: `s${i}`, speechSec: 1 + ((i * 7919) % 1000) / 997, minDurationSec: 0.5, pauseAfterSec: 0.333 }));
  const t = computeSceneTimings(scenes, 30, 0.12);
  assertContiguous(t, 30);
  const exactTotal = scenes.reduce((a, s) => a + 0.12 + s.speechSec + s.pauseAfterSec, 0);
  const last = t[t.length - 1];
  const frames = last.startFrame + last.durationFrames;
  assert.ok(Math.abs(frames - exactTotal * 30) <= 1, `drift: ${frames} vs ${exactTotal * 30}`);
});

test('narration of each scene ends before the next narration starts', () => {
  const t = computeSceneTimings(
    [
      { id: 'a', speechSec: 3.333, minDurationSec: 1, pauseAfterSec: 0 },
      { id: 'b', speechSec: 2.0, minDurationSec: 1, pauseAfterSec: 0 },
    ],
    30,
    0.1,
  );
  assert.ok(t[0].narrationStartSec! + t[0].narrationDurationSec! <= t[1].narrationStartSec! + 1e-9);
});

test('invalid speech duration is rejected', () => {
  assert.throws(() => computeSceneTimings([{ id: 'x', speechSec: 0, minDurationSec: 1, pauseAfterSec: 0 }], 30, 0));
  assert.throws(() => computeSceneTimings([{ id: 'x', speechSec: NaN, minDurationSec: 1, pauseAfterSec: 0 }], 30, 0));
});

test('assertContiguous detects gaps', () => {
  const t = computeSceneTimings(
    [
      { id: 'a', speechSec: 2, minDurationSec: 1, pauseAfterSec: 0 },
      { id: 'b', speechSec: 2, minDurationSec: 1, pauseAfterSec: 0 },
    ],
    30,
    0,
  );
  t[1].startFrame += 3;
  assert.throws(() => assertContiguous(t, 30), /Gap/);
});

test('transition frames are clamped to 40% of the shorter neighbour', () => {
  assert.equal(transitionFrames('cut', 0.5, 30, 100, 100), 0);
  assert.equal(transitionFrames('crossfade', 0.5, 30, 100, 100), 15);
  assert.equal(transitionFrames('crossfade', 1.0, 30, 40, 100), 16);
});

test('chapter timestamps', () => {
  assert.equal(formatChapterTime(0), '0:00');
  assert.equal(formatChapterTime(65.9), '1:05');
  assert.equal(formatChapterTime(3725), '1:02:05');
});
