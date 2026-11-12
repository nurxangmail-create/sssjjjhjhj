import { config } from '../config.js';
import { request } from '../lib/http.js';
import { log } from '../lib/logger.js';

/**
 * Provider: TikTok official oEmbed endpoint.
 *
 * Public, documented, no key: https://www.tiktok.com/oembed?url=<video url>
 * Returns { title, author_name, author_url, thumbnail_url, html, width, height }.
 *
 * IMPORTANT LIMITATION: oEmbed returns NO video stream URL. It is used here
 * only as (a) a fast existence check when scrapers are blocked, and (b) a
 * metadata/thumbnail fallback so the UI still shows the real video preview.
 * If oEmbed succeeds but no provider yields a stream, the API returns
 * NO_STREAM rather than pretending a download exists.
 */
export const oembedProvider = {
  name: 'oembed',
  enabled: () => config.providers.oembed,

  async resolve(parsed) {
    const target = parsed.canonicalUrl || `https://www.tiktok.com/@i/video/${parsed.videoId}`;
    const url = `https://www.tiktok.com/oembed?url=${encodeURIComponent(target)}`;
    try {
      const res = await request(url, {
        headers: { Accept: 'application/json' },
        timeoutMs: 9000,
        retries: 1,
      });
      if (res.status === 404 || res.status === 400) return { notFound: true };
      if (!res.ok) return null;
      const data = JSON.parse(await res.text());
      if (!data || typeof data !== 'object') return null;

      // CRITICAL: TikTok's oEmbed answers HTTP 200 with the SAME skeleton for
      // non-existent videos — {version,type,width,height,html,provider_*}
      // without `title`, `author_name` or `thumbnail_url`.
      // A real video always carries a title and/or a thumbnail.
      // Verified live (2026-11): fake id 7000000000000000000 => no title,
      // no thumbnail; real video => title + author_name + thumbnail_url.
      const hasTitle = typeof data.title === 'string' && data.title.trim().length > 0;
      const hasThumb = typeof data.thumbnail_url === 'string' && data.thumbnail_url.length > 0;
      if (!hasTitle && !hasThumb) return { notFound: true };

      return {
        id: String(parsed.videoId || data.embed_product_id || ''),
        kind: 'video',
        url: parsed.canonicalUrl,
        title: data.title || '',
        createdAt: null,
        durationSeconds: null,
        durationLabel: null,
        cover: data.thumbnail_url || null,
        coverFallback: null,
        dynamicCover: null,
        author: {
          id: null,
          username: data.author_url ? data.author_url.split('@').pop() : parsed.username || null,
          nickname: data.author_name || null,
          avatar: null,
          verified: false,
        },
        music: null,
        stats: {},
        qualities: [],
        images: [],
        isPhoto: false,
        region: null,
        provider: 'oembed',
        metadataOnly: true,
      };
    } catch (err) {
      log.debug('oembed failed', { err });
      return null;
    }
  },
};
