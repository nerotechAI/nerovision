import { config, has, load, loadProject, projectPaths, writeJson } from '@nero/core';
import { EditorialPackage, NarrationManifest, Project, SCHEMA_VERSION, Storyboard, Timeline } from '@nero/schemas';
import { buildStoryboard, buildTimeline } from '@nero/timeline';
import { unsupportedScenes } from '../support';

const SIZES: Record<Project['settings']['resolution'], [number, number]> = {
  '720p': [1280, 720],
  '1080p': [1920, 1080],
  '1440p': [2560, 1440],
  '2160p': [3840, 2160],
};

export interface PreparedTimeline {
  timeline: Timeline;
  storyboard: Storyboard;
  warnings: string[];
}

/** editorial → storyboard → timeline, in memory, using the same builders as the full pipeline. */
export function composeTimeline(project: Project, editorial: EditorialPackage, opts: { previous?: Storyboard | null; narration?: NarrationManifest | null } = {}): PreparedTimeline {
  const sb = buildStoryboard(editorial, { projectId: project.id, voice: project.settings.voice, previous: opts.previous ?? null });
  const narrated = sb.scenes.filter((s) => s.narration);
  if (narrated.length > 0 && !opts.narration)
    throw new Error(`${narrated.length} scene(s) have narration but there is no narration manifest. The narration stage is not built yet; render visual-only scenes (narration: null) for now.`);
  // With no narrated scene there is nothing to measure or estimate, so an empty manifest is exact.
  const manifest: NarrationManifest = opts.narration ?? {
    schemaVersion: SCHEMA_VERSION,
    projectId: project.id,
    mode: 'audio',
    sampleRate: config().narrationSampleRate,
    segments: [],
    totalSpeechSec: 0,
  };
  const [width, height] = SIZES[project.settings.resolution];
  const built = buildTimeline(sb, manifest, {
    fps: config().fps,
    width,
    height,
    leadInSec: project.settings.voice.leadInSec,
    intensity: project.settings.visualIntensity,
    sfxFiles: {},
  });
  const warnings = [
    ...sb.warnings,
    // no sound library yet: sfx cues are expected to be dropped, so do not report them as problems
    ...built.warnings.filter((w) => !w.includes('sound library')),
    ...unsupportedScenes(built.timeline).map((s) => `Scene ${s.id}: type "${s.type}" has no renderer yet; the particle-field fallback is used.`),
  ];
  return { timeline: built.timeline, storyboard: built.storyboard, warnings };
}

/** Build and persist storyboard.json + timeline.json for a project on disk. */
export function prepareTimeline(projectId: string): PreparedTimeline {
  const project = loadProject(projectId);
  const p = projectPaths(projectId);
  const prepared = composeTimeline(project, load.editorial(projectId), {
    previous: has(projectId, 'storyboard') ? load.storyboard(projectId) : null,
    narration: has(projectId, 'narration') ? load.narration(projectId) : null,
  });
  writeJson(p.storyboard, prepared.storyboard);
  writeJson(p.timeline, prepared.timeline);
  return prepared;
}
