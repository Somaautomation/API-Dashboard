#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

if [[ ! -f "${ROOT_DIR}/.env.prod" ]]; then
  echo "Missing ${ROOT_DIR}/.env.prod"
  exit 1
fi

set -a
source "${ROOT_DIR}/.env.prod"
set +a

if [[ -z "${INTERNAL_DOMAIN:-}" ]]; then
  echo "INTERNAL_DOMAIN is required in .env.prod"
  exit 1
fi

envsubst '${INTERNAL_DOMAIN}' \
  < "${ROOT_DIR}/deploy/internal/nginx/conf.d/site.conf.template" \
  > "${ROOT_DIR}/deploy/internal/nginx/conf.d/site.conf"

echo "Rendered nginx site config for ${INTERNAL_DOMAIN}"
