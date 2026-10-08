/**
 * Pure timing math. The narration audio is the source of truth: a scene lasts exactly
 * leadIn + speech + pause (never stretched), and every boundary is snapped to a frame
 * from the *cumulative* time so rounding never drifts and there are no gaps.
 */

export interface TimingInput {
  id: string;
  /** measured speech duration in seconds (null for visual-only beats) */
  speechSec: number | null;
  minDurationSec: number;
  pauseAfterSec: number;
}

export interface SceneTiming {
  id: string;
  startSec: number;
  endSec: number;
  durationSec: number;
  startFrame: number;
  durationFrames: number;
  narrationStartSec: number | null;
  narrationDurationSec: number | null;
}

export function secToFrame(sec: number, fps: number): number {
  return Math.round(sec * fps);
}

export function frameToSec(frame: number, fps: number): number {
  return frame / fps;
}

export function computeSceneTimings(scenes: TimingInput[], fps: number, leadInSec: number): SceneTiming[] {
  if (fps <= 0 || !Number.isFinite(fps)) throw new Error(`Invalid fps ${fps}`);
  const out: SceneTiming[] = [];
  let cursorSec = 0;
  for (const s of scenes) {
    if (s.speechSec !== null && (!Number.isFinite(s.speechSec) || s.speechSec <= 0)) throw new Error(`Scene ${s.id}: invalid speech duration ${s.speechSec}`);
    const natural = s.speechSec === null ? 0 : leadInSec + s.speechSec + s.pauseAfterSec;
    const dur = Math.max(natural, s.minDurationSec);
    const startFrame = secToFrame(cursorSec, fps);
    const endFrame = Math.max(startFrame + 1, secToFrame(cursorSec + dur, fps));
    const startSec = frameToSec(startFrame, fps);
    out.push({
      id: s.id,
      startSec,
      endSec: frameToSec(endFrame, fps),
      durationSec: frameToSec(endFrame - startFrame, fps),
      startFrame,
      durationFrames: endFrame - startFrame,
      // narration is anchored to the frame-aligned start so picture and voice stay locked
      narrationStartSec: s.speechSec === null ? null : startSec + leadInSec,
      narrationDurationSec: s.speechSec,
    });
    cursorSec += dur;
  }
  return out;
}

/** Throws if the timeline has a gap, an overlap, or speech that spills into the next scene's speech. */
export function assertContiguous(t: SceneTiming[], fps: number): void {
  for (let i = 0; i < t.length; i++) {
    const s = t[i];
    if (s.durationFrames < 1) throw new Error(`Scene ${s.id} has no frames`);
    if (i === 0 && s.startFrame !== 0) throw new Error(`Timeline must start at frame 0 (starts at ${s.startFrame})`);
    if (i > 0) {
      const prev = t[i - 1];
      if (prev.startFrame + prev.durationFrames !== s.startFrame) throw new Error(`Gap/overlap between ${prev.id} and ${s.id}`);
    }
    if (s.narrationStartSec !== null && s.narrationDurationSec !== null) {
      const speechEnd = s.narrationStartSec + s.narrationDurationSec;
      const next = t[i + 1];
      if (next?.narrationStartSec != null && speechEnd > next.narrationStartSec + 1e-6)
        throw new Error(`Narration of ${s.id} overlaps narration of ${next.id}`);
      if (speechEnd > s.endSec + 1 / fps + 1e-6 && !next) throw new Error(`Narration of ${s.id} runs past the end of the video`);
    }
  }
}

/** Transition length in frames, clamped so it never eats more than 40% of either neighbour. */
export function transitionFrames(type: string, durationSec: number, fps: number, prevFrames: number, nextFrames: number): number {
  if (type === 'cut') return 0;
  const wanted = secToFrame(durationSec, fps);
  return Math.max(0, Math.min(wanted, Math.floor(prevFrames * 0.4), Math.floor(nextFrames * 0.4)));
}

/** "mm:ss" for YouTube chapters ("h:mm:ss" past one hour). */
export function formatChapterTime(sec: number): string {
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}
