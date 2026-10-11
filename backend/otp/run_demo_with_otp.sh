#!/usr/bin/env bash
set -euo pipefail
BACKEND_DIR="$(cd -- "$(dirname -- "$0")/.." && pwd)"
OTP_URL="${OTP_URL:-http://127.0.0.1:8080/otp/gtfs/v1}"
OTP_DATA_DIR="${OTP_DATA_DIR:-$BACKEND_DIR/otp/data}"
args=(--otp-url "$OTP_URL")
if compgen -G "$OTP_DATA_DIR/*.gtfs.zip" >/dev/null; then
  args+=(--otp-transit)
fi
if [[ -n "${TRANSIT_FARE:-}" ]]; then
  args+=(--transit-fare "$TRANSIT_FARE")
fi
exec /usr/bin/python3 "$BACKEND_DIR/serve.py" "${args[@]}" "$@"
