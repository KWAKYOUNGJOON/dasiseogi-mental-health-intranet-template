#!/bin/sh
set -eu

DEFAULT_H2_URL='jdbc:h2:file:/data/tmp/h2/localdb;MODE=MySQL;DATABASE_TO_LOWER=TRUE;AUTO_SERVER=TRUE'
DEFAULT_PROD_PROFILE='prod'

is_blank() {
  [ -z "${1:-}" ]
}

contains_placeholder() {
  printf '%s' "${1:-}" | grep -qi 'PLACEHOLDER'
}

starts_with_h2() {
  printf '%s' "${1:-}" | grep -qi '^jdbc:h2:'
}

profile_contains() {
  printf ',%s,' "${SPRING_PROFILES_ACTIVE:-}" | grep -q ",$1,"
}

is_local_profile() {
  profile_contains 'local'
}

fail() {
  echo "backend-entrypoint: $1" >&2
  exit 1
}

require_non_blank() {
  VAR_NAME="$1"
  VAR_VALUE="$2"
  if is_blank "$VAR_VALUE"; then
    fail "$VAR_NAME is required for ${SPRING_PROFILES_ACTIVE:-$DEFAULT_PROD_PROFILE} startup"
  fi
}

require_non_placeholder() {
  VAR_NAME="$1"
  VAR_VALUE="$2"
  if contains_placeholder "$VAR_VALUE"; then
    fail "$VAR_NAME must not contain placeholder values for ${SPRING_PROFILES_ACTIVE:-$DEFAULT_PROD_PROFILE} startup"
  fi
}

mkdir -p /data/logs /data/tmp /data/tmp/exports /data/backups

DB_URL_CANDIDATE="${APP_DB_URL_DOCKER:-${APP_DB_URL:-}}"
PROFILE_CANDIDATE="${SPRING_PROFILES_ACTIVE:-$DEFAULT_PROD_PROFILE}"
export SPRING_PROFILES_ACTIVE="$PROFILE_CANDIDATE"

if is_local_profile; then
  if is_blank "$DB_URL_CANDIDATE"; then
    mkdir -p /data/tmp/h2

    export APP_DB_URL="$DEFAULT_H2_URL"
    export APP_DB_USERNAME='sa'
    export APP_DB_PASSWORD=''
    export APP_DB_DRIVER='org.h2.Driver'

    echo "backend-entrypoint: using explicit local profile with local H2 fallback"
  else
    require_non_placeholder 'APP_DB_URL_DOCKER or APP_DB_URL' "$DB_URL_CANDIDATE"
    require_non_blank 'APP_DB_USERNAME' "${APP_DB_USERNAME:-}"
    require_non_blank 'APP_DB_PASSWORD' "${APP_DB_PASSWORD:-}"
    require_non_placeholder 'APP_DB_USERNAME' "${APP_DB_USERNAME:-}"
    require_non_placeholder 'APP_DB_PASSWORD' "${APP_DB_PASSWORD:-}"

    export APP_DB_URL="$DB_URL_CANDIDATE"
    export APP_DB_DRIVER="${APP_DB_DRIVER:-org.mariadb.jdbc.Driver}"

    echo "backend-entrypoint: using explicit local profile with external database configuration"
  fi
else
  require_non_blank 'APP_DB_URL_DOCKER or APP_DB_URL' "$DB_URL_CANDIDATE"
  require_non_blank 'APP_DB_USERNAME' "${APP_DB_USERNAME:-}"
  require_non_blank 'APP_DB_PASSWORD' "${APP_DB_PASSWORD:-}"
  require_non_blank 'APP_DB_DRIVER' "${APP_DB_DRIVER:-}"

  require_non_placeholder 'APP_DB_URL_DOCKER or APP_DB_URL' "$DB_URL_CANDIDATE"
  require_non_placeholder 'APP_DB_USERNAME' "${APP_DB_USERNAME:-}"
  require_non_placeholder 'APP_DB_PASSWORD' "${APP_DB_PASSWORD:-}"
  require_non_placeholder 'APP_DB_DRIVER' "${APP_DB_DRIVER:-}"

  if starts_with_h2 "$DB_URL_CANDIDATE"; then
    fail 'prod/deploy startup must not use jdbc:h2 datasource URLs'
  fi

  export APP_DB_URL="$DB_URL_CANDIDATE"
  export APP_DB_DRIVER="${APP_DB_DRIVER}"

  echo "backend-entrypoint: using fail-fast production database configuration with profile ${SPRING_PROFILES_ACTIVE}"
fi

exec java -jar /app/app.jar
