const express = require('express');
const { dashboardPort } = require('../bot/config');
const path = require('path');
const db = require('../bot/libs/db');

const app = express();
app.use(express.json());

// simple token auth middleware: token can be sent via header 'x-dashboard-token' or ?token=
const DASH_TOKEN = process.env.DASH_TOKEN || null;
function requireToken(req, res, next) {
  const token = req.get('x-dashboard-token') || req.query.token;
  if (!token || !DASH_TOKEN || token !== DASH_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// serve static UI
app.use('/', express.static(path.join(__dirname, 'public')));

// API: get settings
app.get('/api/settings', requireToken, (req, res) => {
  const data = db.all ? db.all() : {};
  res.json(data.settings || {});
});

// API: update settings (saves to db.json)
app.post('/api/settings', requireToken, async (req, res) => {
  const body = req.body || {};
  try {
    await db.set('settings', body);
    return res.json({ ok: true, settings: body });
  } catch (e) {
    console.error('Failed to save settings from dashboard', e && e.message ? e.message : e);
    return res.status(500).json({ error: 'Failed to save' });
  }
});

// API: trigger welcome message — sets a request flag in db that the bot polls
app.post('/api/welcome/send', requireToken, async (req, res) => {
  try {
    const ts = Date.now();
    await db.set('welcomeRequest', { requestedAt: ts, requestedBy: req.body.requestedBy || 'dashboard' });
    return res.json({ ok: true, requestedAt: ts });
  } catch (e) {
    console.error('Failed to set welcomeRequest', e && e.message ? e.message : e);
    return res.status(500).json({ error: 'Failed' });
  }
});

// API: simple stats
app.get('/api/stats', requireToken, (req, res) => {
  const data = db.all ? db.all() : {};
  res.json(data.stats || {});
});

// API: read db (for admin; small sites only)
app.get('/api/db', requireToken, (req, res) => {
  const data = db.all ? db.all() : {};
  res.json(data);
});

// API: manage simple custom commands stored in db.settings.commands
app.get('/api/commands', requireToken, (req, res) => {
  const data = db.all ? db.all() : {};
  const cmds = (data.settings && data.settings.commands) || [];
  res.json(cmds);
});

app.post('/api/commands', requireToken, async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.name || !body.response) return res.status(400).json({ error: 'name and response required' });
    const data = db.all ? db.all() : {};
    const settings = data.settings || {};
    settings.commands = settings.commands || [];
    // replace if exists
    const existing = settings.commands.find(c => c.name === body.name);
    if (existing) {
      existing.description = body.description || existing.description;
      existing.response = body.response;
    } else {
      settings.commands.push({ name: body.name, description: body.description || '', response: body.response });
    }
    await db.set('settings', settings);
    return res.json({ ok: true, commands: settings.commands });
  } catch (e) {
    console.error('Failed to save command', e);
    return res.status(500).json({ error: 'Failed' });
  }
});

app.delete('/api/commands/:name', requireToken, async (req, res) => {
  try {
    const name = req.params.name;
    const data = db.all ? db.all() : {};
    const settings = data.settings || {};
    settings.commands = (settings.commands || []).filter(c => c.name !== name);
    await db.set('settings', settings);
    return res.json({ ok: true, commands: settings.commands });
  } catch (e) {
    console.error('Failed to delete command', e);
    return res.status(500).json({ error: 'Failed' });
  }
});

app.get('/', (req, res) => {
  const data = db.all ? db.all() : {};
  res.send(`<h1>Viht VPN Bot Dashboard</h1>
    <p>AI requests: ${data.stats ? data.stats.aiRequests : 0}</p>
    <p>Welcome message: ${JSON.stringify(data.welcome || {})}</p>
    <p>Use endpoints /stats and /toggle (future)</p>
  `);
});

app.listen(dashboardPort, () => console.log('Dashboard running on port', dashboardPort));

