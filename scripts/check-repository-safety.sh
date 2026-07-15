#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

check_path() {
  local path="${1#./}"
  local name="${path##*/}"

  case "$path" in
    data/*|*/data/*|node_modules/*|*/node_modules/*|dist/*|*/dist/*|src-tauri/target/*|*/target/*|.loop-runs/*|*/.loop-runs/*|.gstack/*|.codex/*|.claude/*|.agents/*|docs/superpowers/*)
      echo "Blocked private/generated path: $path" >&2
      return 1
      ;;
  esac

  case "$name" in
    .env.example)
      return 0
      ;;
    .env|.env.*|*.db|*.db-*|*.sqlite|*.sqlite3|*.sqlite-*|*.sqlite3-*|*.bak|*.bak-*|*.bak_*|*.pem|*.p12|*.pfx|*.key|credentials*.json|secrets*.json|service-account*.json|*.log|*.tmp|*.tmp.*|*.xmp|.DS_Store|Thumbs.db|vite.config.ts.timestamp-*.mjs)
      echo "Blocked private/generated file: $path" >&2
      return 1
      ;;
  esac
}

if (( $# > 0 )); then
  for path in "$@"; do
    check_path "$path"
  done
  exit 0
fi

cd "$repo_root"
git rev-parse --is-inside-work-tree >/dev/null

git ls-files --cached --others --exclude-standard -z |
  while IFS= read -r -d '' path; do
    check_path "$path"
  done

secret_pattern='(sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{20,}|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY)'
mac_user_path='/User''s/[^/[:space:]]+'
linux_user_path='/ho''me/[^/[:space:]]+'
windows_user_path='[A-Za-z]:\\User''s\\[^\\[:space:]]+'
email_literal='[A-Za-z0-9._%+-]+@[A-Za-z][A-Za-z0-9.-]*\.[A-Za-z]{2,}'
private_identity_pattern="($mac_user_path|$linux_user_path|$windows_user_path|$email_literal)"
found=0
while IFS= read -r -d '' path; do
  [[ -f "$path" ]] || continue
  if grep -Iq . "$path" && rg -l --no-messages "$secret_pattern" -- "$path" >/dev/null; then
    echo "Possible credential literal in: $path" >&2
    found=1
  fi
  if grep -Iq . "$path" && rg -l --no-messages "$private_identity_pattern" -- "$path" >/dev/null; then
    if ! rg -l --no-messages '^[^@[:space:]]+@users\.noreply\.github\.com$' -- "$path" >/dev/null; then
      echo "Possible personal path or email in: $path" >&2
      found=1
    fi
  fi
done < <(git ls-files --cached --others --exclude-standard -z)

if (( found != 0 )); then
  exit 1
fi

echo "Repository privacy check passed."
