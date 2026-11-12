import 'dotenv/config';
import crypto from 'node:crypto';

const bool = (v, d = false) => {
  if (v === undefined || v === null || v === '') return d;
  return /^(1|true|yes|on|enabled)$/i.test(String(v).trim());
};

const int = (v, d) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : d;
};

const str = (v, d = '') => (typeof v === 'string' && v.trim() ? v.trim() : d);

function buildSecret() {
  const provided = str(process.env.TOKEN_SECRET);
  if (provided && provided.length >= 16) return { secret: provided, ephemeral: false };
  // Ephemeral secret: keeps the app booting without configuration, but signed
  // media links die on restart and are per-instance. Documented in README.
  return { secret: crypto.randomBytes(32).toString('hex'), ephemeral: true };
}

const { secret, ephemeral } = buildSecret();

export const config = {
  env: str(process.env.NODE_ENV, 'development'),
  isProd: str(process.env.NODE_ENV, 'development') === 'production',
  port: int(process.env.PORT, 3000),
  host: str(process.env.HOST, '0.0.0.0'),

  tokenSecret: secret,
  tokenSecretEphemeral: ephemeral,
  /** Media links stay valid long enough for a slow mobile download to start. */
  tokenTtlSeconds: int(process.env.TOKEN_TTL_SECONDS, 7200),
  /** Thumbnails are re-proxied often, keep them cheap. */
  thumbTtlSeconds: int(process.env.THUMB_TTL_SECONDS, 21600),

  providers: {
    tiktokWeb: bool(process.env.ENABLE_TIKTOK_WEB, true),
    tikwm: bool(process.env.ENABLE_TIKWM, true),
    rapidapi: bool(process.env.RAPIDAPI_KEY, false),
    oembed: bool(process.env.ENABLE_OEMBED, true),
  },

  tikwmBase: str(process.env.TIKWM_BASE, 'https://www.tikwm.com/api/'),
  rapidapi: {
    key: str(process.env.RAPIDAPI_KEY),
    host: str(process.env.RAPIDAPI_HOST, 'tiktok-scraper7.p.rapidapi.com'),
    path: str(process.env.RAPIDAPI_PATH, '/'),
    // tiktok-scraper7 uses /  with ?url=, others differ; path is configurable.
    method: str(process.env.RAPIDAPI_METHOD, 'GET').toUpperCase(),
  },

  http: {
    timeoutMs: int(process.env.HTTP_TIMEOUT_MS, 12000),
    retries: int(process.env.HTTP_RETRIES, 2),
    proxy: str(process.env.TIKTOK_PROXY),
    userAgent:
      str(process.env.HTTP_USER_AGENT) ||
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  },

  cacheTtlSeconds: int(process.env.CACHE_TTL_SECONDS, 480),

  ffmpeg: {
    bin: str(process.env.FFMPEG_PATH, 'ffmpeg'),
    probe: str(process.env.FFPROBE_PATH, 'ffprobe'),
    maxConcurrent: Math.max(1, int(process.env.MAX_CONCURRENT_JOBS, 2)),
    jobTtlSeconds: int(process.env.JOB_TTL_SECONDS, 1200),
    jobTimeoutSeconds: int(process.env.JOB_TIMEOUT_SECONDS, 300),
    maxInputMb: int(process.env.MAX_INPUT_MB, 400),
  },

  rateLimits: {
    resolvePerMin: int(process.env.RL_RESOLVE_PER_MIN, 30),
    jobPerMin: int(process.env.RL_JOB_PER_MIN, 10),
  },

  maxPhotos: Math.max(1, int(process.env.MAX_PHOTOS, 40)),
};

export const version = '1.0.0';
