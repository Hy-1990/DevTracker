#!/usr/bin/env bash

set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "macOS release bundles must be built on macOS." >&2
  exit 1
fi

npm run release:check:macos-config
npm run tauri build -- --bundles dmg

version=$(node -p "require('./src-tauri/tauri.conf.json').version")
dmg=$(find src-tauri/target/release/bundle/dmg -maxdepth 1 -type f \
  -name "DevTracker_${version}_*.dmg" -print -quit)

if [[ -z "$dmg" ]]; then
  echo "No DevTracker ${version} DMG was produced." >&2
  exit 1
fi

bash scripts/verify-macos-release.sh "$dmg"
echo "Verified macOS release: $dmg"
