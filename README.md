# Claude Dashboard

A local web-based GUI for browsing and managing your [Claude Code](https://docs.anthropic.com/en/docs/claude-code) configuration. View skills, agents, commands, MCP servers, memories, settings, and running sessions -- all from your browser. Click any skill, command, or agent to launch it directly in a new terminal window.

![Node.js](https://img.shields.io/badge/Node.js-16%2B-green) ![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-blue)

## Features

- **Overview** -- Dashboard with stats and quick-launch cards
- **Skills** -- Browse, search, and create Claude Code skills (slash commands)
- **Commands** -- View custom commands and launch them in one click
- **Agents** -- Browse, create, and launch specialized agents
- **MCP Servers** -- See connected Model Context Protocol servers and their tools
- **Running Sessions** -- Live view of active/recent Claude Code sessions (auto-refreshes)
- **Settings** -- Edit global, local, and per-project Claude Code settings (JSON editor)
- **Memories** -- Inspect, edit, and delete persistent memory entries across projects
- **Global Search** -- Search across all sections from the sidebar (Ctrl+K)
- **Terminal Launch** -- Click any skill/command/agent to open it in a new terminal with a folder picker

## Prerequisites

1. **Node.js** v16 or later -- [download here](https://nodejs.org/)
2. **Claude Code** installed and configured -- you need a `~/.claude` directory with at least one session or configuration file. If you haven't used Claude Code yet, install it and run it once:
   ```bash
   npm install -g @anthropic-ai/claude-code
   claude
   ```

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/maliknarayan/claude-dashboard.git
cd claude-dashboard

# 2. Install dependencies
npm install

# 3. Start the dashboard
npm start
```

Open **http://localhost:3456** in your browser.

### Custom Port

```bash
PORT=8080 npm start
```

## How It Works

The dashboard reads directly from your `~/.claude` directory (the standard Claude Code config folder). It does **not** modify anything unless you explicitly edit settings or memories through the UI.

| Directory / File | What the dashboard reads |
|---|---|
| `~/.claude/skills/` | Skill definitions (SKILL.md frontmatter) |
| `~/.claude/commands/` | Custom command `.md` files |
| `~/.claude/agents/` | Agent definitions (frontmatter + body) |
| `~/.claude/mcp-servers/` | MCP server directories |
| `~/.claude/sessions/` | Session JSON files (matched against running processes) |
| `~/.claude/settings.json` | Global settings |
| `~/.claude/settings.local.json` | Local settings |
| `~/.claude/projects/` | Per-project settings and memory files |

## Platform Support

| Feature | Windows | macOS | Linux |
|---|---|---|---|
| Browse config | Yes | Yes | Yes |
| Detect running sessions | Yes (tasklist) | Yes (ps) | Yes (ps) |
| Launch in terminal | Yes (cmd) | Yes (Terminal.app) | Yes (gnome-terminal / xterm) |
| Folder picker dialog | Yes (PowerShell) | Yes (osascript) | Yes (zenity / kdialog) |

## Project Structure

```
claude-dashboard/
├── server.js          # Express API server (reads ~/.claude, launches terminals)
├── public/
│   ├── index.html     # Dashboard shell and modals
│   ├── app.js         # Frontend logic (SPA, no framework)
│   └── style.css      # Dark theme styles
├── package.json
├── .gitignore
└── README.md
```

## Tech Stack

- **Backend:** Node.js + Express (single dependency)
- **Frontend:** Vanilla HTML/CSS/JS -- no build step, no framework
- **Data source:** Reads directly from `~/.claude` on disk

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/system` | System info (home dir, platform, claude dir exists) |
| GET | `/api/skills` | List all skills |
| POST | `/api/skills` | Create a new skill |
| GET | `/api/skills/:name/source` | Read skill source (SKILL.md) |
| GET | `/api/commands` | List all commands |
| GET | `/api/agents` | List all agents |
| POST | `/api/agents` | Create a new agent |
| GET | `/api/agents/:name/source` | Read agent source |
| GET | `/api/mcp` | List MCP servers and permitted tools |
| GET | `/api/sessions` | List sessions (with alive/dead status) |
| GET | `/api/projects` | List projects |
| GET | `/api/memories` | List all memory entries across projects |
| GET/PUT | `/api/settings/global` | Read/write global settings |
| GET/PUT | `/api/settings/local` | Read/write local settings |
| GET/PUT/DELETE | `/api/memory/:project/:file` | Read/write/delete a memory file |
| POST | `/api/launch` | Launch a skill/command/agent in a new terminal |
| POST | `/api/browse-folder` | Open native folder picker dialog |

## Troubleshooting

**"Claude Code config directory not found"**
- Make sure Claude Code is installed (`npm install -g @anthropic-ai/claude-code`) and has been run at least once so the `~/.claude` directory exists.

**"Launch" button does nothing (Linux)**
- Install a supported terminal emulator: `gnome-terminal`, `xterm`, or any `x-terminal-emulator`.

**"Browse" folder picker doesn't open (Linux)**
- Install `zenity` (GNOME) or `kdialog` (KDE): `sudo apt install zenity`

**Port already in use**
- Use a different port: `PORT=4000 npm start`

## License

MIT
