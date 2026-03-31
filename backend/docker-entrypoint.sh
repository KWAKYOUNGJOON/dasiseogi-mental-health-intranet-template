#!/bin/sh
set -eu

DEFAULT_H2_URL='jdbc:h2:file:/data/tmp/h2/localdb;MODE=MySQL;DATABASE_TO_LOWER=TRUE;AUTO_SERVER=TRUE'

is_blank() {
  [ -z "${1:-}" ]
}

contains_placeholder() {
  printf '%s' "${1:-}" | grep -qi 'PLACEHOLDER'
}

mkdir -p /data/logs /data/tmp /data/tmp/exports /data/backups

DB_URL_CANDIDATE="${APP_DB_URL_DOCKER:-${APP_DB_URL:-}}"

if ! is_blank "$DB_URL_CANDIDATE" \
  && ! contains_placeholder "$DB_URL_CANDIDATE" \
  && ! is_blank "${APP_DB_USERNAME:-}" \
  && ! contains_placeholder "${APP_DB_USERNAME:-}" \
  && ! contains_placeholder "${APP_DB_PASSWORD:-}"
then
  export SPRING_PROFILES_ACTIVE="${SPRING_PROFILES_ACTIVE:-prod}"
  export APP_DB_URL="$DB_URL_CANDIDATE"
  export APP_DB_DRIVER="${APP_DB_DRIVER:-org.mariadb.jdbc.Driver}"

  echo "backend-entrypoint: using external database configuration with profile ${SPRING_PROFILES_ACTIVE}"
else
  if [ -n "${DB_URL_CANDIDATE}${APP_DB_USERNAME:-}${APP_DB_PASSWORD:-}" ]; then
    echo "backend-entrypoint: docker DB env is missing or still uses placeholder values; falling back to local H2 profile" >&2
  else
    echo "backend-entrypoint: docker DB env is not set; falling back to local H2 profile"
  fi

  mkdir -p /data/tmp/h2

  export SPRING_PROFILES_ACTIVE="${SPRING_PROFILES_ACTIVE:-local}"
  export APP_DB_URL="$DEFAULT_H2_URL"
  export APP_DB_USERNAME='sa'
  export APP_DB_PASSWORD=''
  export APP_DB_DRIVER='org.h2.Driver'
fi

exec java -jar /app/app.jar
