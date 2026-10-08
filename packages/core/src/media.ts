import { config } from './config';
import { runOk, run } from './exec';

export interface ProbeStream {
  index: number;
  codec_type: 'video' | 'audio' | 'subtitle' | 'data';
  codec_name?: string;
  profile?: string;
  width?: number;
  height?: number;
  sample_aspect_ratio?: string;
  display_aspect_ratio?: string;
  r_frame_rate?: string;
  avg_frame_rate?: string;
  pix_fmt?: string;
  sample_rate?: string;
  channels?: number;
  duration?: string;
  nb_frames?: string;
}
export interface ProbeResult {
  streams: ProbeStream[];
  format: { filename: string; format_name: string; duration?: string; size?: string; bit_rate?: string };
}

export async function ffprobe(file: string): Promise<ProbeResult> {
  const r = await runOk(config().ffprobe, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file]);
  return JSON.parse(r.stdout) as ProbeResult;
}

/** Exact media duration in seconds (container duration, falling back to the first stream). */
export async function mediaDuration(file: string): Promise<number> {
  const p = await ffprobe(file);
  const d = Number(p.format.duration ?? p.streams.find((s) => s.duration)?.duration);
  if (!Number.isFinite(d) || d <= 0) throw new Error(`Could not read a valid duration from ${file}`);
  return d;
}

export function parseRate(rate: string | undefined): number | null {
  if (!rate) return null;
  const [a, b] = rate.split('/').map(Number);
  if (!b) return a || null;
  return a / b;
}

/** Peak and mean volume via ffmpeg volumedetect. */
export async function volumeStats(file: string): Promise<{ meanDb: number; peakDb: number }> {
  const r = await run(config().ffmpeg, ['-hide_banner', '-nostats', '-i', file, '-af', 'volumedetect', '-f', 'null', '-']);
  const mean = /mean_volume:\s*(-?[\d.]+|-inf) dB/.exec(r.stderr);
  const peak = /max_volume:\s*(-?[\d.]+|-inf) dB/.exec(r.stderr);
  if (!mean || !peak) throw new Error(`volumedetect failed for ${file}`);
  const n = (s: string) => (s === '-inf' ? -Infinity : Number(s));
  return { meanDb: n(mean[1]), peakDb: n(peak[1]) };
}

/** Which binaries exist and their versions. Used by `nero doctor` and /api/health. */
export async function toolVersion(cmd: string, args: string[] = ['-version']): Promise<string | null> {
  try {
    const r = await run(cmd, args, { timeoutMs: 20000 });
    if (r.code !== 0) return null;
    return (r.stdout || r.stderr).split('\n')[0].trim();
  } catch {
    return null;
  }
}
