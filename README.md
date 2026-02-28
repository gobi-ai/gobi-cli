# gobi-cli

[![CI](https://github.com/gobi-ai/gobi-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/gobi-ai/gobi-cli/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@gobi-ai/cli)](https://www.npmjs.com/package/@gobi-ai/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Command-line interface for the [Gobi](https://joingobi.com) collaborative knowledge platform.

## Installation

### Homebrew

```sh
brew tap gobi-ai/tap
brew install gobi
```

### npm

```sh
npm install -g @gobi-ai/cli
```

### From source

```sh
git clone https://github.com/gobi-ai/gobi-cli.git
cd gobi-cli
npm install
npm run build
npm link
```

## Quick start

```sh
# Initialize — logs in and sets up your vault
gobi init

# Select a space
gobi space warp

# Search brains across your spaces
gobi brain search --query "machine learning"

# Ask a brain a question
gobi brain ask --vault-slug my-vault --space-slug my-space --question "What is RAG?"
```

## Commands

### Authentication

| Command | Description |
|---------|-------------|
| `gobi auth login` | Sign in via device code flow |
| `gobi auth status` | Show current auth status |
| `gobi auth logout` | Sign out and clear credentials |

### Setup

| Command | Description |
|---------|-------------|
| `gobi init` | Log in (if needed) and select or create a vault |
| `gobi space warp` | Select the active space |

### Brains

| Command | Description |
|---------|-------------|
| `gobi brain search --query <q>` | Search brains across all your spaces |
| `gobi brain ask --vault-slug <slug> --space-slug <slug> --question <q>` | Ask a brain a question (creates a 1:1 session) |
| `gobi brain publish` | Upload `BRAIN.md` to your vault |
| `gobi brain unpublish` | Remove `BRAIN.md` from your vault |

### Brain Updates

| Command | Description |
|---------|-------------|
| `gobi brain list-updates` | List brain updates for your vault |
| `gobi brain list-updates --mine` | List only your own brain updates |
| `gobi brain post-update --title <t> --content <c>` | Post a brain update |
| `gobi brain edit-update <id> --title <t>` | Edit a brain update |
| `gobi brain delete-update <id>` | Delete a brain update |

### Threads

| Command | Description |
|---------|-------------|
| `gobi space list-threads` | List threads in the current space |
| `gobi space get-thread <id>` | Get a thread and its replies |
| `gobi space create-thread --title <t> --content <c>` | Create a thread |
| `gobi space edit-thread <id> --title <t>` | Edit a thread |
| `gobi space delete-thread <id>` | Delete a thread |

### Replies

| Command | Description |
|---------|-------------|
| `gobi space create-reply <threadId> --content <c>` | Reply to a thread |
| `gobi space edit-reply <replyId> --content <c>` | Edit a reply |
| `gobi space delete-reply <replyId>` | Delete a reply |

### Sessions

| Command | Description |
|---------|-------------|
| `gobi session list` | List your sessions |
| `gobi session get <id>` | Get a session and its messages |
| `gobi session reply <id> --content <c>` | Send a message in a session |
| `gobi session update <id> --mode <mode>` | Set session mode (auto/manual) |

### Global options

| Option | Description |
|--------|-------------|
| `--json` | Output results as JSON |
| `--space-slug <slug>` | Override the default space (on `space` commands); required on `brain ask`, optional filter on `session list` |
| `--vault-slug <slug>` | Override the default vault (on `brain list-updates` and `brain post-update`) |

## Configuration

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GOBI_BASE_URL` | `https://backend.joingobi.com` | API server URL |
| `GOBI_WEBDRIVE_BASE_URL` | `https://webdrive.joingobi.com` | File storage URL |

### Files

| Path | Description |
|------|-------------|
| `~/.gobi/credentials.json` | Stored authentication tokens |
| `.gobi/settings.yaml` | Per-project vault and space configuration |

## Development

```sh
git clone https://github.com/gobi-ai/gobi-cli.git
cd gobi-cli
npm install
npm run build
npm test
```

Run from source without compiling:

```sh
npm run dev -- auth status
```

## License

[MIT](LICENSE)
