import fs from 'node:fs';
import path from 'node:path';
import { exists, readJson, writeJson } from './fsutil';

export interface Checkpoint {
  stage: string;
  inputHash: string;
  completedAt: string;
  /** absolute or project-relative files the stage produced; all must still exist for the checkpoint to be fresh */
  outputs: string[];
  meta?: Record<string, unknown>;
}

export class Checkpoints {
  constructor(
    private readonly dir: string,
    private readonly projectRoot: string,
  ) {}

  private file(stage: string) {
    return path.join(this.dir, `${stage}.json`);
  }

  get(stage: string): Checkpoint | null {
    const f = this.file(stage);
    if (!exists(f)) return null;
    try {
      return readJson<Checkpoint>(f);
    } catch {
      return null;
    }
  }

  /** Fresh = same inputs as last successful run and every output still on disk. */
  isFresh(stage: string, inputHash: string): boolean {
    const cp = this.get(stage);
    if (!cp || cp.inputHash !== inputHash) return false;
    return cp.outputs.every((o) => exists(path.isAbsolute(o) ? o : path.join(this.projectRoot, o)));
  }

  save(stage: string, inputHash: string, outputs: string[], meta?: Record<string, unknown>): Checkpoint {
    const cp: Checkpoint = {
      stage,
      inputHash,
      completedAt: new Date().toISOString(),
      outputs: outputs.map((o) => (path.isAbsolute(o) ? path.relative(this.projectRoot, o).split(path.sep).join('/') : o)),
      meta,
    };
    writeJson(this.file(stage), cp);
    return cp;
  }

  invalidate(stage: string): void {
    const f = this.file(stage);
    if (exists(f)) fs.unlinkSync(f);
  }

  all(): Record<string, Checkpoint | null> {
    const out: Record<string, Checkpoint | null> = {};
    if (!exists(this.dir)) return out;
    for (const f of fs.readdirSync(this.dir)) if (f.endsWith('.json')) out[f.slice(0, -5)] = this.get(f.slice(0, -5));
    return out;
  }
}
