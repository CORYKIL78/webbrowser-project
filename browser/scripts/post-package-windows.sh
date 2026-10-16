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
# The Visual C++ runtime files, so Glyde starts on PCs that do not have them installed.
# They come from the Windows toolchain that mach downloaded for the cross build.
COPIED=0
for name in msvcp140.dll vcruntime140.dll vcruntime140_1.dll msvcp140_1.dll msvcp140_2.dll concrt140.dll; do
  found="$(find "$HOME/.mozbuild" -ipath '*x64*' -iname "$name" 2>/dev/null | grep -i 'redist\|crt' | head -n 1 || true)"
  if [ -n "$found" ] && [ ! -f "$APPDIR/$name" ]; then cp "$found" "$APPDIR/$name"; COPIED=$((COPIED+1)); fi
done
echo "Copied $COPIED Visual C++ runtime files"
cp "$ROOT/browser/distribution/policies.json" "$APPDIR/distribution/policies.json"

[ "$APPDIR" = "$WORK/glyde" ] || mv "$APPDIR" "$WORK/glyde"
mkdir -p "$ROOT/dist"
(cd "$WORK" && zip -qr "$ROOT/dist/glyde-windows-x86_64.zip" glyde)
echo "Wrote $ROOT/dist/glyde-windows-x86_64.zip"
