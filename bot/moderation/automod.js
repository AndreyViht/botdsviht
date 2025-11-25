const fs = require('fs');
const path = require('path');
const db = require('../libs/db');

// Simple auto-moderation: profanity -> delete + temporary timeout
// Bad words are loaded from a separate file `badwords.txt` (one per line).
const BADWORDS_FILE = path.join(__dirname, 'badwords.txt');
const MOD_LOG_CHANNEL = '1441896031531827202'; // channel for moderation logs (as requested)

let currentRegex = null;

function nowIso() { return (new Date()).toISOString(); }

function makeRegexList(words) {
  if (!words || words.length === 0) return null;
  // escape and join
  const esc = words.map(w => w.trim()).filter(Boolean).map(w => w.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'));
  if (esc.length === 0) return null;
  return new RegExp('\\b(' + esc.join('|') + ')\\b', 'iu');
}

function loadBadWords() {
  try {
    if (!fs.existsSync(BADWORDS_FILE)) {
      return [];
    }
    const txt = fs.readFileSync(BADWORDS_FILE, 'utf8');
    const lines = txt.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    return lines;
  } catch (e) {
    console.warn('Failed to load badwords file', e && e.message ? e.message : e);
    return [];
  }
}

async function logAction(client, record) {
  try {
    const all = db.get && db.get('modLogs') ? db.get('modLogs') : [];
    const arr = Array.isArray(all) ? all : [];
    arr.push(record);
    await db.set('modLogs', arr);
  } catch (e) {
    console.warn('Failed to write mod log to DB', e && e.message ? e.message : e);
  }

  try {
    const ch = await client.channels.fetch(MOD_LOG_CHANNEL).catch(() => null);
    if (ch && ch.isTextBased && ch.isTextBased()) {
      ch.send({ content: `Модерация: ${record.action} ${record.userTag} (${record.userId}) by ${record.moderatorTag || 'auto'} — ${record.reason}` }).catch(()=>{});
    }
  } catch (e) {
    console.warn('Failed to send mod log message', e && e.message ? e.message : e);
  }
}

function watchBadWordsFile() {
  // initial load
  const words = loadBadWords();
  currentRegex = makeRegexList(words);
  console.log('automod: loaded', words.length, 'bad words from', BADWORDS_FILE);

  // watch file for changes
  fs.watchFile(BADWORDS_FILE, { interval: 2000 }, (curr, prev) => {
    try {
      const newWords = loadBadWords();
      currentRegex = makeRegexList(newWords);
      console.log('automod: reloaded badwords.txt, new count', newWords.length);
    } catch (e) {
      console.warn('automod: error reloading badwords', e && e.message ? e.message : e);
    }
  });
}

function initAutomod(client, opts = {}) {
  console.log('automod: initializing');
  watchBadWordsFile();

  client.on('messageCreate', async (message) => {
    try {
      if (!message) { console.log('automod: messageCreate with no message'); return; }
      if (message.author?.bot) { /* ignore bots */ return; }
      if (!message.content || !message.content.trim()) { console.log('automod: skipping empty content or attachments-only', { id: message.id, channel: message.channelId }); return; }
      if (!currentRegex) { console.log('automod: no badwords configured, skipping'); return; }
      if (message.content.includes('```')) { console.log('automod: skipping code block message', { id: message.id }); return; }

      const matched = currentRegex.test(message.content);
      if (!matched) { /* no match */ return; }

      // debug log for troubleshooting
      try {
        console.log(`[automod] matched profanity in guild=${message.guildId} channel=${message.channelId} user=${message.author.id} content="${message.content.slice(0,60).replace(/\n/g,' ')}"`);
      } catch (e) {}

      // debug log for troubleshooting
      try {
        console.log(`[automod] matched profanity in guild=${message.guildId} channel=${message.channelId} user=${message.author.id} content="${message.content.slice(0,60).replace(/\n/g,' ')}"`);
      } catch (e) {}

      const member = message.member;
      const guild = message.guild;
      const reason = 'Automod: profanity detected';

      try {
        await message.delete();
        console.log('automod: deleted message', { id: message.id, channel: message.channelId });
      } catch (e) {
        console.warn('automod: failed to delete message', e && e.message ? e.message : e);
      }

      try {
        if (member) {
          console.log('automod: member info', { id: member.id, manageable: member.manageable, moderatable: member.moderatable, hasTimeout: typeof member.timeout === 'function' });
        }
        if (member && typeof member.timeout === 'function') {
          await member.timeout(3 * 60 * 1000, reason);
          console.log('automod: applied timeout to', member.id);
        } else {
          const muteRole = guild.roles.cache.find(r => r.name.toLowerCase().includes('muted'));
          if (muteRole && member) {
            await member.roles.add(muteRole, reason);
            console.log('automod: added mute role to', member.id, 'roleId', muteRole.id);
          } else {
            console.warn('automod: cannot timeout or find mute role for', member && member.id);
          }
        }
      } catch (e) {
        console.warn('automod: Failed to timeout/add role to member', e && e.message ? e.message : e);
      }

      try { await message.author.send('Вам был выдан мут на 3 минуты за использование запрещённой лексики. Пожалуйста, соблюдайте правила сервера.').catch(()=>{}); } catch (e) {}

      const rec = {
        timestamp: nowIso(),
        action: 'timeout',
        userId: message.author.id,
        userTag: `${message.author.username}#${message.author.discriminator}`,
        moderatorTag: 'automod',
        reason,
        content: message.content.slice(0, 400)
      };
      await logAction(client, rec).catch(()=>{});

    } catch (e) {
      console.error('automod error', e && e.message ? e.message : e);
    }
  });
}

module.exports = { initAutomod };
