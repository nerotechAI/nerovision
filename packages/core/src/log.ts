import fs from 'node:fs';
import path from 'node:path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export interface LogEvent {
  level: LogLevel;
  message: string;
  stage?: string;
  progress?: number; // 0..1 within the stage
  time: string;
}
export type LogSink = (e: LogEvent) => void;

/** A logger that fans out to sinks (console, project log file, job runner SSE). */
export class Logger {
  private sinks: LogSink[] = [];
  constructor(private readonly stage?: string) {}

  addSink(s: LogSink): this {
    this.sinks.push(s);
    return this;
  }

  child(stage: string): Logger {
    const l = new Logger(stage);
    l.sinks = this.sinks;
    return l;
  }

  private emit(level: LogLevel, message: string, progress?: number) {
    const e: LogEvent = { level, message, stage: this.stage, progress, time: new Date().toISOString() };
    for (const s of this.sinks) {
      try {
        s(e);
      } catch {
        /* a broken sink must never break production */
      }
    }
  }
  debug(m: string) {
    this.emit('debug', m);
  }
  info(m: string) {
    this.emit('info', m);
  }
  warn(m: string) {
    this.emit('warn', m);
  }
  error(m: string) {
    this.emit('error', m);
  }
  progress(fraction: number, m = '') {
    this.emit('info', m, Math.max(0, Math.min(1, fraction)));
  }
}

const colors: Record<LogLevel, string> = { debug: '\x1b[90m', info: '\x1b[36m', warn: '\x1b[33m', error: '\x1b[31m' };

export function consoleSink(opts: { verbose?: boolean } = {}): LogSink {
  let lastProgressLine = 0;
  return (e) => {
    if (e.level === 'debug' && !opts.verbose) return;
    const tag = e.stage ? `[${e.stage}]` : '';
    if (e.progress !== undefined) {
      const now = Date.now();
      if (now - lastProgressLine < 1000 && e.progress < 1) return; // throttle
      lastProgressLine = now;
      const pct = `${Math.round(e.progress * 100)}%`.padStart(4);
      process.stdout.write(`${colors.info}${tag}\x1b[0m ${pct} ${e.message}\n`);
      return;
    }
    const out = e.level === 'error' || e.level === 'warn' ? process.stderr : process.stdout;
    out.write(`${colors[e.level]}${tag}\x1b[0m ${e.message}\n`);
  };
}

export function fileSink(file: string): LogSink {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  return (e) => {
    if (e.progress !== undefined && e.progress < 1 && !e.message) return;
    fs.appendFileSync(file, `${e.time} ${e.level.toUpperCase()} ${e.stage ?? '-'} ${e.progress !== undefined ? `(${Math.round(e.progress * 100)}%) ` : ''}${e.message}\n`);
  };
}
