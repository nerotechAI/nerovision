import fs from 'node:fs';
import { EditorialPackage, NarrationManifest, Project, ProjectSettings, SCHEMA_VERSION, Storyboard, Timeline, parseOrThrow } from '@nero/schemas';
import { exists, readJson, writeJson, ensureDir } from './fsutil';
import { assertProjectId, projectPaths, projectsDir, slugify } from './paths';

export function createProject(input: { id?: string; title: string; topic: string; settings?: Partial<ProjectSettings> }): Project {
  const id = assertProjectId(input.id ?? slugify(input.title));
  const p = projectPaths(id);
  if (exists(p.project)) throw new Error(`Project "${id}" already exists.`);
  const now = new Date().toISOString();
  const project = parseOrThrow(
    Project,
    { schemaVersion: SCHEMA_VERSION, id, title: input.title, topic: input.topic, createdAt: now, updatedAt: now, settings: ProjectSettings.parse(input.settings ?? {}) },
    'project',
  );
  for (const d of [p.root, p.narrationDir, p.assetsDir, p.subtitlesDir, p.audioDir, p.renderDir, p.qaDir, p.exportDir, p.checkpointsDir, p.logsDir]) ensureDir(d);
  writeJson(p.project, project);
  return project;
}

export function loadProject(id: string): Project {
  const p = projectPaths(id);
  if (!exists(p.project)) throw new Error(`Project "${id}" not found in ${projectsDir()}. Create it with: npm run nero -- create`);
  return parseOrThrow(Project, readJson(p.project), `project.json (${id})`);
}

export function saveProject(project: Project): Project {
  const next = parseOrThrow(Project, { ...project, updatedAt: new Date().toISOString() }, 'project');
  writeJson(projectPaths(project.id).project, next);
  return next;
}

export function updateSettings(id: string, patch: Partial<ProjectSettings>): Project {
  const project = loadProject(id);
  const merged = { ...project.settings, ...patch } as ProjectSettings;
  return saveProject({ ...project, settings: ProjectSettings.parse(merged) });
}

export function listProjects(): Project[] {
  const dir = projectsDir();
  if (!exists(dir)) return [];
  const out: Project[] = [];
  for (const name of fs.readdirSync(dir)) {
    try {
      out.push(loadProject(name));
    } catch {
      /* not a project folder */
    }
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function deleteProject(id: string): void {
  const p = projectPaths(id);
  if (!exists(p.project)) throw new Error(`Project "${id}" not found.`);
  fs.rmSync(p.root, { recursive: true, force: true });
}

export const load = {
  editorial: (id: string) => parseOrThrow(EditorialPackage, readJson(projectPaths(id).editorial), 'editorial package'),
  storyboard: (id: string) => parseOrThrow(Storyboard, readJson(projectPaths(id).storyboard), 'storyboard'),
  narration: (id: string) => parseOrThrow(NarrationManifest, readJson(projectPaths(id).narrationManifest), 'narration manifest'),
  timeline: (id: string) => parseOrThrow(Timeline, readJson(projectPaths(id).timeline), 'timeline'),
};

export function has(id: string, what: 'editorial' | 'storyboard' | 'narration' | 'timeline'): boolean {
  const p = projectPaths(id);
  const f = { editorial: p.editorial, storyboard: p.storyboard, narration: p.narrationManifest, timeline: p.timeline }[what];
  return exists(f);
}
