#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env.prod"

set -a
source "${ENV_FILE}"
set +a

: "${INTERNAL_DOMAIN:?Set INTERNAL_DOMAIN in .env.prod}"

echo "Checking edge health..."
curl -kfsS "https://${INTERNAL_DOMAIN}/healthz"

echo "Checking backend health..."
curl -kfsS "https://${INTERNAL_DOMAIN}/api/v1/health"

echo "Checking frontend entrypoint..."
curl -kfsSI "https://${INTERNAL_DOMAIN}/" | head -n 1

echo "All checks passed"
