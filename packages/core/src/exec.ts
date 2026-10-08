import { spawn } from 'node:child_process';

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface RunOptions {
  cwd?: string;
  input?: string;
  /** called with each stderr chunk (ffmpeg writes progress to stderr) */
  onStderr?: (chunk: string) => void;
  onStdout?: (chunk: string) => void;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  /** keep at most this many chars of stdout/stderr in memory */
  maxBuffer?: number;
}

export class CommandError extends Error {
  constructor(
    public readonly command: string,
    public readonly result: RunResult,
  ) {
    const tail = (result.stderr || result.stdout).trim().split('\n').slice(-12).join('\n');
    super(`Command failed (exit ${result.code}): ${command}\n${tail}`);
  }
}

/** Spawn without a shell (no quoting problems on Windows paths with spaces). */
export function run(cmd: string, args: string[], opts: RunOptions = {}): Promise<RunResult> {
  const max = opts.maxBuffer ?? 4_000_000;
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(cmd, args, { cwd: opts.cwd, env: opts.env ?? process.env, windowsHide: true });
    } catch (e) {
      reject(e);
      return;
    }
    let stdout = '';
    let stderr = '';
    let timer: NodeJS.Timeout | null = null;
    if (opts.timeoutMs) timer = setTimeout(() => child.kill('SIGKILL'), opts.timeoutMs);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (d: string) => {
      if (stdout.length < max) stdout += d;
      opts.onStdout?.(d);
    });
    child.stderr.on('data', (d: string) => {
      stderr = (stderr + d).slice(-max);
      opts.onStderr?.(d);
    });
    child.on('error', (err: NodeJS.ErrnoException) => {
      if (timer) clearTimeout(timer);
      if (err.code === 'ENOENT') reject(new Error(`Executable not found: "${cmd}". Install it or set its path in .env.`));
      else reject(err);
    });
    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      resolve({ code: code ?? -1, stdout, stderr });
    });
    if (opts.input !== undefined) child.stdin.end(opts.input);
    else child.stdin.end();
  });
}

/** Like run(), but rejects with a readable CommandError on a non-zero exit. */
export async function runOk(cmd: string, args: string[], opts: RunOptions = {}): Promise<RunResult> {
  const r = await run(cmd, args, opts);
  if (r.code !== 0) throw new CommandError(`${cmd} ${args.join(' ')}`.slice(0, 600), r);
  return r;
}
