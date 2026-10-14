#!/usr/bin/env bash
# After "./mach package" for the Windows cross build: add the policies file and write a zip to dist/.
# Usage: post-package-windows.sh <path to firefox source>
set -euo pipefail

SRC="${1:?Usage: post-package-windows.sh <firefox source dir>}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PKG="$(ls "$SRC"/obj-glyde-win/dist/{glyde,firefox}-*.win64.zip 2>/dev/null | head -n 1 || true)"
test -n "$PKG" || { echo "No packaged Windows zip found under $SRC/obj-glyde-win/dist" >&2; exit 1; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
unzip -q "$PKG" -d "$WORK"

APPDIR="$(find "$WORK" -maxdepth 1 -mindepth 1 -type d | head -n 1)"
mkdir -p "$APPDIR/distribution"
cp "$ROOT/browser/distribution/policies.json" "$APPDIR/distribution/policies.json"

mv "$APPDIR" "$WORK/glyde"
mkdir -p "$ROOT/dist"
(cd "$WORK" && zip -qr "$ROOT/dist/glyde-windows-x86_64.zip" glyde)
echo "Wrote $ROOT/dist/glyde-windows-x86_64.zip"
