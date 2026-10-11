#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd -- "$(dirname -- "$0")/../.." && pwd)"
SERVICE_USER="${SUDO_USER:-$(id -un)}"
[[ "$SERVICE_USER" != root ]] || { echo "Run with sudo from your regular account." >&2; exit 1; }
[[ -f "$REPO_ROOT/frontend/dist/index.html" ]] || { echo "Build frontend first." >&2; exit 1; }
/usr/bin/python3 "$REPO_ROOT/backend/serve.py" --help >/dev/null
/usr/bin/cloudflared --config "$REPO_ROOT/infra/cloudflared/config.yml" tunnel ingress validate
id -nG "$SERVICE_USER" | tr ' ' '\n' | grep -qx docker || { echo "$SERVICE_USER must be in the docker group to run otp.service." >&2; exit 1; }
unit_file=$(mktemp)
trap 'rm -f "$unit_file"' EXIT
install_unit() {
  sed -e "s|@ROOT@|$REPO_ROOT|g" -e "s|@USER@|$SERVICE_USER|g" "$REPO_ROOT/infra/systemd/$1.in" > "$unit_file"
  install -m 644 "$unit_file" "/etc/systemd/system/$1"
}
install_unit otp.service
install_unit hackru.service
install_unit njt-refresh.service
install -m 644 "$REPO_ROOT/infra/systemd/njt-refresh.timer" /etc/systemd/system/njt-refresh.timer
# Type=notify waits for a tunnel connection; the packaged 15s limit can
# expire before cloudflared finishes starting on a busy host.
install -d -m 755 /etc/systemd/system/cloudflared.service.d
install -m 644 "$REPO_ROOT/infra/systemd/cloudflared-timeout.conf" /etc/systemd/system/cloudflared.service.d/startup-timeout.conf
systemctl daemon-reload
# OTP first: hackru.service Wants/After otp.service but works without it.
systemctl enable otp.service hackru.service
# GTFS refresh about every 20h; feeds/status only, no graph rebuild unless NJT_REFRESH_ARGS=--rebuild.
systemctl enable --now njt-refresh.timer
if ! systemctl is-active --quiet otp.service; then
  # A hand-started OTP container would hold port 8080; only the managed one should run.
  others=$(docker ps --filter "publish=8080" --format '{{.Names}}' | grep -vx pharmreach-otp || true)
  [[ -z "$others" ]] || { echo "Stop the hand-started OTP container(s) first: docker stop $others" >&2; exit 1; }
  systemctl start otp.service
fi
systemctl restart hackru.service
for attempt in {1..20}; do
  if curl --fail --silent http://127.0.0.1:4173/api/health >/dev/null; then break; fi
  sleep 1
done
curl --fail --silent http://127.0.0.1:4173/api/health
cp -a /etc/cloudflared/config.yml /etc/cloudflared/config.yml.before-hackru-migration
install -m 644 "$REPO_ROOT/infra/cloudflared/config.yml" /etc/cloudflared/config.yml
systemctl restart cloudflared.service
systemctl --no-pager --full status otp.service hackru.service cloudflared.service njt-refresh.timer
