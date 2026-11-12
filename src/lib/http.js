import { config } from '../config.js';
import { AppError, errors } from './errors.js';
import { log } from './logger.js';

const DEFAULT_HEADERS = {
  'User-Agent': config.http.userAgent,
  'Accept-Language': 'en-US,en;q=0.9',
  Accept: 'application/json, text/plain, */*',
};

function withTimeout(ms, outer) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error('timeout')), ms);
  if (outer) {
    if (outer.aborted) ctrl.abort(outer.reason);
    else outer.addEventListener('abort', () => ctrl.abort(outer.reason), { once: true });
  }
  return { signal: ctrl.signal, done: () => clearTimeout(timer) };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * fetch with timeout, retries and exponential backoff.
 * Retries only on network errors / 429 / 5xx — never on 4xx logic errors.
 */
export async function request(url, opts = {}) {
  const {
    method = 'GET',
    headers = {},
    body,
    timeoutMs = config.http.timeoutMs,
    retries = config.http.retries,
    signal: outerSignal,
    redirect = 'follow',
  } = opts;

  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const { signal, done } = withTimeout(timeoutMs, outerSignal);
    try {
      const res = await fetch(url, {
        method,
        headers: { ...DEFAULT_HEADERS, ...headers },
        body,
        signal,
        redirect,
      });
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        const ra = Number(res.headers.get('retry-after'));
        const wait = Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, 4000) : 400 * (attempt + 1) ** 2;
        log.debug('http retry', { url: url.slice(0, 120), status: res.status, wait });
        await res.arrayBuffer().catch(() => {});
        await sleep(wait);
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      const isTimeout = err?.name === 'AbortError' || /timeout/i.test(err?.message || '');
      if (isTimeout) {
        if (attempt >= retries) throw errors.timeout();
      } else if (attempt >= retries) {
        throw errors.upstream(err?.message || 'network error');
      }
      await sleep(300 * (attempt + 1));
    } finally {
      done();
    }
  }
  throw errors.upstream(lastErr?.message || 'unknown');
}

export async function requestJson(url, opts = {}) {
  const res = await request(url, {
    ...opts,
    headers: { Accept: 'application/json', ...(opts.headers || {}) },
  });
  if (!res.ok) {
    const err = AppError.prototype.isPrototypeOf(res) ? res : null;
    throw err || errors.upstream(`HTTP ${res.status} from ${new URL(url).host}`);
  }
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw errors.upstream('Invalid JSON from provider');
  }
}

export async function requestText(url, opts = {}) {
  const res = await request(url, {
    ...opts,
    headers: { Accept: 'text/html,application/xhtml+xml', ...(opts.headers || {}) },
  });
  if (!res.ok) throw errors.upstream(`HTTP ${res.status} from ${new URL(url).host}`);
  return res.text();
}

/** Utility: HEAD-style size probe that degrades gracefully. */
export async function probeSize(url, headers = {}) {
  try {
    const res = await request(url, {
      method: 'HEAD',
      headers,
      retries: 0,
      timeoutMs: Math.min(config.http.timeoutMs, 6000),
    });
    const len = Number(res.headers.get('content-length'));
    return Number.isFinite(len) && len > 0 ? len : null;
  } catch {
    return null;
  }
}
