import { errors } from './errors.js';

const ID_RE = /^\d{6,25}$/;

/** Accepted hostnames (exact or suffix). */
const HOSTS = [
  'tiktok.com',
  'www.tiktok.com',
  'm.tiktok.com',
  'vm.tiktok.com',
  'vt.tiktok.com',
  'www.vm.tiktok.com',
  'lite.tiktok.com',
  'tiktokv.com',
  'www.tiktokv.com',
  'vt.tiktokv.com',
];

const SHORT_HOSTS = new Set(['vm.tiktok.com', 'vt.tiktok.com', 'www.vm.tiktok.com', 'vt.tiktokv.com']);

export function normalizeInput(raw) {
  if (typeof raw !== 'string') throw errors.badUrl('No URL provided.');
  let s = raw.trim();
  if (!s) throw errors.badUrl('Empty URL.');
  // Strip surrounding quotes / whitespace that mobile share sheets add.
  s = s.replace(/^[<"'“”'(]+|[>"'“”)']+$/g, '').trim();
  if (s.length > 2048) throw errors.badUrl('URL too long.');
  // Bare IDs: "6718335390845095173" or "tiktok.com/@a/video/123" without scheme.
  if (ID_RE.test(s)) return `https://www.tiktok.com/@i/video/${s}`;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = `https://${s.replace(/^\/+/, '')}`;
  return s;
}

export function isTikTokHost(hostname) {
  const h = hostname.toLowerCase();
  return HOSTS.includes(h) || h.endsWith('.tiktok.com') || h.endsWith('.tiktokv.com');
}

/**
 * Parse any TikTok share/desktop/mobile URL shape into a canonical descriptor.
 *
 * Supported:
 *   https://www.tiktok.com/@user/video/123
 *   https://www.tiktok.com/@user/photo/123
 *   https://m.tiktok.com/v/123.html
 *   https://vm.tiktok.com/ZMxxxx/            (short -> needs redirect)
 *   https://vt.tiktok.com/ZSxxxx/
 *   https://www.tiktok.com/t/ZTxxxx/
 *   https://www.tiktok.com/@user/video/123?is_from_webapp=1&sender_device=pc
 *
 * @returns {{kind:'video'|'photo'|'short', videoId?:string, username?:string, shortUrl?:string, canonicalUrl?:string}}
 */
export function parseTikTokUrl(input) {
  const normalized = normalizeInput(input);
  let url;
  try {
    url = new URL(normalized);
  } catch {
    throw errors.badUrl('Could not parse the URL.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw errors.badUrl('Only http(s) links are supported.');
  }
  if (!isTikTokHost(url.hostname)) {
    throw errors.badUrl('This is not a TikTok link.');
  }

  const host = url.hostname.toLowerCase();
  const path = url.pathname.replace(/\/{2,}/g, '/');

  // Short links must be resolved with a redirect first.
  if (SHORT_HOSTS.has(host) || /^\/t\/[A-Za-z0-9]+\/?$/.test(path)) {
    return { kind: 'short', shortUrl: url.toString() };
  }

  // /@user/video/ID  |  /@user/photo/ID  |  /video/ID (no username)
  const m =
    path.match(/^\/@([^/]+)\/(video|photo)\/(\d{6,25})/) ||
    path.match(/^\/@([^/]+)\/v\/(\d{6,25})/) ||
    path.match(/^\/(?:embed(?:\/v2)?|player\/v1|v)\/(\d{6,25})/) ||
    path.match(/^\/(?:video|photo)\/(\d{6,25})/);

  if (m) {
    // Different regexes produce different group offsets; recover by scanning.
    const groups = m.slice(1);
    const idGroup = groups.find((g) => g && ID_RE.test(g)) || null;
    const kindGroup = groups.find((g) => g === 'video' || g === 'photo') || null;
    const userGroup = groups.find((g) => g && !ID_RE.test(g) && g !== 'video' && g !== 'photo') || null;
    if (!idGroup) throw errors.badUrl('Video ID missing from the link.');
    const kind = kindGroup === 'photo' ? 'photo' : 'video';
    return {
      kind,
      videoId: idGroup,
      username: userGroup ? decodeURIComponent(userGroup) : undefined,
      canonicalUrl: `https://www.tiktok.com/@${userGroup ? decodeURIComponent(userGroup) : 'i'}/${kind}/${idGroup}`,
    };
  }

  // Bare ID anywhere in the path, e.g. /1234567890.html
  const idOnly = path.match(/(\d{15,25})/);
  if (idOnly) {
    return {
      kind: 'video',
      videoId: idOnly[1],
      canonicalUrl: `https://www.tiktok.com/@i/video/${idOnly[1]}`,
    };
  }

  // A profile link is not a video.
  if (/^\/@[^/]+\/?$/.test(path)) {
    throw errors.badUrl('That is a profile link. Open a specific video and copy its link.');
  }

  throw errors.badUrl('Unrecognized TikTok URL format.');
}

/** Follow redirects on vm./vt. short links to obtain the real video URL. */
export async function expandShortUrl(shortUrl, { request }) {
  const res = await request(shortUrl, {
    method: 'GET',
    redirect: 'manual',
    retries: 1,
    timeoutMs: 9000,
    headers: { Accept: 'text/html' },
  });
  let location = res.headers.get('location');
  // Drain body to free the socket.
  res.arrayBuffer().catch(() => {});

  // Some short hosts answer 200 with a meta-refresh instead of a redirect.
  if (!location && res.status === 200) {
    throw errors.notFound();
  }
  if (!location) throw errors.notFound();

  for (let hop = 0; hop < 5; hop += 1) {
    const target = new URL(location, shortUrl);
    if (!isTikTokHost(target.hostname)) throw errors.notFound();
    if (/(\/@[^/]+\/(video|photo)\/|\/v\/|video\/)\d{6,25}/.test(target.pathname)) {
      return target.toString();
    }
    const next = await request(target.toString(), {
      redirect: 'manual',
      retries: 1,
      timeoutMs: 9000,
      headers: { Accept: 'text/html' },
    });
    const nextLoc = next.headers.get('location');
    next.arrayBuffer().catch(() => {});
    if (!nextLoc) return target.toString();
    location = nextLoc;
  }
  throw errors.notFound();
}
