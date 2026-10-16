#!/usr/bin/env bash
# Add Glyde's build configuration and default preferences to an unpacked Firefox source tree.
# Usage: apply-config.sh <path to firefox source> [platform, default linux]
set -euo pipefail

SRC="${1:?Usage: apply-config.sh <firefox source dir> [platform]}"
PLATFORM="${2:-linux}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

test -d "$SRC/browser" || { echo "$SRC does not look like a Firefox source tree" >&2; exit 1; }

# Build options
cp "$ROOT/browser/mozconfig/$PLATFORM.mozconfig" "$SRC/mozconfig"
echo "Installed mozconfig for $PLATFORM"

# Default preferences: append once, never twice
PREFS="$SRC/browser/app/profile/firefox.js"
test -f "$PREFS" || { echo "Missing $PREFS. Firefox layout has changed, update this script." >&2; exit 1; }
if ! grep -q "Glyde default preferences" "$PREFS"; then
  { echo; echo "// ===== Glyde ====="; cat "$ROOT/browser/prefs/glyde-prefs.js"; } >> "$PREFS"
  echo "Appended Glyde preferences"
else
  echo "Glyde preferences already present"
fi

# Company and vendor names that Windows shows in the file properties (and that name the profile folder).
# Every change is printed, so a failed build can be traced back. Missing files are skipped.
for f in browser/app/module.ver config/module.ver browser/confvars.sh browser/installer/windows/nsis/defines.nsi.in; do
  if [ -f "$SRC/$f" ]; then
    before="$(md5sum "$SRC/$f" | cut -d' ' -f1)"
    sed -i -E 's/Mozilla (Corporation|Foundation)/Glyde/g; s/^(MOZ_APP_VENDOR)=.*/\1=Glyde/' "$SRC/$f"
    after="$(md5sum "$SRC/$f" | cut -d' ' -f1)"
    if [ "$before" != "$after" ]; then echo "Set vendor name in $f"; else echo "No vendor name to change in $f"; fi
  else
    echo "Skipped $f (not present)"
  fi
done

# Our own patches, if any, applied in name order
shopt -s nullglob
for p in "$ROOT"/browser/patches/*.patch; do
  echo "Applying $(basename "$p")"
  patch -d "$SRC" -p1 --forward < "$p"
done
echo "Config applied"
