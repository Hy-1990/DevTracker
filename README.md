# DevTracker

English | [简体中文](docs/README_zh-CN.md)

[![CI](https://github.com/Hy-1990/DevTracker/actions/workflows/ci.yml/badge.svg)](https://github.com/Hy-1990/DevTracker/actions/workflows/ci.yml)
[![Vue 3](https://img.shields.io/badge/Vue-3-42b883.svg)](https://vuejs.org/)
[![Tauri 2](https://img.shields.io/badge/Tauri-2-24c8db.svg)](https://tauri.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

DevTracker is a local-first desktop workspace for small engineering teams that need one place to manage monthly tasks, delivery health, team capacity, and status reports. It is built with Vue 3, TypeScript, Tauri 2, Rust, and SQLite, with complete Chinese and English interfaces and matching daily, weekly, and monthly reports.

> An ad-hoc signed Apple Silicon DMG is available from [GitHub Releases](https://github.com/Hy-1990/DevTracker/releases). It is not Apple-notarized, so macOS requires one manual approval on first launch. Every screenshot uses fictional demo data.

## Screenshots

### Grouped task table

![DevTracker table view](docs/images/devtracker-table.png)

### Kanban board

![DevTracker Kanban view](docs/images/devtracker-kanban.png)

### Analytics

![DevTracker analytics view](docs/images/devtracker-stats.png)

## Features

- Monthly task boards with subtasks, owners, assignees, testers, projects, priorities, statuses, dates, effort, progress, and quality scores.
- Table, Kanban, delay analysis, delivery rankings, analytics, and team-capacity views.
- Instant Chinese and English switching with the preference stored locally.
- Daily, weekly, and monthly reports in the selected language, including locale-specific AI prompts.
- Excel, CSV, JSON, and SQLite database exports.
- Dark, light, and system theme modes.
- A local SQLite database with no remote application backend.

## Architecture

```text
Vue 3 + TypeScript + Naive UI
            │
        Tauri Commands
            │
        Rust + SQLite
            │
  OS application data directory
```

The frontend handles interaction, analytics, and report generation. Tauri commands handle database access, file exports, and optional DeepSeek API requests. The database lives in the operating system's application-data directory, not inside the Git repository.

## Quick start

### Install on Apple Silicon Macs

1. Download `DevTracker_0.1.1_aarch64.dmg` from [GitHub Releases](https://github.com/Hy-1990/DevTracker/releases/latest).
2. Open the DMG and drag DevTracker into Applications.
3. Try to open DevTracker once. If macOS blocks it, open **System Settings → Privacy & Security**, locate the DevTracker security message, and choose **Open Anyway**.

The DMG is ad-hoc signed and passes strict bundle-signature verification, but it is not signed with a paid Apple Developer ID or notarized by Apple. Do not bypass this warning for copies obtained outside this repository.

### Prerequisites

- Node.js 20 or later
- npm
- Rust stable
- [Tauri 2 system prerequisites](https://v2.tauri.app/start/prerequisites/)

### Development

```bash
git clone https://github.com/Hy-1990/DevTracker.git
cd DevTracker
npm ci
npm run tauri dev
```

### Test and build

```bash
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
npm run tauri build
```

`npm run tauri build` creates desktop artifacts for the current operating system. Generated output is excluded from Git.

On macOS, use `npm run release:build:macos` for a distributable ad-hoc signed DMG. The command also verifies the disk image, the complete App bundle signature, architecture, and absence of sensitive file types.

## Data and privacy

Default database locations:

- macOS: `~/Library/Application Support/DevTracker/data.db`
- Windows: `DevTracker/data.db` under the user's Local AppData directory
- Linux: `DevTracker/data.db` under the user's local data directory

Set `DEVTRACKER_DB_DIR` to use another directory. If an older release finds `data/data.db` inside the project, the first launch copies it to the system data directory using SQLite's consistent backup API. The original file is never deleted automatically.

The repository uses `.gitignore`, CI, and privacy-check scripts to reject databases, backups, environment files, private keys, local absolute paths, and high-confidence credential literals:

```bash
npm run privacy:test
npm run privacy:check
```

### AI privacy boundary

The DeepSeek API Key is stored in the WebView's local `localStorage`; it is not written to the project or SQLite database. Only when you explicitly request an AI summary are the current report content and API Key sent to the DeepSeek API. Reports may contain task, project, or team-member information, so confirm that this data may be shared with a third-party service before using AI features.

Without AI features, task management and standard report generation stay entirely on the device.

## Demo data and screenshots

`scripts/demo-data.sql` contains fictional people, projects, and tasks only. Run:

```bash
scripts/run-demo.sh
```

The script creates an isolated database in the system temporary directory and removes it on exit. It never reads or overwrites the default database.

## Project structure

```text
src/                    Vue frontend, views, state, and localization
src-tauri/src/          Rust commands and SQLite data layer
scripts/                Privacy checks and isolated demo data
docs/                   Localized documentation
docs/images/            README screenshots
.github/workflows/      CI verification
```

## Contributing

Issues and pull requests are welcome. Run the full test and privacy checks before submitting changes. All examples, logs, screenshots, and test fixtures must use fictional data.

For security or privacy reports, read [SECURITY.md](SECURITY.md). Never post databases, logs, API keys, or real business data in a public issue.

## License

[MIT License](LICENSE)
