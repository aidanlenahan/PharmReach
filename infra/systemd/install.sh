#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd -- "$(dirname -- "$0")/../.." && pwd)"
SERVICE_USER="${SUDO_USER:-$(id -un)}"
[[ "$SERVICE_USER" != root ]] || { echo "Run with sudo from your regular account." >&2; exit 1; }
[[ -f "$REPO_ROOT/frontend/dist/index.html" ]] || { echo "Build frontend first." >&2; exit 1; }
/usr/bin/python3 "$REPO_ROOT/backend/serve.py" --help >/dev/null
/usr/bin/cloudflared --config "$REPO_ROOT/infra/cloudflared/config.yml" tunnel ingress validate
unit_file=$(mktemp)
trap 'rm -f "$unit_file"' EXIT
sed -e "s|@ROOT@|$REPO_ROOT|g" -e "s|@USER@|$SERVICE_USER|g" "$REPO_ROOT/infra/systemd/hackru.service.in" > "$unit_file"
install -m 644 "$unit_file" /etc/systemd/system/hackru.service
systemctl daemon-reload
systemctl enable hackru.service
systemctl restart hackru.service
for attempt in {1..20}; do
  if curl --fail --silent http://127.0.0.1:4173/api/health >/dev/null; then break; fi
  sleep 1
done
curl --fail --silent http://127.0.0.1:4173/api/health
cp -a /etc/cloudflared/config.yml /etc/cloudflared/config.yml.before-hackru-migration
install -m 644 "$REPO_ROOT/infra/cloudflared/config.yml" /etc/cloudflared/config.yml
systemctl restart cloudflared.service
systemctl --no-pager --full status hackru.service cloudflared.service
