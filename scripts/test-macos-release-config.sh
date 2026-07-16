#!/usr/bin/env bash

set -euo pipefail

node --input-type=module <<'NODE'
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'));
const identity = config.bundle?.macOS?.signingIdentity;

if (identity === '-') {
  console.error(
    'macOS release builds must not use an ad-hoc signing identity.',
  );
  process.exit(1);
}

console.log('macOS Developer ID release configuration passed.');
NODE
