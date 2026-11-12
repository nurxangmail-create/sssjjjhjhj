import { Readable } from 'node:stream';
import { config } from '../config.js';
import { errors } from './errors.js';
import { log } from './logger.js';

const UA = config.http.userAgent;

const SAFE_UPSTREAM_HOSTS = [
  'tiktok.com',
  'tiktokcdn.com',
  'tiktokcdn-us.com',
  'tiktokcdn-eu.com',
  'tiktokcdn-in.com',
  'tiktokv.com',
  'tiktokv.us',
  'ibytedtos.com',
  'byteoversea.com',
  'muscdn.com',
  'tikwm.com',
  'ttwstatic.com',
];

/** Block SSRF: only known media hosts are allowed to be proxied. */
export function isAllowedUpstream(rawUrl) {
  let u;
  try {
    u = new URL(rawUrl);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  const host = u.hostname.toLowerCase();
  // Reject bare IPs and localhost outright.
  if (/^[\d.]+$/.test(host) || host === 'localhost' || host.includes(':')) return false;
  return SAFE_UPSTREAM_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

/** Upstream headers that make TikTok's CDN serve us the bytes. */
export function upstreamHeaders(extra = {}) {
  return {
    'User-Agent': UA,
    Accept: '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    Referer: 'https://www.tiktok.com/',
    ...extra,
  };
}

/**
 * Stream an upstream media URL to an Express response.
 *
 * - Forwards the client's Range header so mobile Safari/Chrome and <video>
 *   seeking work (verified: TikTok's /aweme/v1/play gateway returns 206).
 * - Copies Content-Length / Content-Range / Content-Type / Accept-Ranges.
 * - Aborts the upstream request when the client disconnects, so an abandoned
 *   download does not keep burning bandwidth on the Render instance.
 *
 * @param {import('express').Response} res
 * @param {string} upstreamUrl
 * @param {{filename?:string, inline?:boolean, contentType?:string, range?:string}} opts
 */
export async function streamFromUpstream(res, upstreamUrl, opts = {}) {
  const { filename, inline = false, contentType = 'video/mp4', range } = opts;

  if (!isAllowedUpstream(upstreamUrl)) {
    throw errors.upstream('blocked upstream host');
  }

  const ctrl = new AbortController();
  const onClose = () => {
    if (!res.writableEnded) ctrl.abort(new Error('client disconnected'));
  };
  res.on('close', onClose);

  let upstream;
  try {
    upstream = await fetch(upstreamUrl, {
      method: 'GET',
      headers: upstreamHeaders(range ? { Range: range } : {}),
      redirect: 'follow',
      signal: ctrl.signal,
    });
  } catch (err) {
    res.off('close', onClose);
    throw errors.upstream(err?.message || 'fetch failed');
  }

  try {
    // Upstream may itself deny a Range; fall back to a full 200 stream.
    if (!upstream.ok && upstream.status !== 206 && upstream.status !== 416) {
      log.warn('upstream rejected media', { status: upstream.status, host: new URL(upstreamUrl).host });
      throw errors.noStream();
    }

    const len = upstream.headers.get('content-length');
    const cr = upstream.headers.get('content-range');
    const upstreamType = upstream.headers.get('content-type');

    if (upstream.status === 416) {
      res.status(416);
      if (cr) res.setHeader('Content-Range', cr);
      res.end();
      return;
    }

    res.status(upstream.status === 206 ? 206 : 200);
    res.setHeader('Content-Type', upstreamType && /^(video|audio|image)\//.test(upstreamType) ? upstreamType : contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, max-age=0, no-transform');
    if (len) res.setHeader('Content-Length', len);
    if (cr) res.setHeader('Content-Range', cr);

    const encoded = encodeURIComponent(filename || 'tiktok-video.mp4');
    const ascii = (filename || 'tiktok-video.mp4').replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
    res.setHeader(
      'Content-Disposition',
      `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encoded}`,
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (!upstream.body) {
      res.end();
      return;
    }

    const stream = Readable.fromWeb(upstream.body);
    stream.on('error', (err) => {
      log.warn('upstream stream error', { err });
      res.destroy(err);
    });
    res.on('close', () => {
      stream.destroy();
      res.off('close', onClose);
    });
    stream.pipe(res);
  } catch (err) {
    res.off('close', onClose);
    ctrl.abort();
    if (res.headersSent) {
      res.destroy(err);
      return;
    }
    throw err;
  }
}

/** Buffered image proxy for thumbnails/avatars (they are small, <200KB). */
export async function proxyImage(res, upstreamUrl, { maxBytes = 4_000_000, contentType = 'image/jpeg' } = {}) {
  if (!isAllowedUpstream(upstreamUrl)) throw errors.upstream('blocked upstream host');
  const upstream = await fetch(upstreamUrl, {
    headers: upstreamHeaders({ Accept: 'image/avif,image/webp,image/jpeg,image/png,*/*' }),
    redirect: 'follow',
    signal: AbortSignal.timeout(9000),
  });
  if (!upstream.ok) throw errors.upstream(`image ${upstream.status}`);
  const ct = upstream.headers.get('content-type') || contentType;
  const buf = Buffer.from(await upstream.arrayBuffer());
  if (buf.length > maxBytes) throw errors.upstream('image too large');
  res.setHeader('Content-Type', ct.startsWith('image/') ? ct : contentType);
  res.setHeader('Cache-Control', 'public, max-age=3600, immutable');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(buf);
}
