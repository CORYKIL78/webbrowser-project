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

# Our own patches, if any, applied in name order
shopt -s nullglob
for p in "$ROOT"/browser/patches/*.patch; do
  echo "Applying $(basename "$p")"
  patch -d "$SRC" -p1 --forward < "$p"
done
echo "Config applied"
