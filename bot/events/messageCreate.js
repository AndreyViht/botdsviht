const { InteractionType } = require('discord.js');
const db = require('../libs/db');
const pointSystem = require('../libs/pointSystem');
const { checkMessage } = require('../moderation/badwordHandler');
const { handlePostMessageInput } = require('../post-manager/postManager');
const { sendPrompt } = require('../ai/vihtAi');
const config = require('../config');

const COOLDOWN_MS = 3000;
const lastMessageAt = new Map();
const processedMessages = new Set();

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    try {
      if (message.author?.bot) return;
      if (!message.channel) return;

      // Count messages for points system
      try {
        const milestone = await pointSystem.addMessage(message.author.id, message.client);
        if (milestone) {
          console.log(`[MESSAGES] Milestone ${milestone} reached for ${message.author.id}`);
        }
      } catch (e) {
        console.warn('Message count error:', e && e.message ? e.message : e);
      }

      // Post Manager message input
      try {
        await handlePostMessageInput(message);
      } catch (e) {
        console.warn('Post Manager message input error:', e && e.message ? e.message : e);
      }

      // Check for bad words
      try {
        await checkMessage(message, message.client);
      } catch (e) {
        console.warn('Badword check failed:', e && e.message ? e.message : e);
      }

      const ch = message.channel;
      const isThread = !!ch?.isThread;
      const isAiMain = String(ch.id) === String(config.aiChatChannelId);
      const isAiThread = isThread && String(ch.parentId) === String(config.aiChatChannelId);
      if (!isAiMain && !isAiThread) return;

      // Prevent duplicate processing
      if (processedMessages.has(message.id)) return;
      processedMessages.add(message.id);

      // Whoami handler
      try {
        const whoamiRegex = /^\s*(?:кто\s+я|я\s+кто)\b/i;
        const excludeRegex = /\bа\s+я\b/i;
        const text = (message.content || '').trim();
        if (whoamiRegex.test(text) && !excludeRegex.test(text)) {
          let member = message.member;
          if ((!member || !member.roles) && message.guild) {
            member = await message.guild.members.fetch(message.author.id).catch(() => null);
          }
          const user = message.author;
          const created = user.createdAt ? new Date(user.createdAt) : null;
          const createdStr = created ? `${String(created.getDate()).padStart(2,'0')}.${String(created.getMonth()+1).padStart(2,'0')}.${created.getFullYear()} ${String(created.getHours()).padStart(2,'0')}:${String(created.getMinutes()).padStart(2,'0')}` : '—';
          let rolesList = 'Нет ролей';
          if (member && member.roles && member.roles.cache) {
            const filtered = member.roles.cache.filter(r => r.id !== message.guild.id);
            if (filtered.size > 0) rolesList = filtered.map(r => `${r.name} (id: ${r.id})`).join(', ');
          }
          const reply = `🧾 **Информация о пользователе**
**Вы:** ${user.username}
**Ваш тег:** ${user.tag}
**Ваш id:** ${user.id}
**Зарегистрирован:** ${createdStr}
**Роли:** ${rolesList}

Если нужна подробная информация о ролях или правах — напишите, и я подскажу. 😊`;
          try { await message.reply({ content: reply, allowedMentions: { parse: [] } }); } catch (e) { try { await message.channel.send(reply).catch(() => null); } catch (e2) {} }
          return;
        }
      } catch (e) { console.warn('whoami handler failed', e && e.message ? e.message : e); }

      // Ensure DB ready
      try { if (db && db.ensureReady) await db.ensureReady(); } catch (e) { console.warn('DB ensureReady failed:', e && e.message); }

      const now = Date.now();
      const last = lastMessageAt.get(message.author.id) || 0;
      if (now - last < COOLDOWN_MS) return;
      lastMessageAt.set(message.author.id, now);

      try {
        if (config.useMockAi) {
          const q = (message.content || '').trim();
          let quick = 'Принято. Сейчас не могу использовать внешний AI, но постараюсь помочь — уточните запрос.';
          if (/\b(кто\s+такой\s+viht|viht|вихт)\b/i.test(q)) quick = 'Viht — команда, создающая быстрые и надёжные VPN‑решения.';
          else if (/\b(андрей|andrey|кто\s+такой\s+андрей)\b/i.test(q)) quick = 'Андрей Вихт — основатель проекта Viht.';
          else if (/\b(сандра|sandra)\b/i.test(q)) quick = 'Сандра — спутник и поддержка Андрея.';
          else if (/\b(ной|noya|ной\s*бой)\b/i.test(q)) quick = 'Ной Бой — друг и товарищ команды.';
          await message.reply(quick);
          return;
        }
        try { message.channel.sendTyping(); } catch (e) {}
        const controlRoleId = config.controlRoleId;
        const callerIsCreator = message.member && message.member.roles && message.member.roles.cache && message.member.roles.cache.has(controlRoleId);

        let authorKey = message.author.id;
        try { await db.ensureReady(); } catch (e) {}
        if (isAiThread) {
          const aiChats = db.get('aiChats') || {};
          const rec = Object.values(aiChats).find(r => r && r.threadId === ch.id);
          if (rec && rec.chatId) {
            authorKey = `${message.author.id}:${rec.chatId}`;
          }
        }
        const reply = await sendPrompt(message.content, { callerIsCreator, authorId: authorKey, authorName: message.author.username });
        await db.incrementAi();
        const out = String(reply || '').trim();
        if (out.length > 0) {
          for (let i = 0; i < out.length; i += 1200) {
            const chunk = out.slice(i, i + 1200);
            await message.reply(chunk);
          }
        }
      } catch (err) { console.error('AI error:', err); await message.reply('Ошибка: AI недоступен.'); }
    } catch (err) { console.error('messageCreate handler error', err); }
  }
};

// Cleanup memory
setInterval(() => {
  const now = Date.now();
  const MAX_AGE = 24 * 60 * 60 * 1000;

  let removed = 0;
  for (const [userId, timestamp] of lastMessageAt.entries()) {
    if (now - timestamp > MAX_AGE) {
      lastMessageAt.delete(userId);
      removed++;
    }
  }

  if (processedMessages.size > 100000) {
    const oldSize = processedMessages.size;
    processedMessages.clear();
    console.log('[MEMORY] Cleared processedMessages (' + oldSize + ' items)');
  }

  console.log('[MEMORY] Cleanup: lastMessageAt=' + lastMessageAt.size + ' users (removed ' + removed + '), processedMessages=' + processedMessages.size);
}, 60 * 60 * 1000);