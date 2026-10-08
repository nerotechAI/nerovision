import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let cachedRoot: string | null = null;

/** Repo root: NERO_ROOT, or the nearest ancestor whose package.json is "nero-vision-studio". */
export function repoRoot(): string {
  if (cachedRoot) return cachedRoot;
  if (process.env.NERO_ROOT) return (cachedRoot = path.resolve(process.env.NERO_ROOT));
  const starts = [process.cwd(), path.dirname(fileURLToPath(import.meta.url))];
  for (const start of starts) {
    let dir = path.resolve(start);
    for (;;) {
      const pkg = path.join(dir, 'package.json');
      if (fs.existsSync(pkg)) {
        try {
          if (JSON.parse(fs.readFileSync(pkg, 'utf8')).name === 'nero-vision-studio') return (cachedRoot = dir);
        } catch {
          /* ignore malformed */
        }
      }
      const up = path.dirname(dir);
      if (up === dir) break;
      dir = up;
    }
  }
  throw new Error('Could not locate the nero-vision-studio root. Run commands from inside the repo or set NERO_ROOT.');
}

export function projectsDir(): string {
  return path.resolve(process.env.NERO_PROJECTS_DIR ?? path.join(repoRoot(), 'projects'));
}

export function assetsDir(): string {
  return path.resolve(process.env.NERO_ASSETS_DIR ?? path.join(repoRoot(), 'assets'));
}

export function dataDir(): string {
  return path.resolve(process.env.NERO_DATA_DIR ?? path.join(repoRoot(), '.nero'));
}

const PROJECT_ID = /^[a-z0-9][a-z0-9-]{0,80}$/;

export function assertProjectId(id: string): string {
  if (!PROJECT_ID.test(id)) throw new Error(`Invalid project id "${id}". Use lowercase letters, digits and dashes.`);
  return id;
}

/** Every path inside a project folder, in one place. */
export function projectPaths(id: string) {
  assertProjectId(id);
  const root = path.join(projectsDir(), id);
  return {
    root,
    project: path.join(root, 'project.json'),
    editorial: path.join(root, 'editorial.json'),
    storyboard: path.join(root, 'storyboard.json'),
    narrationDir: path.join(root, 'narration'),
    narrationManifest: path.join(root, 'narration', 'manifest.json'),
    assetsDir: path.join(root, 'assets'),
    timeline: path.join(root, 'timeline.json'),
    subtitlesDir: path.join(root, 'subtitles'),
    srt: path.join(root, 'subtitles', 'legendas.pt-BR.srt'),
    vtt: path.join(root, 'subtitles', 'legendas.pt-BR.vtt'),
    words: path.join(root, 'subtitles', 'words.json'),
    audioDir: path.join(root, 'audio'),
    mix: path.join(root, 'audio', 'mix.wav'),
    mixReport: path.join(root, 'audio', 'mix-report.json'),
    renderDir: path.join(root, 'render'),
    qaDir: path.join(root, 'qa'),
    exportDir: path.join(root, 'export'),
    thumbnailsDir: path.join(root, 'export', 'thumbnails'),
    checkpointsDir: path.join(root, 'checkpoints'),
    logsDir: path.join(root, 'logs'),
  };
}
export type ProjectPaths = ReturnType<typeof projectPaths>;

/** Resolve a project-relative path, refusing anything that escapes the project folder. */
export function resolveInProject(projectRoot: string, rel: string): string {
  const abs = path.resolve(projectRoot, rel);
  const rootWithSep = path.resolve(projectRoot) + path.sep;
  if (abs !== path.resolve(projectRoot) && !abs.startsWith(rootWithSep)) throw new Error(`Path escapes project folder: ${rel}`);
  return abs;
}

/** Project-relative path with forward slashes (what Remotion's staticFile() expects). */
export function toProjectRel(projectRoot: string, abs: string): string {
  return path.relative(projectRoot, abs).split(path.sep).join('/');
}

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
