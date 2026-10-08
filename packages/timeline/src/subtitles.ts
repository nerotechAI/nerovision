import type { SubtitleCue } from '@nero/schemas';

export interface TimedWord {
  word: string; // as written in the script (keeps punctuation/accents)
  start: number; // absolute seconds in the video
  end: number;
  /** where the timing came from */
  source: 'whisper' | 'provider' | 'estimate';
}

/** Tokenize script text into display words (punctuation stays attached). */
export function scriptWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/** Lowercase, strip accents and punctuation – used only for matching. */
export function normWord(w: string): string {
  return w
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Fallback timing: distribute a segment's exact duration over its words by weight
 * (character count + extra weight for punctuation pauses). Segment boundaries are exact
 * because they come from the measured audio file.
 */
export function estimateWordTimings(text: string, startSec: number, durationSec: number): TimedWord[] {
  const words = scriptWords(text);
  if (words.length === 0) return [];
  const weight = (w: string) => Math.max(2, normWord(w).length) + (/[.!?…]$/.test(w) ? 4 : /[,;:]$/.test(w) ? 2 : 0);
  const total = words.reduce((a, w) => a + weight(w), 0);
  let t = startSec;
  return words.map((w) => {
    const d = (weight(w) / total) * durationSec;
    const tw: TimedWord = { word: w, start: t, end: t + d, source: 'estimate' };
    t += d;
    return tw;
  });
}

/**
 * Map recognized words (e.g. faster-whisper, which may misspell names or drop accents)
 * onto the script's words with a global edit-distance alignment. Script spelling and
 * punctuation are kept; timings come from the recognizer. Unmatched script words are
 * interpolated between their matched neighbours.
 */
export function alignWords(script: string[], recognized: { word: string; start: number; end: number }[], segStart: number, segEnd: number): TimedWord[] {
  const a = script.map(normWord);
  const b = recognized.map((r) => normWord(r.word));
  const n = a.length;
  const m = b.length;
  if (n === 0) return [];
  if (m === 0) return estimateWordTimings(script.join(' '), segStart, segEnd - segStart);

  // DP over (n+1)x(m+1): cost 0 for equal, 1 for substitution, 1 for gaps
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++) {
      const sub = dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : similar(a[i - 1], b[j - 1]) ? 0 : 1);
      dp[i][j] = Math.min(sub, dp[i - 1][j] + 1, dp[i][j - 1] + 1);
    }
  const match: (number | null)[] = new Array(n).fill(null);
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    const cost = a[i - 1] === b[j - 1] || similar(a[i - 1], b[j - 1]) ? 0 : 1;
    if (dp[i][j] === dp[i - 1][j - 1] + cost) {
      match[i - 1] = j - 1; // matched or substituted: take the recognizer timing
      i--;
      j--;
    } else if (dp[i][j] === dp[i - 1][j] + 1) i--;
    else j--;
  }

  const out: TimedWord[] = script.map((w, k) => {
    const r = match[k] !== null ? recognized[match[k]!] : null;
    return { word: w, start: r ? r.start : NaN, end: r ? r.end : NaN, source: r ? 'whisper' : 'estimate' };
  });
  // interpolate gaps
  for (let k = 0; k < n; k++) {
    if (!Number.isNaN(out[k].start)) continue;
    let e = k;
    while (e < n && Number.isNaN(out[e].start)) e++;
    const from = k > 0 ? out[k - 1].end : segStart;
    const to = e < n ? out[e].start : segEnd;
    const span = Math.max(0, to - from);
    const count = e - k;
    for (let q = 0; q < count; q++) {
      out[k + q].start = from + (span * q) / count;
      out[k + q].end = from + (span * (q + 1)) / count;
    }
    k = e - 1;
  }
  // enforce monotonic, clamp to the segment
  let last = segStart;
  for (const w of out) {
    w.start = Math.min(Math.max(w.start, last), segEnd);
    w.end = Math.min(Math.max(w.end, w.start), segEnd);
    last = w.start;
  }
  return out;
}

function similar(x: string, y: string): boolean {
  if (!x || !y) return false;
  if (x.length > 3 && y.length > 3 && (x.startsWith(y) || y.startsWith(x))) return true;
  return levenshtein(x, y) <= Math.floor(Math.max(x.length, y.length) / 4);
}

function levenshtein(x: string, y: string): number {
  const prev = Array.from({ length: y.length + 1 }, (_, k) => k);
  for (let i = 1; i <= x.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= y.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (x[i - 1] === y[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[y.length];
}

export interface CueOptions {
  maxCharsPerLine: number; // 42 is the common broadcast default
  maxLines: number; // 2
  maxDurationSec: number; // 6
  minDurationSec: number; // 0.9
  minGapSec: number; // 0.05
}
export const DEFAULT_CUE_OPTIONS: CueOptions = { maxCharsPerLine: 42, maxLines: 2, maxDurationSec: 6, minDurationSec: 0.9, minGapSec: 0.05 };

/** Split a cue's text into ≤ maxLines balanced lines without breaking words. */
export function breakLines(text: string, maxChars: number, maxLines = 2): string[] {
  if (text.length <= maxChars) return [text];
  const words = text.split(' ');
  let best: string[] = [text];
  let bestScore = Infinity;
  // try every split point for two lines; pick the most balanced valid one
  for (let k = 1; k < words.length; k++) {
    const l1 = words.slice(0, k).join(' ');
    const l2 = words.slice(k).join(' ');
    const over = Math.max(0, l1.length - maxChars) + Math.max(0, l2.length - maxChars);
    // prefer breaking after punctuation, avoid ending line 1 with a short function word
    const punctBonus = /[,;:.!?]$/.test(words[k - 1]) ? -6 : 0;
    const weakEnd = /^(a|o|as|os|e|de|da|do|das|dos|em|no|na|um|uma|que|se|por|para|com)$/i.test(words[k - 1]) ? 8 : 0;
    const score = over * 100 + Math.abs(l1.length - l2.length) + punctBonus + weakEnd;
    if (score < bestScore) {
      bestScore = score;
      best = [l1, l2];
    }
  }
  return best.slice(0, maxLines);
}

/** Group timed words into readable cues. Sentences end cues; long sentences break at commas. */
export function buildCues(words: TimedWord[], opts: CueOptions = DEFAULT_CUE_OPTIONS): SubtitleCue[] {
  const maxChars = opts.maxCharsPerLine * opts.maxLines;
  const cues: SubtitleCue[] = [];
  let cur: TimedWord[] = [];
  const flush = () => {
    if (cur.length === 0) return;
    const text = cur.map((w) => w.word).join(' ');
    cues.push({ index: cues.length + 1, start: cur[0].start, end: cur[cur.length - 1].end, text, lines: breakLines(text, opts.maxCharsPerLine, opts.maxLines) });
    cur = [];
  };
  for (let k = 0; k < words.length; k++) {
    const w = words[k];
    const prev = cur[cur.length - 1];
    // a long silence between words always starts a new cue
    if (prev && w.start - prev.end > 0.7) flush();
    const candidate = [...cur, w].map((x) => x.word).join(' ');
    const dur = cur.length ? w.end - cur[0].start : 0;
    if (cur.length && (candidate.length > maxChars || dur > opts.maxDurationSec)) flush();
    cur.push(w);
    const text = cur.map((x) => x.word).join(' ');
    if (/[.!?…]["»”]?$/.test(w.word)) flush();
    else if (/[,;:—]$/.test(w.word) && text.length > maxChars * 0.6) flush();
  }
  flush();

  // timing hygiene: minimum duration, no overlap, small gap
  for (let k = 0; k < cues.length; k++) {
    const c = cues[k];
    const next = cues[k + 1];
    const limit = next ? next.start - opts.minGapSec : Infinity;
    if (c.end - c.start < opts.minDurationSec) c.end = Math.min(c.start + opts.minDurationSec, Math.max(limit, c.end));
    if (next && c.end > limit) c.end = Math.max(c.start + 0.2, limit);
  }
  return cues;
}

function ts(sec: number, sep: ',' | '.'): string {
  const ms = Math.max(0, Math.round(sec * 1000));
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const r = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}${sep}${String(r).padStart(3, '0')}`;
}

export function toSrt(cues: SubtitleCue[]): string {
  return cues.map((c, k) => `${k + 1}\n${ts(c.start, ',')} --> ${ts(c.end, ',')}\n${c.lines.join('\n')}\n`).join('\n');
}

export function toVtt(cues: SubtitleCue[]): string {
  return 'WEBVTT\n\n' + cues.map((c) => `${ts(c.start, '.')} --> ${ts(c.end, '.')}\n${c.lines.join('\n')}\n`).join('\n');
}

/** Returns a list of problems; empty means valid. */
export function validateCues(cues: SubtitleCue[], videoDurationSec: number, opts: CueOptions = DEFAULT_CUE_OPTIONS): string[] {
  const problems: string[] = [];
  cues.forEach((c, k) => {
    if (!(c.start >= 0)) problems.push(`cue ${k + 1}: negative start`);
    if (!(c.end > c.start)) problems.push(`cue ${k + 1}: end ≤ start`);
    if (c.end > videoDurationSec + 0.05) problems.push(`cue ${k + 1}: ends at ${c.end.toFixed(2)}s after the video (${videoDurationSec.toFixed(2)}s)`);
    if (k > 0 && c.start < cues[k - 1].end - 1e-6) problems.push(`cue ${k + 1}: overlaps previous cue`);
    if (c.lines.length > opts.maxLines) problems.push(`cue ${k + 1}: ${c.lines.length} lines`);
    c.lines.forEach((l) => {
      if (l.length > opts.maxCharsPerLine + 12) problems.push(`cue ${k + 1}: line too long (${l.length} chars)`);
    });
  });
  return problems;
}

/** Parse SRT back into cues (used by QA to validate the exported file itself). */
export function parseSrt(srt: string): SubtitleCue[] {
  const blocks = srt.replace(/\r/g, '').trim().split(/\n\n+/);
  const toSec = (t: string) => {
    const m = /(\d+):(\d+):(\d+)[,.](\d+)/.exec(t);
    if (!m) throw new Error(`bad timestamp ${t}`);
    return +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000;
  };
  return blocks.filter(Boolean).map((b, k) => {
    const lines = b.split('\n');
    const [a, z] = lines[1].split('-->').map((x) => x.trim());
    const textLines = lines.slice(2);
    return { index: k + 1, start: toSec(a), end: toSec(z), text: textLines.join(' '), lines: textLines };
  });
}
