#!/usr/bin/env bash

set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "macOS release verification must run on macOS." >&2
  exit 1
fi

dmg=${1:?"Usage: scripts/verify-macos-release.sh <path-to-dmg>"}
if [[ ! -f "$dmg" ]]; then
  echo "DMG not found: $dmg" >&2
  exit 1
fi

mount_dir=$(mktemp -d /tmp/devtracker-release-mount.XXXXXX)
mounted=0

cleanup() {
  if [[ "$mounted" -eq 1 ]]; then
    hdiutil detach "$mount_dir" >/dev/null 2>&1 || true
  fi
  rm -rf -- "$mount_dir"
}
trap cleanup EXIT

hdiutil verify "$dmg" >/dev/null
hdiutil attach -readonly -nobrowse -mountpoint "$mount_dir" "$dmg" >/dev/null
mounted=1

app="$mount_dir/DevTracker.app"
if [[ ! -d "$app" ]]; then
  echo "DevTracker.app is missing from the DMG." >&2
  exit 1
fi

codesign --verify --deep --strict --verbose=2 "$app"

assessment=$(spctl --assess --type execute --verbose=4 "$app" 2>&1 || true)
if grep -q "code has no resources but signature indicates they must be present" <<<"$assessment"; then
  echo "The App bundle has an incomplete signature." >&2
  exit 1
fi

blocked=$(find "$app" -type f \
  \( -iname '*.db' -o -iname '*.sqlite' -o -iname '*.sqlite3' \
     -o -iname '.env' -o -iname '*.pem' -o -iname '*.key' \) -print)
if [[ -n "$blocked" ]]; then
  echo "Sensitive file type found in App bundle:" >&2
  echo "$blocked" >&2
  exit 1
fi

file "$app/Contents/MacOS/devtracker"
codesign -dvv "$app" 2>&1 | grep -E 'Identifier=|Signature=|TeamIdentifier='
shasum -a 256 "$dmg"
