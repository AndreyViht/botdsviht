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

  // Music System
  musicChannelId: '1470911152145043466',
};

module.exports = config;
