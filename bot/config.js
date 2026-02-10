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
};

module.exports = config;
