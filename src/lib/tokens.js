import crypto from 'node:crypto';
import { config } from '../config.js';

/**
 * Signed media tokens.
 *
 * Why: we never expose raw TikTok CDN URLs to the browser. Those URLs are
 * IP/time signed upstream and hotlink-protected, so a browser fetch fails or
 * expires. Instead the server hands out an opaque token; /api/download/:token
 * verifies it and streams the bytes itself (with Range support).
 */
const b64url = (buf) => Buffer.from(buf).toString('base64url');

function hmac(payload) {
  return crypto.createHmac('sha256', config.tokenSecret).update(payload).digest('base64url');
}

export function signMediaToken(data, ttlSeconds) {
  const body = {
    ...data,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const payload = b64url(JSON.stringify(body));
  return `${payload}.${hmac(payload)}`;
}

export function verifyMediaToken(token) {
  if (typeof token !== 'string' || token.length > 8192) return null;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = hmac(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let body;
  try {
    body = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!body || typeof body !== 'object') return null;
  if (typeof body.exp !== 'number' || body.exp < Math.floor(Date.now() / 1000)) return null;
  return body;
}
