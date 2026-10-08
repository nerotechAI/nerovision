import {
  EditorialPackage,
  GENERATED_LICENSE,
  PROCEDURAL_SCENE_TYPES,
  SCHEMA_VERSION,
  Storyboard,
  StoryboardScene,
  VoiceSettings,
  parseOrThrow,
} from '@nero/schemas';

/** Deterministic 31-bit seed from a string (FNV-1a). */
export function seedFrom(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) & 0x7fffffff;
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/** Rough pt-BR narration estimate (≈150 wpm at speed 1.0). Only for planning; real audio decides. */
export function estimateSpeechSec(text: string, speed = 1): number {
  const words = countWords(text);
  const commas = (text.match(/[,;:—–]/g) ?? []).length;
  const stops = (text.match(/[.!?…]/g) ?? []).length;
  return (words / (150 * speed)) * 60 + commas * 0.18 + stops * 0.3;
}

export interface BuildStoryboardOptions {
  projectId: string;
  voice: VoiceSettings;
  /** keep user edits (asset locks, review notes, overrides) from an existing storyboard */
  previous?: Storyboard | null;
}

export function buildStoryboard(pkg: EditorialPackage, opts: BuildStoryboardOptions): Storyboard {
  const chapterCue = new Map(pkg.chapters.map((c) => [c.id, c.musicCue]));
  const prevById = new Map((opts.previous?.scenes ?? []).map((s) => [s.id, s]));
  const warnings: string[] = [];

  const scenes: StoryboardScene[] = pkg.scenes.map((s, index) => {
    const next = pkg.scenes[index + 1];
    const lastInChapter = !next || next.chapterId !== s.chapterId;
    const prev = prevById.get(s.id);
    const procedural = PROCEDURAL_SCENE_TYPES.includes(s.type);
    const keepAsset = prev && prev.asset.locked && prev.type === s.type;
    return {
      ...s,
      index,
      seed: seedFrom(`${opts.projectId}:${s.id}`),
      musicCue: s.musicCue ?? chapterCue.get(s.chapterId) ?? 'ambient',
      pauseAfterSec: s.pauseAfterSec ?? (lastInChapter ? opts.voice.chapterPauseSec : opts.voice.scenePauseSec),
      asset: keepAsset
        ? prev.asset
        : {
            source: 'procedural',
            status: procedural ? 'procedural' : 'needs-asset',
            path: null,
            assetId: null,
            kind: null,
            width: null,
            height: null,
            durationSec: null,
            score: null,
            license: GENERATED_LICENSE,
            locked: false,
          },
      narrationAudio: null,
      timing: null,
      review: prev && prev.narration === s.narration ? prev.review : { status: 'pending', notes: '' },
    };
  });

  // ── editorial quality warnings (never block; they show up in the dashboard and CLI) ──
  let run = 1;
  for (let i = 1; i < scenes.length; i++) {
    run = scenes[i].type === scenes[i - 1].type ? run + 1 : 1;
    if (run === 4) warnings.push(`Scenes ${scenes[i - 3].id}–${scenes[i].id}: four "${scenes[i].type}" shots in a row may feel repetitive.`);
  }
  const descSeen = new Map<string, string>();
  for (const s of scenes) {
    const key = s.visual.description.trim().toLowerCase();
    if (descSeen.has(key)) warnings.push(`Scene ${s.id} repeats the visual description of ${descSeen.get(key)}.`);
    else descSeen.set(key, s.id);
  }
  const estSec = scenes.reduce(
    (acc, s) => acc + Math.max(s.narration ? estimateSpeechSec(s.narration, opts.voice.speed) + opts.voice.leadInSec + s.pauseAfterSec : 0, s.minDurationSec),
    0,
  );
  const words = scenes.reduce((a, s) => a + (s.narration ? countWords(s.narration) : 0), 0);
  warnings.push(`Planning estimate: ${words} narrated words ≈ ${(estSec / 60).toFixed(1)} min (real duration comes from the generated voice).`);

  return parseOrThrow(
    Storyboard,
    { schemaVersion: SCHEMA_VERSION, projectId: opts.projectId, title: pkg.title, chapters: pkg.chapters, scenes, warnings },
    'storyboard',
  );
}
