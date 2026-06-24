#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <username> <password>"
  exit 1
fi

USER_NAME="$1"
PASSWORD="$2"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
mkdir -p "${ROOT_DIR}/secrets"

docker run --rm httpd:2.4-alpine htpasswd -nbB "${USER_NAME}" "${PASSWORD}" > "${ROOT_DIR}/secrets/htpasswd"
chmod 600 "${ROOT_DIR}/secrets/htpasswd"

echo "Created ${ROOT_DIR}/secrets/htpasswd"
