import { config } from '../config.js';
import { request } from '../lib/http.js';
import { log } from '../lib/logger.js';

/**
 * Provider: RapidAPI (optional, commercial).
 *
 * Disabled unless RAPIDAPI_KEY is set. Works with TikTok scrapers on RapidAPI
 * that expose the tikwm-style envelope `{ code: 0, data: {...} }`
 * (e.g. tiktok-scraper7). Only used when the free providers fail, so the key
 * is spent on real fallbacks rather than every request.
 *
 * Configure with:
 *   RAPIDAPI_KEY=<your key>
 *   RAPIDAPI_HOST=tiktok-scraper7.p.rapidapi.com
 *   RAPIDAPI_PATH=/            (query: ?url=<canonical>&hd=1)
 */
export const rapidApiProvider = {
  name: 'rapidapi',
  enabled: () => config.providers.rapidapi && Boolean(config.rapidapi.key),

  async resolve(parsed) {
    if (!config.rapidapi.key) return null;
    const target = parsed.canonicalUrl || `https://www.tiktok.com/@i/video/${parsed.videoId}`;

    const url = new URL(`https://${config.rapidapi.host}${config.rapidapi.path}`);
    url.searchParams.set('url', target);
    url.searchParams.set('hd', '1');

    let payload;
    try {
      const res = await request(url.toString(), {
        method: config.rapidapi.method,
        headers: {
          'X-RapidAPI-Key': config.rapidapi.key,
          'X-RapidAPI-Host': config.rapidapi.host,
          Accept: 'application/json',
        },
        timeoutMs: 15000,
        retries: 1,
      });
      const text = await res.text();
      payload = JSON.parse(text);
    } catch (err) {
      log.warn('rapidapi request failed', { err });
      return null;
    }

    // Hand off to the shared tikwm-shaped normalizer via a late import so the
    // module stays optional/optional-loadable.
    const { normalizeTikwmShape } = await import('./shape.js');
    if (!payload || typeof payload !== 'object') return null;
    if (payload.code !== undefined && payload.code !== 0) {
      const msg = String(payload.msg || payload.message || '');
      if (/not found|invalid|does not exist/i.test(msg)) return { notFound: true };
      return null;
    }
    const data = payload.data || payload;
    if (!data || (!data.play && !data.hdplay && !data.images)) return null;
    return normalizeTikwmShape(data, parsed);
  },
};
