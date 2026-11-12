/**
 * Structured application errors with a stable machine `code`, an HTTP status
 * and a user-facing Azerbaijani message plus an English fallback.
 */
export class AppError extends Error {
  constructor(code, status, az, en, extra = {}) {
    super(az);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.az = az;
    this.en = en;
    this.extra = extra;
    this.expose = true;
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.az,
        message_en: this.en,
        ...(Object.keys(this.extra).length ? { details: this.extra } : {}),
      },
    };
  }
}

export const errors = {
  badUrl: (reason = '') =>
    new AppError(
      'INVALID_URL',
      400,
      'Link düzgün deyil. TikTok video linkini yoxlayın (məsələn: https://www.tiktok.com/@istifadeci/video/1234567890123456789).',
      `Invalid URL. ${reason}`.trim(),
    ),

  notFound: () =>
    new AppError(
      'VIDEO_NOT_FOUND',
      404,
      'Video tapılmadı. Link silinmiş, özəl (private) və ya yanlış ola bilər.',
      'Video not found. The link may be deleted, private, or incorrect.',
    ),

  unavailable: (reason = '') =>
    new AppError(
      'VIDEO_UNAVAILABLE',
      422,
      'Bu video əlçatan deyil. Bölgə məhdudiyyəti, özəl hesab və ya silinmiş video ola bilər.',
      `Video unavailable. ${reason}`.trim(),
    ),

  noStream: () =>
    new AppError(
      'NO_STREAM',
      422,
      'Video mənbəyi əldə edilə bilmədi. Bir neçə saniyə sonra yenidən cəhd edin.',
      'Could not obtain a downloadable video stream.',
    ),

  upstream: (reason = '') =>
    new AppError(
      'UPSTREAM_ERROR',
      502,
      'TikTok cavab vermədi. Bir neçə saniyə sonra yenidən cəhd edin.',
      `Upstream provider failed. ${reason}`.trim(),
    ),

  timeout: () =>
    new AppError(
      'TIMEOUT',
      504,
      'Sorğu vaxtı bitdi. İnternet bağlantısını yoxlayıb yenidən cəhd edin.',
      'The request timed out.',
    ),

  rateLimited: (retryAfter = 30) =>
    new AppError(
      'RATE_LIMITED',
      429,
      `Çox sürətli sorğu göndərdiniz. ${retryAfter} saniyə sonra yenidən cəhd edin.`,
      `Too many requests. Retry in ${retryAfter}s.`,
      { retryAfter },
    ),

  badToken: () =>
    new AppError(
      'INVALID_TOKEN',
      403,
      'Yükləmə linkinin vaxtı bitib. Videonu yenidən axtarın.',
      'The download link expired. Please resolve the video again.',
    ),

  ffmpegMissing: () =>
    new AppError(
      'FFMPEG_MISSING',
      501,
      'Bu serverdə FFmpeg quraşdırılmayıb, çevirmə mövcud deyil. Birbaşa MP4 yükləmədən istifadə edin.',
      'FFmpeg is not installed on this server; conversion is unavailable.',
    ),

  jobFailed: (reason = '') =>
    new AppError(
      'JOB_FAILED',
      500,
      'Çevirmə alınmadı. Birbaşa MP4 variantını yükləməyə çalışın.',
      `Conversion failed. ${reason}`.trim(),
    ),

  tooLarge: (limitMb) =>
    new AppError(
      'TOO_LARGE',
      413,
      `Video çox böyükdür (limit: ${limitMb} MB).`,
      `Video exceeds the ${limitMb} MB limit.`,
    ),

  badJob: (reason = '') =>
    new AppError(
      'BAD_JOB',
      400,
      'Çevirmə sorğusu düzgün deyil.',
      `Invalid conversion request. ${reason}`.trim(),
    ),

  jobNotFound: () =>
    new AppError(
      'JOB_NOT_FOUND',
      404,
      'Çevirmə tapılmadı və ya vaxtı bitib. Yenidən çevirin.',
      'Conversion job not found or already expired.',
    ),

  jobPending: () =>
    new AppError(
      'JOB_PENDING',
      409,
      'Çevirmə hələ bitməyib. Bir neçə saniyə gözləyin.',
      'Conversion is still running.',
    ),

  forbidden: () =>
    new AppError('FORBIDDEN', 403, 'Bu əməliyyat icazəli deyil.', 'Forbidden.'),
};

export function isAppError(err) {
  return err instanceof AppError;
}
