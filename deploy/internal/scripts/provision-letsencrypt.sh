#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/deploy/internal/docker-compose.prod.yml"
ENV_FILE="${ROOT_DIR}/.env.prod"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}"
  exit 1
fi

set -a
source "${ENV_FILE}"
set +a

: "${INTERNAL_DOMAIN:?Set INTERNAL_DOMAIN in .env.prod}"
: "${LETSENCRYPT_EMAIL:?Set LETSENCRYPT_EMAIL in .env.prod}"

# Ensure nginx challenge path is available
cd "${ROOT_DIR}/deploy/internal"
docker compose --env-file ../../.env.prod -f docker-compose.prod.yml up -d nginx

# Request certificate
cd "${ROOT_DIR}"
docker compose --env-file .env.prod -f "${COMPOSE_FILE}" run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d "${INTERNAL_DOMAIN}" \
  --email "${LETSENCRYPT_EMAIL}" \
  --agree-tos --no-eff-email

CERT_BASE="${ROOT_DIR}/deploy/internal/nginx/certbot/conf/live"
mkdir -p "${CERT_BASE}"
rm -rf "${CERT_BASE}/internal"
ln -s "${CERT_BASE}/${INTERNAL_DOMAIN}" "${CERT_BASE}/internal"

echo "Certificate provisioned for ${INTERNAL_DOMAIN}"
