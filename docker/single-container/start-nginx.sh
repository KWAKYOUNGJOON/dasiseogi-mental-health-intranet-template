#!/bin/bash
set -Eeuo pipefail

APP_SERVER_PORT="${APP_SERVER_PORT:-8080}"
APP_HEALTHCHECK_PATH="${APP_HEALTHCHECK_PATH:-/api/v1/health}"
BACKEND_HEALTH_URL="http://127.0.0.1:${APP_SERVER_PORT}${APP_HEALTHCHECK_PATH}"

mkdir -p /data/logs

for _ in $(seq 1 60); do
  if curl -fsS "${BACKEND_HEALTH_URL}" >/dev/null 2>&1; then
    exec nginx -g 'daemon off;'
  fi
  sleep 1
done

echo "single-container-nginx: timed out waiting for backend health at ${BACKEND_HEALTH_URL}" >&2
exit 1
