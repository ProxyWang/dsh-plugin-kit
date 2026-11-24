#!/usr/bin/env bash
# Mount smoke: prove the *packed* bundle installs and composes, without
# touching the user's DSH home.
#
#   1. pack the package (no build scripts, so the checkout stays clean);
#   2. install it into a throwaway DSH_HOME profile with the documented CLI;
#   3. dump the composed profile and require the plugin row to be there.
#
# This catches the release-class failures unit tests cannot: a `files` entry
# that drops a runtime module, a patch that no longer mounts the row, or an
# install that fails on a clean home. Set DSH_SMOKE_BOOT=1 to also boot the
# profile briefly (needs the web surface and a free port).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/dsh-smoke.XXXXXX")"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

PROFILE="smoke-$$"
export DSH_HOME="$TMP/home"
mkdir -p "$DSH_HOME"

log() { printf '[smoke] %s\n' "$*"; }

cd "$ROOT"

log "packing $ROOT (npm pack, scripts skipped so the checkout stays clean)"
TARBALL="$(npm pack --ignore-scripts --pack-destination "$TMP" 2>/dev/null | tail -n1)"
TARBALL="$TMP/$(basename "$TARBALL")"
[ -f "$TARBALL" ] || { log "FAIL: pnpm pack produced no tarball"; exit 1; }
log "packed $(basename "$TARBALL") ($(wc -c <"$TARBALL" | tr -d ' ') bytes)"

# The packed tarball must carry the runtime entries the manifest promises.
for entry in package/index.js package/client.js package/cordis.patch.yml package/icon.svg package/locale/zh.json package/lib/host/db/sql.js package/src/client/vt/body.js package/docs/DETAIL.md; do
  tar -tzf "$TARBALL" "$entry" >/dev/null 2>&1 || { log "FAIL: tarball misses $entry"; exit 1; }
done
log "tarball carries the runtime entries and docs"

log "installing into throwaway profile $PROFILE"
dsh plugin --profile "$PROFILE" add "file:$TARBALL" >/dev/null

log "dumping composed profile"
dsh --profile "$PROFILE" --dump-config >"$TMP/config.txt" 2>"$TMP/config.err" || {
  log "FAIL: dump-config exited non-zero"; sed -n 1,20p "$TMP/config.err"; exit 1;
}
grep -q 'dsh-plugin-kit' "$TMP/config.txt" || { log "FAIL: plugin package absent from composed config"; exit 1; }
grep -q 'code-explorer' "$TMP/config.txt" || { log "FAIL: plugin row absent from composed config"; exit 1; }
log "composed config contains the package and its row"

if [ "${DSH_SMOKE_BOOT:-0}" = "1" ]; then
  log "booting the smoke profile for a short liveness check"
  ( dsh web --profile "$PROFILE" --port 0 >"$TMP/boot.log" 2>&1 & echo $! >"$TMP/boot.pid" )
  sleep 5
  if kill -0 "$(cat "$TMP/boot.pid")" 2>/dev/null; then
    log "profile booted and stayed up"
    kill "$(cat "$TMP/boot.pid")" 2>/dev/null || true
  else
    log "FAIL: profile boot exited"; sed -n 1,30p "$TMP/boot.log"; exit 1
  fi
fi

log "PASS: pack -> install -> compose"
