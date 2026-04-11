#!/bin/bash
set -Eeuo pipefail

export SPRING_PROFILES_ACTIVE="${SPRING_PROFILES_ACTIVE:-local}"
export APP_SERVER_PORT="${APP_SERVER_PORT:-8080}"
export APP_DB_NAME="${APP_DB_NAME:-mental_health_local}"
export APP_DB_USERNAME="${APP_DB_USERNAME:-mental_user}"
export APP_DB_PASSWORD="${APP_DB_PASSWORD:-mental_pass}"
export APP_DB_DRIVER="${APP_DB_DRIVER:-org.mariadb.jdbc.Driver}"
export APP_SEED_ENABLED="${APP_SEED_ENABLED:-true}"
export APP_BACKUP_ROOT_PATH="${APP_BACKUP_ROOT_PATH:-/data/backups}"
export APP_EXPORT_TEMP_PATH="${APP_EXPORT_TEMP_PATH:-/data/tmp/exports}"
export APP_DB_DUMP_COMMAND="${APP_DB_DUMP_COMMAND:-mariadb-dump}"
export LOGGING_FILE_PATH="${LOGGING_FILE_PATH:-/data/logs}"
export APP_LOG_FILE_PATH="${APP_LOG_FILE_PATH:-/data/logs}"
export APP_ENVIRONMENT="${APP_ENVIRONMENT:-local-single-container}"
export MARIADB_PORT="${MARIADB_PORT:-3306}"

DEFAULT_DB_URL="jdbc:mariadb://127.0.0.1:${MARIADB_PORT}/${APP_DB_NAME}?useUnicode=true&characterEncoding=utf8"
export APP_DB_URL_DOCKER="${APP_DB_URL_DOCKER:-${APP_DB_URL:-${DEFAULT_DB_URL}}}"
export APP_DB_URL="${APP_DB_URL_DOCKER}"

mkdir -p "${LOGGING_FILE_PATH}" "${APP_BACKUP_ROOT_PATH}" "${APP_EXPORT_TEMP_PATH}"

for _ in $(seq 1 60); do
  if mariadb-admin ping \
    -h 127.0.0.1 \
    -P "${MARIADB_PORT}" \
    -u"${APP_DB_USERNAME}" \
    -p"${APP_DB_PASSWORD}" \
    --silent >/dev/null 2>&1; then
    exec /app/backend/docker-entrypoint.sh
  fi
  sleep 1
done

echo "single-container-backend: timed out waiting for MariaDB on 127.0.0.1:${MARIADB_PORT}" >&2
exit 1
