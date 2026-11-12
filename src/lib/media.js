import { spawn } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { config } from '../config.js';
import { errors } from './errors.js';
import { log } from './logger.js';

/**
 * FFmpeg helpers + a bounded conversion-job runner.
 *
 * Design notes:
 *  - FFmpeg is OPTIONAL. If the binary is missing the API still streams the
 *    original MP4; only the "convert" features return FFMPEG_MISSING (501).
 *  - Nothing is stored permanently: every job writes into a temp dir that is
 *    swept after JOB_TTL_SECONDS, and files are unlinked as soon as they are
 *    served once via the "one-shot" cleanup timer.
 *  - Jobs are bounded by MAX_CONCURRENT_JOBS and a hard wall-clock timeout so
 *    a single huge video cannot pin the Render instance.
 */

let availability = null; // { ffmpeg:boolean, ffprobe:boolean, version?:string, checkedAt:number }

function execCapture(bin, args, { timeoutMs = 8000 } = {}) {
  return new Promise((resolve) => {
    let out = '';
    let err = '';
    let child;
    try {
      child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      resolve({ ok: false, code: -1, out: '', err: e.message });
      return;
    }
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
    }, timeoutMs);
    child.stdout.on('data', (d) => {
      out += d.toString();
    });
    child.stderr.on('data', (d) => {
      err += d.toString();
    });
    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({ ok: false, code: -1, out, err: e.message });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, code, out, err });
    });
  });
}

export async function checkAvailability({ force = false } = {}) {
  if (!force && availability && Date.now() - availability.checkedAt < 5 * 60_000) return availability;
  const [ff, fp] = await Promise.all([
    execCapture(config.ffmpeg.bin, ['-hide_banner', '-version'], { timeoutMs: 5000 }),
    execCapture(config.ffmpeg.probe, ['-hide_banner', '-version'], { timeoutMs: 5000 }),
  ]);
  const versionMatch = ff.out.match(/ffmpeg version (\S+)/i);
  availability = {
    ffmpeg: ff.ok,
    ffprobe: fp.ok,
    version: versionMatch ? versionMatch[1] : null,
    checkedAt: Date.now(),
  };
  if (!ff.ok) {
    log.warn('ffmpeg not available — conversion features disabled', { bin: config.ffmpeg.bin });
  }
  return availability;
}

/**
 * Probe a remote URL with ffprobe. Used to report the REAL codec/resolution of
 * streams whose provider does not publish it (tikwm/RapidAPI).
 */
export async function probeUrl(url, { timeoutMs = 8000 } = {}) {
  const av = await checkAvailability();
  if (!av.ffprobe) return null;
  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    // Analysis window limits are essential on remote URLs: we only need the
    // container header, not a full decode.
    '-analyzeduration',
    '3000000',
    '-probesize',
    '3000000',
    '-user_agent',
    config.http.userAgent,
    url,
  ];
  const res = await execCapture(config.ffmpeg.probe, args, { timeoutMs });
  if (!res.ok || !res.out) return null;
  try {
    const data = JSON.parse(res.out);
    const video = (data.streams || []).find((s) => s.codec_type === 'video');
    const audio = (data.streams || []).find((s) => s.codec_type === 'audio');
    return {
      width: Number(video?.width) || null,
      height: Number(video?.height) || null,
      videoCodec: video?.codec_name || null,
      audioCodec: audio?.codec_name || null,
      hasAudio: Boolean(audio),
      bitrate: Number(data.format?.bit_rate) || null,
      durationSeconds: Number(data.format?.duration) || null,
      sizeBytes: Number(data.format?.size) || null,
      formatName: data.format?.format_name || null,
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------------- */
/* Conversion job runner                                                      */
/* ------------------------------------------------------------------------- */

const JOB_ROOT = path.join(os.tmpdir(), 'ttdl-jobs');
const jobs = new Map(); // id -> job
let running = 0;
const queue = [];

function ensureRoot() {
  fs.mkdirSync(JOB_ROOT, { recursive: true });
}

function newId() {
  return `j${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function scheduleNext() {
  while (running < config.ffmpeg.maxConcurrent && queue.length) {
    const job = queue.shift();
    if (job.cancelled) continue;
    startJob(job);
  }
}

function startJob(job) {
  running += 1;
  job.state = 'running';
  job.startedAt = Date.now();
  ensureRoot();
  job.dir = path.join(JOB_ROOT, job.id);
  fs.mkdirSync(job.dir, { recursive: true });
  job.output = path.join(job.dir, job.outputName);

  const args = buildArgs(job);
  log.info('ffmpeg start', { id: job.id, kind: job.kind, mode: job.mode });
  const child = spawn(config.ffmpeg.bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  job.child = child;

  let stderrTail = '';
  let progressBuf = '';

  const timer = setTimeout(() => {
    job.error = 'timeout';
    try {
      child.kill('SIGKILL');
    } catch {}
  }, config.ffmpeg.jobTimeoutSeconds * 1000);

  child.stdout.on('data', (d) => {
    progressBuf += d.toString();
    const lines = progressBuf.split('\n');
    progressBuf = lines.pop() || '';
    for (const line of lines) {
      const [k, v] = line.split('=');
      if (k === 'out_time_ms' && job.durationSeconds) {
        const seconds = Number(v) / 1_000_000;
        if (Number.isFinite(seconds)) {
          job.progress = Math.max(0, Math.min(99, Math.round((seconds / job.durationSeconds) * 100)));
        }
      } else if (k === 'progress' && v === 'end') {
        job.progress = 100;
      }
    }
  });

  child.stderr.on('data', (d) => {
    stderrTail = (stderrTail + d.toString()).slice(-2000);
  });

  const finalize = async (code) => {
    clearTimeout(timer);
    running -= 1;
    job.finishedAt = Date.now();
    job.child = null;
    if (code === 0 && fs.existsSync(job.output)) {
      const st = fs.statSync(job.output);
      job.state = 'done';
      job.progress = 100;
      job.sizeBytes = st.size;
      job.path = job.output;
      log.info('ffmpeg done', { id: job.id, bytes: st.size, ms: Date.now() - job.startedAt });
    } else {
      job.state = 'error';
      job.error = job.error || (code === 0 ? 'no output produced' : `ffmpeg exited ${code}: ${stderrTail.slice(-400)}`);
      log.warn('ffmpeg failed', { id: job.id, code, tail: stderrTail.slice(-300) });
      await fsp.rm(job.dir, { recursive: true, force: true }).catch(() => {});
    }
    scheduleNext();
  };

  child.on('error', (e) => {
    job.error = e.message;
    finalize(-1);
  });
  child.on('close', (code) => finalize(code));
}

function buildArgs(job) {
  const common = [
    '-hide_banner',
    '-nostdin',
    '-loglevel',
    'error',
    '-progress',
    'pipe:1',
    '-user_agent',
    config.http.userAgent,
    '-rw_timeout',
    '20000000',
    '-i',
    job.url,
  ];

  if (job.kind === 'mp3') {
    return [
      ...common,
      '-vn',
      '-acodec',
      'libmp3lame',
      '-q:a',
      '2',
      '-ar',
      '44100',
      '-f',
      'mp3',
      '-y',
      job.output,
    ];
  }

  if (job.kind === 'gif') {
    // Short, small GIF from the first seconds — cheap and always plays.
    return [
      ...common,
      '-t',
      String(Math.min(job.durationSeconds || 5, 8)),
      '-vf',
      'fps=12,scale=480:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse',
      '-loop',
      '0',
      '-y',
      job.output,
    ];
  }

  // kind === 'mp4' — H.264/AAC compatibility transcode (fixes HEVC on old Android,
  // unsupported audio codecs, and odd pixel formats).
  return [
    ...common,
    '-map',
    '0:v:0',
    '-map',
    '0:a:0?',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '20',
    '-profile:v',
    'high',
    '-level',
    '4.1',
    '-pix_fmt',
    'yuv420p',
    '-vf',
    "scale='trunc(iw/2)*2:trunc(ih/2)*2'",
    '-c:a',
    'aac',
    '-b:a',
    '160k',
    '-ac',
    '2',
    '-ar',
    '44100',
    '-movflags',
    '+faststart',
    '-f',
    'mp4',
    '-y',
    job.output,
  ];
}

/**
 * Enqueue a conversion.
 * @param {{kind:'mp4'|'mp3'|'gif', url:string, durationSeconds?:number, baseName:string}} spec
 */
export function enqueueJob(spec) {
  ensureRoot();
  const id = newId();
  const ext = spec.kind === 'mp3' ? 'mp3' : spec.kind === 'gif' ? 'gif' : 'mp4';
  const job = {
    id,
    kind: spec.kind,
    url: spec.url,
    durationSeconds: Number(spec.durationSeconds) || null,
    baseName: spec.baseName,
    outputName: `${spec.baseName}.${ext}`,
    ext,
    state: 'queued',
    progress: 0,
    createdAt: Date.now(),
    expiresAt: Date.now() + config.ffmpeg.jobTtlSeconds * 1000,
    sizeBytes: null,
    error: null,
  };
  jobs.set(id, job);
  queue.push(job);
  scheduleNext();
  return job;
}

export function getJob(id) {
  return jobs.get(id) || null;
}

export function serializeJob(job) {
  return {
    id: job.id,
    kind: job.kind,
    state: job.state,
    progress: job.progress,
    sizeBytes: job.sizeBytes,
    sizeLabel: null,
    error: job.error && job.state === 'error' ? job.error : null,
    filename: job.outputName,
    expiresAt: job.expiresAt,
  };
}

/** Periodic sweep: drop expired jobs and their temp files. */
export function startJobSweeper() {
  const timer = setInterval(async () => {
    const now = Date.now();
    for (const [id, job] of jobs) {
      if (job.state === 'queued' || job.state === 'running') continue;
      if (job.expiresAt > now) continue;
      jobs.delete(id);
      if (job.dir) await fsp.rm(job.dir, { recursive: true, force: true }).catch(() => {});
    }
  }, 30_000);
  timer.unref?.();
  return timer;
}

export function activeJobCount() {
  return { running, queued: queue.length, total: jobs.size };
}

export function requireFfmpeg(av) {
  if (!av?.ffmpeg) throw errors.ffmpegMissing();
}
