#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env.prod"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}"
  exit 1
fi

ROLLBACK_TAG="${1:-}"
if [[ -z "${ROLLBACK_TAG}" ]]; then
  echo "Usage: $0 <rollback_tag>"
  exit 1
fi

if grep -q '^DEPLOY_TAG=' "${ENV_FILE}"; then
  sed -i "s/^DEPLOY_TAG=.*/DEPLOY_TAG=${ROLLBACK_TAG}/" "${ENV_FILE}"
else
  echo "DEPLOY_TAG=${ROLLBACK_TAG}" >> "${ENV_FILE}"
fi

echo "Set DEPLOY_TAG=${ROLLBACK_TAG}. Starting rollback..."
bash "${SCRIPT_DIR}/deploy.sh"
