import express from 'express';
import compression from 'compression';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, version } from './config.js';
import { log } from './lib/logger.js';
import { isAppError } from './lib/errors.js';
import { api } from './routes/api.js';
import { checkAvailability, startJobSweeper } from './lib/media.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const app = express();

// Render terminates TLS at its proxy.
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(compression());
app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: false, limit: '64kb' }));

// Basic security headers (no external deps).
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

// Access log (skips health pings to keep Render logs readable).
app.use((req, res, next) => {
  if (req.path === '/api/health') return next();
  const started = Date.now();
  res.on('finish', () => {
    log.info('http', {
      m: req.method,
      p: req.path.length > 90 ? req.path.slice(0, 90) + '…' : req.path,
      s: res.statusCode,
      ms: Date.now() - started,
    });
  });
  next();
});

app.use('/api', api);

app.use(
  express.static(PUBLIC_DIR, {
    maxAge: config.isProd ? '1h' : 0,
    etag: true,
    setHeaders(res, filePath) {
      if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
    },
  }),
);

// SPA fallback for non-API routes.
app.get(/^\/(?!api\/).*/, (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.use((req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Belə bir endpoint yoxdur.' } });
});

// Central error handler: always JSON, never leaks stack traces.
app.use((err, req, res, next) => {
  if (res.headersSent) {
    log.warn('error after headers sent', { err });
    return res.end();
  }
  if (isAppError(err)) {
    if (err.status >= 500) log.error('app error', { code: err.code, err, path: req.path });
    else log.info('app error', { code: err.code, status: err.status, path: req.path });
    if (err.status === 429) res.setHeader('Retry-After', String(err.extra?.retryAfter || 30));
    return res.status(err.status).json(err.toJSON());
  }
  // Body-parser style errors
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'BAD_JSON', message: 'Sorğu formatı düzgün deyil.' } });
  }
  log.error('unhandled', { err, path: req.path, method: req.method });
  res.status(500).json({
    error: {
      code: 'INTERNAL',
      message: 'Serverdə gözlənilməz xəta baş verdi. Yenidən cəhd edin.',
      message_en: 'Unexpected server error.',
    },
  });
});

const server = app.listen(config.port, config.host, async () => {
  const av = await checkAvailability();
  log.info('server started', {
    version,
    port: config.port,
    env: config.env,
    ffmpeg: av.ffmpeg ? av.version || true : false,
    providers: config.providers,
    tokenSecret: config.tokenSecretEphemeral ? 'ephemeral' : 'configured',
  });
  if (config.tokenSecretEphemeral) {
    log.warn('TOKEN_SECRET not set — download links will break after a restart/redeploy. Set it in Render env vars.');
  }
  if (!av.ffmpeg) {
    log.warn('FFmpeg missing — MP3/GIF/compatibility conversion will return 501. Deploy with the Dockerfile to enable it.');
  }
});

startJobSweeper();

// Keep-alive: Render's proxy reuses connections; make sure slow streams aren't cut.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 70_000;

function shutdown(signal) {
  log.info('shutting down', { signal });
  server.close(() => {
    log.info('closed');
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 8000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => log.error('unhandledRejection', { err: reason }));
process.on('uncaughtException', (err) => log.error('uncaughtException', { err }));

export default app;
