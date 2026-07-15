#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
demo_dir="$(mktemp -d "${TMPDIR:-/tmp}/devtracker-demo.XXXXXX")"

cleanup() {
  rm -rf "$demo_dir"
}
trap cleanup EXIT INT TERM

case "$demo_dir" in
  "$repo_root"/*|"$repo_root/data"|"$HOME/Library/Application Support/DevTracker"*)
    echo "Refusing unsafe demo database directory: $demo_dir" >&2
    exit 1
    ;;
esac

sqlite3 "$demo_dir/data.db" < "$repo_root/scripts/demo-data.sql"
export DEVTRACKER_DB_DIR="$demo_dir"

echo "Launching DevTracker with isolated fictional demo data."
cd "$repo_root"
bundle_binary="$repo_root/src-tauri/target/debug/bundle/macos/DevTracker.app/Contents/MacOS/devtracker"
if [[ "${DEVTRACKER_USE_BUNDLE:-0}" == "1" ]]; then
  if [[ ! -x "$bundle_binary" ]]; then
    echo "Debug app bundle not found. Run: npm run tauri build -- --debug" >&2
    exit 1
  fi
  "$bundle_binary"
elif command -v lsof >/dev/null && lsof -tiTCP:1420 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Using the existing DevTracker Vite server on port 1420."
  cargo run --manifest-path src-tauri/Cargo.toml --no-default-features
else
  npm run tauri dev
fi
