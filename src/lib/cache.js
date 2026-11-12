/**
 * Small in-process TTL cache with single-flight de-duplication.
 *
 * TikTok video metadata barely changes, and the free providers are
 * rate limited (tikwm: 1 req/sec). Caching prevents duplicate upstream
 * calls when the same link is pasted twice, or when the browser retries.
 */
export class TtlCache {
  constructor({ ttlSeconds = 300, max = 300 } = {}) {
    this.ttl = ttlSeconds * 1000;
    this.max = max;
    this.map = new Map();
    this.inflight = new Map();
  }

  get(key) {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.expires < Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    // refresh LRU order
    this.map.delete(key);
    this.map.set(key, hit);
    return hit.value;
  }

  set(key, value) {
    if (this.map.size >= this.max) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    this.map.set(key, { value, expires: Date.now() + this.ttl });
  }

  delete(key) {
    this.map.delete(key);
  }

  clear() {
    this.map.clear();
  }

  get size() {
    return this.map.size;
  }

  /**
   * Collapses concurrent identical requests into one upstream call.
   */
  async wrap(key, fn) {
    const cached = this.get(key);
    if (cached !== undefined) return { value: cached, cached: true };

    const running = this.inflight.get(key);
    if (running) return { value: await running, cached: true };

    const promise = (async () => {
      try {
        const value = await fn();
        if (value !== undefined) this.set(key, value);
        return value;
      } finally {
        this.inflight.delete(key);
      }
    })();

    this.inflight.set(key, promise);
    return { value: await promise, cached: false };
  }
}

/** Simple per-key sliding-window rate limiter. */
export class RateLimiter {
  constructor({ perMinute = 30 } = {}) {
    this.perMinute = perMinute;
    this.hits = new Map();
    this.timer = setInterval(() => this.sweep(), 60_000);
    this.timer.unref?.();
  }

  sweep() {
    const cutoff = Date.now() - 60_000;
    for (const [key, arr] of this.hits) {
      const kept = arr.filter((t) => t > cutoff);
      if (kept.length) this.hits.set(key, kept);
      else this.hits.delete(key);
    }
  }

  /** @returns {{allowed:boolean, remaining:number, retryAfter:number}} */
  take(key) {
    const now = Date.now();
    const cutoff = now - 60_000;
    const arr = (this.hits.get(key) || []).filter((t) => t > cutoff);
    // Exponential-ish backoff if the caller keeps hammering.
    if (arr.length >= this.perMinute) {
      const oldest = arr[0];
      const retryAfter = Math.max(1, Math.ceil((oldest + 60_000 - now) / 1000));
      this.hits.set(key, arr);
      return { allowed: false, remaining: 0, retryAfter };
    }
    arr.push(now);
    this.hits.set(key, arr);
    return { allowed: true, remaining: this.perMinute - arr.length, retryAfter: 0 };
  }
}
