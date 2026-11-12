# TikSave — TikTok Video Downloader

Real TikTok video resolver + downloader. **No fake demo**: every file served is
the actual MP4 that TikTok's own players use, relayed by the server with HTTP
Range support.

- **Stack**: Node.js 20+ · Express 4 · vanilla JS frontend (zero frontend deps)
- **Deploy target**: Render.com → **Web Service** (Docker runtime, ffmpeg included)
- **Live API**: `POST /api/resolve`, `GET /api/download/:token`, `GET /api/stream/:token`, `POST /api/convert`

---

## 1. What actually works (verified live against TikTok)

| Feature | Status | Notes |
|---|---|---|
| Paste link → real metadata (title, author, avatar, cover, stats, music) | ✅ | Read from TikTok's own page JSON |
| Highest-quality watermark-free MP4 | ✅ | All bitrate ladders enumerated (e.g. 720p HEVC, 576p H.264) |
| Stream-based download with Range/seek | ✅ | Upstream verified to answer `206 Partial Content` |
| Preview player in the browser | ✅ | Proxied through `/api/stream/:token` |
| MP3 audio extraction | ✅ | FFmpeg, job-based, progress polling |
| GIF export | ✅ | FFmpeg, 8s cap |
| H.264 compatibility transcode (HEVC → H.264) | ✅ | Fixes "won't play on old Android" |
| Photo-post (gallery) support | ✅ | Multi-image posts |
| Short links (`vm.` / `vt.` / `/t/`) | ✅ | Redirect-expanded server-side |
| Bare ID, no scheme, `m.tiktok.com/v/`, extra query params | ✅ | Normalised |
| Correct error messages (not found / private / deleted / bad URL / throttle) | ✅ | Azerbaijani + English |
| No watermark | ✅ | The watermarked `wmplay` stream is **never** exposed |

### Providers (fallback chain)

1. **TikTok web page JSON** (`__UNIVERSAL_DATA_FOR_REHYDRATION__`) — primary,
   no API key, richest data (real resolution, codec, FPS, per-variant size).
2. **tikwm.com** — free mirror, 1 request/second. Fills HEVC ladders the page omits.
3. **RapidAPI** — optional commercial fallback, only used if `RAPIDAPI_KEY` is set.
4. **TikTok oEmbed** — official, metadata only (no stream); existence check.

Results are **merged**, so metadata from one provider and streams from another
both reach the UI.

---

## 2. Deploy on Render.com (Web Service)

### Option A — Blueprint (recommended, gets ffmpeg)

`render.yaml` is included. In Render: **New → Blueprint → pick this repo**.
It creates a Docker web service with a generated `TOKEN_SECRET`, health checks
on `/api/health`, and `ffmpeg` preinstalled.

### Option B — Manual Web Service

1. Render → **New → Web Service** → connect this repo.
2. **Runtime**: `Docker` (recommended) **or** `Node`.
3. Start command: `npm start` · Health check path: `/api/health`.
4. Environment variables:

| Variable | Required | Purpose |
|---|---|---|
| `TOKEN_SECRET` | **Yes (prod)** | HMAC key for signed download links. Without it a random key is generated per process and links break after restart/redeploy. Render can generate one: `generateValue: true`. |
| `NODE_ENV` | recommended | `production` |
| `PORT` | auto | Render injects it |
| `ENABLE_TIKTOK_WEB` | optional | default `true` |
| `ENABLE_TIKWM` | optional | default `true` |
| `ENABLE_OEMBED` | optional | default `true` |
| `RAPIDAPI_KEY` | optional | enables paid fallback |
| `RAPIDAPI_HOST` | optional | default `tiktok-scraper7.p.rapidapi.com` |
| `TIKTOK_PROXY` | optional | `http://user:pass@host:port` if Render's IPs get throttled |
| `CACHE_TTL_SECONDS` | optional | default `480` |
| `MAX_CONCURRENT_JOBS` | optional | default `2` |

> ⚠️ **Node runtime vs Docker**: Render's native Node image ships **without
> ffmpeg**. MP4 download/preview works fine either way, but MP3/GIF/H.264
> conversion returns `501 FFMPEG_MISSING`. Use the Dockerfile (Option A) to get
> the full feature set.

### Local

```bash
cp .env.example .env
npm install
npm start          # http://localhost:3000
```

`ffmpeg`/`ffprobe` are optional locally; the API reports availability at `/api/health`.

---

## 3. API reference

### `POST /api/resolve`

```json
{ "url": "https://www.tiktok.com/@user/video/123...", "refresh": false }
```

`200` →

```json
{
  "ok": true,
  "video": {
    "id": "6718335390845095173",
    "title": "...", "durationLabel": "0:10", "kind": "video",
    "author": { "username": "scout2015", "nickname": "...", "avatarPath": "/api/thumb/..." },
    "coverPath": "/api/thumb/...",
    "stats": { "playsLabel": "160.1K", "likesLabel": "35.2K", "...": "..." },
    "music": { "title": "...", "downloadPath": "/api/download/..." },
    "qualities": [
      {
        "id": "q0", "label": "720p", "resolution": "720x1280",
        "codec": "h265", "fps": 30, "sizeLabel": "1.9 MB",
        "watermark": false, "recommended": false,
        "downloadPath": "/api/download/<signed>",
        "streamPath": "/api/stream/<signed>",
        "filename": "scout2015-...-720p-h265.mp4"
      }
    ],
    "bestQuality": { "id": "q1", "label": "576p", "codec": "h264" },
    "providers": ["tiktok-web"], "resolveMs": 532, "fromCache": false
  }
}
```

Errors (`4xx/5xx`) always look like:

```json
{ "error": { "code": "VIDEO_NOT_FOUND", "message": "az...", "message_en": "en..." } }
```

| Code | HTTP | Meaning |
|---|---|---|
| `INVALID_URL` | 400 | Not a TikTok video link (profile links, other sites, empty) |
| `VIDEO_NOT_FOUND` | 404 | Deleted / private / never existed |
| `VIDEO_UNAVAILABLE` | 422 | Region-restricted / taken down |
| `NO_STREAM` | 422 | Metadata found but no playable source |
| `INVALID_TOKEN` | 403 | Signed link expired → resolve again |
| `RATE_LIMITED` | 429 | Per-IP limit (`RL_RESOLVE_PER_MIN`, default 30/min) |
| `UPSTREAM_ERROR` / `TIMEOUT` | 502/504 | TikTok unreachable |
| `FFMPEG_MISSING` | 501 | Conversion requested on a server without ffmpeg |

### Media endpoints

| Endpoint | Notes |
|---|---|
| `GET /api/download/:token` | `Content-Disposition: attachment`; honours `Range` |
| `GET /api/stream/:token` | inline (for `<video>`), honours `Range` |
| `GET /api/thumb/:token` | cover / avatar proxy (TikTok CDN blocks hotlinks) |
| `GET /api/probe/:token` | real codec/resolution via ffprobe |
| `POST /api/convert` | `{ token, kind: "mp3"\|"gif"\|"mp4", ... }` → `202 { job }` |
| `GET /api/jobs/:id` | `{ state: queued\|running\|done\|error, progress }` |
| `GET /api/jobs/:id/file` | finished artefact |
| `GET /api/health` | ffmpeg availability, providers, job counts |
| `GET /api/providers` | configured provider matrix |

---

## 4. Why the server proxies media (important design decision)

TikTok CDN URLs are **hotlink-protected and short-lived**:

- `video.playAddr` / `bitrateInfo[].PlayAddr.UrlList[*]` on `*.tiktokcdn.com`
  → **403** for non-browser clients (verified).
- The `https://www.tiktok.com/aweme/v1/play/?...` gateway from the same
  `UrlList` → **works** from a datacenter IP and answers `206` for `Range`.
- Links carry an expiry (`~2h`).

Therefore the browser **never** receives a TikTok URL. The server mints its own
HMAC-signed token (`/api/download/<token>`), verifies it on request, and streams
the bytes. This also keeps downloads same-origin (no CORS, no `Content-Disposition`
workarounds, mobile Safari behaves) and lets the server abort upstream transfers
when the client disconnects.

---

## 5. Documented limitations (read before complaining 🙂)

1. **TikTok has no public download API.** Its official APIs (Display / Research)
   **do not** expose video file URLs, and require app review. So resolution uses
   the public web page JSON + independent mirrors. This is the same source every
   downloader uses; it can break when TikTok changes its markup — the multi-provider
   chain exists precisely for that.
2. **Rate limits.** tikwm free tier = 1 req/sec. Our resolver caches results
   (`CACHE_TTL_SECONDS`) and collapses concurrent identical lookups, but heavy
   multi-instance traffic may need `RAPIDAPI_KEY` or `TIKTOK_PROXY`.
3. **Express is single-instance stateful.** Conversion jobs and the resolve cache
   live in process memory. On Render, use **1 instance**; a restart drops running
   jobs (downloads already in flight from cached URLs are unaffected).
4. **`TOKEN_SECRET` must be stable.** If unset on a multi-instance/restarting
   deployment, old download links 403. `/api/health` shows
   `tokenSecretConfigured`.
5. **Codec reality.** TikTok's highest-resolution ladder is frequently **HEVC**
   (H.265). iPhones and modern Android play it; older Chrome/Android may not.
   The UI labels each variant and flags an **H.264** "best compatible" default,
   plus an optional H.265→H.264 transcode job. Files are never re-encoded silently.
6. **Photo posts** return images, not a video stream (by design).
7. **Copyright.** Only download content you own or have permission to use. The
   app does not bypass private accounts, DRM, or takedowns — it surfaces the
   platform's own error instead.

---

## 6. Project layout

```
src/
  server.js              Express app, security headers, SPA fallback, error handler
  config.js              env parsing & defaults
  routes/api.js          all API routes (resolve, download, stream, thumb, convert, jobs)
  providers/
    index.js             fallback chain + merge + cache + client payload
    tiktok-web.js        TikTok page JSON provider (primary)
    tikwm.js             tikwm.com provider
    rapidapi.js          optional RapidAPI provider
    oembed.js            official oEmbed (metadata only)
    shape.js             shared tikwm-shaped normalizer
  lib/
    http.js              timeout/retry/backoff fetch wrapper
    stream.js            Range-aware upstream relay + SSRF allowlist + image proxy
    media.js             ffmpeg detect, ffprobe, bounded conversion job runner
    tokens.js            HMAC-signed media tokens
    cache.js             TTL cache with single-flight + per-IP rate limiter
    url.js               TikTok URL parser & short-link expansion
    format.js            bytes/duration/count formatting, slugify, codec class
    errors.js            structured AppError catalogue (AZ + EN)
    logger.js            JSON structured logging
public/
  index.html             UI markup
  styles.css             design system, full responsive (360px → desktop)
  app.js                 controller: resolve, preview, download, jobs, history, i18n
Dockerfile               Node 22 + ffmpeg (Render Docker runtime)
render.yaml              Render Blueprint (health check, generated secret)
```

## 7. UI features

Responsive from 320px phones to desktop; safe-area insets; 16px inputs (prevents
iOS zoom); no scroll-jank (CSS-only effects, no heavy libs). Includes: dark/light
theme, AZ/EN/RU interface, paste-from-clipboard, deep links (`/?url=...`),
recent-downloads history (localStorage), quality picker with codec/size badges,
inline preview with seek, MP3/GIF conversion with progress, share sheet,
copy caption/link, keyboard shortcut `/`, `prefers-reduced-motion` support.

## 8. Legal

For personal use only, respecting TikTok's Terms of Service and copyright law.
The author of this software is not responsible for how it is used.
