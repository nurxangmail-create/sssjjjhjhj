import { config } from '../config.js';

/**
 * Shared normalizer for the "tikwm-shaped" provider payload.
 *
 * Both tikwm.com and most RapidAPI TikTok scrapers return this envelope:
 *   { id, title, cover, origin_cover, ai_dynamic_cover, duration,
 *     size, hd_size, play, hdplay, wmplay, music, music_info, author,
 *     play_count, digg_count, comment_count, share_count, collect_count,
 *     create_time, region, images? }
 *
 * The watermarked `wmplay` field is intentionally never surfaced.
 */
export function normalizeTikwmShape(data, parsed) {
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
      source: parsed.providerHint || 'tikwm',
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
    provider: parsed.providerHint || 'tikwm',
  };
}
