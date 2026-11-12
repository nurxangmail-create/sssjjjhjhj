/** Human-readable helpers shared by providers and the UI payload. */

export function formatCount(n) {
  const num = Number(n);
  if (!Number.isFinite(num) || num <= 0) return null;
  if (num >= 1e9) return `${(num / 1e9).toFixed(1).replace(/\.0$/, '')}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return String(num);
}

export function formatBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return null;
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v >= 100 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, '')} ${units[i]}`;
}

export function formatDuration(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  if (!s) return null;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/** Filesystem/browser safe, readable filename slug. */
export function slugify(text, max = 48) {
  const base = String(text || '')
    .normalize('NFKD')
    // Azerbaijani/Turkish characters that NFKD does not fold.
    .replace(/[əƏ]/g, 'e')
    .replace(/[ıİ]/g, 'i')
    .replace(/[şŞ]/g, 's')
    .replace(/[çÇ]/g, 'c')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[öÖ]/g, 'o')
    .replace(/[üÜ]/g, 'u')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, ' ')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  const trimmed = base.slice(0, max).replace(/-+$/g, '');
  return trimmed || 'tiktok-video';
}

export function buildFilename({ title, username, qualityLabel, ext = 'mp4', suffix = '' }) {
  const parts = [slugify(username ? `@${username}`.replace('@', '') : 'tiktok', 24)];
  const t = slugify(title || '', 40);
  if (t && t !== 'tiktok-video') parts.push(t);
  if (qualityLabel) parts.push(slugify(qualityLabel, 16));
  if (suffix) parts.push(slugify(suffix, 16));
  return `${parts.filter(Boolean).join('-')}.${ext}`;
}

/** Codec class used for compatibility decisions in the UI. */
export function codecClass(codecRaw, formatRaw) {
  const c = String(codecRaw || '').toLowerCase();
  const f = String(formatRaw || '').toLowerCase();
  if (/h265|hevc|hvc1|hev1/.test(c) || /hevc|h265/.test(f)) return 'h265';
  if (/av01|av1/.test(c)) return 'av1';
  if (/vp9|vp09/.test(c)) return 'vp9';
  if (/h264|avc|avc1/.test(c) || /h264/.test(f)) return 'h264';
  return 'unknown';
}
