# ---------------------------------------------------------------------------
# TikSave — production image for Render.com
#
# Why Docker on Render: Render's native Node runtime does NOT ship ffmpeg.
# The MP3 / GIF / compatibility-transcode features need it, so we install it
# here. The app itself still boots fine without Docker (MP4 streaming needs no
# ffmpeg) — only conversion endpoints return 501 in that case.
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS base

ENV NODE_ENV=production \
    PORT=3000 \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false

# ffmpeg: conversion + ffprobe.  curl: container healthcheck.
# tini: correct signal handling so Render's SIGTERM reaches Node cleanly.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ffmpeg \
      curl \
      tini \
      ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && ffmpeg -version | head -1

WORKDIR /app

# Install deps first for better layer caching.
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

# App source (node_modules and .env are excluded via .dockerignore)
COPY . .

# Run as the unprivileged user that ships with the official image.
RUN mkdir -p /tmp/ttdl-jobs && chown -R node:node /app /tmp/ttdl-jobs
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/api/health" || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "src/server.js"]
