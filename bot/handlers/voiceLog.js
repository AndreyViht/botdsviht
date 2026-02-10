const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const config = require('../config');

// Compact logging helper
async function logAction(client, text, color = 0x2B2D31) {
  try {
    const logChannelId = config.auditLogChannelId || '1470897162614214738';
    const channel = await client.channels.fetch(logChannelId).catch(() => null);
    if (!channel) {
        console.warn(`[AUDIT] Channel not found: ${logChannelId}`);
        return;
    }

    // Use simple text or compact embed
    const { EmbedBuilder } = require('discord.js');
    const embed = new EmbedBuilder()
      .setColor(color)
      .setDescription(text)
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch (e) {
    console.error('Failed to send audit log:', e.message);
  }
}

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState) {
    const member = newState.member || oldState.member;
    if (!member) return;

    // 1. Join Voice
    if (!oldState.channelId && newState.channelId) {
      await logAction(member.client, `🎙️ **${member.user.tag}** зашел в канал **${newState.channel.name}**`, 0x57F287); // Green
    }
    // 2. Leave Voice
    else if (oldState.channelId && !newState.channelId) {
      await logAction(member.client, `🚪 **${member.user.tag}** вышел из канала **${oldState.channel.name}**`, 0xED4245); // Red
    }
    // 3. Switch Voice
    else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      await logAction(member.client, `👣 **${member.user.tag}** перешел: **${oldState.channel.name}** ➡️ **${newState.channel.name}**`, 0xFEE75C); // Yellow
    }
  },
  logAction // Export for other handlers
};
