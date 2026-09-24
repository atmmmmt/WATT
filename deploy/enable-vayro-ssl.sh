#!/usr/bin/env bash
set -euo pipefail

DOMAIN="vayro-wa.com"
APP_DOMAIN="app.${DOMAIN}"
API_DOMAIN="api.${DOMAIN}"
SERVER_IP="$(curl -4 -fsS --max-time 10 https://api.ipify.org || hostname -I | awk '{print $1}')"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this script as root." >&2
  exit 1
fi

resolve_ip() {
  getent ahostsv4 "$1" 2>/dev/null | awk 'NR==1 {print $1}' || true
}

for host in "$DOMAIN" "www.${DOMAIN}" "$APP_DOMAIN" "$API_DOMAIN"; do
  ip="$(resolve_ip "$host")"
  if [ "$ip" != "$SERVER_IP" ]; then
    echo "$host resolves to '${ip:-nothing}', expected ${SERVER_IP}. DNS is not ready yet." >&2
    exit 1
  fi
done

certbot --nginx --non-interactive --agree-tos --redirect \
  -m "admin@${DOMAIN}" \
  -d "$DOMAIN" -d "www.${DOMAIN}" -d "$APP_DOMAIN" -d "$API_DOMAIN"

nginx -t
systemctl reload nginx

echo "SSL enabled successfully:"
echo "  https://${DOMAIN}"
echo "  https://${APP_DOMAIN}"
echo "  https://${API_DOMAIN}"
