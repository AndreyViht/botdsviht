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
  // GatewayIntentBits.GuildMessageReactions, // Not needed for buttons/modals
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
      if (command.data && command.execute) client.commands.set(command.data.name, command);
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
    const { sendWelcomeMessage } = require('./roles/reactionRole');
    const WELCOME_CHANNEL_ID = require('./config').welcomeChannelId;
    const welcomeChannel = await client.channels.fetch(WELCOME_CHANNEL_ID).catch(() => null);

    if (welcomeChannel) {
      const welcomeRec = db.get('welcome');
      if (welcomeRec && welcomeRec.messageId) {
        try {
          const oldMsg = await welcomeChannel.messages.fetch(welcomeRec.messageId).catch(() => null);
          if (oldMsg) {
             // Optional: update message if needed
             // await sendWelcomeMessage(client, WELCOME_CHANNEL_ID); 
             console.log('Welcome message exists:', welcomeRec.messageId);
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

  // Ensure menu panel
  try {
    const { ensureMenuPanel } = require('./menus/menuHandler');
    await ensureMenuPanel(client);
  } catch (e) { console.warn('Failed to ensure menu panel on ready:', e && e.message ? e.message : e); }

  // Ensure reviews panel
  try {
    const { ensureReviewPanel } = require('./commands/reviewsHandler');
    await ensureReviewPanel(client);
  } catch (e) { console.warn('Failed to ensure review panel on ready:', e && e.message ? e.message : e); }

  // Central refresh interval
  setInterval(async () => {
    try {
      const { ensureMenuPanel } = require('./menus/menuHandler');
      await ensureMenuPanel(client).catch(e => console.warn('[PANEL] Menu error:', e.message));
      
      const { ensureReviewPanel } = require('./commands/reviewsHandler');
      await ensureReviewPanel(client).catch(e => console.warn('[PANEL] Review error:', e.message));
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
