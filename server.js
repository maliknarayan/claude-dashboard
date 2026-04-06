const express = require('express');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3456;

const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const IS_WIN = process.platform === 'win32';
const IS_MAC = process.platform === 'darwin';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- API: System Info ---

app.get('/api/system', (req, res) => {
  const claudeExists = fs.existsSync(CLAUDE_DIR);
  res.json({
    homeDir: os.homedir(),
    platform: process.platform,
    claudeDir: CLAUDE_DIR,
    claudeExists,
  });
});

// --- Helpers ---

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };
  const meta = {};
  match[1].split(/\r?\n/).forEach(line => {
    const idx = line.indexOf(':');
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      let val = line.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      meta[key] = val;
    }
  });
  return { meta, body: match[2] };
}

function safeReadDir(dir) {
  try { return fs.readdirSync(dir); } catch { return []; }
}

function safeReadFile(filePath) {
  try { return fs.readFileSync(filePath, 'utf-8'); } catch { return null; }
}

function decodeProjectPath(encoded) {
  // Claude encodes project paths: C--Users-Kilowott => C:\Users\Kilowott (Win) or /Users/Kilowott (Unix)
  const decoded = encoded.replace(/--/g, '/').replace(/-/g, path.sep);
  // On Windows, re-add drive letter colon: C\Users => C:\Users
  if (IS_WIN && /^[A-Za-z]\\/.test(decoded)) {
    return decoded[0] + ':' + decoded.slice(1);
  }
  // On Unix, paths start with / which gets encoded as leading separator
  if (!IS_WIN && !decoded.startsWith('/')) {
    return '/' + decoded;
  }
  return decoded;
}

// --- API: Running Sessions ---

function getRunningPids() {
  return new Promise((resolve) => {
    const cmd = IS_WIN
      ? 'tasklist /FI "IMAGENAME eq claude.exe" /NH'
      : 'ps aux | grep -i claude | grep -v grep';

    exec(cmd, (err, stdout) => {
      if (err) return resolve([]);
      const pids = [];
      stdout.split(/\r?\n/).forEach(line => {
        if (IS_WIN) {
          const match = line.match(/claude\.exe\s+(\d+)/i);
          if (match) pids.push(parseInt(match[1]));
        } else {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 2 && /claude/.test(line)) {
            pids.push(parseInt(parts[1]));
          }
        }
      });
      resolve(pids);
    });
  });
}

app.get('/api/sessions', async (req, res) => {
  const sessDir = path.join(CLAUDE_DIR, 'sessions');
  const files = safeReadDir(sessDir).filter(f => f.endsWith('.json'));
  const runningPids = await getRunningPids();

  const sessions = files.map(f => {
    const content = safeReadFile(path.join(sessDir, f));
    if (!content) return null;
    try {
      const data = JSON.parse(content);
      const alive = runningPids.includes(data.pid);
      return {
        pid: data.pid,
        sessionId: data.sessionId || '',
        cwd: data.cwd || '',
        startedAt: data.startedAt || 0,
        alive,
        file: f,
      };
    } catch { return null; }
  }).filter(Boolean);

  // Sort: alive first, then by startedAt descending
  sessions.sort((a, b) => {
    if (a.alive !== b.alive) return a.alive ? -1 : 1;
    return b.startedAt - a.startedAt;
  });

  res.json(sessions);
});

// --- API: Skills ---

app.get('/api/skills', (req, res) => {
  const skillsDir = path.join(CLAUDE_DIR, 'skills');
  const dirs = safeReadDir(skillsDir).filter(d => {
    try { return fs.statSync(path.join(skillsDir, d)).isDirectory(); } catch { return false; }
  });
  const skills = dirs.map(d => {
    const file = safeReadFile(path.join(skillsDir, d, 'SKILL.md')) || safeReadFile(path.join(skillsDir, d, 'skill.md'));
    if (!file) return { name: d, description: '', allowedTools: '', argumentHint: '' };
    const { meta } = parseFrontmatter(file);
    return {
      name: meta.name || d,
      description: meta.description || '',
      allowedTools: meta['allowed-tools'] || '',
      argumentHint: meta['argument-hint'] || ''
    };
  });
  res.json(skills);
});

// --- API: Commands ---

app.get('/api/commands', (req, res) => {
  const cmdDir = path.join(CLAUDE_DIR, 'commands');
  const files = safeReadDir(cmdDir).filter(f => f.endsWith('.md'));
  const commands = files.map(f => {
    const content = safeReadFile(path.join(cmdDir, f));
    const name = f.replace('.md', '');
    const firstLine = content ? content.split(/\r?\n/).find(l => l.trim()) : '';
    return { name, description: firstLine || '' };
  });
  res.json(commands);
});

// --- API: Agents ---

app.get('/api/agents', (req, res) => {
  const agentsDir = path.join(CLAUDE_DIR, 'agents');
  const files = safeReadDir(agentsDir).filter(f => f.endsWith('.md'));
  const agents = files.map(f => {
    const content = safeReadFile(path.join(agentsDir, f));
    const name = f.replace('.md', '');
    if (!content) return { name, description: '', model: '' };
    const { meta } = parseFrontmatter(content);
    let desc = meta.description || '';
    // Truncate long descriptions for the card
    if (desc.length > 200) desc = desc.substring(0, desc.indexOf('.', 80) + 1) || desc.substring(0, 200) + '...';
    return { name: meta.name || name, model: meta.model || '', description: desc };
  });
  res.json(agents);
});

// --- API: MCP Servers ---

app.get('/api/mcp', (req, res) => {
  const mcpDir = path.join(CLAUDE_DIR, 'mcp-servers');
  const dirs = safeReadDir(mcpDir).filter(d => {
    try { return fs.statSync(path.join(mcpDir, d)).isDirectory(); } catch { return false; }
  });

  // Also check settings for MCP tool permissions
  const settingsLocal = safeReadFile(path.join(CLAUDE_DIR, 'settings.local.json'));
  const mcpPermissions = [];
  if (settingsLocal) {
    try {
      const parsed = JSON.parse(settingsLocal);
      const perms = parsed?.permissions?.allow || [];
      perms.filter(p => p.startsWith('mcp__')).forEach(p => {
        const parts = p.split('__');
        if (parts.length >= 3) {
          const server = parts[1];
          const tool = parts.slice(2).join('__');
          if (!mcpPermissions.find(m => m.server === server)) {
            mcpPermissions.push({ server, tools: [] });
          }
          const entry = mcpPermissions.find(m => m.server === server);
          entry.tools.push(tool);
        }
      });
    } catch {}
  }

  const servers = dirs.map(d => {
    const perm = mcpPermissions.find(m => m.server === d);
    return { name: d, hasDirectory: true, tools: perm ? perm.tools : [] };
  });

  // Add MCP servers that only appear in permissions
  mcpPermissions.forEach(p => {
    if (!servers.find(s => s.name === p.server)) {
      servers.push({ name: p.server, hasDirectory: false, tools: p.tools });
    }
  });

  res.json(servers);
});

// --- API: Settings ---

app.get('/api/settings/global', (req, res) => {
  const content = safeReadFile(path.join(CLAUDE_DIR, 'settings.json'));
  res.json({ content: content || '{}' });
});

app.put('/api/settings/global', (req, res) => {
  try {
    JSON.parse(req.body.content); // validate JSON
    fs.writeFileSync(path.join(CLAUDE_DIR, 'settings.json'), req.body.content, 'utf-8');
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: 'Invalid JSON: ' + e.message });
  }
});

app.get('/api/settings/local', (req, res) => {
  const content = safeReadFile(path.join(CLAUDE_DIR, 'settings.local.json'));
  res.json({ content: content || '{}' });
});

app.put('/api/settings/local', (req, res) => {
  try {
    JSON.parse(req.body.content);
    fs.writeFileSync(path.join(CLAUDE_DIR, 'settings.local.json'), req.body.content, 'utf-8');
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: 'Invalid JSON: ' + e.message });
  }
});

// --- API: Projects ---

app.get('/api/projects', (req, res) => {
  const projDir = path.join(CLAUDE_DIR, 'projects');
  const dirs = safeReadDir(projDir).filter(d => {
    try { return fs.statSync(path.join(projDir, d)).isDirectory(); } catch { return false; }
  });
  const projects = dirs.map(d => {
    const decoded = decodeProjectPath(d);
    const memDir = path.join(projDir, d, 'memory');
    const hasMemory = fs.existsSync(memDir);
    const settingsFile = path.join(projDir, d, 'settings.json');
    const hasSettings = fs.existsSync(settingsFile);
    return { encoded: d, path: decoded, hasMemory, hasSettings };
  });
  res.json(projects);
});

// --- API: Project Settings ---

app.get('/api/settings/project/:encoded', (req, res) => {
  const settingsFile = path.join(CLAUDE_DIR, 'projects', req.params.encoded, 'settings.json');
  const content = safeReadFile(settingsFile);
  res.json({ content: content || '{}' });
});

app.put('/api/settings/project/:encoded', (req, res) => {
  try {
    JSON.parse(req.body.content);
    const settingsFile = path.join(CLAUDE_DIR, 'projects', req.params.encoded, 'settings.json');
    fs.writeFileSync(settingsFile, req.body.content, 'utf-8');
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: 'Invalid JSON: ' + e.message });
  }
});

// --- API: Memories ---

app.get('/api/memories', (req, res) => {
  const projDir = path.join(CLAUDE_DIR, 'projects');
  const projects = safeReadDir(projDir).filter(d => {
    try { return fs.statSync(path.join(projDir, d)).isDirectory(); } catch { return false; }
  });

  const allMemories = [];
  projects.forEach(proj => {
    const memDir = path.join(projDir, proj, 'memory');
    const files = safeReadDir(memDir).filter(f => f.endsWith('.md'));
    files.forEach(f => {
      const content = safeReadFile(path.join(memDir, f));
      const { meta } = content ? parseFrontmatter(content) : { meta: {} };
      allMemories.push({
        project: proj,
        projectPath: decodeProjectPath(proj),
        file: f,
        name: meta.name || f.replace('.md', ''),
        description: meta.description || '',
        type: meta.type || 'unknown'
      });
    });
  });
  res.json(allMemories);
});

app.get('/api/memory/:project/:file', (req, res) => {
  const filePath = path.join(CLAUDE_DIR, 'projects', req.params.project, 'memory', req.params.file);
  const content = safeReadFile(filePath);
  if (content === null) return res.status(404).json({ error: 'Not found' });
  res.json({ content });
});

app.put('/api/memory/:project/:file', (req, res) => {
  const filePath = path.join(CLAUDE_DIR, 'projects', req.params.project, 'memory', req.params.file);
  try {
    fs.writeFileSync(filePath, req.body.content, 'utf-8');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/memory/:project/:file', (req, res) => {
  const filePath = path.join(CLAUDE_DIR, 'projects', req.params.project, 'memory', req.params.file);
  try {
    fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- API: Create Skill ---

app.post('/api/skills', (req, res) => {
  const { name, description, allowedTools, argumentHint, body } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Skill name is required' });

  const safeName = name.trim().replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
  const skillDir = path.join(CLAUDE_DIR, 'skills', safeName);

  if (fs.existsSync(skillDir)) {
    return res.status(409).json({ error: `Skill "${safeName}" already exists` });
  }

  try {
    fs.mkdirSync(skillDir, { recursive: true });

    let frontmatter = '---\n';
    frontmatter += `name: "${name.trim()}"\n`;
    if (description) frontmatter += `description: "${description.trim()}"\n`;
    if (allowedTools) frontmatter += `allowed-tools: "${allowedTools.trim()}"\n`;
    if (argumentHint) frontmatter += `argument-hint: "${argumentHint.trim()}"\n`;
    frontmatter += '---\n\n';
    frontmatter += body || `# ${name.trim()}\n\nSkill instructions go here.\n`;

    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), frontmatter, 'utf-8');
    res.json({ success: true, name: safeName });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- API: Read Skill Source ---

app.get('/api/skills/:name/source', (req, res) => {
  const skillDir = path.join(CLAUDE_DIR, 'skills', req.params.name);
  const content = safeReadFile(path.join(skillDir, 'SKILL.md')) || safeReadFile(path.join(skillDir, 'skill.md'));
  if (content === null) return res.status(404).json({ error: 'Not found' });
  res.json({ content });
});

// --- API: Create Agent ---

app.post('/api/agents', (req, res) => {
  const { name, model, description, body } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Agent name is required' });

  const safeName = name.trim().replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
  const agentsDir = path.join(CLAUDE_DIR, 'agents');
  const agentFile = path.join(agentsDir, safeName + '.md');

  if (fs.existsSync(agentFile)) {
    return res.status(409).json({ error: `Agent "${safeName}" already exists` });
  }

  try {
    if (!fs.existsSync(agentsDir)) fs.mkdirSync(agentsDir, { recursive: true });

    let frontmatter = '---\n';
    frontmatter += `name: "${name.trim()}"\n`;
    if (model) frontmatter += `model: "${model.trim()}"\n`;
    if (description) frontmatter += `description: "${description.trim()}"\n`;
    frontmatter += '---\n\n';
    frontmatter += body || `# ${name.trim()}\n\nAgent instructions go here.\n`;

    fs.writeFileSync(agentFile, frontmatter, 'utf-8');
    res.json({ success: true, name: safeName });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- API: Read Agent Source ---

app.get('/api/agents/:name/source', (req, res) => {
  const agentFile = path.join(CLAUDE_DIR, 'agents', req.params.name + '.md');
  const content = safeReadFile(agentFile);
  if (content === null) return res.status(404).json({ error: 'Not found' });
  res.json({ content });
});

// --- API: Launch ---

app.post('/api/launch', (req, res) => {
  const { type, name, directory } = req.body;
  // type: 'skill', 'command', 'agent'
  let claudeCmd;
  if (type === 'skill') {
    claudeCmd = `claude "/${name}"`;
  } else if (type === 'command') {
    claudeCmd = `claude "/${name}"`;
  } else if (type === 'agent') {
    claudeCmd = `claude`;
  } else {
    claudeCmd = 'claude';
  }

  const dir = directory || os.homedir();
  let shellCmd;

  if (IS_WIN) {
    const winDir = dir.replace(/\//g, '\\');
    shellCmd = `cmd /c start cmd /k "cd /d ${winDir} && ${claudeCmd}"`;
  } else if (IS_MAC) {
    // Open a new Terminal.app tab
    const script = `tell application "Terminal" to do script "cd '${dir}' && ${claudeCmd}"`;
    shellCmd = `osascript -e '${script}'`;
  } else {
    // Linux: try common terminal emulators
    shellCmd = `x-terminal-emulator -e bash -c "cd '${dir}' && ${claudeCmd}; exec bash" 2>/dev/null || gnome-terminal -- bash -c "cd '${dir}' && ${claudeCmd}; exec bash" 2>/dev/null || xterm -e bash -c "cd '${dir}' && ${claudeCmd}; exec bash"`;
  }

  exec(shellCmd, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// --- API: Browse folder ---

app.post('/api/browse-folder', (req, res) => {
  if (IS_WIN) {
    const psScript = `
      Add-Type -AssemblyName System.Windows.Forms
      $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
      $dialog.Description = "Select project folder"
      $dialog.ShowNewFolderButton = $false
      if ($dialog.ShowDialog() -eq 'OK') {
        Write-Output $dialog.SelectedPath
      }
    `;
    exec(`powershell -Command "${psScript.replace(/\r?\n/g, ' ').replace(/"/g, '\\"')}"`, (err, stdout) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ folder: stdout.trim() || null });
    });
  } else if (IS_MAC) {
    const script = 'osascript -e \'tell application "Finder" to set theFolder to POSIX path of (choose folder with prompt "Select project folder")\' 2>/dev/null';
    exec(script, (err, stdout) => {
      if (err) return res.json({ folder: null }); // User cancelled
      res.json({ folder: stdout.trim() || null });
    });
  } else {
    // Linux: try zenity, kdialog, or return null
    exec('zenity --file-selection --directory --title="Select project folder" 2>/dev/null || kdialog --getexistingdirectory ~ 2>/dev/null', (err, stdout) => {
      if (err) return res.json({ folder: null });
      res.json({ folder: stdout.trim() || null });
    });
  }
});

app.listen(PORT, () => {
  console.log(`\n  Claude Dashboard running at http://localhost:${PORT}\n`);
});
