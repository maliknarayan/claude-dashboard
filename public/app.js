// --- State ---
let state = {
  skills: [],
  commands: [],
  agents: [],
  mcp: [],
  projects: [],
  memories: [],
  sessions: [],
  currentPage: 'overview',
  settingsTab: 'global',
  settingsContent: {},
  searchQuery: '',
  pageFilter: '',
  system: { homeDir: '', platform: 'win32', claudeExists: true },
};

let runningRefreshTimer = null;

// --- API ---
async function api(url, opts) {
  const res = await fetch(url, opts);
  return res.json();
}

async function loadAll() {
  const [skills, commands, agents, mcp, projects, memories, sessions, system] = await Promise.all([
    api('/api/skills'),
    api('/api/commands'),
    api('/api/agents'),
    api('/api/mcp'),
    api('/api/projects'),
    api('/api/memories'),
    api('/api/sessions'),
    api('/api/system'),
  ]);
  state.skills = skills;
  state.commands = commands;
  state.agents = agents;
  state.mcp = mcp;
  state.projects = projects;
  state.memories = memories;
  state.sessions = sessions;
  state.system = system;

  if (!system.claudeExists) {
    showToast('Claude Code config directory (~/.claude) not found. Install and run Claude Code first.', 'error');
  }

  updateBadges();
}

async function refreshSessions() {
  state.sessions = await api('/api/sessions');
  updateBadges();
  if (state.currentPage === 'running') renderPage();
}

function updateBadges() {
  document.getElementById('badge-skills').textContent = state.skills.length;
  document.getElementById('badge-commands').textContent = state.commands.length;
  document.getElementById('badge-agents').textContent = state.agents.length;
  document.getElementById('badge-mcp').textContent = state.mcp.length;
  document.getElementById('badge-memories').textContent = state.memories.length;
  const aliveCount = state.sessions.filter(s => s.alive).length;
  const badge = document.getElementById('badge-running');
  badge.textContent = aliveCount;
  badge.classList.toggle('badge-live', aliveCount > 0);
}

// --- Toast ---
function showToast(message, type = 'success') {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = `toast ${type}`;
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// --- Search / Filter ---
function matchesSearch(item, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  const fields = Object.values(item).filter(v => typeof v === 'string');
  return fields.some(f => f.toLowerCase().includes(q));
}

function filterList(list, query) {
  if (!query) return list;
  return list.filter(item => matchesSearch(item, query));
}

function getEffectiveFilter() {
  return state.pageFilter || state.searchQuery;
}

// Global search input
document.getElementById('global-search').addEventListener('input', (e) => {
  state.searchQuery = e.target.value.trim();
  state.pageFilter = '';
  renderPage();
});

// Keyboard shortcut: Ctrl+K to focus search
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    document.getElementById('global-search').focus();
  }
  if (e.key === 'Escape') {
    document.getElementById('global-search').blur();
  }
});

// --- Navigation ---
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    state.currentPage = item.dataset.page;
    state.pageFilter = '';
    // Manage auto-refresh for running page
    if (runningRefreshTimer) { clearInterval(runningRefreshTimer); runningRefreshTimer = null; }
    if (state.currentPage === 'running') {
      runningRefreshTimer = setInterval(refreshSessions, 5000);
    }
    renderPage();
  });
});

// --- Render ---
function renderPage() {
  const main = document.getElementById('main-content');
  switch (state.currentPage) {
    case 'overview': return renderOverview(main);
    case 'skills': return renderSkills(main);
    case 'commands': return renderCommands(main);
    case 'agents': return renderAgents(main);
    case 'mcp': return renderMcp(main);
    case 'running': return renderRunning(main);
    case 'settings': return renderSettings(main);
    case 'memories': return renderMemories(main);
  }
}

// --- Page Filter HTML ---
function pageFilterHTML(placeholder) {
  return `
    <div class="page-filter">
      <input type="text" id="page-filter-input" placeholder="${placeholder}" value="${escAttr(state.pageFilter || state.searchQuery)}">
    </div>
  `;
}

function bindPageFilter(el) {
  const input = el.querySelector('#page-filter-input');
  if (input) {
    input.addEventListener('input', (e) => {
      state.pageFilter = e.target.value.trim();
      renderPage();
      // Restore focus after re-render
      const newInput = document.getElementById('page-filter-input');
      if (newInput) {
        newInput.focus();
        newInput.selectionStart = newInput.selectionEnd = newInput.value.length;
      }
    });
  }
}

// --- No Results HTML ---
function noResultsHTML(query) {
  return `<div class="no-results">No results matching "${escHtml(query)}"</div>`;
}

// --- Overview ---
function renderOverview(el) {
  const q = getEffectiveFilter();
  const filteredSkills = filterList(state.skills, q);
  const filteredCommands = filterList(state.commands, q);
  const filteredAgents = filterList(state.agents, q);
  const filteredMcp = filterList(state.mcp, q);
  const filteredProjects = filterList(state.projects, q);
  const filteredMemories = filterList(state.memories, q);

  el.innerHTML = `
    <h1 class="page-title">Dashboard</h1>
    <p class="page-subtitle">Your Claude Code configuration at a glance</p>
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-number">${state.skills.length}</div>
        <div class="stat-label">Skills</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${state.commands.length}</div>
        <div class="stat-label">Commands</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${state.agents.length}</div>
        <div class="stat-label">Agents</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${state.mcp.length}</div>
        <div class="stat-label">MCP Servers</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${state.projects.length}</div>
        <div class="stat-label">Projects</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${state.memories.length}</div>
        <div class="stat-label">Memories</div>
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">Quick Launch</h2>
      <div class="cards">
        ${filteredSkills.slice(0, 6).map(s => cardHTML(s.name, s.description, 'skill')).join('')}
      </div>
      ${filteredSkills.length === 0 && q ? noResultsHTML(q) : ''}
    </div>

    <div class="section">
      <h2 class="section-title">Projects</h2>
      <div class="memory-list">
        ${filteredProjects.map(p => `
          <div class="memory-item" style="cursor:default">
            <div class="memory-info">
              <div class="memory-name">${escHtml(p.path)}</div>
              <div class="memory-desc">${p.hasMemory ? 'Has memory' : ''} ${p.hasSettings ? '| Has settings' : ''}</div>
            </div>
          </div>
        `).join('')}
        ${filteredProjects.length === 0 && q ? noResultsHTML(q) : ''}
      </div>
    </div>
  `;
  bindCardClicks(el);
}

// --- Skills ---
function renderSkills(el) {
  const q = getEffectiveFilter();
  const filtered = filterList(state.skills, q);

  el.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Skills</h1>
      <button class="btn btn-primary" id="btn-create-skill">+ New Skill</button>
    </div>
    <p class="page-subtitle">Slash commands — click to launch in terminal</p>
    ${pageFilterHTML('Filter skills...')}
    <div class="cards">
      ${filtered.map(s => {
        let tags = '';
        if (s.allowedTools) tags += s.allowedTools.split(',').map(t => `<span class="tag tools">${t.trim()}</span>`).join('');
        if (s.argumentHint) tags += `<span class="tag">${escHtml(s.argumentHint)}</span>`;
        return cardHTML(s.name, s.description, 'skill', tags);
      }).join('')}
    </div>
    ${filtered.length === 0 ? (q ? noResultsHTML(q) : '<div class="empty-state"><div class="empty-icon">&#9889;</div><p>No skills yet. Create your first one!</p></div>') : ''}
  `;
  bindCardClicks(el);
  bindPageFilter(el);

  document.getElementById('btn-create-skill').addEventListener('click', () => {
    openCreateSkillModal();
  });
}

// --- Commands ---
function renderCommands(el) {
  const q = getEffectiveFilter();
  const filtered = filterList(state.commands, q);

  el.innerHTML = `
    <h1 class="page-title">Commands</h1>
    <p class="page-subtitle">Custom commands — click to launch in terminal</p>
    ${pageFilterHTML('Filter commands...')}
    <div class="cards">
      ${filtered.map(c => cardHTML(c.name, c.description, 'command')).join('')}
    </div>
    ${filtered.length === 0 ? (q ? noResultsHTML(q) : '<div class="empty-state"><div class="empty-icon">&#9654;</div><p>No commands found.</p></div>') : ''}
  `;
  bindCardClicks(el);
  bindPageFilter(el);
}

// --- Agents ---
function renderAgents(el) {
  const q = getEffectiveFilter();
  const filtered = filterList(state.agents, q);

  el.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Agents</h1>
      <button class="btn btn-primary" id="btn-create-agent">+ New Agent</button>
    </div>
    <p class="page-subtitle">Specialized agents — click to launch in terminal</p>
    ${pageFilterHTML('Filter agents...')}
    <div class="cards">
      ${filtered.map(a => {
        const tags = a.model ? `<span class="tag model">${a.model}</span>` : '';
        return cardHTML(a.name, a.description, 'agent', tags);
      }).join('')}
    </div>
    ${filtered.length === 0 ? (q ? noResultsHTML(q) : '<div class="empty-state"><div class="empty-icon">&#9881;</div><p>No agents yet. Create your first one!</p></div>') : ''}
  `;
  bindCardClicks(el);
  bindPageFilter(el);

  document.getElementById('btn-create-agent').addEventListener('click', () => {
    openCreateAgentModal();
  });
}

// --- MCP Servers ---
function renderMcp(el) {
  const q = getEffectiveFilter();
  const filtered = filterList(state.mcp, q);

  el.innerHTML = `
    <h1 class="page-title">MCP Servers</h1>
    <p class="page-subtitle">Connected Model Context Protocol servers</p>
    ${pageFilterHTML('Filter MCP servers...')}
    <div class="cards">
      ${filtered.map(m => `
        <div class="card" style="cursor:default">
          <div class="card-header">
            <div class="card-icon mcp">&#9729;</div>
            <div class="card-name">${escHtml(m.name)}</div>
          </div>
          <div class="card-tags">
            <span class="tag">${m.hasDirectory ? 'local server' : 'external'}</span>
            <span class="tag">${m.tools.length} tools</span>
          </div>
          ${m.tools.length ? `
            <div class="mcp-tools">
              <div class="mcp-tools-title">Available Tools</div>
              <div class="mcp-tool-list">
                ${m.tools.map(t => `<span class="mcp-tool">${escHtml(t)}</span>`).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      `).join('')}
    </div>
    ${filtered.length === 0 ? (q ? noResultsHTML(q) : '<div class="empty-state"><div class="empty-icon">&#9729;</div><p>No MCP servers found.</p></div>') : ''}
  `;
  bindPageFilter(el);
}

// --- Running Sessions ---
function renderRunning(el) {
  const q = getEffectiveFilter();
  const alive = state.sessions.filter(s => s.alive);
  const dead = state.sessions.filter(s => !s.alive);
  const filteredAlive = filterList(alive, q);
  const filteredDead = filterList(dead, q);

  function sessionCardHTML(s) {
    const startDate = s.startedAt ? new Date(s.startedAt) : null;
    const timeStr = startDate ? startDate.toLocaleString() : 'Unknown';
    const uptime = startDate ? formatUptime(Date.now() - s.startedAt) : '';
    const folder = s.cwd ? s.cwd.replace(/\\\\/g, '\\') : 'Unknown';
    const folderName = folder.split('\\').pop() || folder.split('/').pop() || folder;
    const statusClass = s.alive ? 'alive' : 'dead';
    const statusLabel = s.alive ? 'Active' : 'Stopped';

    return `
      <div class="session-card ${statusClass}">
        <div class="session-header">
          <div class="session-status ${statusClass}">
            <span class="status-dot"></span>
            ${statusLabel}
          </div>
          <span class="session-pid">PID ${s.pid}</span>
        </div>
        <div class="session-project">${escHtml(folderName)}</div>
        <div class="session-path">${escHtml(folder)}</div>
        <div class="session-meta">
          <span>Started: ${escHtml(timeStr)}</span>
          ${s.alive && uptime ? `<span>Uptime: ${escHtml(uptime)}</span>` : ''}
        </div>
        ${s.sessionId ? `<div class="session-id">Session: ${escHtml(s.sessionId.substring(0, 8))}...</div>` : ''}
      </div>
    `;
  }

  el.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Running Sessions</h1>
      <div class="running-refresh">
        <span class="refresh-indicator"></span>
        <span class="refresh-label">Auto-refresh every 5s</span>
      </div>
    </div>
    <p class="page-subtitle">Active and recent Claude Code sessions</p>
    ${pageFilterHTML('Filter sessions...')}

    <div class="section">
      <h2 class="section-title">
        <span class="status-dot alive-dot"></span>
        Active (${alive.length})
      </h2>
      ${filteredAlive.length > 0 ? `
        <div class="session-grid">
          ${filteredAlive.map(sessionCardHTML).join('')}
        </div>
      ` : `
        <div class="empty-state" style="padding:30px">
          <p>No active Claude sessions</p>
        </div>
      `}
    </div>

    ${filteredDead.length > 0 ? `
      <div class="section">
        <h2 class="section-title">
          <span class="status-dot dead-dot"></span>
          Recent / Stopped (${dead.length})
        </h2>
        <div class="session-grid">
          ${filteredDead.map(sessionCardHTML).join('')}
        </div>
      </div>
    ` : ''}
  `;
  bindPageFilter(el);
}

function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

// --- Settings ---
async function renderSettings(el) {
  el.innerHTML = `
    <h1 class="page-title">Settings</h1>
    <p class="page-subtitle">Edit Claude Code configuration files</p>
    <div class="editor-container">
      <div class="editor-tabs">
        <div class="editor-tab ${state.settingsTab === 'global' ? 'active' : ''}" data-tab="global">Global (settings.json)</div>
        <div class="editor-tab ${state.settingsTab === 'local' ? 'active' : ''}" data-tab="local">Local (settings.local.json)</div>
        ${state.projects.filter(p => p.hasSettings).map(p => `
          <div class="editor-tab ${state.settingsTab === p.encoded ? 'active' : ''}" data-tab="${p.encoded}" data-project="true">${escHtml(p.path.split('\\').pop() || p.path)}</div>
        `).join('')}
      </div>
      <div class="editor-body">
        <textarea id="settings-editor" spellcheck="false"></textarea>
      </div>
      <div class="editor-footer">
        <span class="status-msg" id="settings-status"></span>
        <button class="btn btn-primary" id="settings-save">Save Changes</button>
      </div>
    </div>
  `;

  await loadSettingsTab(state.settingsTab);

  el.querySelectorAll('.editor-tab').forEach(tab => {
    tab.addEventListener('click', async () => {
      el.querySelectorAll('.editor-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.settingsTab = tab.dataset.tab;
      await loadSettingsTab(state.settingsTab);
    });
  });

  document.getElementById('settings-save').addEventListener('click', async () => {
    const content = document.getElementById('settings-editor').value;
    let url;
    if (state.settingsTab === 'global') url = '/api/settings/global';
    else if (state.settingsTab === 'local') url = '/api/settings/local';
    else url = `/api/settings/project/${state.settingsTab}`;

    const res = await api(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });

    if (res.success) {
      showToast('Settings saved successfully', 'success');
    } else {
      showToast(res.error || 'Failed to save', 'error');
    }
  });
}

async function loadSettingsTab(tab) {
  let url;
  if (tab === 'global') url = '/api/settings/global';
  else if (tab === 'local') url = '/api/settings/local';
  else url = `/api/settings/project/${tab}`;

  const data = await api(url);
  try {
    const formatted = JSON.stringify(JSON.parse(data.content), null, 2);
    document.getElementById('settings-editor').value = formatted;
  } catch {
    document.getElementById('settings-editor').value = data.content;
  }
}

// --- Memories ---
function renderMemories(el) {
  const q = getEffectiveFilter();
  const filtered = filterList(state.memories, q);

  el.innerHTML = `
    <h1 class="page-title">Memories</h1>
    <p class="page-subtitle">Persistent memory entries across projects — click to edit</p>
    ${pageFilterHTML('Filter memories...')}
    <div class="memory-list">
      ${filtered.map(m => `
        <div class="memory-item" data-project="${m.project}" data-file="${m.file}">
          <span class="memory-type-badge ${m.type}">${m.type}</span>
          <div class="memory-info">
            <div class="memory-name">${escHtml(m.name)}</div>
            <div class="memory-desc">${escHtml(m.description)}</div>
            <div class="memory-project">${escHtml(m.projectPath)}</div>
          </div>
          <div class="memory-actions">
            <button class="btn btn-secondary btn-edit-mem">Edit</button>
            <button class="btn btn-danger btn-del-mem">Del</button>
          </div>
        </div>
      `).join('')}
      ${filtered.length === 0 ? (q ? noResultsHTML(q) : '<p style="color:var(--text-muted);padding:20px">No memories found.</p>') : ''}
    </div>
  `;
  bindPageFilter(el);

  el.querySelectorAll('.memory-item').forEach(item => {
    const project = item.dataset.project;
    const file = item.dataset.file;

    item.querySelector('.btn-edit-mem').addEventListener('click', async (e) => {
      e.stopPropagation();
      const data = await api(`/api/memory/${project}/${file}`);
      openMemoryModal(project, file, data.content);
    });

    item.querySelector('.btn-del-mem').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`Delete memory "${file}"?`)) return;
      await api(`/api/memory/${project}/${file}`, { method: 'DELETE' });
      await loadAll();
      renderPage();
      showToast('Memory deleted', 'success');
    });
  });
}

// --- Memory Modal ---
function openMemoryModal(project, file, content) {
  const modal = document.getElementById('memory-modal');
  document.getElementById('mem-modal-title').textContent = `Edit: ${file}`;
  document.getElementById('mem-modal-desc').textContent = `Project: ${project}`;
  document.getElementById('mem-modal-editor').value = content;
  modal.classList.add('show');

  const cleanup = () => {
    modal.classList.remove('show');
    document.getElementById('mem-modal-save').replaceWith(document.getElementById('mem-modal-save').cloneNode(true));
    document.getElementById('mem-modal-delete').replaceWith(document.getElementById('mem-modal-delete').cloneNode(true));
    document.getElementById('mem-modal-cancel').replaceWith(document.getElementById('mem-modal-cancel').cloneNode(true));
  };

  document.getElementById('mem-modal-cancel').addEventListener('click', cleanup);

  document.getElementById('mem-modal-save').addEventListener('click', async () => {
    const newContent = document.getElementById('mem-modal-editor').value;
    await api(`/api/memory/${project}/${file}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newContent })
    });
    cleanup();
    await loadAll();
    renderPage();
    showToast('Memory updated', 'success');
  });

  document.getElementById('mem-modal-delete').addEventListener('click', async () => {
    if (!confirm(`Delete memory "${file}"?`)) return;
    await api(`/api/memory/${project}/${file}`, { method: 'DELETE' });
    cleanup();
    await loadAll();
    renderPage();
    showToast('Memory deleted', 'success');
  });
}

// --- Create Skill Modal ---
function openCreateSkillModal() {
  const modal = document.getElementById('create-skill-modal');
  modal.querySelector('#skill-name').value = '';
  modal.querySelector('#skill-desc').value = '';
  modal.querySelector('#skill-tools').value = '';
  modal.querySelector('#skill-hint').value = '';
  modal.querySelector('#skill-body').value = '';
  modal.classList.add('show');

  const cleanup = () => {
    modal.classList.remove('show');
    cloneReplace('create-skill-save');
    cloneReplace('create-skill-cancel');
  };

  document.getElementById('create-skill-cancel').addEventListener('click', cleanup);

  document.getElementById('create-skill-save').addEventListener('click', async () => {
    const name = modal.querySelector('#skill-name').value.trim();
    if (!name) {
      showToast('Skill name is required', 'error');
      return;
    }

    const payload = {
      name,
      description: modal.querySelector('#skill-desc').value.trim(),
      allowedTools: modal.querySelector('#skill-tools').value.trim(),
      argumentHint: modal.querySelector('#skill-hint').value.trim(),
      body: modal.querySelector('#skill-body').value,
    };

    const res = await api('/api/skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.success) {
      cleanup();
      await loadAll();
      renderPage();
      showToast(`Skill "${name}" created!`, 'success');
    } else {
      showToast(res.error || 'Failed to create skill', 'error');
    }
  });
}

// --- Create Agent Modal ---
function openCreateAgentModal() {
  const modal = document.getElementById('create-agent-modal');
  modal.querySelector('#agent-name').value = '';
  modal.querySelector('#agent-model').value = '';
  modal.querySelector('#agent-desc').value = '';
  modal.querySelector('#agent-body').value = '';
  modal.classList.add('show');

  const cleanup = () => {
    modal.classList.remove('show');
    cloneReplace('create-agent-save');
    cloneReplace('create-agent-cancel');
  };

  document.getElementById('create-agent-cancel').addEventListener('click', cleanup);

  document.getElementById('create-agent-save').addEventListener('click', async () => {
    const name = modal.querySelector('#agent-name').value.trim();
    if (!name) {
      showToast('Agent name is required', 'error');
      return;
    }

    const payload = {
      name,
      model: modal.querySelector('#agent-model').value,
      description: modal.querySelector('#agent-desc').value.trim(),
      body: modal.querySelector('#agent-body').value,
    };

    const res = await api('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.success) {
      cleanup();
      await loadAll();
      renderPage();
      showToast(`Agent "${name}" created!`, 'success');
    } else {
      showToast(res.error || 'Failed to create agent', 'error');
    }
  });
}

// --- Card HTML ---
function cardHTML(name, description, type, extraTags = '') {
  const icons = { skill: '&#9889;', command: '&#9654;', agent: '&#9881;' };
  return `
    <div class="card" data-type="${type}" data-name="${escAttr(name)}">
      <div class="card-header">
        <div class="card-icon ${type}">${icons[type] || ''}</div>
        <div class="card-name">${escHtml(name)}</div>
      </div>
      <div class="card-desc">${escHtml(description)}</div>
      ${extraTags ? `<div class="card-tags">${extraTags}</div>` : ''}
    </div>
  `;
}

function bindCardClicks(container) {
  container.querySelectorAll('.card[data-type]').forEach(card => {
    card.addEventListener('click', () => {
      openLaunchModal(card.dataset.type, card.dataset.name);
    });
  });
}

// --- Launch Modal ---
function openLaunchModal(type, name) {
  const modal = document.getElementById('launch-modal');
  const typeLabel = { skill: 'Skill', command: 'Command', agent: 'Agent' };
  document.getElementById('modal-title').textContent = `Launch: /${name}`;
  document.getElementById('modal-desc').textContent = `Open a new terminal with this ${typeLabel[type] || type}`;
  document.getElementById('modal-folder').value = state.system.homeDir || '';
  modal.classList.add('show');

  const cleanup = () => {
    modal.classList.remove('show');
    ['modal-browse', 'modal-cancel', 'modal-launch'].forEach(id => cloneReplace(id));
  };

  document.getElementById('modal-cancel').addEventListener('click', cleanup);

  document.getElementById('modal-browse').addEventListener('click', async () => {
    const res = await api('/api/browse-folder', { method: 'POST' });
    if (res.folder) {
      document.getElementById('modal-folder').value = res.folder;
    }
  });

  document.getElementById('modal-launch').addEventListener('click', async () => {
    const directory = document.getElementById('modal-folder').value;
    await api('/api/launch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, name, directory })
    });
    cleanup();
    showToast(`Launched /${name}`, 'success');
  });
}

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('show');
  });
});

// --- Helpers ---
function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escAttr(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function cloneReplace(id) {
  const el = document.getElementById(id);
  if (el) el.replaceWith(el.cloneNode(true));
}

// --- Init ---
(async () => {
  await loadAll();
  renderPage();
})();
