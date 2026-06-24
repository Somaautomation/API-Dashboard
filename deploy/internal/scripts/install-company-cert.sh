#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <fullchain.pem> <privkey.pem>"
  exit 1
fi

SRC_CERT="$1"
SRC_KEY="$2"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
DEST_DIR="${ROOT_DIR}/deploy/internal/nginx/certbot/conf/live/internal"

mkdir -p "${DEST_DIR}"
cp "${SRC_CERT}" "${DEST_DIR}/fullchain.pem"
cp "${SRC_KEY}" "${DEST_DIR}/privkey.pem"
chmod 600 "${DEST_DIR}/privkey.pem"

echo "Installed company certificate into ${DEST_DIR}"
