/**
 * Single source of truth for every structured file Nero Vision Studio reads or writes.
 * Everything that crosses a stage boundary (editorial → storyboard → narration → timeline →
 * render → QA → export) is validated against these schemas.
 */
import { z } from 'zod';

export const SCHEMA_VERSION = 1 as const;

// ───────────────────────────── enums ─────────────────────────────

export const SceneType = z.enum([
  'cinematic_footage', // real licensed footage (local or Pexels)
  'animated_still', // licensed still image with camera motion
  'parallax_25d', // layered depth scene (image or procedural layers)
  'futuristic_interface', // HUD / holographic interface
  'data_visualization', // animated chart from editorial data
  'digital_map', // wireframe globe with points/arcs
  'particle_field', // abstract particle environment
  'typography', // kinetic typography sequence
  'timeline', // animated historical timeline
  'explainer', // technology explainer schematic (nodes/edges)
  'neural_network', // cybernetic neural network graph
  'digital_rain', // data rain environment
  'chapter_card', // chapter title reveal
  'ai_generated_clip', // clip from an optional, explicitly configured AI video provider
]);
export type SceneType = z.infer<typeof SceneType>;

/** Scene types that never need an external asset. */
export const PROCEDURAL_SCENE_TYPES: SceneType[] = [
  'futuristic_interface',
  'data_visualization',
  'digital_map',
  'particle_field',
  'typography',
  'timeline',
  'explainer',
  'neural_network',
  'digital_rain',
  'chapter_card',
];

export const Epistemic = z.enum(['fact', 'context', 'speculation', 'opinion']);
export type Epistemic = z.infer<typeof Epistemic>;

export const CameraMove = z.enum(['static', 'push-in', 'pull-out', 'pan-left', 'pan-right', 'tilt-up', 'tilt-down', 'drift', 'orbit']);
export type CameraMove = z.infer<typeof CameraMove>;

export const OverlayEffect = z.enum(['grain', 'vignette', 'scanlines', 'fog', 'glitch', 'data-stream', 'hud-frame', 'light-leak']);
export type OverlayEffect = z.infer<typeof OverlayEffect>;

export const TransitionType = z.enum(['cut', 'crossfade', 'glitch', 'flash', 'dip-black', 'wipe']);
export type TransitionType = z.infer<typeof TransitionType>;

export const MusicCue = z.enum(['silence', 'ambient', 'tension', 'mystery', 'pulse', 'resolve']);
export type MusicCue = z.infer<typeof MusicCue>;

export const AssetSource = z.enum(['local', 'pexels', 'ai-image', 'ai-video', 'procedural']);
export type AssetSource = z.infer<typeof AssetSource>;

export const ReviewStatus = z.enum(['pending', 'approved', 'needs-changes']);

// ───────────────────────────── licensing ─────────────────────────────

export const License = z.object({
  name: z.string().min(1), // e.g. "Pexels License", "Generated locally", "CC0-1.0", "Own work"
  url: z.string().url().nullable().default(null),
  author: z.string().nullable().default(null),
  sourceUrl: z.string().url().nullable().default(null),
  attribution: z.string().nullable().default(null), // ready-to-print credit line
  requiresAttribution: z.boolean().default(false),
  commercialUse: z.boolean().default(true),
  notes: z.string().nullable().default(null),
});
export type License = z.infer<typeof License>;

export const GENERATED_LICENSE: License = {
  name: 'Generated locally by Nero Vision Studio',
  url: null,
  author: 'Nero Vision Studio (procedural)',
  sourceUrl: null,
  attribution: null,
  requiresAttribution: false,
  commercialUse: true,
  notes: 'Original procedural output; no third-party material.',
};

// ───────────────────────────── editorial package ─────────────────────────────

export const Source = z.object({
  id: z.string().regex(/^src[0-9]{2,3}$/),
  title: z.string().min(1),
  authors: z.array(z.string()).default([]),
  year: z.number().int().min(1800).max(2100).nullable().default(null),
  publisher: z.string().nullable().default(null),
  url: z.string().url().nullable().default(null),
  doi: z.string().nullable().default(null),
  note: z.string().nullable().default(null), // what this source supports
  /** true only after a human (or an interactive research session) opened and checked it. */
  verified: z.boolean().default(false),
});
export type Source = z.infer<typeof Source>;

export const DataPoint = z.object({ label: z.string(), value: z.number(), note: z.string().optional() });
export const TimelineEvent = z.object({ year: z.string(), label: z.string() });
export const MapPoint = z.object({ label: z.string(), lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) });
export const DiagramNode = z.object({ id: z.string(), label: z.string() });
export const DiagramEdge = z.object({ from: z.string(), to: z.string() });

/** Optional structured content for data-driven scene types. */
export const SceneData = z
  .object({
    chart: z
      .object({
        kind: z.enum(['bar', 'line']).default('bar'),
        title: z.string(),
        unit: z.string().default(''),
        points: z.array(DataPoint).min(2).max(12),
        /** "illustrative" data must be labeled on screen. */
        illustrative: z.boolean().default(false),
      })
      .optional(),
    timeline: z.array(TimelineEvent).min(2).max(8).optional(),
    map: z.object({ points: z.array(MapPoint).min(1).max(12), arcs: z.array(z.tuple([z.number(), z.number()])).default([]) }).optional(),
    diagram: z.object({ nodes: z.array(DiagramNode).min(2).max(10), edges: z.array(DiagramEdge).default([]) }).optional(),
    hud: z.object({ readouts: z.array(z.object({ label: z.string(), value: z.string() })).max(6) }).optional(),
  })
  .default({});
export type SceneData = z.infer<typeof SceneData>;

export const TextOverlay = z.object({
  text: z.string().min(1).max(120),
  style: z.enum(['title', 'lower-third', 'tag', 'quote', 'stat', 'caption']),
  /** seconds after scene start; default 0.4 */
  atSec: z.number().min(0).optional(),
});
export type TextOverlay = z.infer<typeof TextOverlay>;

export const SfxCue = z.object({
  id: z.string(), // id in the sound library, e.g. "whoosh-01"
  /** seconds relative to scene start (may be negative to anticipate a cut) */
  atSec: z.number().default(0),
  gainDb: z.number().min(-40).max(0).default(-14),
});
export type SfxCue = z.infer<typeof SfxCue>;

export const Transition = z.object({ type: TransitionType.default('crossfade'), durationSec: z.number().min(0).max(1.5).default(0.5) });
export type Transition = z.infer<typeof Transition>;

export const EditorialScene = z.object({
  id: z.string().regex(/^s[0-9]{3}$/),
  chapterId: z.string().regex(/^ch[0-9]{2}$/),
  type: SceneType,
  /** Narrated text for this shot. null = visual-only beat (uses minDurationSec). */
  narration: z.string().min(1).nullable(),
  epistemic: Epistemic.default('context'),
  sourceIds: z.array(z.string()).default([]),
  visual: z.object({
    description: z.string().min(1),
    /** English stock-search keywords, most specific first. */
    keywords: z.array(z.string()).default([]),
    aiPrompt: z.string().nullable().default(null),
  }),
  data: SceneData,
  textOverlays: z.array(TextOverlay).max(3).default([]),
  camera: CameraMove.default('drift'),
  overlays: z.array(OverlayEffect).default(['grain', 'vignette']),
  transition: Transition.default({ type: 'crossfade', durationSec: 0.5 }),
  sfx: z.array(SfxCue).default([]),
  musicCue: MusicCue.optional(),
  minDurationSec: z.number().min(0.5).max(20).default(2.5),
  pauseAfterSec: z.number().min(0).max(4).optional(),
});
export type EditorialScene = z.infer<typeof EditorialScene>;

export const Chapter = z.object({
  id: z.string().regex(/^ch[0-9]{2}$/),
  title: z.string().min(1),
  summary: z.string().default(''),
  musicCue: MusicCue.default('ambient'),
});
export type Chapter = z.infer<typeof Chapter>;

export const EditorialPackage = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    slug: z.string().regex(/^[a-z0-9-]+$/),
    language: z.literal('pt-BR'),
    title: z.string().min(1),
    altTitles: z.array(z.string()).min(1),
    topic: z.string(),
    tone: z.string(),
    logline: z.string(),
    hook: z.string().min(1),
    /** How the package was produced; recorded in metadata for transparency. */
    provenance: z.object({
      method: z.enum(['claude-code-interactive', 'llm-api', 'human']),
      model: z.string().nullable().default(null),
      createdAt: z.string(),
      notes: z.string().nullable().default(null),
    }),
    chapters: z.array(Chapter).min(1),
    scenes: z.array(EditorialScene).min(1),
    sources: z.array(Source).default([]),
    youtube: z.object({
      description: z.string(),
      keywords: z.array(z.string()).default([]),
      pinnedComment: z.string().default(''),
      playlist: z.string().default(''),
    }),
    aiDisclosureNotes: z.array(z.string()).default([]),
  })
  .superRefine((pkg, ctx) => {
    const chapterIds = new Set(pkg.chapters.map((c) => c.id));
    const sourceIds = new Set(pkg.sources.map((s) => s.id));
    const seen = new Set<string>();
    pkg.scenes.forEach((s, i) => {
      if (seen.has(s.id)) ctx.addIssue({ code: 'custom', path: ['scenes', i, 'id'], message: `duplicate scene id ${s.id}` });
      seen.add(s.id);
      if (!chapterIds.has(s.chapterId)) ctx.addIssue({ code: 'custom', path: ['scenes', i, 'chapterId'], message: `unknown chapter ${s.chapterId}` });
      for (const sid of s.sourceIds)
        if (!sourceIds.has(sid)) ctx.addIssue({ code: 'custom', path: ['scenes', i, 'sourceIds'], message: `unknown source ${sid}` });
      if (s.epistemic === 'fact' && s.narration && s.sourceIds.length === 0)
        ctx.addIssue({ code: 'custom', path: ['scenes', i, 'sourceIds'], message: `scene ${s.id} is marked "fact" but cites no source` });
      if (s.type === 'data_visualization' && !s.data.chart)
        ctx.addIssue({ code: 'custom', path: ['scenes', i, 'data'], message: `scene ${s.id} is data_visualization but has no data.chart` });
      if (s.type === 'timeline' && !s.data.timeline)
        ctx.addIssue({ code: 'custom', path: ['scenes', i, 'data'], message: `scene ${s.id} is timeline but has no data.timeline` });
    });
    const ids = pkg.sources.map((s) => s.id);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', path: ['sources'], message: 'duplicate source ids' });
  });
export type EditorialPackage = z.infer<typeof EditorialPackage>;

// ───────────────────────────── project settings ─────────────────────────────

export const VoiceSettings = z.object({
  provider: z.enum(['kokoro', 'elevenlabs']).default('kokoro'),
  voiceId: z.string().default('pm_alex'),
  speed: z.number().min(0.6).max(1.4).default(0.95),
  /** Silence inserted after every narrated scene, unless the scene overrides it. */
  scenePauseSec: z.number().min(0).max(3).default(0.35),
  chapterPauseSec: z.number().min(0).max(4).default(1.1),
  leadInSec: z.number().min(0).max(1).default(0.12),
});
export type VoiceSettings = z.infer<typeof VoiceSettings>;

export const ProjectSettings = z.object({
  targetRuntimeSec: z.object({ min: z.number().default(570), max: z.number().default(630) }).default({ min: 570, max: 630 }),
  narrativeStyle: z.enum(['investigative', 'mysterious', 'analytical', 'epic']).default('mysterious'),
  language: z.literal('pt-BR').default('pt-BR'),
  voice: VoiceSettings.default({}),
  visualIntensity: z.enum(['restrained', 'balanced', 'intense']).default('balanced'),
  preset: z.enum(['neon-noir', 'cold-signal', 'violet-dusk']).default('neon-noir'),
  assetPreference: z.enum(['procedural-only', 'local-first', 'pexels-first']).default('local-first'),
  music: z.object({ trackId: z.string().default('gen-dark-ambient-01'), volumeDb: z.number().default(-20), sfx: z.boolean().default(true) }).default({}),
  resolution: z.enum(['720p', '1080p', '1440p', '2160p']).default('1080p'),
  productionMode: z.enum(['local', 'hybrid']).default('local'),
  subtitles: z.object({ burn: z.boolean().default(false), animatedEmphasis: z.boolean().default(false), maxCharsPerLine: z.number().default(42), safeMarginPct: z.number().default(8) }).default({}),
  preview: z.object({ seconds: z.number().min(5).max(120).default(30), scale: z.number().min(0.25).max(1).default(0.5) }).default({}),
});
export type ProjectSettings = z.infer<typeof ProjectSettings>;

export const Project = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string(),
  topic: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  settings: ProjectSettings,
});
export type Project = z.infer<typeof Project>;

// ───────────────────────────── storyboard ─────────────────────────────

export const AssetAssignment = z.object({
  source: AssetSource,
  status: z.enum(['resolved', 'procedural', 'needs-asset']),
  /** project-relative path (served as staticFile) */
  path: z.string().nullable().default(null),
  assetId: z.string().nullable().default(null),
  kind: z.enum(['video', 'image']).nullable().default(null),
  width: z.number().nullable().default(null),
  height: z.number().nullable().default(null),
  durationSec: z.number().nullable().default(null),
  score: z.number().nullable().default(null),
  license: License,
  /** true when the user pinned this asset in the storyboard editor; asset stage will not replace it */
  locked: z.boolean().default(false),
});
export type AssetAssignment = z.infer<typeof AssetAssignment>;

export const StoryboardScene = EditorialScene.extend({
  index: z.number().int().min(0),
  seed: z.number().int(),
  musicCue: MusicCue,
  pauseAfterSec: z.number().min(0).max(4),
  asset: AssetAssignment,
  narrationAudio: z.string().nullable().default(null),
  timing: z
    .object({
      startSec: z.number(),
      endSec: z.number(),
      durationSec: z.number(),
      startFrame: z.number().int(),
      durationFrames: z.number().int().positive(),
      narrationStartSec: z.number().nullable(),
      narrationDurationSec: z.number().nullable(),
    })
    .nullable()
    .default(null),
  review: z.object({ status: ReviewStatus.default('pending'), notes: z.string().default('') }).default({}),
});
export type StoryboardScene = z.infer<typeof StoryboardScene>;

export const Storyboard = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  projectId: z.string(),
  title: z.string(),
  chapters: z.array(Chapter),
  scenes: z.array(StoryboardScene).min(1),
  warnings: z.array(z.string()).default([]),
});
export type Storyboard = z.infer<typeof Storyboard>;

// ───────────────────────────── narration ─────────────────────────────

export const NarrationSegment = z.object({
  sceneId: z.string(),
  text: z.string(),
  textHash: z.string(),
  file: z.string(), // project-relative normalized WAV (48 kHz mono)
  durationSec: z.number().positive(),
  provider: z.enum(['kokoro', 'elevenlabs', 'estimate']),
  voiceId: z.string(),
  speed: z.number(),
  peakDb: z.number().nullable().default(null),
  /** word timings from the TTS provider when available (seconds, relative to segment start) */
  words: z.array(z.object({ word: z.string(), start: z.number(), end: z.number() })).nullable().default(null),
});
export type NarrationSegment = z.infer<typeof NarrationSegment>;

export const NarrationManifest = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  projectId: z.string(),
  /** "estimate" manifests come from animatic mode (no audio). Final renders refuse them. */
  mode: z.enum(['audio', 'estimate']),
  sampleRate: z.number().int(),
  segments: z.array(NarrationSegment),
  totalSpeechSec: z.number(),
});
export type NarrationManifest = z.infer<typeof NarrationManifest>;

// ───────────────────────────── timeline (renderer input) ─────────────────────────────

export const TimelineScene = z.object({
  id: z.string(),
  index: z.number().int(),
  chapterId: z.string(),
  type: SceneType,
  epistemic: Epistemic,
  narration: z.string().nullable(),
  description: z.string(),
  seed: z.number().int(),
  from: z.number().int().min(0), // first frame where this scene is the "current" scene
  durationInFrames: z.number().int().positive(), // until next scene starts
  /** extra frames the scene keeps rendering underneath the next scene's incoming transition */
  tailFrames: z.number().int().min(0),
  transitionIn: z.object({ type: TransitionType, frames: z.number().int().min(0) }),
  camera: CameraMove,
  overlays: z.array(OverlayEffect),
  textOverlays: z.array(TextOverlay),
  data: SceneData,
  asset: z
    .object({ src: z.string(), kind: z.enum(['video', 'image']), durationSec: z.number().nullable(), width: z.number().nullable(), height: z.number().nullable() })
    .nullable(),
  chapterTitle: z.string(),
  chapterNumber: z.number().int(),
});
export type TimelineScene = z.infer<typeof TimelineScene>;

export const SubtitleCue = z.object({ index: z.number().int(), start: z.number(), end: z.number(), text: z.string(), lines: z.array(z.string()) });
export type SubtitleCue = z.infer<typeof SubtitleCue>;

export const Timeline = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  projectId: z.string(),
  title: z.string(),
  fps: z.number().int(),
  width: z.number().int(),
  height: z.number().int(),
  durationInFrames: z.number().int().positive(),
  durationSec: z.number(),
  narrationMode: z.enum(['audio', 'estimate']),
  intensity: z.enum(['restrained', 'balanced', 'intense']),
  chapters: z.array(z.object({ id: z.string(), title: z.string(), number: z.number().int(), startFrame: z.number().int(), startSec: z.number() })),
  scenes: z.array(TimelineScene).min(1),
  /** present when animated captions are burned in by the renderer */
  captions: z.array(SubtitleCue).default([]),
  showCaptions: z.boolean().default(false),
  /** audio placements for the mixer (seconds) */
  audio: z.object({
    narration: z.array(z.object({ sceneId: z.string(), file: z.string(), startSec: z.number(), durationSec: z.number() })),
    sfx: z.array(z.object({ id: z.string(), file: z.string(), startSec: z.number(), gainDb: z.number() })),
    music: z.array(z.object({ cue: MusicCue, startSec: z.number(), endSec: z.number() })),
  }),
});
export type Timeline = z.infer<typeof Timeline>;

// ───────────────────────────── asset library ─────────────────────────────

export const LibraryAsset = z.object({
  id: z.string(),
  kind: z.enum(['video', 'image', 'music', 'sfx']),
  path: z.string(), // repo-relative path under assets/
  title: z.string(),
  tags: z.array(z.string()).default([]),
  width: z.number().nullable().default(null),
  height: z.number().nullable().default(null),
  durationSec: z.number().nullable().default(null),
  sha256: z.string().nullable().default(null),
  source: z.enum(['local', 'pexels', 'generated', 'ai-image', 'ai-video']),
  license: License,
  addedAt: z.string(),
  /** music only: which cues the track fits */
  moods: z.array(MusicCue).default([]),
});
export type LibraryAsset = z.infer<typeof LibraryAsset>;

// ───────────────────────────── jobs & QA ─────────────────────────────

export const STAGES = ['storyboard', 'narration', 'assets', 'timeline', 'subtitles', 'audio', 'render', 'qa', 'thumbnails', 'export'] as const;
export const Stage = z.enum(STAGES);
export type Stage = z.infer<typeof Stage>;

export const RenderMode = z.enum(['preview', 'final']);
export type RenderMode = z.infer<typeof RenderMode>;

export const QaCheck = z.object({
  id: z.string(),
  label: z.string(),
  status: z.enum(['pass', 'warn', 'fail']),
  detail: z.string(),
});
export type QaCheck = z.infer<typeof QaCheck>;

export const QaReport = z.object({
  file: z.string(),
  mode: RenderMode,
  createdAt: z.string(),
  passed: z.boolean(),
  checks: z.array(QaCheck),
  probe: z.record(z.unknown()).nullable(),
});
export type QaReport = z.infer<typeof QaReport>;

/** Helper: parse with a readable error. */
export function parseOrThrow<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, data: unknown, what: string): T {
  const r = schema.safeParse(data);
  if (r.success) return r.data;
  const issues = r.error.issues.slice(0, 12).map((i) => `  • ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n');
  const more = r.error.issues.length > 12 ? `\n  … and ${r.error.issues.length - 12} more` : '';
  throw new Error(`Invalid ${what}:\n${issues}${more}`);
}

export { z };
