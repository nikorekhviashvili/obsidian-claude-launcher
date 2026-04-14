# Claude Code Launcher for Obsidian

Launch [Claude Code](https://docs.anthropic.com/en/docs/claude-code) directly from Obsidian. Select text, hit a hotkey, and Claude opens in your terminal with full context — the file path, your selection, and an optional prompt.

> **macOS only** — uses AppleScript to control terminal apps.

## How it works

1. Press `Cmd+Alt+D` or run the command from the palette. (You can also change hotkey from Obsidian settings)
2. A modal appears showing the current file and selected text
3. Optionally type additional context for Claude Code
4. Hit `Cmd+Enter` — Claude Code launches in your terminal, scoped to your vault

The plugin passes context to Claude as a prompt:
- **File reference** — `@path/to/note.md` so Claude knows which file you're working in
- **Your prompt** — whatever you typed in the modal
- **Selected text** — wrapped in a code block

## Requirements

- macOS
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed and on your PATH
- One of: Terminal.app, iTerm2, or Warp

## Installation

### With BRAT (recommended)

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) from Community Plugins
2. In BRAT settings, click **Add Beta Plugin**
3. Paste: `nikorekhviashvili/obsidian-claude-launcher`
4. Enable the plugin

### Manual

1. Download `main.js`, `manifest.json` from the [latest release](https://github.com/nikorekhviashvili/obsidian-claude-launcher/releases/latest)
2. Create `<vault>/.obsidian/plugins/claude-launcher/`
3. Copy both files into that folder
4. Enable the plugin in Obsidian settings

## Settings

| Setting | Description | Default |
|---|---|---|
| **Terminal application** | Terminal.app, iTerm2, or Warp | Terminal.app |
| **Skip permissions** | Launch with `--dangerously-skip-permissions` | On |
| **Extra CLI flags** | Additional flags (e.g. `--model sonnet`) | — |

## Building from source

```bash
npm install
npm run build
```

This produces `main.js` in the project root. Copy it alongside `manifest.json` into your vault's plugin folder to test locally.

## License

MIT
