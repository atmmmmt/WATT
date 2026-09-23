#!/usr/bin/env bash
#
# One-server setup for all of VAYRO (Ubuntu 22.04/24.04, run as root).
#
#   sudo bash vps-setup-all.sh vayro.com you@example.com
#
# Result:
#   https://vayro.com        -> landing page      (static)
#   https://app.vayro.com    -> dashboard         (static)
#   https://api.vayro.com    -> API + WhatsApp    (Node/PM2 behind Nginx)
#
# Installs Node 22, Chromium (for whatsapp-web.js), PM2 + log rotation, Nginx,
# free SSL for all three names, a 4GB swap file and a firewall.
# Safe to re-run: every step checks before acting.

set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"
APP_USER="${APP_USER:-vayro}"
APP_DIR="/home/${APP_USER}/api"
WEB_ROOT="/var/www"
SWAP_SIZE="${SWAP_SIZE:-4G}"

if [[ -z "$DOMAIN" || -z "$EMAIL" ]]; then
  echo "Usage: sudo bash vps-setup-all.sh <root-domain> <email-for-ssl>" >&2
  exit 1
fi
if [[ $EUID -ne 0 ]]; then
  echo "Run as root: sudo bash vps-setup-all.sh ..." >&2
  exit 1
fi

APP_HOST="app.${DOMAIN}"
API_HOST="api.${DOMAIN}"

echo "==> 1/9 System packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates gnupg git ufw nginx rsync

echo "==> 2/9 Swap (${SWAP_SIZE}) and kernel limits"
# Without swap one memory spike makes the kernel kill Chrome and drop live sessions.
if ! swapon --show | grep -q '/swapfile'; then
  fallocate -l "$SWAP_SIZE" /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
sysctl -qw vm.swappiness=10
grep -q '^vm.swappiness' /etc/sysctl.conf || echo 'vm.swappiness=10' >> /etc/sysctl.conf
grep -q 'vayro-nofile' /etc/security/limits.conf || cat >> /etc/security/limits.conf <<EOF
# vayro-nofile — many Chrome instances open a lot of files
* soft nofile 65535
* hard nofile 65535
EOF

echo "==> 3/9 Node.js 22"
if ! command -v node >/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs
fi

echo "==> 4/9 Chromium + fonts for WhatsApp Web"
apt-get install -y -qq chromium-browser 2>/dev/null || apt-get install -y -qq chromium
CHROME_BIN="$(command -v chromium || command -v chromium-browser || true)"
apt-get install -y -qq fonts-liberation fonts-noto-core fonts-noto-color-emoji \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
  libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2t64 2>/dev/null || \
  apt-get install -y -qq libasound2

echo "==> 5/9 Application user and web roots"
id -u "$APP_USER" >/dev/null 2>&1 || adduser --disabled-password --gecos "" "$APP_USER"
mkdir -p "$APP_DIR" "$WEB_ROOT/vayro-landing" "$WEB_ROOT/vayro-dashboard"
chown -R "$APP_USER:$APP_USER" "/home/${APP_USER}" "$WEB_ROOT/vayro-landing" "$WEB_ROOT/vayro-dashboard"

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

echo "==> 8/9 Nginx sites"

# Landing page (root domain + www)
cat > "/etc/nginx/sites-available/${DOMAIN}" <<EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};
    root ${WEB_ROOT}/vayro-landing;
    index index.html;

    # Hashed assets can be cached forever; index.html must not be.
    location ~* \.(?:js|css|webp|png|jpg|jpeg|svg|woff2?)\$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files \$uri =404;
    }
    location = /index.html { add_header Cache-Control "no-cache"; }

    # Single-page app: unknown paths fall back to index.html.
    location / { try_files \$uri \$uri/ /index.html; }

    gzip on;
    gzip_types text/css application/javascript image/svg+xml application/json;
}
EOF

# Dashboard (app.)
cat > "/etc/nginx/sites-available/${APP_HOST}" <<EOF
server {
    listen 80;
    server_name ${APP_HOST};
    root ${WEB_ROOT}/vayro-dashboard;
    index index.html;

    location ~* \.(?:js|css|webp|png|jpg|jpeg|svg|woff2?)\$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files \$uri =404;
    }
    location = /index.html { add_header Cache-Control "no-cache"; }
    # The service worker must always be revalidated or updates never reach installed PWAs.
    location = /sw.js { add_header Cache-Control "no-cache"; }

    location / { try_files \$uri \$uri/ /index.html; }

    gzip on;
    gzip_types text/css application/javascript image/svg+xml application/json;
}
EOF

# API (api.) — same paths as before: /v1/..., /api/..., /auth/..., /docs
cat > "/etc/nginx/sites-available/${API_HOST}" <<EOF
server {
    listen 80;
    server_name ${API_HOST};

    # Uploaded WhatsApp media is served straight off disk, not through Node.
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
ln -sf "/etc/nginx/sites-available/${APP_HOST}" "/etc/nginx/sites-enabled/${APP_HOST}"
ln -sf "/etc/nginx/sites-available/${API_HOST}" "/etc/nginx/sites-enabled/${API_HOST}"
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "==> 9/9 SSL certificates"
apt-get install -y -qq certbot python3-certbot-nginx
certbot --nginx -d "$DOMAIN" -d "www.${DOMAIN}" -d "$APP_HOST" -d "$API_HOST" \
  --non-interactive --agree-tos -m "$EMAIL" --redirect || \
  echo "!! Certbot failed — point the DNS records at this server, then re-run the certbot line above."

cat <<EOF

────────────────────────────────────────────────
Server ready.

Chromium (PUPPETEER_EXECUTABLE_PATH): ${CHROME_BIN:-NOT FOUND}
API directory:        ${APP_DIR}
Landing web root:     ${WEB_ROOT}/vayro-landing
Dashboard web root:   ${WEB_ROOT}/vayro-dashboard
App user:             ${APP_USER}

DNS records needed (all pointing at this server's IP):
  ${DOMAIN}        A
  www.${DOMAIN}    A
  ${APP_HOST}      A
  ${API_HOST}      A

Next, from your machine:
  bash deploy/publish.sh ${DOMAIN} <server-ip>

Then on the server:
  su - ${APP_USER}
  cd api && npm ci --omit=dev && npm run build
  pm2 start ecosystem.config.js && pm2 save

Finally: in WhatsApp on every phone, remove the OLD linked devices, then scan
the new QR from the dashboard.
────────────────────────────────────────────────
EOF
