#!/usr/bin/env bash

set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "macOS release bundles must be built on macOS." >&2
  exit 1
fi

notary_profile=${DEVTRACKER_NOTARY_PROFILE:-DevTracker Notary}
target=universal-apple-darwin

identity_hash=$(
  security find-identity -v -p codesigning \
    | awk '/Developer ID Application/ { print $2; exit }'
)
if [[ -z "$identity_hash" ]]; then
  echo "No valid Developer ID Application signing identity was found." >&2
  exit 1
fi

for architecture in aarch64-apple-darwin x86_64-apple-darwin; do
  if ! rustup target list --installed | grep -qx "$architecture"; then
    echo "Missing Rust target: $architecture" >&2
    echo "Install it with: rustup target add $architecture" >&2
    exit 1
  fi
done

if ! xcrun notarytool history --keychain-profile "$notary_profile" >/dev/null 2>&1; then
  echo "The configured Apple notarization profile is unavailable or invalid." >&2
  exit 1
fi

export APPLE_SIGNING_IDENTITY="$identity_hash"

npm run privacy:check
npm run release:check:macos-config
npm run tauri build -- --target "$target" --bundles dmg

version=$(node -p "require('./src-tauri/tauri.conf.json').version")
dmg_dir="src-tauri/target/$target/release/bundle/dmg"
dmg=$(find "$dmg_dir" -maxdepth 1 -type f \
  -name "DevTracker_${version}_universal.dmg" -print -quit)

if [[ -z "$dmg" ]]; then
  echo "No universal DevTracker ${version} DMG was produced." >&2
  exit 1
fi

notary_result=$(mktemp /tmp/devtracker-notary-result.XXXXXX.json)
cleanup() {
  rm -f -- "$notary_result"
}
trap cleanup EXIT

if ! xcrun notarytool submit "$dmg" \
  --keychain-profile "$notary_profile" \
  --wait \
  --output-format json >"$notary_result"; then
  echo "Apple notarization submission failed." >&2
  exit 1
fi

notary_status=$(node -e \
  "const fs=require('fs'); const r=JSON.parse(fs.readFileSync(process.argv[1])); process.stdout.write(r.status || '')" \
  "$notary_result")
if [[ "$notary_status" != "Accepted" ]]; then
  echo "Apple notarization did not accept the release." >&2
  exit 1
fi

stapled=0
for attempt in {1..6}; do
  if xcrun stapler staple "$dmg" >/dev/null 2>&1; then
    stapled=1
    break
  fi
  if [[ "$attempt" -lt 6 ]]; then
    echo "Notarization ticket is not available yet; retrying in 20 seconds ($attempt/6)."
    sleep 20
  fi
done
if [[ "$stapled" -ne 1 ]]; then
  echo "Unable to staple the Apple notarization ticket." >&2
  echo "Use the GitHub macOS staple workflow when the local network blocks Apple CloudKit." >&2
  exit 1
fi

xcrun stapler validate "$dmg" >/dev/null
bash scripts/verify-macos-release.sh "$dmg" --require-notarized
echo "Verified signed and notarized macOS release: $dmg"
