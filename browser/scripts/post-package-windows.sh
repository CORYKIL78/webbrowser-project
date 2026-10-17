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

# Check that the program really carries the Glyde icon (this is what the taskbar and Start menu show).
# The largest picture in the icon file is searched for inside glyde.exe. A warning, not a failure.
python3 - "$SRC/browser/branding/glyde/firefox.ico" "$WORK/glyde/glyde.exe" <<'PY' || true
import struct, sys
ico, exe = sys.argv[1], sys.argv[2]
d = open(ico, "rb").read()
n = struct.unpack_from("<H", d, 4)[0]
best = max((struct.unpack_from("<BBBBHHII", d, 6 + 16 * i) for i in range(n)), key=lambda e: e[6])
img = d[best[7]:best[7] + best[6]]
found = img in open(exe, "rb").read()
msg = "glyde.exe contains the Glyde icon" if found else "glyde.exe does NOT contain the Glyde icon, the taskbar may show the wrong picture"
print(("OK: " if found else "::warning::") + msg)
PY

(cd "$WORK" && zip -qr "$ROOT/dist/glyde-windows-x86_64.zip" glyde)
echo "Wrote $ROOT/dist/glyde-windows-x86_64.zip"

# The installer: Start menu entry, uninstall entry in Settings > Apps, default browser registration.
VERSION="$(python3 -c "import json;print(json.load(open('$ROOT/browser/glyde.json'))['version'])")"
ART="$WORK/art"
ICON_ARGS=()
if [ -f "$SRC/browser/branding/glyde/firefox.ico" ]; then
  mkdir -p "$ART"
  cp "$SRC/browser/branding/glyde/firefox.ico" "$ART/glyde.ico"
  ICON_ARGS=(-DICON="$ART/glyde.ico")
fi
# A problem here must not throw away a finished build, so it is reported as a warning.
if python3 "$ROOT/browser/scripts/make-installer-art.py" "$ART" && \
   makensis -V2 -DVERSION="$VERSION" -DSRCDIR="$WORK/glyde" "${ICON_ARGS[@]}" -DART="$ART" \
     -DOUTFILE="$ROOT/dist/glyde-windows-x86_64-setup.exe" "$ROOT/browser/installer/glyde.nsi"; then
  echo "Wrote $ROOT/dist/glyde-windows-x86_64-setup.exe"
else
  echo "::warning::The Windows installer could not be built. The zip is still available."
fi
