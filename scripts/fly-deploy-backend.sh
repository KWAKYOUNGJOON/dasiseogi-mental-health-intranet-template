#!/usr/bin/env bash
set -euo pipefail

# Edit the uppercase values below before running this helper.
BACKEND_FLY_APP_NAME="REPLACE_BACKEND_FLY_APP_NAME"
APP_DB_URL="REPLACE_APP_DB_URL"
APP_DB_USERNAME="REPLACE_APP_DB_USERNAME"
APP_DB_PASSWORD="REPLACE_APP_DB_PASSWORD"
APP_DB_DRIVER="org.mariadb.jdbc.Driver"
APP_DB_DUMP_COMMAND=""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"
BACKEND_FLY_TOML="$BACKEND_DIR/fly.toml"

require_command() {
  local command_name="$1"

  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "[fly-deploy-backend] Missing required command: $command_name"
    exit 1
  fi
}

require_value() {
  local variable_name="$1"
  local variable_value="${!variable_name:-}"

  if [[ -z "$variable_value" || "$variable_value" == REPLACE_* ]]; then
    echo "[fly-deploy-backend] Update $variable_name before running this script."
    exit 1
  fi
}

read_toml_string() {
  local key="$1"
  local file_path="$2"

  sed -n "s/^[[:space:]]*${key}[[:space:]]*=[[:space:]]*\"\\([^\"]*\\)\"[[:space:]]*$/\\1/p" "$file_path" | head -n 1
}

require_command fly

if [[ ! -f "$BACKEND_FLY_TOML" ]]; then
  echo "[fly-deploy-backend] Missing Fly config: $BACKEND_FLY_TOML"
  exit 1
fi

require_value BACKEND_FLY_APP_NAME
require_value APP_DB_URL
require_value APP_DB_USERNAME
require_value APP_DB_PASSWORD
require_value APP_DB_DRIVER

BACKEND_FLY_TOML_APP_NAME="$(read_toml_string app "$BACKEND_FLY_TOML")"

if [[ -z "$BACKEND_FLY_TOML_APP_NAME" ]]; then
  echo "[fly-deploy-backend] Could not read app from $BACKEND_FLY_TOML"
  exit 1
fi

if [[ "$BACKEND_FLY_APP_NAME" != "$BACKEND_FLY_TOML_APP_NAME" ]]; then
  echo "[fly-deploy-backend] BACKEND_FLY_APP_NAME does not match backend/fly.toml app."
  echo "[fly-deploy-backend] script:   $BACKEND_FLY_APP_NAME"
  echo "[fly-deploy-backend] fly.toml: $BACKEND_FLY_TOML_APP_NAME"
  echo "[fly-deploy-backend] Update both values to the same app name before deploying."
  exit 1
fi

echo "[fly-deploy-backend] repo root: $REPO_ROOT"
echo "[fly-deploy-backend] backend dir: $BACKEND_DIR"
echo "[fly-deploy-backend] app: $BACKEND_FLY_APP_NAME"
echo "[fly-deploy-backend] db url: $APP_DB_URL"
echo "[fly-deploy-backend] db username: $APP_DB_USERNAME"
echo "[fly-deploy-backend] db password: <hidden>"

echo "[fly-deploy-backend] Checking that the Fly app already exists..."
fly status --app "$BACKEND_FLY_APP_NAME" >/dev/null

pushd "$BACKEND_DIR" >/dev/null

if [[ -n "$APP_DB_DUMP_COMMAND" ]]; then
  fly secrets set \
    --app "$BACKEND_FLY_APP_NAME" \
    APP_DB_URL="$APP_DB_URL" \
    APP_DB_USERNAME="$APP_DB_USERNAME" \
    APP_DB_PASSWORD="$APP_DB_PASSWORD" \
    APP_DB_DRIVER="$APP_DB_DRIVER" \
    APP_DB_DUMP_COMMAND="$APP_DB_DUMP_COMMAND"
else
  fly secrets set \
    --app "$BACKEND_FLY_APP_NAME" \
    APP_DB_URL="$APP_DB_URL" \
    APP_DB_USERNAME="$APP_DB_USERNAME" \
    APP_DB_PASSWORD="$APP_DB_PASSWORD" \
    APP_DB_DRIVER="$APP_DB_DRIVER"
fi

fly deploy

popd >/dev/null

echo "[fly-deploy-backend] Backend deploy command completed."
