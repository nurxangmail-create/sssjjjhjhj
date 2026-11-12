import { config } from '../config.js';
import { request } from '../lib/http.js';
import { errors } from '../lib/errors.js';
import { codecClass } from '../lib/format.js';
import { log } from '../lib/logger.js';

/**
 * Provider: TikTok's own public web page.
 *
 * TikTok embeds a `__UNIVERSAL_DATA_FOR_REHYDRATION__` JSON blob in the video
 * page. It contains the same signed play URLs the web player itself uses.
 *
 * Verified behaviour (2026-11):
 *   - The raw `video.playAddr` / `bitrateInfo[].PlayAddr.UrlList[*]` helper
 *     hosts (p16-*.tiktokcdn) answer 403 to non-browser clients (hotlink guard).
 *   - The URL inside UrlList shaped `https://www.tiktok.com/aweme/v1/play/?...`
 *     DOES work from a datacenter IP and honours HTTP Range (206) — this is
 *     the variant we use for streaming.
 *   - Those URLs are signed and expire (~2h). We therefore never hand them to
 *     the browser; we mint our own signed token and proxy the bytes.
 *
 * No API key required. Statuses: statusCode 0 = ok, 10204 = not found/private.
 */

const UA = config.http.userAgent;

function buildPageUrls(videoId, username) {
  const urls = [];
  if (username) urls.push(`https://www.tiktok.com/@${encodeURIComponent(username)}/video/${videoId}`);
  urls.push(`https://www.tiktok.com/@i/video/${videoId}`);
  urls.push(`https://www.tiktok.com/video/${videoId}`);
  return [...new Set(urls)];
}

function extractScope(html) {
  const m =
    html.match(/<script[^>]+id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/) ||
    html.match(/<script[^>]+id='__UNIVERSAL_DATA_FOR_REHYDRATION__'[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    const json = JSON.parse(m[1]);
    return json?.__DEFAULT_SCOPE__ || null;
  } catch {
    return null;
  }
}

/** Pick the best playable URL from a bitrate entry's UrlList. */
function pickPlayUrl(urlList = []) {
  const list = urlList.filter((u) => typeof u === 'string' && /^https?:\/\//.test(u));
  if (!list.length) return null;
  // 1) The /aweme/v1/play/ gateway: works outside the browser and supports Range.
  const gateway = list.find((u) => u.includes('/aweme/v1/play'));
  if (gateway) return gateway;
  // 2) Same-origin relative to tiktok.com (some variants).
  const tiktokHost = list.find((u) => /^https:\/\/(www\.)?tiktok\.com\//.test(u));
  if (tiktokHost) return tiktokHost;
  // 3) Anything not obviously hotlink-protected.
  return list.find((u) => !/tiktokcdn/.test(u)) || list[0];
}

function qualitiesFromItem(item) {
  const video = item.video || {};
  const seen = new Set();
  const out = [];

  const push = (entry) => {
    const playAddr = entry.PlayAddr || {};
    const url = pickPlayUrl(playAddr.UrlList || (playAddr.UrlList === undefined && video.playAddr ? [video.playAddr] : []));
    if (!url) return;
    const width = Number(playAddr.Width) || Number(video.width) || 0;
    const height = Number(playAddr.Height) || Number(video.height) || 0;
    const key = `${width}x${height}:${entry.GearName || ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      width,
      height,
      bitrate: Number(entry.Bitrate) || Number(video.bitrate) || null,
      fps: Number(entry.BitrateFPS) || null,
      sizeBytes: Number(playAddr.DataSize) || null,
      codec: codecClass(entry.CodecType, entry.Format || video.format),
      codecRaw: entry.CodecType || video.codecType || null,
      format: entry.Format || 'mp4',
      gear: entry.GearName || null,
      qualityType: Number.isFinite(entry.QualityType) ? entry.QualityType : null,
      url,
      watermark: false,
      source: 'tiktok-web',
    });
  };

  const bitrates = Array.isArray(video.bitrateInfo) ? video.bitrateInfo : [];
  bitrates.forEach(push);

  // Always keep the default playAddr as a last resort even if bitrateInfo is absent.
  if (!out.length && video.playAddr) {
    out.push({
      width: Number(video.width) || 0,
      height: Number(video.height) || 0,
      bitrate: Number(video.bitrate) || null,
      fps: null,
      sizeBytes: Number(video.size) || null,
      codec: codecClass(video.codecType, video.format),
      codecRaw: video.codecType || null,
      format: 'mp4',
      gear: 'default',
      qualityType: null,
      url: video.playAddr,
      watermark: false,
      source: 'tiktok-web',
    });
  }
  return out;
}

function normalizeItem(item, parsed) {
  const video = item.video || {};
  const author = item.author || {};
  const stats = item.statsV2 || item.stats || {};
  const music = item.music || {};
  const isPhoto = Boolean(item.imagePost?.images?.length);

  const images = isPhoto
    ? item.imagePost.images
        .slice(0, config.maxPhotos)
        .map((img) => img?.imageURL?.urlList?.[0] || img?.displayImage?.urlList?.[0] || null)
        .filter(Boolean)
    : [];

  return {
    id: String(item.id || parsed.videoId || ''),
    kind: isPhoto ? 'photo' : 'video',
    url: parsed.canonicalUrl,
    title: item.desc || '',
    createdAt: item.createTime ? Number(item.createTime) * 1000 : null,
    durationSeconds: Number(video.duration) || null,
    durationLabel: null,
    cover: video.originCover || video.cover || video.dynamicCover || null,
    coverFallback: video.cover || null,
    dynamicCover: video.dynamicCover || null,
    author: {
      id: author.id ? String(author.id) : null,
      username: author.uniqueId || parsed.username || null,
      nickname: author.nickname || null,
      avatar: author.avatarMedium || author.avatarThumb || null,
      verified: Boolean(author.verified),
    },
    music: music.playUrl
      ? {
          title: music.title || null,
          author: music.authorName || null,
          durationSeconds: Number(music.duration) || null,
          cover: music.coverLarge || music.coverMedium || null,
          url: music.playUrl,
        }
      : null,
    stats: {
      plays: Number(stats.playCount) || null,
      likes: Number(stats.diggCount) || null,
      comments: Number(stats.commentCount) || null,
      shares: Number(stats.shareCount) || null,
      saves: Number(stats.collectCount) || null,
    },
    qualities: qualitiesFromItem(item),
    images,
    isPhoto,
    region: item.locationCreated || null,
    provider: 'tiktok-web',
  };
}

async function fetchPage(url) {
  const res = await request(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Upgrade-Insecure-Requests': '1',
    },
    timeoutMs: Math.max(config.http.timeoutMs, 15000),
    retries: 1,
  });
  if (res.status === 404) return { notFound: true };
  if (!res.ok) throw errors.upstream(`tiktok page HTTP ${res.status}`);
  return { html: await res.text() };
}

export const tiktokWebProvider = {
  name: 'tiktok-web',
  enabled: () => config.providers.tiktokWeb,

  /**
   * @param {{videoId:string, username?:string, canonicalUrl?:string}} parsed
   */
  async resolve(parsed) {
    const urls = buildPageUrls(parsed.videoId, parsed.username);
    let lastStatus = null;

    for (const url of urls) {
      let page;
      try {
        page = await fetchPage(url);
      } catch (err) {
        log.debug('tiktok-web page failed', { url: url.slice(-40), err });
        continue;
      }
      if (page.notFound) {
        lastStatus = 10204;
        continue;
      }
      const scope = extractScope(page.html);
      if (!scope) continue;

      const detail = scope['webapp.video-detail'];
      if (!detail) continue;

      if (detail.statusCode && detail.statusCode !== 0) {
        lastStatus = detail.statusCode;
        if (detail.statusCode === 10204 || detail.statusCode === 10216) return { notFound: true };
        continue;
      }

      const item = detail.itemInfo?.itemStruct || detail.itemInfo?.item;
      if (!item) {
        lastStatus = 'no-item';
        continue;
      }

      if (item.privateItem || item.secret) return { unavailable: 'private' };
      if (item.takeDown || item.isProhibited) return { unavailable: 'removed' };

      const normalized = normalizeItem(item, parsed);
      if (!normalized.qualities.length && !normalized.isPhoto) {
        log.warn('tiktok-web: no playable stream', { id: normalized.id });
      }
      return normalized;
    }

    if (lastStatus === 10204 || lastStatus === 10216) return { notFound: true };
    return null;
  },
};
