import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { config, ensureDir } from '@nero/core';
import type { RenderMode, Timeline } from '@nero/schemas';

const ENTRY = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'index.ts');
const COMPOSITION_ID = 'NeroDocumentary';

/** Bundle the Remotion project once; the returned URL can be reused across renders. */
export function bundleRenderer(onProgress?: (fraction: number) => void): Promise<string> {
  return bundle({ entryPoint: ENTRY, onProgress: (pct) => onProgress?.(pct / 100) });
}

export interface RenderOptions {
  timeline: Timeline;
  output: string;
  mode: RenderMode;
  /** reuse a bundle from bundleRenderer() instead of building a new one */
  serveUrl?: string;
  /** output scale; 0.5 renders a 1080p timeline at 960x540 */
  scale?: number;
  /** inclusive frame range; defaults to the whole timeline */
  frameRange?: [number, number];
  onProgress?: (fraction: number, detail: string) => void;
}

export interface RenderResult {
  output: string;
  width: number;
  height: number;
  fps: number;
  frames: number;
  elapsedSec: number;
}

/** Render a timeline to an H.264 MP4 with headless Chromium + the FFmpeg that ships with Remotion. */
export async function renderTimeline(opts: RenderOptions): Promise<RenderResult> {
  const started = Date.now();
  const cfg = config();
  const scale = opts.scale ?? 1;
  const inputProps = { timeline: opts.timeline };
  ensureDir(path.dirname(opts.output));

  const serveUrl = opts.serveUrl ?? (await bundleRenderer((f) => opts.onProgress?.(f * 0.1, 'bundling')));
  const browserExecutable = cfg.chromeExecutable ?? undefined;
  const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps, browserExecutable, logLevel: 'warn' });

  await renderMedia({
    composition,
    serveUrl,
    inputProps,
    codec: 'h264',
    outputLocation: opts.output,
    pixelFormat: 'yuv420p',
    colorSpace: 'bt709',
    crf: opts.mode === 'final' ? 18 : 24,
    // per-frame film grain is nearly incompressible; without a ceiling CRF alone lets it reach ~90 Mbps
    encodingMaxRate: opts.mode === 'final' ? '20M' : '6M',
    encodingBufferSize: opts.mode === 'final' ? '40M' : '12M',
    x264Preset: opts.mode === 'final' ? 'slow' : 'veryfast',
    imageFormat: 'jpeg',
    jpegQuality: opts.mode === 'final' ? 96 : 80,
    // picture only: narration, music and effects are mixed and muxed by the audio stage
    muted: true,
    scale,
    frameRange: opts.frameRange ?? null,
    concurrency: cfg.renderConcurrency,
    browserExecutable,
    overwrite: true,
    logLevel: 'warn',
    onProgress: ({ progress, renderedFrames, encodedFrames }) =>
      opts.onProgress?.(0.1 + progress * 0.9, `rendered ${renderedFrames}, encoded ${encodedFrames}`),
  });

  const [first, last] = opts.frameRange ?? [0, composition.durationInFrames - 1];
  return {
    output: opts.output,
    width: Math.round(composition.width * scale),
    height: Math.round(composition.height * scale),
    fps: composition.fps,
    frames: last - first + 1,
    elapsedSec: (Date.now() - started) / 1000,
  };
}
