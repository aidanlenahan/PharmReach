#!/usr/bin/env bash
set -euo pipefail

OTP_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
OTP_DATA_DIR="${OTP_DATA_DIR:-$OTP_DIR/data}"
OTP_IMAGE="${OTP_IMAGE:-docker.io/opentripplanner/opentripplanner:2.10.0}"
OTP_PORT="${OTP_PORT:-8080}"
OTP_JAVA_HEAP="${OTP_JAVA_HEAP:-4G}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required for this OTP launcher. Install/start Docker, then retry." >&2
  exit 2
fi
if [[ ! -d "$OTP_DATA_DIR" ]]; then
  echo "OTP input directory not found: $OTP_DATA_DIR" >&2
  echo "Stage the OSM extract (and optional GTFS feeds) with backend/otp/prepare.py first." >&2
  exit 2
fi

case "${1:-}" in
  build)
    if ! compgen -G "$OTP_DATA_DIR/*.osm.pbf" >/dev/null; then
      echo "Expected at least one *.osm.pbf in $OTP_DATA_DIR" >&2
      exit 2
    fi
    if ! compgen -G "$OTP_DATA_DIR/*.gtfs.zip" >/dev/null; then
      echo "No GTFS feed found; OTP will provide street routes only (walk, drive, bike)." >&2
    fi
    exec docker run --rm \
      -e "JAVA_TOOL_OPTIONS=-Xmx$OTP_JAVA_HEAP" \
      -v "$OTP_DATA_DIR:/var/opentripplanner" \
      "$OTP_IMAGE" --build --save
    ;;
  serve)
    if [[ ! -s "$OTP_DATA_DIR/graph.obj" ]]; then
      echo "No graph.obj found in $OTP_DATA_DIR; run backend/otp/otp.sh build first." >&2
      exit 2
    fi
    exec docker run --rm -it \
      -e "JAVA_TOOL_OPTIONS=-Xmx$OTP_JAVA_HEAP" \
      -p "127.0.0.1:$OTP_PORT:8080" \
      -v "$OTP_DATA_DIR:/var/opentripplanner" \
      "$OTP_IMAGE" --load --serve
    ;;
  *)
    echo "Usage: $0 {build|serve}" >&2
    echo "Optional environment: OTP_IMAGE, OTP_DATA_DIR, OTP_PORT, OTP_JAVA_HEAP" >&2
    exit 2
    ;;
esac
