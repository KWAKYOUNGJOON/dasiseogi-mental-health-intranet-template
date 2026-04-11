#!/bin/bash
set -Eeuo pipefail

export TZ="${TZ:-Asia/Seoul}"
export APP_DB_NAME="${APP_DB_NAME:-mental_health_local}"
export APP_DB_USERNAME="${APP_DB_USERNAME:-mental_user}"
export APP_DB_PASSWORD="${APP_DB_PASSWORD:-mental_pass}"
export APP_DB_DRIVER="${APP_DB_DRIVER:-org.mariadb.jdbc.Driver}"
export APP_SERVER_PORT="${APP_SERVER_PORT:-8080}"
export APP_FRONTEND_PORT="${APP_FRONTEND_PORT:-4173}"
export APP_HEALTHCHECK_PATH="${APP_HEALTHCHECK_PATH:-/api/v1/health}"
export APP_SEED_ENABLED="${APP_SEED_ENABLED:-true}"
export APP_BACKUP_ROOT_PATH="${APP_BACKUP_ROOT_PATH:-/data/backups}"
export APP_EXPORT_TEMP_PATH="${APP_EXPORT_TEMP_PATH:-/data/tmp/exports}"
export APP_DB_DUMP_COMMAND="${APP_DB_DUMP_COMMAND:-mariadb-dump}"
export LOGGING_FILE_PATH="${LOGGING_FILE_PATH:-/data/logs}"
export APP_LOG_FILE_PATH="${APP_LOG_FILE_PATH:-/data/logs}"
export MARIADB_DATA_DIR="${MARIADB_DATA_DIR:-/var/lib/mysql}"
export MARIADB_RUN_DIR="${MARIADB_RUN_DIR:-/run/mysqld}"
export MARIADB_SOCKET="${MARIADB_SOCKET:-/run/mysqld/mysqld.sock}"
export MARIADB_PID_FILE="${MARIADB_PID_FILE:-/run/mysqld/mysqld.pid}"
export MARIADB_PORT="${MARIADB_PORT:-3306}"

mkdir -p \
  "${LOGGING_FILE_PATH}" \
  "${APP_BACKUP_ROOT_PATH}" \
  "${APP_EXPORT_TEMP_PATH}" \
  "${MARIADB_DATA_DIR}" \
  "${MARIADB_RUN_DIR}"

chown -R mysql:mysql "${MARIADB_DATA_DIR}" "${MARIADB_RUN_DIR}"

/usr/local/bin/init-db.sh

exec /usr/bin/supervisord -c /etc/supervisor/conf.d/single-container.conf
