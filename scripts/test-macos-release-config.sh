#!/usr/bin/env bash

set -euo pipefail

node --input-type=module <<'NODE'
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'));
const identity = config.bundle?.macOS?.signingIdentity;

if (identity !== '-') {
  console.error(
    'macOS release builds must use a complete ad-hoc bundle signature (bundle.macOS.signingIdentity = "-").',
  );
  process.exit(1);
}

console.log('macOS release signing configuration passed.');
NODE
