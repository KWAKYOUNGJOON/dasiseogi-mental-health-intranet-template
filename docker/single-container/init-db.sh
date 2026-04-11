#!/bin/bash
set -Eeuo pipefail

MYSQLD_BIN="${MYSQLD_BIN:-/usr/sbin/mariadbd}"
MYSQL_INSTALL_DB_BIN="${MYSQL_INSTALL_DB_BIN:-/usr/bin/mariadb-install-db}"
MARIADB_CLI="${MARIADB_CLI:-/usr/bin/mariadb}"
MARIADB_ADMIN="${MARIADB_ADMIN:-/usr/bin/mariadb-admin}"

MARIADB_DATA_DIR="${MARIADB_DATA_DIR:-/var/lib/mysql}"
MARIADB_RUN_DIR="${MARIADB_RUN_DIR:-/run/mysqld}"
MARIADB_SOCKET="${MARIADB_SOCKET:-/run/mysqld/mysqld.sock}"
MARIADB_PID_FILE="${MARIADB_PID_FILE:-/run/mysqld/mysqld.pid}"
MARIADB_PORT="${MARIADB_PORT:-3306}"
APP_DB_NAME="${APP_DB_NAME:-mental_health_local}"
APP_DB_USERNAME="${APP_DB_USERNAME:-mental_user}"
APP_DB_PASSWORD="${APP_DB_PASSWORD:-mental_pass}"
APP_DB_CHARSET="${APP_DB_CHARSET:-utf8mb4}"
APP_DB_COLLATION="${APP_DB_COLLATION:-utf8mb4_unicode_ci}"
SCHEMA_FILE="${SCHEMA_FILE:-/app/backend/schema.sql}"

echo "single-container-init: preparing MariaDB datadir at ${MARIADB_DATA_DIR}"

mkdir -p "${MARIADB_DATA_DIR}" "${MARIADB_RUN_DIR}"
chown -R mysql:mysql "${MARIADB_DATA_DIR}" "${MARIADB_RUN_DIR}"

if [ ! -d "${MARIADB_DATA_DIR}/mysql" ]; then
  echo "single-container-init: datadir is empty, running mariadb-install-db"
  "${MYSQL_INSTALL_DB_BIN}" \
    --user=mysql \
    --datadir="${MARIADB_DATA_DIR}" \
    --auth-root-authentication-method=socket \
    --skip-test-db
fi

cleanup() {
  if "${MARIADB_ADMIN}" --protocol=socket --socket="${MARIADB_SOCKET}" -uroot ping --silent >/dev/null 2>&1; then
    "${MARIADB_ADMIN}" --protocol=socket --socket="${MARIADB_SOCKET}" -uroot shutdown >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

echo "single-container-init: starting temporary MariaDB for bootstrap"
"${MYSQLD_BIN}" \
  --user=mysql \
  --datadir="${MARIADB_DATA_DIR}" \
  --socket="${MARIADB_SOCKET}" \
  --pid-file="${MARIADB_PID_FILE}" \
  --port="${MARIADB_PORT}" \
  --skip-networking \
  --character-set-server="${APP_DB_CHARSET}" \
  --collation-server="${APP_DB_COLLATION}" &

for _ in $(seq 1 60); do
  if "${MARIADB_ADMIN}" --protocol=socket --socket="${MARIADB_SOCKET}" -uroot ping --silent >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! "${MARIADB_ADMIN}" --protocol=socket --socket="${MARIADB_SOCKET}" -uroot ping --silent >/dev/null 2>&1; then
  echo "single-container-init: temporary MariaDB bootstrap timed out" >&2
  exit 1
fi

echo "single-container-init: ensuring app database and account"
"${MARIADB_CLI}" --protocol=socket --socket="${MARIADB_SOCKET}" -uroot <<SQL
CREATE DATABASE IF NOT EXISTS \`${APP_DB_NAME}\`
  CHARACTER SET ${APP_DB_CHARSET}
  COLLATE ${APP_DB_COLLATION};
CREATE USER IF NOT EXISTS '${APP_DB_USERNAME}'@'localhost' IDENTIFIED BY '${APP_DB_PASSWORD}';
CREATE USER IF NOT EXISTS '${APP_DB_USERNAME}'@'127.0.0.1' IDENTIFIED BY '${APP_DB_PASSWORD}';
ALTER USER '${APP_DB_USERNAME}'@'localhost' IDENTIFIED BY '${APP_DB_PASSWORD}';
ALTER USER '${APP_DB_USERNAME}'@'127.0.0.1' IDENTIFIED BY '${APP_DB_PASSWORD}';
GRANT ALL PRIVILEGES ON \`${APP_DB_NAME}\`.* TO '${APP_DB_USERNAME}'@'localhost';
GRANT ALL PRIVILEGES ON \`${APP_DB_NAME}\`.* TO '${APP_DB_USERNAME}'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL

TABLE_COUNT="$("${MARIADB_CLI}" --protocol=socket --socket="${MARIADB_SOCKET}" -uroot -Nse \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${APP_DB_NAME}'")"

if [ "${TABLE_COUNT}" = "0" ]; then
  echo "single-container-init: applying schema.sql because app database is empty"
  "${MARIADB_CLI}" --protocol=socket --socket="${MARIADB_SOCKET}" -uroot "${APP_DB_NAME}" < "${SCHEMA_FILE}"
else
  echo "single-container-init: existing schema detected, preserving current data"
fi

echo "single-container-init: bootstrap completed"
