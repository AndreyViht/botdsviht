(() => {
  let token = '';
  const tInput = document.getElementById('token');
  const authBtn = document.getElementById('auth');
  const main = document.getElementById('main');
  const saveBtn = document.getElementById('saveSettings');
  const sendWelcomeBtn = document.getElementById('sendWelcome');
  const saveStatus = document.getElementById('saveStatus');
  const statsArea = document.getElementById('statsArea');
  const dbArea = document.getElementById('dbArea');
  const commandsList = document.getElementById('commandsList');
  const addCmdBtn = document.getElementById('addCmd');

  function api(path, opts = {}) {
    opts.headers = opts.headers || {};
    opts.headers['x-dashboard-token'] = token;
    return fetch(path, opts).then(async r => {
      const txt = await r.text();
      try { return JSON.parse(txt); } catch { return txt; }
    });
  }

  authBtn.addEventListener('click', async () => {
    token = tInput.value.trim();
    if (!token) { alert('Введите токен'); return; }
    try {
      const s = await api('/api/settings');
      if (s && s.error) throw new Error(s.error);
      document.getElementById('welcomeChannel').value = s.welcomeChannelId || '';
      document.getElementById('announceChannel').value = s.announceChannelId || '';
      document.getElementById('aiChannel').value = s.aiChatChannelId || '';
      document.getElementById('subscriberRole').value = s.subscriberRoleId || '';
      main.style.display = 'block';
      saveStatus.textContent = '';
      loadStats(); loadDb(); loadCommands();
    } catch (e) {
      alert('Auth failed: ' + (e.message || JSON.stringify(e)));
    }
  });

  saveBtn.addEventListener('click', async () => {
    const body = {
      welcomeChannelId: document.getElementById('welcomeChannel').value.trim(),
      announceChannelId: document.getElementById('announceChannel').value.trim(),
      aiChatChannelId: document.getElementById('aiChannel').value.trim(),
      subscriberRoleId: document.getElementById('subscriberRole').value.trim()
    };
    saveStatus.textContent = 'Сохранение...';
    try {
      const r = await api('/api/settings', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
      if (r && r.ok) { saveStatus.textContent = 'Сохранено'; setTimeout(() => saveStatus.textContent = '', 2000); }
      else saveStatus.textContent = 'Ошибка сохранения';
    } catch (e) { saveStatus.textContent = 'Ошибка: ' + (e.message || e); }
  });

  sendWelcomeBtn.addEventListener('click', async () => {
    try {
      const r = await api('/api/welcome/send', { method: 'POST', body: JSON.stringify({ requestedBy: 'dashboard' }), headers: { 'Content-Type': 'application/json' } });
      if (r && r.ok) { alert('Запрошена отправка приветствия'); }
      else alert('Ошибка: ' + JSON.stringify(r));
    } catch (e) { alert('Ошибка: ' + (e.message || e)); }
  });

  async function loadStats() { try { const s = await api('/api/stats'); statsArea.textContent = JSON.stringify(s, null, 2); } catch (e) { statsArea.textContent = 'Ошибка: ' + (e.message || e); } }
  async function loadDb() { try { const d = await api('/api/db'); dbArea.textContent = JSON.stringify(d, null, 2); } catch (e) { dbArea.textContent = 'Ошибка: ' + (e.message || e); } }

  async function loadCommands() {
    try {
      const list = await api('/api/commands');
      commandsList.innerHTML = '';
      if (!Array.isArray(list) || list.length === 0) { commandsList.innerHTML = '<div class="small">Нет команд</div>'; return; }
      for (const c of list) {
        const el = document.createElement('div'); el.className = 'cmd-item';
        const left = document.createElement('div');
        left.innerHTML = `<div class="cmd-name">/${c.name}</div><div class="cmd-desc">${c.description || ''}</div>`;
        const right = document.createElement('div');
        const btnDel = document.createElement('button'); btnDel.className = 'btn'; btnDel.textContent = 'Удалить'; btnDel.style.background = '#d35400';
        btnDel.onclick = async () => { if (!confirm('Удалить команду ' + c.name + '?')) return; await api('/api/commands/' + encodeURIComponent(c.name), { method: 'DELETE' }); loadCommands(); };
        const btnUse = document.createElement('button'); btnUse.className = 'btn'; btnUse.textContent = 'Загрузить'; btnUse.style.marginRight = '8px';
        btnUse.onclick = () => { document.getElementById('cmdName').value = c.name; document.getElementById('cmdDesc').value = c.description || ''; document.getElementById('cmdResp').value = c.response || ''; };
        right.appendChild(btnUse); right.appendChild(btnDel);
        el.appendChild(left); el.appendChild(right); commandsList.appendChild(el);
      }
    } catch (e) { commandsList.innerHTML = '<div class="small">Ошибка загрузки команд</div>'; }
  }

  addCmdBtn.addEventListener('click', async () => {
    const name = document.getElementById('cmdName').value.trim();
    const desc = document.getElementById('cmdDesc').value.trim();
    const resp = document.getElementById('cmdResp').value.trim();
    if (!name || !resp) { alert('Имя и ответ обязательны'); return; }
    try {
      await api('/api/commands', { method: 'POST', body: JSON.stringify({ name, description: desc, response: resp }), headers: { 'Content-Type': 'application/json' } });
      alert('Сохранено');
      document.getElementById('cmdName').value = ''; document.getElementById('cmdDesc').value = ''; document.getElementById('cmdResp').value = '';
      loadCommands();
    } catch (e) { alert('Ошибка: ' + (e.message || e)); }
  });

})();
