import path from 'node:path';
import { Logger, consoleSink, fileSink, projectPaths, writeJson } from '@nero/core';
import { prepareTimeline } from './node/prepare';
import { validateRender } from './node/qa';
import { renderTimeline } from './node/render';

async function render(projectId: string, preview: boolean): Promise<number> {
  const p = projectPaths(projectId);
  const mode = preview ? 'preview' : 'final';
  const log = new Logger('render').addSink(consoleSink()).addSink(fileSink(path.join(p.logsDir, 'render.log')));

  const { timeline, warnings } = prepareTimeline(projectId);
  for (const w of warnings) log.warn(w);
  log.info(`Timeline: ${timeline.scenes.length} scenes, ${timeline.durationInFrames} frames, ${timeline.durationSec.toFixed(2)} s @ ${timeline.fps} fps, ${timeline.width}x${timeline.height}`);

  const scale = preview ? 0.5 : 1;
  const output = path.join(p.renderDir, `${projectId}-${mode}.mp4`);
  const result = await renderTimeline({ timeline, output, mode, scale, onProgress: (f, detail) => log.progress(f, detail) });
  log.info(`Rendered ${result.frames} frames in ${result.elapsedSec.toFixed(1)} s`);

  const report = await validateRender(output, mode, { width: result.width, height: result.height, fps: result.fps, frames: result.frames });
  writeJson(path.join(p.qaDir, `render-${mode}.json`), report);
  for (const c of report.checks) (c.status === 'pass' ? log.info : log.error).call(log, `${c.status === 'pass' ? 'PASS' : 'FAIL'}  ${c.label} → ${c.detail}`);
  if (!report.passed) {
    log.error(`QA failed for ${output}`);
    return 1;
  }
  log.info(`Video ready: ${output}`);
  return 0;
}

const [command, projectId, ...flags] = process.argv.slice(2);
if (command !== 'render' || !projectId) {
  console.error('Usage: npm run render -- <project-id> [--preview]');
  process.exit(2);
}
render(projectId, flags.includes('--preview')).then(
  (code) => process.exit(code),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
