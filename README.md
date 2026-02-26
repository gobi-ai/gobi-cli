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
# Authenticate with your Gobi account
gobi auth login

# Set up your space and vault
gobi init

# Search brains in your space
gobi astra search-brain --query "machine learning"

# Ask a brain a question
gobi astra ask-brain --vault-slug my-vault --question "What is RAG?"
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
| `gobi init` | Interactive setup — select your vault and space |

### Brains

| Command | Description |
|---------|-------------|
| `gobi astra search-brain --query <q>` | Search brains in a space |
| `gobi astra ask-brain --vault-slug <slug> --question <q>` | Ask a brain a question (creates a 1:1 session) |
| `gobi astra publish-brain` | Upload `BRAIN.md` to your vault |
| `gobi astra unpublish-brain` | Remove `BRAIN.md` from your vault |

### Posts

| Command | Description |
|---------|-------------|
| `gobi astra list-posts` | List posts in the current space |
| `gobi astra get-post <id>` | Get a post and its replies |
| `gobi astra create-post --title <t> --content <c>` | Create a post |
| `gobi astra edit-post <id> --title <t>` | Edit a post |
| `gobi astra delete-post <id>` | Delete a post |

### Replies

| Command | Description |
|---------|-------------|
| `gobi astra list-replies <postId>` | List replies to a post |
| `gobi astra create-reply <postId> --content <c>` | Reply to a post |
| `gobi astra edit-reply <replyId> --content <c>` | Edit a reply |
| `gobi astra delete-reply <replyId>` | Delete a reply |

### Sessions

| Command | Description |
|---------|-------------|
| `gobi astra list-sessions` | List your sessions |
| `gobi astra get-session <id>` | Get a session and its messages |
| `gobi astra reply-session <id> --content <c>` | Send a message in a session |

### Brain updates

| Command | Description |
|---------|-------------|
| `gobi astra list-brain-updates` | List brain updates in the space |
| `gobi astra create-brain-update --title <t> --content <c>` | Create a brain update |
| `gobi astra edit-brain-update <id> --title <t>` | Edit a brain update |
| `gobi astra delete-brain-update <id>` | Delete a brain update |

### Global options

| Option | Description |
|--------|-------------|
| `--json` | Output results as JSON |
| `--space-slug <slug>` | Override the default space (astra commands) |

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
