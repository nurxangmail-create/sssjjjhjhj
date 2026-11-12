import { config } from '../config.js';
import { errors } from '../lib/errors.js';
import { log } from '../lib/logger.js';
import { TtlCache } from '../lib/cache.js';
import { expandShortUrl, parseTikTokUrl } from '../lib/url.js';
import { request } from '../lib/http.js';
import { tiktokWebProvider } from './tiktok-web.js';
import { tikwmProvider } from './tikwm.js';
import { rapidApiProvider } from './rapidapi.js';
import { oembedProvider } from './oembed.js';
import { codecClass, formatBytes, formatCount, formatDuration } from '../lib/format.js';

/**
 * Provider chain.
 *
 * Order is deliberate (verified by live testing):
 *   1. tiktok-web  — TikTok's own page JSON. Richest data (all quality
 *                    ladders, real resolution, codec, sizes) and no API key.
 *   2. tikwm       — independent mirror; covers region-locked pages and
 *                    supplies an HEVC "HD" ladder the web page may omit.
 *   3. rapidapi    — optional paid fallback, only if a key is configured.
 *   4. oembed      — official metadata-only last resort (no stream).
 *
 * Results are MERGED, not replaced: usually tiktok-web is authoritative for
 * metadata while tikwm adds extra streams. Concurrent calls for the same video
 * are collapsed by the cache's single-flight wrapper.
 */
const cache = new TtlCache({ ttlSeconds: config.cacheTtlSeconds, max: 500 });

const PROVIDERS = [tiktokWebProvider, tikwmProvider, rapidApiProvider, oembedProvider];

function dedupeQualities(list) {
  const out = [];
  const seen = new Set();
  for (const q of list) {
    if (!q || !q.url) continue;
    // Collapse identical dimensions+codec: prefer the one with a known size.
    const key = `${q.width || q.height || 0}x${q.height || 0}|${q.codec}|${q.source}`;
    if (seen.has(key)) {
      const existing = out.find((o) => `${o.width || o.height || 0}x${o.height || 0}|${o.codec}|${o.source}` === key);
      if (existing && !existing.sizeBytes && q.sizeBytes) Object.assign(existing, q);
      continue;
    }
    seen.add(key);
    out.push(q);
  }
  return out;
}

/** Sort best-first: resolution, then bitrate, then file size. */
function rankQualities(list) {
  return [...list].sort((a, b) => {
    const pa = (a.width || 0) * (a.height || 0);
    const pb = (b.width || 0) * (b.height || 0);
    if (pb !== pa) return pb - pa;
    const ba = a.bitrate || 0;
    const bb = b.bitrate || 0;
    if (bb !== ba) return bb - ba;
    return (b.sizeBytes || 0) - (a.sizeBytes || 0);
  });
}

function mergeResults(results) {
  const usable = results.filter(Boolean);
  if (!usable.length) return null;

  // Metadata priority: tiktok-web > tikwm > rapidapi > oembed
  const byProvider = (name) => usable.find((r) => r.provider === name);
  const primary = byProvider('tiktok-web') || byProvider('tikwm') || byProvider('rapidapi') || usable[0];

  const qualities = rankQualities(dedupeQualities(usable.flatMap((r) => r.qualities || [])));
  const images = usable.find((r) => r.images?.length)?.images || [];

  // A result is only a real success when it carries at least one downloadable
  // asset. oEmbed alone (metadata without streams) is NOT a success — it must
  // never produce `ok:true` with an empty payload.
  if (!qualities.length && !images.length) return null;

  const merged = {
    ...primary,
    author: { ...primary.author },
    stats: { ...primary.stats },
    music: primary.music || usable.find((r) => r.music)?.music || null,
    cover: primary.cover || usable.find((r) => r.cover)?.cover || null,
    coverFallback:
      primary.coverFallback || usable.find((r) => r.coverFallback)?.coverFallback || primary.cover || null,
    durationSeconds: primary.durationSeconds || usable.find((r) => r.durationSeconds)?.durationSeconds || null,
    images,
    qualities,
    sources: usable.map((r) => r.provider),
    metadataOnly: false,
  };
  // Fill sparse metadata from other providers.
  for (const r of usable) {
    for (const k of ['plays', 'likes', 'comments', 'shares', 'saves']) {
      if (!merged.stats[k] && r.stats?.[k]) merged.stats[k] = r.stats[k];
    }
    if (!merged.author.username && r.author?.username) merged.author.username = r.author.username;
    if (!merged.author.nickname && r.author?.nickname) merged.author.nickname = r.author.nickname;
    if (!merged.author.avatar && r.author?.avatar) merged.author.avatar = r.author.avatar;
    if (!merged.title && r.title) merged.title = r.title;
  }
  return merged;
}

/**
 * Turn provider output into the client payload.
 * Signed media tokens are minted by the route layer, not here.
 */
export function toClientPayload(video) {
  const qualities = video.qualities.map((q, idx) => {
    const height = q.height || 0;
    const width = q.width || 0;
    // TikTok reports portrait videos as e.g. 720x1280. The industry label for
    // that is "720p" (the SHORT side), not "1280p". Use min(w,h) when we know
    // both dimensions, else fall back to the height hint.
    const shortSide = width && height ? Math.min(width, height) : height || width || 0;
    const label =
      q.gear === 'hd' && !shortSide
        ? 'HD (yüksək)'
        : q.gear === 'sd' && !shortSide
          ? 'SD (standart)'
          : shortSide
            ? `${shortSide}p`
            : `Keyfiyyət ${idx + 1}`;
    return {
      id: `q${idx}`,
      index: idx,
      width: width || null,
      height: height || null,
      shortSide: shortSide || null,
      resolution: width && height ? `${width}x${height}` : shortSide ? `${shortSide}p` : null,
      label,
      codec: q.codec,
      codecRaw: q.codecRaw || null,
      fps: q.fps || null,
      bitrate: q.bitrate || null,
      sizeBytes: q.sizeBytes || null,
      sizeLabel: formatBytes(q.sizeBytes),
      watermark: false,
      compatible: q.codec === 'h264' || q.codec === 'unknown',
      source: q.source,
      // Filled in below: only the actually-best playable variant is flagged.
      recommended: false,
    };
  });

  // "Best" = highest resolution that plays everywhere (H.264). Falls back to
  // the highest resolution overall when no H.264 variant exists.
  const best = qualities.find((q) => q.codec === 'h264') || qualities[0] || null;
  if (best) best.recommended = true;

  return {
    id: video.id,
    kind: video.kind,
    url: video.url,
    title: video.title,
    titleShort: (video.title || '').slice(0, 120),
    createdAt: video.createdAt,
    durationSeconds: video.durationSeconds,
    durationLabel: formatDuration(video.durationSeconds),
    cover: video.cover,
    coverFallback: video.coverFallback,
    dynamicCover: video.dynamicCover,
    author: {
      username: video.author.username,
      nickname: video.author.nickname,
      avatar: video.author.avatar,
      verified: video.author.verified,
    },
    music: video.music,
    stats: {
      plays: video.stats.plays,
      playsLabel: formatCount(video.stats.plays),
      likes: video.stats.likes,
      likesLabel: formatCount(video.stats.likes),
      comments: video.stats.comments,
      commentsLabel: formatCount(video.stats.comments),
      shares: video.stats.shares,
      sharesLabel: formatCount(video.stats.shares),
      saves: video.stats.saves,
      savesLabel: formatCount(video.stats.saves),
    },
    qualities,
    bestQuality: best,
    images: video.images || [],
    isPhoto: video.isPhoto || (video.images || []).length > 0,
    metadataOnly: Boolean(video.metadataOnly),
    providers: video.sources || [video.provider],
    hasAudio: video.kind !== 'photo',
  };
}

/**
 * Resolve a user-supplied link into normalized video data.
 * @param {string} input raw URL / short link / bare id
 * @param {{skipCache?: boolean}} opts
 */
export async function resolveVideo(input, opts = {}) {
  let parsed = parseTikTokUrl(input);

  if (parsed.kind === 'short') {
    const expanded = await expandShortUrl(parsed.shortUrl, { request });
    parsed = parseTikTokUrl(expanded);
  }
  if (!parsed.videoId) throw errors.badUrl('Video ID not found in the link.');

  const cacheKey = `v:${parsed.videoId}`;
  if (!opts.skipCache) {
    const hit = cache.get(cacheKey);
    if (hit) {
      log.debug('resolve cache hit', { id: parsed.videoId });
      return { ...hit, fromCache: true };
    }
  }

  const { value } = await cache.wrap(cacheKey, async () => {
    const results = [];
    const failures = [];
    let sawNotFound = false;
    let sawUnavailable = null;

    for (const provider of PROVIDERS) {
      if (!provider.enabled()) continue;
      const started = Date.now();
      try {
        const res = await provider.resolve(parsed);
        const ms = Date.now() - started;
        if (!res) {
          log.debug('provider no result', { provider: provider.name, ms });
          continue;
        }
        if (res.notFound) {
          sawNotFound = true;
          log.debug('provider notFound', { provider: provider.name, ms });
          continue;
        }
        if (res.unavailable) {
          sawUnavailable = res.unavailable;
          log.debug('provider unavailable', { provider: provider.name, reason: res.unavailable });
          continue;
        }
        // Stop early once we have real streams; oembed/metadata-only cannot add more.
        results.push(res);
        log.debug('provider ok', { provider: provider.name, ms, qualities: res.qualities?.length ?? 0 });
        if (res.qualities?.length && res.provider === 'tiktok-web') {
          // Still consult tikwm for extra HEVC ladders only if the web page
          // returned a single stream (common on older videos).
          if (res.qualities.length > 1) break;
        }
      } catch (err) {
        failures.push(`${provider.name}:${err.message}`);
        log.warn('provider threw', { provider: provider.name, err });
      }
    }

    const merged = mergeResults(results);
    if (merged) return merged;

    // Everything is metadata-less or empty: map to a precise error.
    if (sawNotFound) throw errors.notFound();
    if (sawUnavailable) throw errors.unavailable(sawUnavailable);
    if (failures.length) throw errors.upstream(failures.join(', '));
    throw errors.notFound();
  });

  return value;
}

export function clearResolveCache() {
  cache.clear();
}

export const resolveCache = cache;
