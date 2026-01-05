const { EmbedBuilder } = require('discord.js');
const db = require('../libs/db');
const statsTracker = require('../libs/statsTracker');
const config = require('../config');

async function sendActivityEmbed(guild, embed, channelId) {
  try {
    const ch = await guild.client.channels.fetch(channelId).catch(() => null);
    if (ch && ch.isTextBased) {
      await ch.send({ embeds: [embed] }).catch(() => null);
    }
  } catch (e) {
    console.warn('sendActivityEmbed failed', e && e.message);
  }
}

module.exports = {
  name: 'guildMemberUpdate',
  async execute(oldMember, newMember) {
    try {
      const guild = newMember.guild || oldMember.guild;
      if (!guild) return;

      // Track boost if user got premium role
      try {
        const oldPremiumRoles = oldMember.roles.cache.filter(r => r.name.toLowerCase().includes('premium') || r.name.toLowerCase().includes('boost'));
        const newPremiumRoles = newMember.roles.cache.filter(r => r.name.toLowerCase().includes('premium') || r.name.toLowerCase().includes('boost'));

        if (newPremiumRoles.size > oldPremiumRoles.size) {
          statsTracker.trackBoost(newMember.id, guild.id);
        }
      } catch (e) {
        console.warn('Boost tracking failed:', e.message);
      }

      const oldNick = oldMember.nickname || oldMember.displayName || '';
      const newNick = newMember.nickname || newMember.displayName || '';
      if (oldNick !== newNick) {
        const embed = new EmbedBuilder()
          .setTitle('✏️ Изменение ника')
          .setColor(0xFFC107)
          .setDescription(`Пользователь <@${newMember.id}> изменил ник`)
          .addFields(
            { name: 'Старый ник', value: oldNick || '—', inline: true },
            { name: 'Новый ник', value: newNick || '—', inline: true }
          )
          .setTimestamp();
        await sendActivityEmbed(guild, embed, config.nickChangeLogChannelId);
      }
    } catch (e) {
      console.error('guildMemberUpdate handler failed', e && e.message);
    }
  }
};