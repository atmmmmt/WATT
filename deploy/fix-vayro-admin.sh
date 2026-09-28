#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/vayro"
SECRETS_FILE="/etc/vayro/production-secrets.env"
ADMIN_EMAIL="admin@vayro-wa.com"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this script as root." >&2
  exit 1
fi

if [ ! -f "$SECRETS_FILE" ]; then
  echo "Missing $SECRETS_FILE" >&2
  exit 1
fi

if [ ! -d "$APP_DIR/node_modules" ]; then
  echo "Missing app dependencies in $APP_DIR" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$SECRETS_FILE"

if [ -z "${DEFAULT_ADMIN_PASSWORD:-}" ]; then
  echo "DEFAULT_ADMIN_PASSWORD is missing from secrets file" >&2
  exit 1
fi

cd "$APP_DIR"
PASSWORD_HASH="$(ADMIN_PASSWORD="$DEFAULT_ADMIN_PASSWORD" node - <<'NODE'
const bcrypt = require('bcryptjs');
const password = process.env.ADMIN_PASSWORD;
if (!password) process.exit(2);
process.stdout.write(bcrypt.hashSync(password, 10));
NODE
)"

HASH="$PASSWORD_HASH" mongosh "mongodb://127.0.0.1:27017/vayro" --quiet --eval '
const email = "admin@vayro-wa.com";
const hash = process.env.HASH;
const result = db.users.updateOne(
  { email },
  {
    $set: {
      passwordHash: hash,
      status: "active",
      role: "super_admin",
      name: "Platform Admin"
    },
    $setOnInsert: {
      email,
      phone: "",
      permissions: [],
      tenantId: null,
      inviteToken: null,
      inviteTokenExpiresAt: null,
      resetToken: null,
      resetTokenExpiresAt: null,
      createdAt: new Date()
    },
    $currentDate: { updatedAt: true }
  },
  { upsert: true }
);
printjson(result);
'

VERIFY_HASH="$(mongosh "mongodb://127.0.0.1:27017/vayro" --quiet --eval 'const u=db.users.findOne({email:"admin@vayro-wa.com"}); if(u) print(u.passwordHash || "")')"

MATCH="$(ADMIN_PASSWORD="$DEFAULT_ADMIN_PASSWORD" HASH="$VERIFY_HASH" node - <<'NODE'
const bcrypt = require('bcryptjs');
const ok = bcrypt.compareSync(process.env.ADMIN_PASSWORD || '', process.env.HASH || '');
process.stdout.write(ok ? 'yes' : 'no');
NODE
)"

if [ "$MATCH" != "yes" ]; then
  echo "Password verification failed" >&2
  exit 1
fi

pm2 restart vayro-api --update-env >/dev/null 2>&1 || true

echo "VAYRO admin repaired successfully."
echo "Email: $ADMIN_EMAIL"
echo "Password: use DEFAULT_ADMIN_PASSWORD from $SECRETS_FILE"
echo "Status: active"
