#!/usr/bin/env bash
# After "./mach package": add the policies file and produce a Linux archive in dist/.
# Usage: post-package.sh <path to firefox source>
set -euo pipefail

SRC="${1:?Usage: post-package.sh <firefox source dir>}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PKG="$(ls "$SRC"/obj-glyde/dist/{glyde,firefox}-*.linux-x86_64.tar.* 2>/dev/null | head -n 1 || true)"
test -n "$PKG" || { echo "No packaged Linux archive found under $SRC/obj-glyde/dist" >&2; exit 1; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
tar -xf "$PKG" -C "$WORK"

APPDIR="$(find "$WORK" -maxdepth 1 -mindepth 1 -type d | head -n 1)"
mkdir -p "$APPDIR/distribution"
cp "$ROOT/browser/distribution/policies.json" "$APPDIR/distribution/policies.json"

mv "$APPDIR" "$WORK/glyde"
mkdir -p "$ROOT/dist"
tar -C "$WORK" -cJf "$ROOT/dist/glyde-linux-x86_64.tar.xz" glyde
echo "Wrote $ROOT/dist/glyde-linux-x86_64.tar.xz"
