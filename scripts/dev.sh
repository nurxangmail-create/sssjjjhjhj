#!/usr/bin/env bash
# Dev process manager for the sandbox (pidfile based so it never kills the caller).
set -u
cd "$(dirname "$0")/.." || exit 1
PIDFILE=".dev.pid"
LOG="logs/server.log"
mkdir -p logs

stop() {
  if [ -f "$PIDFILE" ]; then
    PID=$(cat "$PIDFILE" 2>/dev/null || true)
    if [ -n "${PID:-}" ] && kill -0 "$PID" 2>/dev/null; then
      kill "$PID" 2>/dev/null || true
      for _ in 1 2 3 4 5 6 7 8 9 10; do
        kill -0 "$PID" 2>/dev/null || break
        sleep 0.2
      done
      kill -9 "$PID" 2>/dev/null || true
    fi
    rm -f "$PIDFILE"
  fi
}

start() {
  setsid -f node src/server.js > "$LOG" 2>&1 < /dev/null
  sleep 0.6
  # setsid -f detaches; find the newest node server pid and record it.
  NEWPID=$(pgrep -f "[n]ode src/server.js" | tail -1 || true)
  if [ -n "${NEWPID:-}" ]; then echo "$NEWPID" > "$PIDFILE"; fi
  for _ in $(seq 1 40); do
    if curl -sf -m 2 "http://localhost:${PORT:-3000}/api/health" > /dev/null 2>&1; then
      echo "started pid=$(cat "$PIDFILE" 2>/dev/null)"
      return 0
    fi
    sleep 0.25
  done
  echo "FAILED to start — log tail:"
  tail -20 "$LOG"
  return 1
}

case "${1:-restart}" in
  start) start ;;
  stop) stop; echo stopped ;;
  restart) stop; start ;;
  *) echo "usage: $0 {start|stop|restart}"; exit 1 ;;
esac
