#!/usr/bin/env bash
set -euo pipefail

# Edit the uppercase values below before running this helper.
FRONTEND_FLY_APP_NAME="REPLACE_FRONTEND_FLY_APP_NAME"
BACKEND_UPSTREAM_URL="REPLACE_BACKEND_UPSTREAM_URL"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIR="$REPO_ROOT/frontend"
FRONTEND_FLY_TOML="$FRONTEND_DIR/fly.toml"

require_command() {
  local command_name="$1"

  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "[fly-deploy-frontend] Missing required command: $command_name"
    exit 1
  fi
}

require_value() {
  local variable_name="$1"
  local variable_value="${!variable_name:-}"

  if [[ -z "$variable_value" || "$variable_value" == REPLACE_* ]]; then
    echo "[fly-deploy-frontend] Update $variable_name before running this script."
    exit 1
  fi
}

read_toml_string() {
  local key="$1"
  local file_path="$2"

  sed -n "s/^[[:space:]]*${key}[[:space:]]*=[[:space:]]*\"\\([^\"]*\\)\"[[:space:]]*$/\\1/p" "$file_path" | head -n 1
}

require_command fly

if [[ ! -f "$FRONTEND_FLY_TOML" ]]; then
  echo "[fly-deploy-frontend] Missing Fly config: $FRONTEND_FLY_TOML"
  exit 1
fi

require_value FRONTEND_FLY_APP_NAME
require_value BACKEND_UPSTREAM_URL

FRONTEND_FLY_TOML_APP_NAME="$(read_toml_string app "$FRONTEND_FLY_TOML")"
FRONTEND_FLY_TOML_BACKEND_URL="$(read_toml_string BACKEND_UPSTREAM_URL "$FRONTEND_FLY_TOML")"

if [[ -z "$FRONTEND_FLY_TOML_APP_NAME" ]]; then
  echo "[fly-deploy-frontend] Could not read app from $FRONTEND_FLY_TOML"
  exit 1
fi

if [[ -z "$FRONTEND_FLY_TOML_BACKEND_URL" ]]; then
  echo "[fly-deploy-frontend] Could not read BACKEND_UPSTREAM_URL from $FRONTEND_FLY_TOML"
  exit 1
fi

if [[ "$FRONTEND_FLY_APP_NAME" != "$FRONTEND_FLY_TOML_APP_NAME" ]]; then
  echo "[fly-deploy-frontend] FRONTEND_FLY_APP_NAME does not match frontend/fly.toml app."
  echo "[fly-deploy-frontend] script:   $FRONTEND_FLY_APP_NAME"
  echo "[fly-deploy-frontend] fly.toml: $FRONTEND_FLY_TOML_APP_NAME"
  echo "[fly-deploy-frontend] Update both values to the same app name before deploying."
  exit 1
fi

if [[ "$BACKEND_UPSTREAM_URL" != "$FRONTEND_FLY_TOML_BACKEND_URL" ]]; then
  echo "[fly-deploy-frontend] BACKEND_UPSTREAM_URL does not match frontend/fly.toml."
  echo "[fly-deploy-frontend] script:   $BACKEND_UPSTREAM_URL"
  echo "[fly-deploy-frontend] fly.toml: $FRONTEND_FLY_TOML_BACKEND_URL"
  echo "[fly-deploy-frontend] Update both values to the same backend URL before deploying."
  exit 1
fi

echo "[fly-deploy-frontend] repo root: $REPO_ROOT"
echo "[fly-deploy-frontend] frontend dir: $FRONTEND_DIR"
echo "[fly-deploy-frontend] app: $FRONTEND_FLY_APP_NAME"
echo "[fly-deploy-frontend] backend upstream url: $BACKEND_UPSTREAM_URL"

echo "[fly-deploy-frontend] Checking that the Fly app already exists..."
fly status --app "$FRONTEND_FLY_APP_NAME" >/dev/null

pushd "$FRONTEND_DIR" >/dev/null
fly deploy
popd >/dev/null

echo "[fly-deploy-frontend] Frontend deploy command completed."
