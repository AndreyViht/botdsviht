const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, Partials } = require('discord.js');
const { token } = require('./config');
const db = require('./libs/db');
const achievements = require('./libs/achievements');

// Ensure ffmpeg binary is available
try {
  const ffpath = require('ffmpeg-static');
  if (ffpath) {
    process.env.FFMPEG_PATH = ffpath;
    process.env.FFMPEG = ffpath;
    const ffdir = path.dirname(ffpath);
    if (process.env.PATH && !process.env.PATH.includes(ffdir)) process.env.PATH = `${process.env.PATH}${path.delimiter}${ffdir}`;
    console.log('ffmpeg-static found and PATH updated');
  }
} catch (e) {
  console.warn('ffmpeg-static not available; ensure ffmpeg is installed in PATH for audio playback');
}

if (!token) {
  console.error('DISCORD_TOKEN not set in env — set it in .env before starting the bot. Exiting.');
  process.exit(1);
}

// Intents
const intentsList = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.GuildMessageReactions,
  GatewayIntentBits.GuildVoiceStates,
];
const { messageContentIntent, guildMembersIntent } = require('./config');
if (messageContentIntent) intentsList.push(GatewayIntentBits.MessageContent);
if (guildMembersIntent) intentsList.push(GatewayIntentBits.GuildMembers);

const client = new Client({
  intents: intentsList,
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// Global error handlers
process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at:', p, 'reason:', reason && reason.stack ? reason.stack : reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err && err.stack ? err.stack : err);
});

// Load commands
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js') && f !== 'register-commands.js');
  for (const file of commandFiles) {
    try {
      const command = require(path.join(commandsPath, file));
      if (command.data && command.execute) client.commands.set(command.data.name, command);
    } catch (e) {
      console.warn('Failed loading command', file, e && e.message ? e.message : e);
    }
  }
}

// Load events
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
  const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));
  for (const file of eventFiles) {
    try {
      const event = require(path.join(eventsPath, file));
      if (event.name && event.execute) {
        if (event.once) {
          client.once(event.name, (...args) => event.execute(...args));
        } else {
          client.on(event.name, (...args) => event.execute(...args));
        }
      }
    } catch (e) {
      console.warn('Failed loading event', file, e && e.message ? e.message : e);
    }
  }
}

// Load handlers
const handlersPath = path.join(__dirname, 'handlers');
if (fs.existsSync(handlersPath)) {
  const handlerFiles = fs.readdirSync(handlersPath).filter(f => f.endsWith('.js'));
  for (const file of handlerFiles) {
    try {
      const handler = require(path.join(handlersPath, file));
      if (handler.name && handler.execute) {
        client.on(handler.name, (...args) => handler.execute(...args));
      }
    } catch (e) {
      console.warn('Failed loading handler', file, e && e.message ? e.message : e);
    }
  }
}

// Schedule reminders
(async function scheduleReminders() {
  try {
    await db.ensureReady();
    const reminders = db.get('reminders') || [];
    const now = Date.now();
    for (const r of reminders) {
      const delay = Math.max(0, (r.when || 0) - now);
      setTimeout(async () => {
        try {
          const ch = await client.channels.fetch(r.channelId).catch(() => null);
          if (ch) await ch.send(`<@${r.userId}> Напоминание: ${r.text}`);
          const cur = db.get('reminders') || [];
          await db.set('reminders', cur.filter(x => x.id !== r.id));
        } catch (e) {}
      }, delay);
    }
  } catch (e) {
    console.warn('scheduleReminders failed', e && e.message);
  }
})();

// Load user languages
(async function loadUserLangs() {
  try {
    await db.ensureReady();
    const ul = db.get('userLangs') || {};
    client.userLangs = new Map(Object.entries(ul));
  } catch (e) {
    client.userLangs = new Map();
  }
})();

// Reaction handlers
let handleReactionAdd = null;
let handleReactionRemove = null;
try {
  const roleHandlers = require('./roles/reactionRole');
  handleReactionAdd = roleHandlers.handleReactionAdd;
  handleReactionRemove = roleHandlers.handleReactionRemove;
} catch (e) { /* optional */ }

if (handleReactionAdd) client.on('messageReactionAdd', async (reaction, user) => {
  try { await handleReactionAdd(reaction, user); } catch (e) { console.error('messageReactionAdd handler:', e); }
});
if (handleReactionRemove) client.on('messageReactionRemove', async (reaction, user) => {
  try { await handleReactionRemove(reaction, user); } catch (e) { console.error('messageReactionRemove handler:', e); }
});

// Hourly cleanup
setInterval(async () => {
  try {
    const dmMenu = require('./dm-menu');
    if (typeof dmMenu.cleanupExpiredMenus === 'function') {
      await dmMenu.cleanupExpiredMenus().catch(() => {});
      console.log('[CLEANUP] Expired DM menus cleaned');
    }
  } catch (err) {
    console.error('[CLEANUP] Hourly DM cleanup error:', err.message);
  }
}, 3600000);

// Bot start time
const botStartTime = Date.now();

// Ready event
client.once('ready', async () => {
  console.log(`✅ Ready as ${client.user.tag}`);
  console.log('Config flags:', { messageContentIntent, guildMembersIntent });

  await db.ensureReady();
  console.log('✅ DB ready, proceeding with startup status report');

  // Initialize stats tracker
  try {
    const statsTracker = require('./libs/statsTracker');
    statsTracker.initStats();
    statsTracker.cleanupOldStats();
    console.log('✅ Stats tracker initialized and cleaned up');
  } catch (e) {
    console.warn('Stats tracker init failed:', e.message);
  }

  // Connect to voice channel
  try {
    const { joinVoiceChannel, entersState, VoiceConnectionStatus } = require('@discordjs/voice');
    const guild = await client.guilds.fetch(require('./config').defaultGuildId).catch((err) => {
      console.warn('[VOICE] Failed to fetch guild:', require('./config').defaultGuildId, err?.message);
      return null;
    });

    if (guild) {
      const voiceChannel = await guild.channels.fetch(require('./config').defaultVoiceChannelId).catch((err) => {
        console.warn('[VOICE] Failed to fetch default voice channel:', require('./config').defaultVoiceChannelId, err?.message);
        return null;
      });

      if (voiceChannel && voiceChannel.isVoiceBased) {
        try {
          const connection = joinVoiceChannel({
            channelId: require('./config').defaultVoiceChannelId,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator,
            selfDeaf: false,
            selfMute: false
          });
          await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
          console.log('[VOICE] Bot connected to default voice channel');
        } catch (e) {
          console.warn('[VOICE] Failed to connect to default channel:', e && e.message);
        }
      }
    }
  } catch (e) {
    console.warn('[VOICE] Default voice channel initialization failed:', e.message);
  }

  // Send ready notification
  try {
    const ch = await client.channels.fetch(require('./config').voiceLogChannelId).catch(() => null);
    if (ch && ch.isTextBased) {
      const embed = require('discord.js').EmbedBuilder().setTitle('✅ Бот перезагружен').setColor(0x4CAF50).setDescription(`Viht Bot готов к работе`).addFields(
        { name: 'Время', value: new Date().toLocaleString('ru-RU'), inline: true },
        { name: 'Статус', value: '🟢 Online', inline: true }
      ).setTimestamp();
      await ch.send({ embeds: [embed] }).catch(() => null);
    }
  } catch (e) {
    console.warn('Failed to send bot ready notification:', e && e.message);
  }

  // Auto-register commands
  try {
    const autoReg = process.env.AUTO_REGISTER_COMMANDS === 'true' || process.env.AUTO_REGISTER_COMMANDS === '1';
    if (autoReg) {
      try {
        const registerCommands = require('./commands/register-commands');
        if (typeof registerCommands === 'function') {
          await registerCommands();
          console.log('Auto command registration completed.');
        }
      } catch (err) {
        console.warn('Auto command registration failed:', err && err.message ? err.message : err);
      }
    }
  } catch (e) { /* ignore */ }

  // Startup embed
  try {
    const logChannelId = require('./config').commandLogChannelId;
    const statusChannel = await client.channels.fetch(logChannelId).catch(() => null);
    if (statusChannel && statusChannel.isTextBased) {
      const formatDateTimeMSK = (ms) => {
        const msk = new Date(ms + 3 * 60 * 60 * 1000);
        const day = String(msk.getUTCDate()).padStart(2, '0');
        const month = String(msk.getUTCMonth() + 1).padStart(2, '0');
        const year = msk.getUTCFullYear();
        const hours = String(msk.getUTCHours()).padStart(2, '0');
        const mins = String(msk.getUTCMinutes()).padStart(2, '0');
        return { date: `${day}.${month}.${year}`, time: `${hours}:${mins}` };
      };
      const { date, time } = formatDateTimeMSK(botStartTime);
      let version = 'unknown';
      try { version = (fs.readFileSync(path.join(__dirname, '..', 'VERSION'), 'utf-8') || '').trim() || version; } catch (e) {}
      let gitSha = 'unknown';
      try { const { execSync } = require('child_process'); gitSha = String(execSync('git rev-parse --short HEAD', { cwd: path.join(__dirname, '..'), timeout: 2000 })).trim(); } catch (e) {}
      const embed = require('discord.js').EmbedBuilder()
        .setTitle('✅ Бот запущен')
        .setColor(0x4CAF50)
        .setThumbnail(client.user.displayAvatarURL({ size: 64 }))
        .addFields(
          { name: 'Бот', value: `${client.user.tag}`, inline: true },
          { name: 'Дата (MSK)', value: `${date}`, inline: true },
          { name: 'Время (MSK)', value: `${time}`, inline: true },
          { name: 'Версия', value: `${version}`, inline: true },
          { name: 'Commit', value: `${gitSha}`, inline: true },
          { name: 'Серверов', value: `${client.guilds.cache.size}`, inline: true }
        )
        .setFooter({ text: 'Авто-уведомление о запуске' })
        .setTimestamp();
      await statusChannel.send({ embeds: [embed] }).catch(() => null);
      console.log('Startup embed posted to', logChannelId, 'version', version, 'commit', gitSha);
    }
  } catch (e) {
    console.warn('Failed to post startup embed:', e && e.message ? e.message : e);
  }

  // Restore mutes
  try {
    const MUTE_ROLE_ID = require('./config').muteRoleId;
    const mutes = db.get('mutes') || {};
    const now = Date.now();
    for (const [userId, entry] of Object.entries(mutes)) {
      try {
        const guild = client.guilds.cache.get(entry.guildId);
        if (!guild) continue;
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) continue;

        const mutedRole = guild.roles.cache.get(MUTE_ROLE_ID);
        if (!mutedRole) {
          console.warn(`Mute role ${MUTE_ROLE_ID} not found on guild ${guild.id}, skipping user ${userId}`);
          continue;
        }

        if (!member.roles.cache.has(MUTE_ROLE_ID)) {
          try { await member.roles.add(MUTE_ROLE_ID); } catch (e) {
            console.warn(`Failed to add mute role to ${userId}:`, e.message);
          }
        }

        if (entry && entry.unmuteTime) {
          const unmuteAt = new Date(entry.unmuteTime).getTime();
          const ms = Math.max(0, unmuteAt - now);

          if (ms <= 0) {
            try {
              if (member.roles.cache.has(MUTE_ROLE_ID)) {
                await member.roles.remove(MUTE_ROLE_ID);
              }
              if (entry.removedRoles && entry.removedRoles.length > 0) {
                const toRestore = entry.removedRoles.filter(id => guild.roles.cache.has(id));
                if (toRestore.length > 0) {
                  await member.roles.add(toRestore);
                }
              }
              const current = db.get('mutes') || {};
              delete current[userId];
              await db.set('mutes', current);
            } catch (e) {
              console.warn(`Failed to unmute expired user ${userId}:`, e.message);
            }
          } else {
            setTimeout(async () => {
              try {
                const g = await client.guilds.fetch(entry.guildId).catch(() => null);
                if (!g) return;
                const m = await g.members.fetch(userId).catch(() => null);
                if (!m) return;

                if (m.roles.cache.has(MUTE_ROLE_ID)) {
                  try { await m.roles.remove(MUTE_ROLE_ID); } catch (e) {
                    console.warn(`Failed to remove mute role from ${userId}:`, e.message);
                  }
                }

                if (entry.removedRoles && entry.removedRoles.length > 0) {
                  const toRestore = entry.removedRoles.filter(id => g.roles.cache.has(id));
                  if (toRestore.length > 0) {
                    try { await m.roles.add(toRestore); } catch (e) {
                      console.warn(`Failed to restore roles to ${userId}:`, e.message);
                    }
                  }
                }

                const current = db.get('mutes') || {};
                delete current[userId];
                await db.set('mutes', current);

                console.log(`User ${userId} automatically unmuted after timeout`);
              } catch (e) {
                console.error('Unmute timer error:', e.message);
              }
            }, ms);
            console.log(`Scheduled unmute for user ${userId} in ${Math.round(ms / 1000)}s`);
          }
        }
      } catch (e) {
        console.warn(`Error reconciling mute for user ${userId}:`, e.message);
      }
    }
    console.log('Mute reconciliation completed');
  } catch (e) {
    console.warn('Failed mute reconciliation:', e && e.message ? e.message : e);
  }

  // Refresh welcome message
  try {
    const { sendWelcomeMessage } = require('./roles/reactionRole');
    const WELCOME_CHANNEL_ID = require('./config').welcomeChannelId;
    const welcomeChannel = await client.channels.fetch(WELCOME_CHANNEL_ID).catch(() => null);

    if (welcomeChannel) {
      const welcomeRec = db.get('welcome');
      if (welcomeRec && welcomeRec.messageId) {
        try {
          const oldMsg = await welcomeChannel.messages.fetch(welcomeRec.messageId).catch(() => null);
          if (oldMsg) {
            const { EmbedBuilder } = require('discord.js');
            const SUBSCRIBER_ROLE_ID = require('./config').subscriberRoleId;
            const embed = new EmbedBuilder()
              .setColor(0xFF006E)
              .setImage('https://media.discordapp.net/attachments/1446801265219604530/1449749530139693166/image_1.jpg?ex=694007f7&is=693eb677&hm=064f42d3b3d9b6c47515e949319c6c62d86d99b950b21d548f94a7ac60faa19a&=&format=webp')
              .setFooter({ text: '💡 Нажми ✅ для входа, убери галочку для выхода' });
            await oldMsg.edit({ embeds: [embed] }).catch(() => null);
            try { await oldMsg.react('✅').catch(() => null); } catch (e) {}
            console.log('Updated existing welcome message:', welcomeRec.messageId);
          } else {
            await sendWelcomeMessage(client, WELCOME_CHANNEL_ID);
            console.log('Posted new welcome message in', WELCOME_CHANNEL_ID);
          }
        } catch (e) {
          await sendWelcomeMessage(client, WELCOME_CHANNEL_ID);
          console.log('Refreshed welcome message in', WELCOME_CHANNEL_ID);
        }
      } else {
        await sendWelcomeMessage(client, WELCOME_CHANNEL_ID);
        console.log('Posted welcome message in', WELCOME_CHANNEL_ID);
      }
    }
  } catch (e) {
    console.warn('Failed to refresh welcome message:', e && e.message ? e.message : e);
  }

  // Post support panel
  try {
    const SUPPORT_CHANNEL_ID = require('./config').supportChannelId;
    const panelRec = db.get('supportPanelPosted');
    const supportChannel = await client.channels.fetch(SUPPORT_CHANNEL_ID).catch(() => null);
    if (!supportChannel) return console.warn('Support channel not found:', SUPPORT_CHANNEL_ID);
    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const embed = new EmbedBuilder().setTitle('🛠️ Служба поддержки Viht').setColor(0x0066cc).setDescription('Нажмите кнопку ниже, чтобы создать новое обращение в службу поддержки. Пожалуйста, указывайте тему и подробности — это поможет нам быстрее решить вашу проблему.');
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('support_create').setLabel('Создать обращение').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId('support_close_all').setLabel('Закрыть все обращения (админы)').setStyle(ButtonStyle.Danger));
    if (!panelRec) {
      const msg = await supportChannel.send({ embeds: [embed], components: [row] }).catch(() => null);
      if (msg && db && db.set) await db.set('supportPanelPosted', { channelId: SUPPORT_CHANNEL_ID, messageId: msg.id, postedAt: Date.now() });
      console.log('Posted support panel to', SUPPORT_CHANNEL_ID);
    } else {
      const existing = await supportChannel.messages.fetch(panelRec.messageId).catch(() => null);
      if (existing) { await existing.edit({ embeds: [embed], components: [row] }).catch(() => null); console.log('Updated existing support panel message with admin button'); }
      else { const msg = await supportChannel.send({ embeds: [embed], components: [row] }).catch(() => null); if (msg && db && db.set) await db.set('supportPanelPosted', { channelId: SUPPORT_CHANNEL_ID, messageId: msg.id, postedAt: Date.now() }); console.log('Reposted support panel to', SUPPORT_CHANNEL_ID); }
    }
  } catch (e) { console.warn('Failed to post support panel on ready:', e && e.message ? e.message : e); }

  // Ensure AI panel
  try {
    const AI_PANEL_KEY = 'aiPanelPosted';
    const aiChannelId = require('./config').aiChatChannelId;
    async function ensureAiPanel() {
      try {
        if (!aiChannelId) return console.warn('aiChatChannelId not configured');
        const aiChannel = await client.channels.fetch(aiChannelId).catch(() => null);
        if (!aiChannel) return console.warn('AI panel channel not found:', aiChannelId);
        const { createAiPanelEmbed, makeButtons } = require('./ai/aiHandler');
        const embed = createAiPanelEmbed();
        const row = makeButtons();
        const rec = db.get(AI_PANEL_KEY);
        if (rec && rec.channelId === aiChannelId && rec.messageId) {
          const existing = await aiChannel.messages.fetch(rec.messageId).catch(() => null);
          if (existing) {
            await existing.edit({ embeds: [embed], components: row }).catch(() => null);
            console.log('Updated existing AI panel message');
            return;
          }
        }
        const msg = await aiChannel.send({ embeds: [embed], components: row }).catch(() => null);
        if (msg && db && db.set) await db.set(AI_PANEL_KEY, { channelId: aiChannelId, messageId: msg.id, postedAt: Date.now() });
        console.log('Posted AI panel to', aiChannelId);
      } catch (err) { console.warn('ensureAiPanel error', err && err.message ? err.message : err); }
    }
    await ensureAiPanel();
  } catch (e) { console.warn('Failed to ensure AI panel on ready:', e && e.message ? e.message : e); }

  // Ensure menu panel
  try {
    const { ensureMenuPanel } = require('./menus/menuHandler');
    await ensureMenuPanel(client);
  } catch (e) { console.warn('Failed to ensure menu panel on ready:', e && e.message ? e.message : e); }

  // Post price panel
  try {
    const PRICE_CHANNEL_ID = require('./config').priceChannelId;
    const priceKey = 'pricePanelPosted';
    const priceChannel = await client.channels.fetch(PRICE_CHANNEL_ID).catch(() => null);
    if (!priceChannel) {
      console.warn('Price channel not found:', PRICE_CHANNEL_ID);
    } else {
      const { createPriceMainEmbed, getMainRow } = require('./price/priceEmbeds');
      const rec = db.get(priceKey);
      const mainEmbed = createPriceMainEmbed();
      const mainRow = getMainRow();
      if (!rec) {
        const msg = await priceChannel.send({ embeds: [mainEmbed], components: [mainRow] }).catch(() => null);
        if (msg && db && db.set) await db.set(priceKey, { channelId: PRICE_CHANNEL_ID, messageId: msg.id, postedAt: Date.now() });
        console.log('Posted price panel to', PRICE_CHANNEL_ID);
      } else {
        const existing = await priceChannel.messages.fetch(rec.messageId).catch(() => null);
        if (existing) { await existing.edit({ embeds: [mainEmbed], components: [mainRow] }).catch(() => null); console.log('Updated existing price panel message'); }
        else { const msg = await priceChannel.send({ embeds: [mainEmbed], components: [mainRow] }).catch(() => null); if (msg && db && db.set) await db.set(priceKey, { channelId: PRICE_CHANNEL_ID, messageId: msg.id, postedAt: Date.now() }); console.log('Reposted price panel to', PRICE_CHANNEL_ID); }
      }
    }
  } catch (e) { console.warn('Failed to post price panel on ready:', e && e.message ? e.message : e); }

  // Post music panel
  try {
    const { updateMusicPanel } = require('./music/musicHandlers');
    console.log('[MUSIC] Initializing music panel...');
    await updateMusicPanel(client);
    console.log('[MUSIC] Music panel posted successfully');
  } catch (e) {
    console.error('[MUSIC] Failed to post music panel on ready:', e && e.message ? e.message : e);
  }

  // Post post manager panel
  try {
    const { postPostManagerPanel } = require('./post-manager/postManager');
    await postPostManagerPanel(client);
  } catch (e) { console.warn('Failed to post manager panel on ready:', e && e.message ? e.message : e); }

  // Central refresh interval
  setInterval(async () => {
    try {
      await ensureAiPanel().catch(e => console.warn('[PANEL] AI error:', e.message));
      const { ensureMenuPanel } = require('./menus/menuHandler');
      await ensureMenuPanel(client).catch(e => console.warn('[PANEL] Menu error:', e.message));
      const { updateMusicPanel } = require('./music/musicHandlers');
      await updateMusicPanel(client).catch(e => console.warn('[PANEL] Music error:', e.message));
      const { postPostManagerPanel } = require('./post-manager/postManager');
      await postPostManagerPanel(client).catch(e => console.warn('[PANEL] Manager error:', e.message));

      // Check voice connection
      try {
        const { joinVoiceChannel, entersState, VoiceConnectionStatus } = require('@discordjs/voice');
        const DEFAULT_VOICE_CHANNEL_ID = require('./config').defaultVoiceChannelId;
        const DEFAULT_GUILD_ID = require('./config').defaultGuildId;

        const guild = await client.guilds.fetch(DEFAULT_GUILD_ID).catch(() => null);
        if (guild) {
          const botVoiceState = guild.members.me?.voice;
          if (!botVoiceState?.channel || botVoiceState.channel.id !== DEFAULT_VOICE_CHANNEL_ID) {
            console.log('[VOICE] Bot disconnected, reconnecting...');
            const voiceChannel = await guild.channels.fetch(DEFAULT_VOICE_CHANNEL_ID).catch(() => null);
            if (voiceChannel?.isVoiceBased) {
              const connection = joinVoiceChannel({
                channelId: DEFAULT_VOICE_CHANNEL_ID,
                guildId: guild.id,
                adapterCreator: guild.voiceAdapterCreator,
                selfDeaf: false,
                selfMute: false
              });
              await entersState(connection, VoiceConnectionStatus.Ready, 15_000).catch(() => {});
              console.log('[VOICE] Bot reconnected to default voice channel');
            }
          }
        }
      } catch (e) {
        console.warn('[VOICE] Reconnect check failed:', e.message);
      }
    } catch (e) {
      console.error('[PANEL] Central refresh error:', e.message);
    }
  }, 5 * 60 * 1000);
});

// Graceful shutdown
async function gracefulShutdown(signal) {
  try {
    console.log(`[Shutdown] Received ${signal}, logging out client and exiting`);
    if (client && client.user) {
      try { await client.destroy(); } catch (e) { console.warn('Error destroying client', e && e.message); }
    }
    process.exit(0);
  } catch (e) {
    console.error('Error during gracefulShutdown', e && e.message ? e.message : e);
    process.exit(1);
  }
}
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error && error.message ? error.message : error);
  if (error && error.stack) console.error(error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason && reason.message ? reason.message : reason);
});

console.log('🚀 [MAIN] Attempting to login with token...');
client.login(token).then(() => {
  console.log('🟢 [MAIN] Client logged in successfully');
}).catch(err => {
  console.error('🔴 [MAIN] Login failed:', err.message);
});

