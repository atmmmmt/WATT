#!/usr/bin/env bash
set -euo pipefail

DOMAIN="vayro-wa.com"
APP_DOMAIN="app.${DOMAIN}"
API_DOMAIN="api.${DOMAIN}"
REPO_URL="https://github.com/atmmmmt/WATT.git"
BRANCH="feat/baileys-gateway"
APP_DIR="/var/www/vayro"
SECRETS_DIR="/etc/vayro"
SECRETS_FILE="${SECRETS_DIR}/production-secrets.env"
SERVER_IP="$(curl -4 -fsS --max-time 10 https://api.ipify.org || hostname -I | awk '{print $1}')"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this script as root." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

echo "[1/10] Creating 2 GB swap if needed..."
if ! swapon --show | grep -q '/swapfile'; then
  if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
    chmod 600 /swapfile
    mkswap /swapfile
  fi
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "[2/10] Installing base packages..."
apt-get update
apt-get install -y ca-certificates curl gnupg git nginx certbot python3-certbot-nginx build-essential openssl ufw

if ! command -v node >/dev/null 2>&1 || [ "$(node -p 'Number(process.versions.node.split(`.`)[0])')" -lt 20 ]; then
  echo "[3/10] Installing Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
else
  echo "[3/10] Node.js $(node -v) already installed."
fi

if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi

if ! command -v mongod >/dev/null 2>&1; then
  echo "[4/10] Installing MongoDB 8.0..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | gpg --dearmor --yes -o /etc/apt/keyrings/mongodb-server-8.0.gpg
  echo "deb [ arch=amd64,arm64 signed-by=/etc/apt/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse" > /etc/apt/sources.list.d/mongodb-org-8.0.list
  apt-get update
  apt-get install -y mongodb-org
else
  echo "[4/10] MongoDB already installed."
fi

# Keep MongoDB conservative on a 4 GB droplet.
if ! grep -q 'cacheSizeGB:' /etc/mongod.conf; then
  sed -i '/^storage:/a\  wiredTiger:\n    engineConfig:\n      cacheSizeGB: 0.5' /etc/mongod.conf || true
fi
systemctl enable --now mongod
systemctl restart mongod

mkdir -p "$SECRETS_DIR"
chmod 700 "$SECRETS_DIR"
if [ ! -f "$SECRETS_FILE" ]; then
  JWT_SECRET="$(openssl rand -hex 48)"
  DOCS_PASSWORD="$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9@%+=_' | head -c 24)"
  ADMIN_PASSWORD="$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9@%+=_' | head -c 24)"
  cat > "$SECRETS_FILE" <<EOF
JWT_SECRET=${JWT_SECRET}
SWAGGER_BASIC_AUTH_PASSWORD=${DOCS_PASSWORD}
DEFAULT_ADMIN_PASSWORD=${ADMIN_PASSWORD}
EOF
  chmod 600 "$SECRETS_FILE"
fi
# shellcheck disable=SC1090
source "$SECRETS_FILE"

echo "[5/10] Fetching VAYRO from GitHub..."
mkdir -p /var/www
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch origin "$BRANCH"
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" reset --hard "origin/$BRANCH"
else
  rm -rf "$APP_DIR"
  git clone --branch "$BRANCH" --single-branch "$REPO_URL" "$APP_DIR"
fi

cat > "$APP_DIR/apps/api/.env" <<EOF
NODE_ENV=production
PORT=4000
MONGODB_URI=mongodb://127.0.0.1:27017/vayro
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=12h
APP_PUBLIC_URL=https://${API_DOMAIN}
SWAGGER_ENABLED=true
SWAGGER_BASIC_AUTH_USER=vayrodocs
SWAGGER_BASIC_AUTH_PASSWORD=${SWAGGER_BASIC_AUTH_PASSWORD}
TRUST_PROXY=1
DASHBOARD_ORIGIN=https://${APP_DOMAIN}
LANDING_ORIGIN=https://${DOMAIN}
CORS_ALLOWED_ORIGINS=https://${DOMAIN},https://www.${DOMAIN},https://${APP_DOMAIN}
DEFAULT_ADMIN_EMAIL=admin@${DOMAIN}
DEFAULT_ADMIN_PASSWORD=${DEFAULT_ADMIN_PASSWORD}
WA_DISABLE_SESSIONS=false
WA_MESSAGE_CACHE_LIMIT=500
WA_HISTORY_CHAT_LIMIT=50
WA_HISTORY_MESSAGE_LIMIT=50
EOF
chmod 600 "$APP_DIR/apps/api/.env"

cat > "$APP_DIR/apps/dashboard/.env.production" <<EOF
VITE_API_BASE_URL=https://${API_DOMAIN}
EOF
cat > "$APP_DIR/frontend/.env.production" <<EOF
VITE_API_BASE_URL=https://${API_DOMAIN}
VITE_SITE_URL=https://${DOMAIN}
EOF

echo "[6/10] Installing dependencies and building..."
cd "$APP_DIR"
export NODE_OPTIONS="--max-old-space-size=2048"
npm install --no-audit --no-fund
npm run build

echo "[7/10] Seeding platform admin..."
cd "$APP_DIR/apps/api"
npm run seed:admin || true

echo "[8/10] Starting API with PM2..."
pm2 delete vayro-api >/dev/null 2>&1 || true
pm2 start server.js --name vayro-api --cwd "$APP_DIR/apps/api" --max-memory-restart 1600M
pm2 save
pm2 startup systemd -u root --hp /root >/tmp/vayro-pm2-startup.txt 2>&1 || true
STARTUP_CMD="$(grep -E '^sudo ' /tmp/vayro-pm2-startup.txt | tail -n1 || true)"
[ -n "$STARTUP_CMD" ] && bash -lc "$STARTUP_CMD" || true
pm2 save

mkdir -p /var/www/vayro-landing /var/www/vayro-dashboard
rm -rf /var/www/vayro-landing/* /var/www/vayro-dashboard/*
cp -a "$APP_DIR/frontend/dist/." /var/www/vayro-landing/
cp -a "$APP_DIR/apps/dashboard/dist/." /var/www/vayro-dashboard/
chown -R www-data:www-data /var/www/vayro-landing /var/www/vayro-dashboard

cat > /etc/nginx/sites-available/vayro <<'NGINX'
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}

server {
    listen 80;
    listen [::]:80;
    server_name vayro-wa.com www.vayro-wa.com;
    root /var/www/vayro-landing;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}

server {
    listen 80;
    listen [::]:80;
    server_name app.vayro-wa.com;
    root /var/www/vayro-dashboard;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}

server {
    listen 80;
    listen [::]:80;
    server_name api.vayro-wa.com;
    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_read_timeout 3600;
        proxy_send_timeout 3600;
    }
}
NGINX

ln -sfn /etc/nginx/sites-available/vayro /etc/nginx/sites-enabled/vayro
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx
systemctl reload nginx

ufw allow OpenSSH >/dev/null || true
ufw allow 'Nginx Full' >/dev/null || true
ufw --force enable >/dev/null || true

echo "[9/10] Checking API locally..."
for i in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:4000/docs >/dev/null 2>&1 || curl -fsS http://127.0.0.1:4000/ >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
pm2 status

echo "[10/10] DNS / SSL..."
resolve_ip() {
  getent ahostsv4 "$1" 2>/dev/null | awk 'NR==1 {print $1}' || true
}
ROOT_IP="$(resolve_ip "$DOMAIN")"
APP_IP="$(resolve_ip "$APP_DOMAIN")"
API_IP="$(resolve_ip "$API_DOMAIN")"

if [ "$ROOT_IP" = "$SERVER_IP" ] && [ "$APP_IP" = "$SERVER_IP" ] && [ "$API_IP" = "$SERVER_IP" ]; then
  certbot --nginx --non-interactive --agree-tos --redirect \
    -m "admin@${DOMAIN}" \
    -d "$DOMAIN" -d "www.${DOMAIN}" -d "$APP_DOMAIN" -d "$API_DOMAIN" || true
else
  echo
  echo "DNS is not fully pointed yet. Create these A records at your DNS provider:"
  echo "  @    -> ${SERVER_IP}"
  echo "  www  -> ${SERVER_IP}"
  echo "  app  -> ${SERVER_IP}"
  echo "  api  -> ${SERVER_IP}"
  echo "After propagation run: bash ${APP_DIR}/deploy/enable-vayro-ssl.sh"
fi

echo
cat <<EOF
============================================================
VAYRO deployment finished.
Server IP: ${SERVER_IP}
Landing:   https://${DOMAIN}
Dashboard: https://${APP_DOMAIN}
API:       https://${API_DOMAIN}
Swagger:   https://${API_DOMAIN}/docs

Admin email:    admin@${DOMAIN}
Admin password: ${DEFAULT_ADMIN_PASSWORD}
Swagger user:   vayrodocs
Swagger pass:   ${SWAGGER_BASIC_AUTH_PASSWORD}

Credentials are also stored at: ${SECRETS_FILE}
============================================================
EOF
