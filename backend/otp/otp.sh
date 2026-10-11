#!/usr/bin/env bash
set -euo pipefail

OTP_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
OTP_DATA_DIR="${OTP_DATA_DIR:-$OTP_DIR/data}"
OTP_IMAGE="${OTP_IMAGE:-docker.io/opentripplanner/opentripplanner:2.10.0}"
OTP_PORT="${OTP_PORT:-8080}"
# Serving heap. Measured on the statewide NJ graph (graph.obj ~311 MB): live heap
# after a full GC is ~1.0 GB, so 2G leaves ~2x for per-request routing garbage
# and some graph growth. Re-measure after expanding the graph (see README).
OTP_JAVA_HEAP="${OTP_JAVA_HEAP:-2G}"
# Container memory cap for `serve`: heap plus ~700 MB for metaspace, code cache,
# GC bookkeeping and thread stacks. Swap is disabled for the container
# (--memory-swap equals --memory) so OTP is OOM-killed and restarted instead of
# dragging the VM into swap.
# Defaults to the heap + 700 MB (2G heap -> 2748m); set explicitly to override.
heap_to_mb() {
  local v="${1,,}"
  case "$v" in
    *g) echo $(( ${v%g} * 1024 )) ;;
    *m) echo "${v%m}" ;;
    *) echo "OTP_JAVA_HEAP must look like 2G or 2048m (got: $1)" >&2; exit 2 ;;
  esac
}
OTP_MEMORY_LIMIT="${OTP_MEMORY_LIMIT:-$(( $(heap_to_mb "$OTP_JAVA_HEAP") + 700 ))m}"
# Building the graph needs much more memory than serving it.
OTP_BUILD_HEAP="${OTP_BUILD_HEAP:-4G}"
OTP_CONTAINER_NAME="${OTP_CONTAINER_NAME:-pharmreach-otp}"

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
      -e "JAVA_TOOL_OPTIONS=-Xmx$OTP_BUILD_HEAP" \
      -v "$OTP_DATA_DIR:/var/opentripplanner" \
      "$OTP_IMAGE" --build --save
    ;;
  serve)
    if [[ ! -s "$OTP_DATA_DIR/graph.obj" ]]; then
      echo "No graph.obj found in $OTP_DATA_DIR; run backend/otp/otp.sh build first." >&2
      exit 2
    fi
    # router-config.json (committed next to this script) makes OTP abandon a
    # request after 8 s, matching the backend's per-request timeout.
    # Interactive flags only when run by hand from a terminal; systemd has no TTY.
    tty_flags=()
    if [[ -t 0 && -t 1 ]]; then
      tty_flags=(-it)
    fi
    exec docker run --rm "${tty_flags[@]}" \
      --name "$OTP_CONTAINER_NAME" \
      --memory "$OTP_MEMORY_LIMIT" --memory-swap "$OTP_MEMORY_LIMIT" \
      -e "JAVA_TOOL_OPTIONS=-Xmx$OTP_JAVA_HEAP -XX:+ExitOnOutOfMemoryError" \
      -p "127.0.0.1:$OTP_PORT:8080" \
      -v "$OTP_DATA_DIR:/var/opentripplanner" \
      -v "$OTP_DIR/router-config.json:/var/opentripplanner/router-config.json:ro" \
      "$OTP_IMAGE" --load --serve
    ;;
  *)
    echo "Usage: $0 {build|serve}" >&2
    echo "Optional environment: OTP_IMAGE, OTP_DATA_DIR, OTP_PORT, OTP_JAVA_HEAP (serve), OTP_MEMORY_LIMIT (serve), OTP_BUILD_HEAP (build), OTP_CONTAINER_NAME" >&2
    exit 2
    ;;
esac
