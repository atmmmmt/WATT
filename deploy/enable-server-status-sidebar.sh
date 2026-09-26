#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/vayro"
SIDEBAR_FILE="$APP_DIR/apps/dashboard/src/components/SidebarLayout.tsx"

if [ ! -f "$SIDEBAR_FILE" ]; then
  echo "Sidebar file not found: $SIDEBAR_FILE" >&2
  exit 1
fi

python3 - <<'PY'
from pathlib import Path

path = Path('/var/www/vayro/apps/dashboard/src/components/SidebarLayout.tsx')
text = path.read_text(encoding='utf-8')

# Add the Server icon import once.
if 'Server,' not in text and ', Server' not in text:
    old = "Sun, Moon, ChevronDown, Download, X, LayoutGrid, WifiOff, RefreshCw, Share, PlusSquare,"
    new = "Sun, Moon, ChevronDown, Download, X, LayoutGrid, WifiOff, RefreshCw, Share, PlusSquare, Server,"
    if old not in text:
        raise SystemExit('Could not find lucide icon import marker')
    text = text.replace(old, new, 1)

# Add the nav item directly below Overview once.
nav_line = "        { to: '/server-status', label: 'حالة السيرفر', icon: <Server size={18} /> },"
if nav_line not in text:
    marker = "        { to: '/', label: 'نظرة عامة', icon: <LayoutDashboard size={18} /> },"
    if marker not in text:
        raise SystemExit('Could not find super-admin overview nav marker')
    text = text.replace(marker, marker + "\n" + nav_line, 1)

path.write_text(text, encoding='utf-8')
print('Sidebar patched: حالة السيرفر added for super_admin.')
PY

cd "$APP_DIR"
npm run build --workspace @waotp/dashboard
rm -rf /var/www/vayro-dashboard/*
cp -a apps/dashboard/dist/. /var/www/vayro-dashboard/
chown -R www-data:www-data /var/www/vayro-dashboard
systemctl reload nginx

echo "Done. Open https://app.vayro-wa.com and hard-refresh (Ctrl+F5)."
