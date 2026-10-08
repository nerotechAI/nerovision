import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { load, loadProject, projectPaths } from '@nero/core';
import { bundleRenderer, composeTimeline, renderTimeline, validateRender } from '@nero/renderer';

/**
 * These tests drive the real engine: webpack bundle → headless Chromium → FFmpeg → ffprobe.
 * Nothing is mocked. They render small slices so the suite stays around a minute.
 */
const DEMO = 'demo-redes-neurais';
const FULL = { width: 1920, height: 1080, fps: 30, frames: 450 };
const timeline = composeTimeline(loadProject(DEMO), load.editorial(DEMO)).timeline;
let tmp: string;
let serveUrl: string;

before(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nero-render-'));
  serveUrl = await bundleRenderer();
});
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

test('renders a real H.264 MP4 slice that matches what was requested', async () => {
  const output = path.join(tmp, 'slice.mp4');
  // frames 180–209 span the glitch transition (starts at 195), so two scenes and a transition are exercised
  const result = await renderTimeline({ timeline, output, mode: 'preview', serveUrl, scale: 0.25, frameRange: [180, 209] });
  assert.deepEqual([result.width, result.height, result.fps, result.frames], [480, 270, 30, 30]);

  const report = await validateRender(output, 'preview', result);
  assert.ok(report.passed, JSON.stringify(report.checks.filter((c) => c.status === 'fail')));
  assert.deepEqual(
    report.checks.map((c) => c.id),
    ['file', 'container', 'video-stream', 'codec', 'resolution', 'fps', 'frames', 'duration', 'pixel-format'],
  );
});

test('rendering is deterministic: the same frames encode to the same bytes', async () => {
  const [a, b] = [path.join(tmp, 'a.mp4'), path.join(tmp, 'b.mp4')];
  for (const output of [a, b]) await renderTimeline({ timeline, output, mode: 'preview', serveUrl, scale: 0.25, frameRange: [300, 311] });
  assert.ok(fs.readFileSync(a).equals(fs.readFileSync(b)), 'two renders of the same frames differ');
});

test('QA rejects a file that does not match the expectation', async () => {
  const output = path.join(tmp, 'slice.mp4');
  const report = await validateRender(output, 'preview', FULL);
  assert.equal(report.passed, false);
  const failed = report.checks.filter((c) => c.status === 'fail').map((c) => c.id);
  assert.deepEqual(failed, ['resolution', 'frames', 'duration']);
  assert.equal((await validateRender(path.join(tmp, 'missing.mp4'), 'final', FULL)).passed, false);
});

test('the final demo render on disk is 1920x1080 H.264 at 30 fps for 15 s', async (t) => {
  const file = path.join(projectPaths(DEMO).renderDir, `${DEMO}-final.mp4`);
  if (!fs.existsSync(file)) return t.skip(`not rendered yet (${file}); run: npm run render:demo`);
  const report = await validateRender(file, 'final', FULL);
  assert.ok(report.passed, JSON.stringify(report.checks.filter((c) => c.status === 'fail')));
});
