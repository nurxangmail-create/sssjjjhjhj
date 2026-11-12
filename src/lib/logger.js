const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const current = LEVELS[process.env.LOG_LEVEL] ?? (process.env.NODE_ENV === 'production' ? LEVELS.info : LEVELS.debug);

function emit(level, msg, meta) {
  if (LEVELS[level] > current) return;
  const line = {
    t: new Date().toISOString(),
    level,
    msg,
  };
  if (meta && typeof meta === 'object') {
    for (const [k, v] of Object.entries(meta)) {
      if (v === undefined) continue;
      if (v instanceof Error) {
        line[k] = v.message;
        if (level === 'error') line[k + '_stack'] = String(v.stack || '').split('\n').slice(0, 4).join(' | ');
      } else {
        line[k] = v;
      }
    }
  }
  const out = JSON.stringify(line);
  if (level === 'error') console.error(out);
  else if (level === 'warn') console.warn(out);
  else console.log(out);
}

export const log = {
  error: (m, meta) => emit('error', m, meta),
  warn: (m, meta) => emit('warn', m, meta),
  info: (m, meta) => emit('info', m, meta),
  debug: (m, meta) => emit('debug', m, meta),
  child: (base) => ({
    error: (m, meta) => emit('error', m, { ...base, ...meta }),
    warn: (m, meta) => emit('warn', m, { ...base, ...meta }),
    info: (m, meta) => emit('info', m, { ...base, ...meta }),
    debug: (m, meta) => emit('debug', m, { ...base, ...meta }),
  }),
};
