import express from 'express';
import { config, version } from '../config.js';
import { errors, isAppError } from '../lib/errors.js';
import { log } from '../lib/logger.js';
import { RateLimiter } from '../lib/cache.js';
import { signMediaToken, verifyMediaToken } from '../lib/tokens.js';
import { resolveVideo, toClientPayload } from '../providers/index.js';
import { streamFromUpstream, proxyImage } from '../lib/stream.js';
import {
  activeJobCount,
  checkAvailability,
  enqueueJob,
  getJob,
  probeUrl,
  serializeJob,
  requireFfmpeg,
} from '../lib/media.js';
import { buildFilename, formatBytes, formatDuration, slugify } from '../lib/format.js';
import fs from 'node:fs';
import fsp from 'node:fs/promises';

export const api = express.Router();

const resolveLimiter = new RateLimiter({ perMinute: config.rateLimits.resolvePerMin });
const jobLimiter = new RateLimiter({ perMinute: config.rateLimits.jobPerMin });

const clientKey = (req) => {
  const fwd = req.headers['x-forwarded-for'];
  const ip = (typeof fwd === 'string' ? fwd.split(',')[0] : req.ip) || 'unknown';
  return ip.trim();
};

function limit(limiter) {
  return (req, res, next) => {
    const r = limiter.take(clientKey(req));
    res.setHeader('X-RateLimit-Remaining', String(r.remaining));
    if (!r.allowed) {
      res.setHeader('Retry-After', String(r.retryAfter));
      return next(errors.rateLimited(r.retryAfter));
    }
    next();
  };
}

/* ------------------------------------------------------------------ health */

api.get('/health', async (req, res) => {
  const av = await checkAvailability();
  res.json({
    ok: true,
    service: 'tiktok-video-downloader',
    version,
    env: config.env,
    uptimeSeconds: Math.round(process.uptime()),
    ffmpeg: { available: av.ffmpeg, ffprobe: av.ffprobe, version: av.version },
    providers: config.providers,
    jobs: activeJobCount(),
    tokenSecretConfigured: !config.tokenSecretEphemeral,
    time: new Date().toISOString(),
  });
});

/* ----------------------------------------------------------------- resolve */

/**
 * Attach signed media links to each quality so the browser never contacts
 * TikTok's CDN directly (those URLs are hotlink-protected and expire).
 */
function attachMediaLinks(payload, rawVideo) {
  payload.qualities = payload.qualities.map((q, idx) => {
    const raw = rawVideo.qualities[idx];
    if (!raw?.url) return q;
    // Build the filename from the corrected label (short side for portrait).
    const label = q.label || 'video';
    const suffix = q.codec === 'h265' ? `${label}-h265` : label;
    const filename = buildFilename({
      title: payload.title,
      username: payload.author?.username,
      qualityLabel: suffix,
    });
    const token = signMediaToken({ u: raw.url, f: filename, t: 'video', src: raw.source }, config.tokenTtlSeconds);
    return {
      ...q,
      watermark: false,
      downloadToken: token,
      downloadPath: `/api/download/${token}`,
      streamPath: `/api/stream/${token}`,
      filename,
    };
  });
  payload.bestQuality = payload.qualities.find((q) => q.codec === 'h264') || payload.qualities[0] || null;
  return payload;
}

api.post('/resolve', limit(resolveLimiter), async (req, res, next) => {
  try {
    const { url, refresh } = req.body || {};
    if (!url) throw errors.badUrl('No URL in request body.');

    const started = Date.now();
    const video = await resolveVideo(url, { skipCache: Boolean(refresh) });
    const payload = attachMediaLinks(toClientPayload(video), video);

    // Cover proxy (avoids hotlink 403 / mixed content on the client).
    if (payload.cover) {
      const ct = signMediaToken({ u: payload.cover, f: 'cover.jpg', t: 'image' }, config.thumbTtlSeconds);
      payload.coverPath = `/api/thumb/${ct}`;
    }
    if (payload.author?.avatar) {
      const at = signMediaToken({ u: payload.author.avatar, f: 'avatar.jpg', t: 'image' }, config.thumbTtlSeconds);
      payload.author.avatarPath = `/api/thumb/${at}`;
    }
    if (payload.music?.url) {
      const mf = buildFilename({ title: payload.title, username: payload.author?.username, ext: 'mp3', suffix: 'audio' });
      const mt = signMediaToken({ u: payload.music.url, f: mf, t: 'audio' }, config.tokenTtlSeconds);
      payload.music.downloadPath = `/api/download/${mt}`;
      payload.music.filename = mf;
    }

    payload.resolveMs = Date.now() - started;
    payload.fromCache = Boolean(video.fromCache);

    // Honest banner when only metadata could be resolved.
    if (!payload.qualities.length) {
      payload.notice = payload.isPhoto
        ? 'Bu post foto-qalereyadır. Şəkilləri yükləyə bilərsiniz.'
        : 'Video mənbəyi hazırda əlçatan deyil. Bir az sonra yenidən cəhd edin.';
    }

    log.info('resolve ok', {
      id: payload.id,
      ms: payload.resolveMs,
      qualities: payload.qualities.length,
      providers: payload.providers,
      cached: payload.fromCache,
    });
    res.json({ ok: true, video: payload });
  } catch (err) {
    next(err);
  }
});

/* --------------------------------------------------------- media streaming */

/** Full download (attachment). Supports Range so it can also resume. */
api.get('/download/:token', async (req, res, next) => {
  try {
    const body = verifyMediaToken(req.params.token);
    if (!body || !body.u) throw errors.badToken();
    const filename = body.f || 'tiktok-video.mp4';
    const inline = req.query.inline === '1' || req.query.inline === 'true';

    log.info('download start', { t: body.t, host: safeHost(body.u), filename });
    await streamFromUpstream(res, body.u, {
      filename,
      inline,
      range: req.headers.range,
      contentType: body.t === 'audio' ? 'audio/mpeg' : 'video/mp4',
    });
  } catch (err) {
    next(err);
  }
});

/** Inline stream for the <video> player (same bytes, no attachment header). */
api.get('/stream/:token', async (req, res, next) => {
  try {
    const body = verifyMediaToken(req.params.token);
    if (!body || !body.u) throw errors.badToken();
    await streamFromUpstream(res, body.u, {
      filename: body.f || 'preview.mp4',
      inline: true,
      range: req.headers.range,
      contentType: 'video/mp4',
    });
  } catch (err) {
    next(err);
  }
});

/** Thumbnail / avatar proxy. */
api.get('/thumb/:token', async (req, res, next) => {
  try {
    const body = verifyMediaToken(req.params.token);
    if (!body || !body.u || body.t !== 'image') throw errors.badToken();
    await proxyImage(res, body.u);
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------- probe info */

/** Real codec/resolution probe for a signed stream (used by the UI badges). */
api.get('/probe/:token', async (req, res, next) => {
  try {
    const body = verifyMediaToken(req.params.token);
    if (!body || !body.u) throw errors.badToken();
    const info = await probeUrl(body.u);
    if (!info) return res.json({ ok: true, probe: null, reason: 'unavailable' });
    res.json({ ok: true, probe: info });
  } catch (err) {
    next(err);
  }
});

/* -------------------------------------------------------------- conversion */

const KINDS = new Set(['mp4', 'mp3', 'gif']);

api.post('/convert', limit(jobLimiter), async (req, res, next) => {
  try {
    const av = await checkAvailability();
    requireFfmpeg(av);

    const { token, kind = 'mp3', title, username } = req.body || {};
    if (!KINDS.has(kind)) throw errors.badJob('Unsupported conversion kind.');
    const body = verifyMediaToken(token);
    if (!body || !body.u) throw errors.badToken();

    const baseName = `${slugify(`${username ? username : 'tiktok'}-${title || 'video'}`, 60)}-${kind}`;
    const job = enqueueJob({
      kind,
      url: body.u,
      durationSeconds: Number(req.body?.durationSeconds) || null,
      baseName,
    });

    res.status(202).json({ ok: true, job: serializeJob(job) });
  } catch (err) {
    next(err);
  }
});

async function handleJobDownload(req, res, next, asAttachment) {
  try {
    const job = getJob(req.params.id);
    if (!job) return next(errors.jobNotFound());
    if (job.state === 'error') return next(errors.jobFailed(job.error || ''));
    if (job.state !== 'done' || !job.path) return next(errors.jobPending());
    if (!fs.existsSync(job.path)) return next(errors.jobNotFound());

    const st = await fsp.stat(job.path);
    const ct = job.kind === 'mp3' ? 'audio/mpeg' : job.kind === 'gif' ? 'image/gif' : 'video/mp4';
    res.setHeader('Content-Type', ct);
    res.setHeader('Content-Length', String(st.size));
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, max-age=0, no-store');
    if (asAttachment) {
      const encoded = encodeURIComponent(job.outputName);
      res.setHeader('Content-Disposition', `attachment; filename="${job.outputName}"; filename*=UTF-8''${encoded}`);
    }
    if (req.headers.range) {
      const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range);
      if (m) {
        const start = m[1] ? Number(m[1]) : 0;
        const end = m[2] ? Math.min(Number(m[2]), st.size - 1) : st.size - 1;
        if (Number.isFinite(start) && start <= end) {
          res.status(206);
          res.setHeader('Content-Range', `bytes ${start}-${end}/${st.size}`);
          res.setHeader('Content-Length', String(end - start + 1));
          return fs.createReadStream(job.path, { start, end }).pipe(res);
        }
      }
    }
    fs.createReadStream(job.path).pipe(res);
  } catch (err) {
    next(err);
  }
}

api.get('/jobs/:id', (req, res, next) => {
  const job = getJob(req.params.id);
  if (!job) return next(errors.jobNotFound());
  const s = serializeJob(job);
  s.sizeLabel = formatBytes(job.sizeBytes);
  s.durationLabel = job.durationSeconds ? formatDuration(job.durationSeconds) : null;
  s.downloadPath = job.state === 'done' ? `/api/jobs/${job.id}/file` : null;
  if (job.state === 'done') {
    const token = signMediaToken(
      { u: 'job', j: job.id, t: job.kind === 'mp3' ? 'audio' : 'video', f: job.outputName },
      600,
    );
    s.downloadPath = `/api/jobs/${job.id}/file?t=${token}`;
  }
  res.json({ ok: true, job: s });
});

api.get('/jobs/:id/file', (req, res, next) => handleJobDownload(req, res, next, true));
api.get('/jobs/:id/preview', (req, res, next) => handleJobDownload(req, res, next, false));

api.delete('/jobs/:id', (req, res) => {
  const job = getJob(req.params.id);
  if (job && job.dir) fsp.rm(job.dir, { recursive: true, force: true }).catch(() => {});
  res.json({ ok: true });
});

/* ------------------------------------------------------------------- misc */

function safeHost(u) {
  try {
    return new URL(u).host;
  } catch {
    return 'invalid';
  }
}

api.get('/providers', (req, res) => {
  res.json({
    ok: true,
    providers: [
      {
        id: 'tiktok-web',
        label: 'TikTok web (rəsmi səhifə JSON)',
        requiresKey: false,
        enabled: config.providers.tiktokWeb,
      },
      {
        id: 'tikwm',
        label: 'tikwm.com (pulsuz, 1 sorğu/san)',
        requiresKey: false,
        enabled: config.providers.tikwm,
      },
      {
        id: 'rapidapi',
        label: 'RapidAPI (kommersiya, açar tələb edir)',
        requiresKey: true,
        enabled: config.providers.rapidapi,
      },
      {
        id: 'oembed',
        label: 'TikTok oEmbed (yalnız metadata)',
        requiresKey: false,
        enabled: config.providers.oembed,
      },
    ],
  });
});
