const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const config = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,
  welcomeChannelId: process.env.WELCOME_CHANNEL_ID || null,
  announceChannelId: process.env.ANNOUNCE_CHANNEL_ID || '1436487981723680930',

  // Role IDs
  subscriberRoleId: process.env.SUBSCRIBER_ROLE_ID || '1441744621641400353',

  // Review System
  reviewsChannelId: '1470879563981525052',
  reviewsModerationChannelId: '1470881027739353279',
  reviewsLogChannelId: '1470879879120683101',

  // Rules
  rulesChannelId: '1436487842334507058',

  // Welcome Log (New)
  welcomeLogChannelId: '1470894200428957778',

  // Audit Log
  auditLogChannelId: '1470897162614214738',

  // Viht AI Chat
  aiChannelId: '1475840432926756914',
  aiApiKey: process.env.OPENROUTER_API_KEY || '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',
  aiModel: 'qwen/qwen3-vl-30b-a3b-thinking:free',
  aiBaseUrl: 'https://openrouter.ai/api/v1',

};

module.exports = config;
