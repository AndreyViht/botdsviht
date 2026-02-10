const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const config = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,
  welcomeChannelId: process.env.WELCOME_CHANNEL_ID || null,
  // aiChatChannelId removed
  announceChannelId: process.env.ANNOUNCE_CHANNEL_ID || '1436487981723680930',
  musicLogChannelId: process.env.MUSIC_LOG_CHANNEL_ID || process.env.ANNOUNCE_CHANNEL_ID || '1436487981723680930',
  vkChartUrl: process.env.VK_CHART_URL || null,
  vkAppId: process.env.VK_APP_ID || null,
  vkAppSecret: process.env.VK_APP_SECRET || null,
  vkServiceToken: process.env.VK_SERVICE_TOKEN || null,
  vkUserToken: process.env.VK_USER_TOKEN || null,
  vkOAuthRedirectUri: process.env.VK_OAUTH_REDIRECT_URI || 'http://localhost:3000/auth/vk/callback',
  useMockAi: process.env.USE_MOCK_AI === 'true',
  guildMembersIntent: process.env.GUILD_MEMBERS_INTENT === 'true',
  messageContentIntent: process.env.MESSAGE_CONTENT_INTENT === 'true',

  // Channel IDs
  commandLogChannelId: process.env.COMMAND_LOG_CHANNEL_ID || '1446801265219604530',
  voiceLogChannelId: process.env.VOICE_LOG_CHANNEL_ID || '1446801072344662149',
  supportChannelId: process.env.SUPPORT_CHANNEL_ID || '1446801072344662149',
  statusChannelId: process.env.STATUS_CHANNEL_ID || '1445848232965181500',
  nickChangeLogChannelId: process.env.NICK_CHANGE_LOG_CHANNEL_ID || '1446800866630963233',
  moderationLogChannelId: process.env.MODERATION_LOG_CHANNEL_ID || '1446798710511243354',
  messageEditLogChannelId: process.env.MESSAGE_EDIT_LOG_CHANNEL_ID || '1446796850471505973',
  badwordLogChannelId: process.env.BADWORD_LOG_CHANNEL_ID || '1446796960697679953',
  musicLogChannelId: process.env.MUSIC_LOG_CHANNEL_ID || '1445848232965181500',
  defaultVoiceChannelId: process.env.DEFAULT_VOICE_CHANNEL_ID || '1449757724274589829',
  defaultGuildId: process.env.DEFAULT_GUILD_ID || '1428051812103094282',
  welcomeChannelId: process.env.WELCOME_CHANNEL_ID || '1436487788760535143',
  priceChannelId: process.env.PRICE_CHANNEL_ID || '1443194062269321357',
  reviewsVoiceChannelId: process.env.REVIEWS_VOICE_CHANNEL_ID || '1449757724274589829',
  ticketChannelId: process.env.TICKET_CHANNEL_ID || '1442575929044897792',

  // Role IDs
  muteRoleId: process.env.MUTE_ROLE_ID || '1445152678706679939',
  subscriberRoleId: process.env.SUBSCRIBER_ROLE_ID || '1441744621641400353',
  controlRoleId: process.env.CONTROL_ROLE_ID || '1436485697392607303',
  staffRoles: (process.env.STAFF_ROLE_IDS || '1436485697392607303,1436486253066326067').split(',').map(s => s.trim()).filter(Boolean),
  allowedCreatorRoles: (process.env.ALLOWED_CREATOR_ROLE_IDS || '1441744621641400353,1441745037531549777,1436486915221098588,1436486486156382299,1436486253066326067,1436485697392607303').split(',').map(s => s.trim()).filter(Boolean)
};

module.exports = config;

// Администраторские роли (комма-разделённый список в env или дефолтные две роли)
const adminRoleEnv = process.env.ADMIN_ROLE_IDS || '1436485697392607303,1436486253066326067';
config.adminRoles = adminRoleEnv.split(',').map(s => s.trim()).filter(Boolean);

// DJ роли — пользователи с этими ролями могут управлять плеером (skip/stop/manage playlists)
const djRoleEnv = process.env.DJ_ROLE_IDS || '';
config.djRoles = djRoleEnv.split(',').map(s => s.trim()).filter(Boolean);
