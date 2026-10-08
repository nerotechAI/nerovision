import { NarrationManifest, SCHEMA_VERSION, Storyboard, StoryboardScene, Timeline, SubtitleCue, parseOrThrow } from '@nero/schemas';
import { assertContiguous, computeSceneTimings, secToFrame, transitionFrames } from './timing';

export interface BuildTimelineOptions {
  fps: number;
  width: number;
  height: number;
  leadInSec: number;
  intensity: Timeline['intensity'];
  /** sfx id → project-relative file; cues whose id is missing are dropped with a warning */
  sfxFiles: Record<string, string>;
  captions?: SubtitleCue[];
  showCaptions?: boolean;
  /** max gain for an effect that lands while the narrator is speaking */
  sfxUnderNarrationMaxDb?: number;
}

export interface BuiltTimeline {
  timeline: Timeline;
  storyboard: Storyboard; // storyboard with timing + narrationAudio filled in
  warnings: string[];
}

export function buildTimeline(sb: Storyboard, manifest: NarrationManifest, opts: BuildTimelineOptions): BuiltTimeline {
  const warnings: string[] = [];
  const segById = new Map(manifest.segments.map((s) => [s.sceneId, s]));

  for (const s of sb.scenes) {
    if (s.narration && !segById.has(s.id)) throw new Error(`Scene ${s.id} has narration text but no narration audio. Run the narration stage first.`);
    const seg = segById.get(s.id);
    if (seg && s.narration && seg.text !== s.narration) throw new Error(`Narration for ${s.id} is stale (text changed). Regenerate narration for this scene.`);
  }

  const timings = computeSceneTimings(
    sb.scenes.map((s) => ({
      id: s.id,
      speechSec: s.narration ? segById.get(s.id)!.durationSec : null,
      minDurationSec: s.minDurationSec,
      pauseAfterSec: s.pauseAfterSec,
    })),
    opts.fps,
    opts.leadInSec,
  );
  assertContiguous(timings, opts.fps);
  const durationInFrames = timings[timings.length - 1].startFrame + timings[timings.length - 1].durationFrames;

  const chapterNumber = new Map(sb.chapters.map((c, i) => [c.id, i + 1]));
  const chapterTitle = new Map(sb.chapters.map((c) => [c.id, c.title]));

  const tIn = sb.scenes.map((s, i) =>
    i === 0 ? 0 : transitionFrames(s.transition.type, s.transition.durationSec, opts.fps, timings[i - 1].durationFrames, timings[i].durationFrames),
  );

  const scenes = sb.scenes.map((s, i) => {
    const t = timings[i];
    return {
      id: s.id,
      index: i,
      chapterId: s.chapterId,
      type: s.type,
      epistemic: s.epistemic,
      narration: s.narration,
      description: s.visual.description,
      seed: s.seed,
      from: t.startFrame,
      durationInFrames: t.durationFrames,
      tailFrames: tIn[i + 1] ?? 0,
      transitionIn: { type: i === 0 ? ('cut' as const) : s.transition.type, frames: tIn[i] },
      camera: s.camera,
      overlays: s.overlays,
      textOverlays: s.textOverlays,
      data: s.data,
      asset:
        s.asset.status === 'resolved' && s.asset.path && s.asset.kind
          ? { src: s.asset.path, kind: s.asset.kind, durationSec: s.asset.durationSec, width: s.asset.width, height: s.asset.height }
          : null,
      chapterTitle: chapterTitle.get(s.chapterId) ?? '',
      chapterNumber: chapterNumber.get(s.chapterId) ?? 0,
    };
  });

  // chapters start at their first scene
  const chapters = sb.chapters
    .map((c) => {
      const first = scenes.find((s) => s.chapterId === c.id);
      return first ? { id: c.id, title: c.title, number: chapterNumber.get(c.id)!, startFrame: first.from, startSec: first.from / opts.fps } : null;
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  // ── audio placements ──
  const narration = sb.scenes
    .map((s, i) => {
      const seg = segById.get(s.id);
      const t = timings[i];
      return seg && t.narrationStartSec !== null ? { sceneId: s.id, file: seg.file, startSec: t.narrationStartSec, durationSec: seg.durationSec } : null;
    })
    .filter((n): n is NonNullable<typeof n> => n !== null);

  const speaking = (sec: number) => narration.some((n) => sec >= n.startSec - 0.1 && sec <= n.startSec + n.durationSec + 0.1);
  const underMax = opts.sfxUnderNarrationMaxDb ?? -22;
  const sfx: Timeline['audio']['sfx'] = [];
  const addSfx = (scene: StoryboardScene, id: string, atSec: number, gainDb: number) => {
    const file = opts.sfxFiles[id];
    if (!file) {
      warnings.push(`Scene ${scene.id}: sound effect "${id}" is not in the sound library; skipped.`);
      return;
    }
    const startSec = Math.max(0, timings[scene.index].startSec + atSec);
    sfx.push({ id, file, startSec, gainDb: speaking(startSec) ? Math.min(gainDb, underMax) : gainDb });
  };
  for (const s of sb.scenes) {
    for (const c of s.sfx) addSfx(s, c.id, c.atSec, c.gainDb);
    if (s.sfx.length === 0) {
      if (s.type === 'chapter_card') addSfx(s, 'impact-01', 0, -12);
      else if (s.transition.type === 'glitch' && s.index > 0) addSfx(s, 'glitch-01', 0, -18);
      else if (s.transition.type === 'flash' && s.index > 0) addSfx(s, 'whoosh-01', -0.25, -18);
    }
  }

  // contiguous music cue regions
  const music: Timeline['audio']['music'] = [];
  sb.scenes.forEach((s, i) => {
    const t = timings[i];
    const last = music[music.length - 1];
    if (last && last.cue === s.musicCue) last.endSec = t.endSec;
    else music.push({ cue: s.musicCue, startSec: t.startSec, endSec: t.endSec });
  });

  const timeline = parseOrThrow(
    Timeline,
    {
      schemaVersion: SCHEMA_VERSION,
      projectId: sb.projectId,
      title: sb.title,
      fps: opts.fps,
      width: opts.width,
      height: opts.height,
      durationInFrames,
      durationSec: durationInFrames / opts.fps,
      narrationMode: manifest.mode,
      intensity: opts.intensity,
      chapters,
      scenes,
      captions: opts.captions ?? [],
      showCaptions: opts.showCaptions ?? false,
      audio: { narration, sfx: sfx.sort((a, b) => a.startSec - b.startSec), music },
    },
    'timeline',
  );

  const storyboard: Storyboard = {
    ...sb,
    scenes: sb.scenes.map((s, i) => ({
      ...s,
      narrationAudio: segById.get(s.id)?.file ?? null,
      timing: { ...timings[i], durationFrames: timings[i].durationFrames, startFrame: timings[i].startFrame },
    })),
  };
  // the timing object carries an `id` field from computeSceneTimings; strip it for the schema
  storyboard.scenes.forEach((s) => {
    if (s.timing) delete (s.timing as Record<string, unknown>).id;
  });

  return { timeline, storyboard, warnings };
}

/** Frame range [start, end] (inclusive) covering the first `seconds` of the video, cut at a scene boundary when possible. */
export function previewFrameRange(tl: Timeline, seconds: number): [number, number] {
  const want = Math.min(tl.durationInFrames, secToFrame(seconds, tl.fps));
  const boundary = tl.scenes.map((s) => s.from + s.durationInFrames).find((end) => end >= want && end - want < tl.fps * 6);
  const end = Math.min(tl.durationInFrames, boundary ?? want);
  return [0, end - 1];
}
