# Claude Dashboard

A local GUI dashboard for managing and configuring Claude Code. Provides a web-based interface to view sessions, skills, commands, memory, settings, and more — all from your browser.

## Features

- **Overview** — See running Claude Code sessions and project stats at a glance
- **Skills** — Browse and search available skills
- **Commands** — View configured custom commands
- **Memory** — Inspect and manage Claude Code memory files
- **Settings** — View and edit Claude Code configuration
- **Global search** — Search across all sections from the sidebar

## Prerequisites

- [Node.js](https://nodejs.org/) (v16+)
- [Claude Code](https://claude.ai/claude-code) installed and configured (`~/.claude` directory)

## Getting Started

```bash
# Install dependencies
npm install

# Start the dashboard
npm start
```

The dashboard will be available at **http://localhost:3456**.

## Tech Stack

- **Backend:** Node.js + Express
- **Frontend:** Vanilla HTML/CSS/JS (no build step)
- **Data source:** Reads directly from `~/.claude` directory

## Project Structure

```
claude-dashboard/
├── server.js          # Express API server
├── public/
│   ├── index.html     # Dashboard UI
│   ├── app.js         # Frontend logic
│   └── style.css      # Styles
├── package.json
└── .gitignore
```
