import { config } from '../config.js';
import { request } from '../lib/http.js';
import { log } from '../lib/logger.js';

/**
 * Provider: tikwm.com public API.
 *
 * Free tier: 1 request/second per IP, no key required. Returns watermark-free
 * `play` / `hdplay` streams (plus a watermarked `wmplay` we deliberately drop).
 *
 * Response envelope:
 *   { code: 0, msg: "success", data: { id, title, cover, origin_cover,
 *     duration, size, hd_size, play, hdplay, wmplay, music, music_info,
 *     author: { unique_id, nickname, avatar }, play_count, digg_count, ... } }
 *   code: -1 (or 400/429) => human message in `msg`
 *
 * Caveat proven by testing: `hdplay` is frequently HEVC/H.265. tikwm does not
 * publish codec or dimensions, so we label the variants by intent ("HD"/"SD")
 * and let the UI offer the always-compatible H.264 default. Downloads are
 * still real: the server streams the exact bytes tikwm returns.
 */

function normalize(data, parsed) {
  const qualities = [];

  const add = (url, { label, heightHint, size }) => {
    if (!url || typeof url !== 'string') return;
    qualities.push({
      width: 0,
      height: heightHint || 0,
      bitrate: null,
      fps: null,
      sizeBytes: Number(size) || null,
      codec: 'unknown',
      codecRaw: null,
      format: 'mp4',
      gear: label,
      qualityType: null,
      url,
      watermark: false,
      source: 'tikwm',
    });
  };

  add(data.hdplay, { label: 'hd', heightHint: 1080, size: data.hd_size });
  add(data.play, { label: 'sd', heightHint: 720, size: data.size });

  const author = data.author || {};
  const isPhoto = Array.isArray(data.images) && data.images.length > 0;

  return {
    id: String(data.id || parsed.videoId || ''),
    kind: isPhoto ? 'photo' : 'video',
    url: parsed.canonicalUrl,
    title: data.title || '',
    createdAt: data.create_time ? Number(data.create_time) * 1000 : null,
    durationSeconds: Number(data.duration) || null,
    durationLabel: null,
    cover: data.origin_cover || data.cover || null,
    coverFallback: data.cover || null,
    dynamicCover: data.ai_dynamic_cover || null,
    author: {
      id: author.id ? String(author.id) : null,
      username: author.unique_id || parsed.username || null,
      nickname: author.nickname || null,
      avatar: author.avatar || null,
      verified: false,
      followers: Number(author.follower_count) || null,
    },
    music: data.music
      ? {
          title: data.music_info?.title || null,
          author: data.music_info?.author || null,
          durationSeconds: Number(data.music_info?.duration) || null,
          cover: data.music_info?.cover || null,
          url: data.music,
        }
      : null,
    stats: {
      plays: Number(data.play_count) || null,
      likes: Number(data.digg_count) || null,
      comments: Number(data.comment_count) || null,
      shares: Number(data.share_count) || null,
      saves: Number(data.collect_count) || null,
    },
    qualities,
    images: isPhoto ? data.images.slice(0, config.maxPhotos) : [],
    isPhoto,
    region: data.region || null,
    provider: 'tikwm',
  };
}

export const tikwmProvider = {
  name: 'tikwm',
  enabled: () => config.providers.tikwm,

  async resolve(parsed) {
    const target = parsed.canonicalUrl || `https://www.tiktok.com/@i/video/${parsed.videoId}`;
    const url = new URL(config.tikwmBase);
    url.searchParams.set('url', target);
    url.searchParams.set('hd', '1');

    let payload;
    try {
      const res = await request(url.toString(), {
        headers: { Accept: 'application/json' },
        timeoutMs: Math.max(config.http.timeoutMs, 15000),
        retries: 2,
      });
      const text = await res.text();
      payload = JSON.parse(text);
    } catch (err) {
      log.debug('tikwm request failed', { err });
      return null;
    }

    if (!payload || typeof payload !== 'object') return null;

    if (payload.code !== 0) {
      const msg = String(payload.msg || '');
      if (/url parsing|not found|invalid|does not exist|no video/i.test(msg)) return { notFound: true };
      if (/private|region|restricted|not available/i.test(msg)) return { unavailable: msg };
      log.debug('tikwm error envelope', { msg });
      return null;
    }
    if (!payload.data) return { notFound: true };
    return normalize(payload.data, parsed);
  },
};
