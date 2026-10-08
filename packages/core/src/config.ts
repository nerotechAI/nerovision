import fs from 'node:fs';
import path from 'node:path';
import { repoRoot } from './paths';

let loaded = false;

/** Minimal .env loader (no dependency). Real environment variables always win. */
export function loadEnv(file?: string): void {
  if (loaded && !file) return;
  loaded = true;
  const p = file ?? path.join(repoRoot(), '.env');
  if (!fs.existsSync(p)) return;
  for (const raw of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

function env(name: string): string | null {
  loadEnv();
  const v = process.env[name];
  return v && v.trim() ? v.trim() : null;
}

function defaultPython(): string {
  const root = repoRoot();
  const candidates =
    process.platform === 'win32'
      ? [path.join(root, '.venv', 'Scripts', 'python.exe')]
      : [path.join(root, '.venv', 'bin', 'python')];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return process.platform === 'win32' ? 'python' : 'python3';
}

/** Everything configurable lives here. Secrets are only ever read from the environment. */
export function config() {
  return {
    ffmpeg: env('FFMPEG_PATH') ?? 'ffmpeg',
    ffprobe: env('FFPROBE_PATH') ?? 'ffprobe',
    python: env('NERO_PYTHON') ?? defaultPython(),
    serverPort: Number(env('NERO_SERVER_PORT') ?? 4317),
    fps: 30,
    width: 1920,
    height: 1080,
    narrationSampleRate: 48000,
    loudnessTargetLufs: Number(env('NERO_LOUDNESS_LUFS') ?? -14),
    truePeakDb: -1.5,
    whisper: {
      model: env('WHISPER_MODEL') ?? 'small',
      device: env('WHISPER_DEVICE') ?? 'cpu',
      computeType: env('WHISPER_COMPUTE_TYPE') ?? 'int8',
    },
    pexels: { apiKey: env('PEXELS_API_KEY') },
    elevenlabs: {
      apiKey: env('ELEVENLABS_API_KEY'),
      voiceId: env('ELEVENLABS_VOICE_ID'),
      modelId: env('ELEVENLABS_MODEL_ID') ?? 'eleven_multilingual_v2',
    },
    llm: {
      /** "none" unless explicitly set. Nero never calls a paid LLM API by default. */
      provider: (env('NERO_LLM_PROVIDER') ?? 'none') as 'none' | 'anthropic',
      apiKey: env('ANTHROPIC_API_KEY'),
      model: env('NERO_LLM_MODEL') ?? 'claude-sonnet-5-5',
      maxTokens: Number(env('NERO_LLM_MAX_TOKENS') ?? 32000),
    },
    aiImage: {
      provider: (env('NERO_AI_IMAGE_PROVIDER') ?? 'none') as 'none' | 'openai',
      apiKey: env('OPENAI_API_KEY'),
      model: env('NERO_AI_IMAGE_MODEL') ?? 'gpt-image-1',
      maxImagesPerProject: Number(env('NERO_AI_IMAGE_MAX_PER_PROJECT') ?? 0),
    },
    aiVideo: {
      provider: (env('NERO_AI_VIDEO_PROVIDER') ?? 'none') as 'none',
    },
    renderConcurrency: env('NERO_RENDER_CONCURRENCY') ? Number(env('NERO_RENDER_CONCURRENCY')) : null,
    chromeExecutable: env('NERO_CHROME_EXECUTABLE'),
  };
}
export type Config = ReturnType<typeof config>;

/** Which optional paid services are switched on. Shown by `nero doctor` and the dashboard. */
export function paidServices(): { name: string; enabled: boolean; costs: string }[] {
  const c = config();
  return [
    { name: 'Pexels API (stock footage)', enabled: !!c.pexels.apiKey, costs: 'Free (API key required, 200 req/h, 20k/month by default)' },
    { name: 'ElevenLabs TTS', enabled: !!c.elevenlabs.apiKey && !!c.elevenlabs.voiceId, costs: 'Paid per character on your ElevenLabs plan' },
    { name: 'LLM editorial API', enabled: c.llm.provider !== 'none' && !!c.llm.apiKey, costs: 'Paid per token on a separately billed API account' },
    { name: 'AI image generation', enabled: c.aiImage.provider !== 'none' && !!c.aiImage.apiKey && c.aiImage.maxImagesPerProject > 0, costs: 'Paid per image' },
  ];
}
