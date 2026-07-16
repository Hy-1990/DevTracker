#!/usr/bin/env bash

set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "macOS release verification must run on macOS." >&2
  exit 1
fi

dmg=${1:?"Usage: scripts/verify-macos-release.sh <path-to-dmg>"}
require_notarized=${2:-}
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
codesign --verify --strict --verbose=2 "$dmg"
hdiutil attach -readonly -nobrowse -mountpoint "$mount_dir" "$dmg" >/dev/null
mounted=1

app="$mount_dir/DevTracker.app"
if [[ ! -d "$app" ]]; then
  echo "DevTracker.app is missing from the DMG." >&2
  exit 1
fi

codesign --verify --deep --strict --verbose=2 "$app"

signature_details=$(codesign -dvvv "$app" 2>&1)
if ! grep -q '^Authority=Developer ID Application:' <<<"$signature_details"; then
  echo "The App bundle is not signed with Developer ID Application." >&2
  exit 1
fi
if ! grep -Eq '^CodeDirectory .*flags=.*runtime' <<<"$signature_details"; then
  echo "The App bundle does not use the hardened runtime." >&2
  exit 1
fi
if ! grep -q '^Timestamp=' <<<"$signature_details"; then
  echo "The App bundle does not have a secure timestamp." >&2
  exit 1
fi

architectures=$(lipo -archs "$app/Contents/MacOS/devtracker")
if [[ " $architectures " != *" arm64 "* || " $architectures " != *" x86_64 "* ]]; then
  echo "The App executable is not universal (arm64 + x86_64)." >&2
  exit 1
fi

if [[ "$require_notarized" == "--require-notarized" ]]; then
  xcrun stapler validate "$dmg" >/dev/null
  spctl --assess --type open --context context:primary-signature --verbose=4 "$dmg" >/dev/null
  spctl --assess --type execute --verbose=4 "$app" >/dev/null
fi

blocked=$(find "$app" -type f \
  \( -iname '*.db' -o -iname '*.sqlite' -o -iname '*.sqlite3' \
     -o -iname '.env' -o -iname '*.pem' -o -iname '*.key' \) -print)
if [[ -n "$blocked" ]]; then
  echo "Sensitive file type found in App bundle:" >&2
  echo "$blocked" >&2
  exit 1
fi

echo "Architectures: $architectures"
echo "Developer ID signature: valid"
if [[ "$require_notarized" == "--require-notarized" ]]; then
  echo "Apple notarization ticket: valid"
fi
shasum -a 256 "$dmg"
