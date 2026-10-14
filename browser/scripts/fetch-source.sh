#!/usr/bin/env bash
# Download the official Firefox source release named in glyde.json and check its checksum.
# Output: build/firefox-<version>/
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CFG="$ROOT/browser/glyde.json"
VERSION="$(python3 -c "import json,sys;print(json.load(open('$CFG'))['firefoxVersion'])")"
SRC_URL="$(python3 -c "import json;print(json.load(open('$CFG'))['sourceUrl'].replace('{version}','$VERSION'))")"
SUM_URL="$(python3 -c "import json;print(json.load(open('$CFG'))['checksumUrl'].replace('{version}','$VERSION'))")"

mkdir -p "$ROOT/build"
cd "$ROOT/build"
TARBALL="firefox-$VERSION.source.tar.xz"

if [ ! -f "$TARBALL" ]; then
  echo "Downloading $SRC_URL"
  curl -fL --retry 3 -o "$TARBALL" "$SRC_URL"
fi

echo "Checking checksum"
curl -fsSL --retry 3 -o SHA512SUMS "$SUM_URL"
EXPECTED="$(grep " source/$TARBALL\$" SHA512SUMS | awk '{print $1}')"
if [ -z "$EXPECTED" ]; then
  echo "Could not find $TARBALL in SHA512SUMS. Stopping so an unchecked file is never built." >&2
  exit 1
fi
ACTUAL="$(sha512sum "$TARBALL" | awk '{print $1}')"
if [ "$EXPECTED" != "$ACTUAL" ]; then
  echo "Checksum mismatch for $TARBALL. Stopping." >&2
  exit 1
fi
echo "Checksum ok"

if [ ! -d "firefox-$VERSION" ]; then
  echo "Extracting"
  tar -xf "$TARBALL"
fi
test -d "firefox-$VERSION" || { echo "Expected folder firefox-$VERSION was not created" >&2; exit 1; }
echo "Source ready: $ROOT/build/firefox-$VERSION"
