#!/usr/bin/env bash
#
# One-time VPS setup for the WaOTP API (Ubuntu 22.04 / 24.04, run as root).
#
#   bash vps-setup.sh api.example.com you@example.com
#
# Installs Node 22, Chromium (for whatsapp-web.js), PM2 with log rotation, Nginx as a
# reverse proxy with a free SSL certificate, a swap file, and tuned kernel limits.
# Safe to re-run: every step checks before acting.

set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"
APP_USER="${APP_USER:-waotp}"
APP_DIR="/home/${APP_USER}/api"
SWAP_SIZE="${SWAP_SIZE:-4G}"

if [[ -z "$DOMAIN" || -z "$EMAIL" ]]; then
  echo "Usage: bash vps-setup.sh <api-domain> <email-for-ssl>" >&2
  exit 1
fi
if [[ $EUID -ne 0 ]]; then
  echo "Run as root: sudo bash vps-setup.sh ..." >&2
  exit 1
fi

echo "==> 1/9 System packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates gnupg git ufw nginx

echo "==> 2/9 Swap (${SWAP_SIZE})"
# Without swap, one memory spike makes the kernel kill Chrome and drop live sessions.
if ! swapon --show | grep -q '/swapfile'; then
  fallocate -l "$SWAP_SIZE" /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
# Prefer RAM, but allow swap as a safety net rather than an OOM kill.
sysctl -qw vm.swappiness=10
grep -q '^vm.swappiness' /etc/sysctl.conf || echo 'vm.swappiness=10' >> /etc/sysctl.conf
# Many Chrome instances open a lot of files.
grep -q 'waotp-nofile' /etc/security/limits.conf || cat >> /etc/security/limits.conf <<EOF
# waotp-nofile
* soft nofile 65535
* hard nofile 65535
EOF

echo "==> 3/9 Node.js 22"
if ! command -v node >/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs
fi

echo "==> 4/9 Chromium for WhatsApp Web"
apt-get install -y -qq chromium-browser 2>/dev/null || apt-get install -y -qq chromium
CHROME_BIN="$(command -v chromium || command -v chromium-browser || true)"
# Fonts, including Arabic, so rendered pages don't fall back to boxes.
apt-get install -y -qq fonts-liberation fonts-noto-core fonts-noto-color-emoji \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
  libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2t64 2>/dev/null || \
  apt-get install -y -qq libasound2

echo "==> 5/9 Application user"
id -u "$APP_USER" >/dev/null 2>&1 || adduser --disabled-password --gecos "" "$APP_USER"
mkdir -p "$APP_DIR"
chown -R "$APP_USER:$APP_USER" "/home/${APP_USER}"

echo "==> 6/9 PM2 + log rotation"
npm install -g pm2@latest >/dev/null
sudo -u "$APP_USER" pm2 install pm2-logrotate >/dev/null 2>&1 || true
sudo -u "$APP_USER" pm2 set pm2-logrotate:max_size 20M >/dev/null 2>&1 || true
sudo -u "$APP_USER" pm2 set pm2-logrotate:retain 7 >/dev/null 2>&1 || true
sudo -u "$APP_USER" pm2 set pm2-logrotate:compress true >/dev/null 2>&1 || true
env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$APP_USER" --hp "/home/${APP_USER}" >/dev/null

echo "==> 7/9 Firewall"
ufw allow OpenSSH >/dev/null
ufw allow 'Nginx Full' >/dev/null
ufw --force enable >/dev/null

echo "==> 8/9 Nginx reverse proxy for ${DOMAIN}"
cat > "/etc/nginx/sites-available/${DOMAIN}" <<EOF
server {
    listen 80;
    server_name ${DOMAIN};

    # Uploaded WhatsApp media is served straight off disk by Nginx, not by Node.
    location /uploads/ {
        alias ${APP_DIR}/uploads/;
        add_header Cross-Origin-Resource-Policy cross-origin;
        add_header Cache-Control "public, max-age=2592000";
        try_files \$uri =404;
    }

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        # Required for socket.io (the live inbox).
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
        client_max_body_size 30m;
    }
}
EOF
ln -sf "/etc/nginx/sites-available/${DOMAIN}" "/etc/nginx/sites-enabled/${DOMAIN}"
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "==> 9/9 SSL certificate"
apt-get install -y -qq certbot python3-certbot-nginx
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect || \
  echo "!! Certbot failed — point ${DOMAIN}'s DNS at this server, then re-run: certbot --nginx -d ${DOMAIN}"

cat <<EOF

────────────────────────────────────────────────
Setup complete.

Chromium path (PUPPETEER_EXECUTABLE_PATH): ${CHROME_BIN:-not found}
App directory: ${APP_DIR}
App user:      ${APP_USER}

Next:
  1) Upload the API (apps/api) into ${APP_DIR}
  2) Create ${APP_DIR}/.env  (see deploy/env.production.example)
  3) su - ${APP_USER}
     cd api && npm ci --omit=dev && npm run build
     pm2 start ecosystem.config.js && pm2 save
  4) Open https://${DOMAIN}/docs to confirm it is live
  5) In WhatsApp on each phone: remove the OLD linked devices, then scan the new QR
────────────────────────────────────────────────
EOF
