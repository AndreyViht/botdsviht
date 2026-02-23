const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, Partials } = require('discord.js');
const { token } = require('./config');
const db = require('./libs/db');

if (!token) {
  console.error('DISCORD_TOKEN not set in env — set it in .env before starting the bot. Exiting.');
  process.exit(1);
}

// Intents
const intentsList = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.GuildVoiceStates, // Added for voice logging
  GatewayIntentBits.GuildMembers,     // Added for member updates (nicknames/roles)
  GatewayIntentBits.MessageContent,   // Added for message content (edit/delete logs)
  // GatewayIntentBits.GuildMessageReactions, 
];

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

// Load commands (Empty for now as files are deleted)
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js') && f !== 'register-commands.js');
  for (const file of commandFiles) {
    try {
      const command = require(path.join(commandsPath, file));
      if (command.data && command.execute) {
         if (Array.isArray(command.data)) {
            // Register multiple commands for the same handler (rpCommands)
            command.data.forEach(cmd => client.commands.set(cmd.name, command));
         } else {
            client.commands.set(command.data.name, command);
         }
      }
    } catch (e) {
      console.warn('Failed loading command', file, e && e.message ? e.message : e);
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

// Bot start time
const botStartTime = Date.now();

// Ready event
client.once('ready', async () => {
  console.log(`✅ Ready as ${client.user.tag}`);
  
  await db.ensureReady();
  console.log('✅ DB ready');

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

  // Refresh welcome message
  try {
    const { initWelcomeMessage } = require('./roles/reactionRole');
    const WELCOME_CHANNEL_ID = require('./config').welcomeChannelId;
    await initWelcomeMessage(client, WELCOME_CHANNEL_ID);
  } catch (e) {
    console.warn('Failed to refresh welcome message:', e && e.message ? e.message : e);
  }

  // Ensure menu panel
  try {
    const { ensureMenuPanel } = require('./menus/menuHandler');
    await ensureMenuPanel(client);
  } catch (e) { console.warn('Failed to ensure menu panel on ready:', e && e.message ? e.message : e); }

  // Ensure reviews panel
  try {
    const { ensureReviewPanel, syncReviewChannelCount } = require('./commands/reviewsHandler');
    await ensureReviewPanel(client);
    await syncReviewChannelCount(client); // Sync count on startup
  } catch (e) { console.warn('Failed to ensure review panel on ready:', e && e.message ? e.message : e); }

  // Ensure rules panel
  try {
    const { ensureRulesPanel } = require('./commands/rulesHandler');
    await ensureRulesPanel(client);
  } catch (e) { console.warn('Failed to ensure rules panel on ready:', e && e.message ? e.message : e); }

  // Ensure pet management message
  try {
    const { ensurePetManagementMessage } = require('./menus/petsHandler');
    await ensurePetManagementMessage(client);
  } catch (e) { console.warn('Failed to ensure pet management message:', e && e.message ? e.message : e); }

  // Ensure cleanup of old music channel
  try {
    const oldMusicChannel = await client.channels.fetch('1470911152145043466').catch(() => null);
    if (oldMusicChannel) {
        // Just ensure we don't post there. We could delete it if we wanted, but let's just ignore it.
        // Or if you want to be sure no messages are posted:
        // await oldMusicChannel.send('⚠️ Музыкальный модуль отключен.');
        console.log('[CLEANUP] Music channel exists but module is disabled.');
    }
  } catch (e) {}



  // Central refresh interval
  setInterval(async () => {
    try {
      const { ensureMenuPanel } = require('./menus/menuHandler');
      await ensureMenuPanel(client).catch(e => console.warn('[PANEL] Menu error:', e.message));
      
      const { ensureReviewPanel } = require('./commands/reviewsHandler');
      await ensureReviewPanel(client).catch(e => console.warn('[PANEL] Review error:', e.message));

      const { ensureRulesPanel } = require('./commands/rulesHandler');
      await ensureRulesPanel(client).catch(e => console.warn('[PANEL] Rules error:', e.message));

      const { ensurePetManagementMessage } = require('./menus/petsHandler');
      await ensurePetManagementMessage(client).catch(e => console.warn('[PANEL] Pet management error:', e.message));
    } catch (e) {
      console.error('[PANEL] Central refresh error:', e.message);
    }
  }, 5 * 60 * 1000);

  // Background task: Pet notifications (every 3 minutes)
  setInterval(async () => {
    try {
      await checkPetNotifications(client);
    } catch (e) {
      console.error('[PETS] Notification check error:', e.message);
    }
  }, 3 * 60 * 1000);
});

// Pet notifications background task
async function checkPetNotifications(client) {
  try {
    const pets = db.all()?.pets || {};
    const now = Date.now();
    const MS_HOUR = 60 * 60 * 1000;

    for (const [petId, pet] of Object.entries(pets)) {
      if (!pet || !pet.owner_id) continue;

      let needNotification = false;
      let message = '';

      // Check feeding times (need to feed if overdue)
      const lastFed = pet.stats?.lastFed || 0;
      const hoursSinceFood = (now - lastFed) / MS_HOUR;
      if (hoursSinceFood >= 8) {
        needNotification = true;
        message = `🍖 Ваш питомец **${pet.name}** голоден! Его нужно покормить.`;
      }

      // Check bathing (need to bathe if not done in 2 days)
      const lastBathed = pet.stats?.lastBathed || 0;
      const hoursSinceBath = (now - lastBathed) / MS_HOUR;
      if (hoursSinceBath >= 48) {
        needNotification = true;
        message = `🛁 Время мыть **${pet.name}**! Питомец грязный.`;
      }

      // Check cleaning (need to clean if overdue by 12 hours)
      const lastCleaned = pet.stats?.lastCleaned || 0;
      const hoursSinceCleaned = (now - lastCleaned) / MS_HOUR;
      if (hoursSinceCleaned >= 12) {
        needNotification = true;
        message = `💩 Нужно убрать за **${pet.name}**!`;
      }

      // Check walking
      const lastWalked = pet.stats?.lastWalked || 0;
      const hoursSinceWalk = (now - lastWalked) / MS_HOUR;
      if (hoursSinceWalk >= 6) {
        needNotification = true;
        message = `🐕 Пора гулять с **${pet.name}**!`;
      }

      if (needNotification && message) {
        try {
          const owner = await client.users.fetch(pet.owner_id);
          if (owner) {
            await owner.send(`${message}\\n\\nПерейдите в свою приватную ветку для управления питомцем.`).catch(() => {
              // If DM fails, try sending in thread
              if (pet.thread_id) {
                client.channels.fetch(pet.thread_id).then(thread => {
                  thread.send(`<@${pet.owner_id}> ${message}`).catch(() => {});
                }).catch(() => {});
              }
            });
          }
        } catch (e) {
          console.warn(`[PETS] Failed to send notification for ${petId}:`, e.message);
        }
      }
    }
  } catch (e) {
    console.error('[PETS] checkPetNotifications error:', e.message);
  }
}

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
