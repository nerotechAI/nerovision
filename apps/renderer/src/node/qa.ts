import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { config, ffprobe, fileSize, parseRate, toolVersion } from '@nero/core';
import type { QaCheck, QaReport, RenderMode } from '@nero/schemas';

const require = createRequire(import.meta.url);

/** The ffprobe binary that ships inside Remotion's platform package, or null if it is not there. */
export function bundledFfprobe(): string | null {
  const suffix = process.platform === 'win32' ? '-msvc' : process.platform === 'linux' ? '-gnu' : '';
  try {
    const dir = path.dirname(require.resolve(`@remotion/compositor-${process.platform}-${process.arch}${suffix}`));
    const bin = path.join(dir, process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe');
    return fs.existsSync(bin) ? bin : null;
  } catch {
    return null;
  }
}

/**
 * Make sure @nero/core can run ffprobe. An explicit FFPROBE_PATH or a system install wins;
 * otherwise fall back to the copy bundled with Remotion, so no global FFmpeg is required.
 */
export async function ensureFfprobe(): Promise<string> {
  if (await toolVersion(config().ffprobe)) return config().ffprobe;
  const bundled = bundledFfprobe();
  if (!bundled || !(await toolVersion(bundled))) throw new Error('ffprobe not found. Install FFmpeg or set FFPROBE_PATH in .env.');
  process.env.FFPROBE_PATH = bundled;
  return bundled;
}

export interface RenderExpectation {
  width: number;
  height: number;
  fps: number;
  frames: number;
}

/** Probe a rendered file and compare it with what the timeline asked for. Nothing is assumed. */
export async function validateRender(file: string, mode: RenderMode, expected: RenderExpectation): Promise<QaReport> {
  const checks: QaCheck[] = [];
  const add = (id: string, label: string, ok: boolean, detail: string) => checks.push({ id, label, status: ok ? 'pass' : 'fail', detail });
  const createdAt = new Date().toISOString();

  const size = fileSize(file);
  add('file', 'File exists and is not empty', size > 0, `${size} bytes`);
  if (size === 0) return { file, mode, createdAt, passed: false, checks, probe: null };

  await ensureFfprobe();
  const probe = await ffprobe(file);
  const video = probe.streams.find((s) => s.codec_type === 'video');
  add('container', 'Container is MP4', probe.format.format_name.split(',').includes('mp4'), probe.format.format_name);
  add('video-stream', 'Has a video stream', !!video, video ? `stream #${video.index}` : 'none');
  if (video) {
    const fps = parseRate(video.avg_frame_rate) ?? parseRate(video.r_frame_rate);
    const frames = Number(video.nb_frames);
    const durationSec = Number(probe.format.duration ?? video.duration);
    const wantSec = expected.frames / expected.fps;
    add('codec', 'Codec is H.264', video.codec_name === 'h264', `${video.codec_name} (${video.profile ?? '?'})`);
    add('resolution', `Resolution is ${expected.width}x${expected.height}`, video.width === expected.width && video.height === expected.height, `${video.width}x${video.height}`);
    add('fps', `Frame rate is ${expected.fps} fps`, fps !== null && Math.abs(fps - expected.fps) < 0.01, `${video.avg_frame_rate} = ${fps}`);
    add('frames', `Frame count is ${expected.frames}`, frames === expected.frames, `${video.nb_frames}`);
    add('duration', `Duration is ${wantSec.toFixed(3)} s`, Math.abs(durationSec - wantSec) <= 1 / expected.fps, `${durationSec.toFixed(3)} s`);
    add('pixel-format', 'Pixel format is yuv420p', video.pix_fmt === 'yuv420p', `${video.pix_fmt}`);
  }
  return { file, mode, createdAt, passed: checks.every((c) => c.status !== 'fail'), checks, probe: probe as unknown as Record<string, unknown> };
}
