#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env.prod"
COMPOSE_FILE="${ROOT_DIR}/deploy/internal/docker-compose.prod.yml"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}"
  exit 1
fi

set -a
source "${ENV_FILE}"
set +a

: "${DEPLOY_TAG:?Set DEPLOY_TAG in .env.prod}"
: "${INTERNAL_DOMAIN:?Set INTERNAL_DOMAIN in .env.prod}"

bash "${SCRIPT_DIR}/generate-allowlist.sh"
bash "${SCRIPT_DIR}/render-nginx-config.sh"

cd "${ROOT_DIR}"
docker compose --env-file .env.prod -f "${COMPOSE_FILE}" pull

docker compose --env-file .env.prod -f "${COMPOSE_FILE}" up -d --remove-orphans

echo "Waiting for health checks..."
sleep 10
curl -fsS "http://127.0.0.1/healthz" >/dev/null || true
curl -kfsS "https://${INTERNAL_DOMAIN}/healthz" >/dev/null
curl -kfsS "https://${INTERNAL_DOMAIN}/api/v1/health" >/dev/null

echo "Deployment successful for tag ${DEPLOY_TAG}"
