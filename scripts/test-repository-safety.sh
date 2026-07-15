#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
checker="$script_dir/check-repository-safety.sh"

must_reject() {
  if "$checker" "$1" >/dev/null 2>&1; then
    echo "Expected privacy check to reject: $1" >&2
    exit 1
  fi
}

must_allow() {
  "$checker" "$1" >/dev/null
}

for path in \
  data/data.db \
  backup/private.sqlite3 \
  backup/private.sqlite-wal \
  backup/data.db-shm \
  backup/data.db-journal \
  backup/data.db.bak_20260715 \
  .env \
  .env.local \
  config/credentials-prod.json \
  config/service-account.json \
  keys/id.key \
  .loop-runs/private/status.json \
  .gstack/security-reports/report.json \
  .codex/session.json \
  .claude/settings.local.json \
  .agents/private-notes.md \
  docs/superpowers/plans/internal.md \
  node_modules/pkg/index.js \
  dist/index.html \
  src-tauri/target/debug/devtracker \
  debug.log \
  vite.config.ts.timestamp-123.mjs \
  docs/images/capture.tmp.png \
  docs/images/devtracker-table.png.xmp
do
  must_reject "$path"
done

for path in src/main.ts .env.example package-lock.json src-tauri/Cargo.lock README.md scripts/demo-data.sql docs/images/devtracker-table.png; do
  must_allow "$path"
done

echo "Repository privacy fixtures passed."
