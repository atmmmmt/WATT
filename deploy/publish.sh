#!/usr/bin/env bash
#
# Builds everything locally and ships it to the server.
#
#   bash deploy/publish.sh vayro.com 203.0.113.10 [ssh-user]
#
# - builds the landing page and the dashboard against https://api.<domain>
# - syncs both to their Nginx web roots
# - syncs the API source (without node_modules/.env/sessions) and restarts PM2
#
# The server's .env, uploaded media and WhatsApp session folders are never touched.

set -euo pipefail

DOMAIN="${1:-}"
SERVER="${2:-}"
SSH_USER="${3:-root}"
APP_USER="${APP_USER:-vayro}"

if [[ -z "$DOMAIN" || -z "$SERVER" ]]; then
  echo "Usage: bash deploy/publish.sh <root-domain> <server-ip> [ssh-user]" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_URL="https://api.${DOMAIN}"

echo "==> Building landing page (API: ${API_URL})"
cd "${ROOT}/frontend"
VITE_API_BASE_URL="$API_URL" VITE_SITE_URL="https://${DOMAIN}" npm run build

echo "==> Building dashboard"
cd "${ROOT}/apps/dashboard"
VITE_API_BASE_URL="$API_URL" npm run build

echo "==> Uploading the two front-ends"
rsync -az --delete "${ROOT}/frontend/dist/" "${SSH_USER}@${SERVER}:/var/www/vayro-landing/"
rsync -az --delete "${ROOT}/apps/dashboard/dist/" "${SSH_USER}@${SERVER}:/var/www/vayro-dashboard/"
ssh "${SSH_USER}@${SERVER}" "chown -R ${APP_USER}:${APP_USER} /var/www/vayro-landing /var/www/vayro-dashboard"

echo "==> Uploading the API source"
# --delete keeps the server clean, but the excludes protect live state:
# .env (credentials), uploads (customer media) and the WhatsApp sessions.
rsync -az --delete \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude '.env' \
  --exclude 'uploads' \
  --exclude '.wwebjs_auth' \
  --exclude '.wwebjs_cache' \
  "${ROOT}/apps/api/" "${SSH_USER}@${SERVER}:/home/${APP_USER}/api/"

echo "==> Installing, building and restarting on the server"
ssh "${SSH_USER}@${SERVER}" bash -s <<EOF
set -euo pipefail
chown -R ${APP_USER}:${APP_USER} /home/${APP_USER}/api
su - ${APP_USER} -c '
  cd ~/api
  npm ci --omit=dev
  npm run build
  pm2 startOrReload ecosystem.config.js --update-env
  pm2 save
'
EOF

echo
echo "Done."
echo "  https://${DOMAIN}       landing"
echo "  https://app.${DOMAIN}   dashboard"
echo "  https://api.${DOMAIN}   API"
