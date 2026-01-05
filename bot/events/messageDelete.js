const { EmbedBuilder } = require('discord.js');
const db = require('../libs/db');
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

async function findRecentAuditEntry(guild, predicate, windowMs = 10000) {
  try {
    const logs = await guild.fetchAuditLogs({ limit: 30 }).catch(() => null);
    if (!logs || !logs.entries) return null;
    const now = Date.now();
    for (const entry of logs.entries.values()) {
      try {
        const created = entry.createdAt ? entry.createdAt.getTime() : (entry.createdTimestamp || 0);
        if (now - created > windowMs) continue;
        if (typeof predicate === 'function' && predicate(entry)) return entry;
      } catch (e) {}
    }
  } catch (e) {}
  return null;
}

module.exports = {
  name: 'messageDelete',
  async execute(message) {
    try {
      if (!message || !message.guild) return;
      const guild = message.guild;
      const channel = message.channel;
      const author = message.author;

      // Check if it's a review message - update count
      if (channel.id === config.reviewsVoiceChannelId || (channel.parentId && channel.parentId === config.reviewsVoiceChannelId)) {
        try {
          const reviewsCmd = message.client.commands.get('reviews');
          if (reviewsCmd && reviewsCmd.handleReviewDeleted) {
            await reviewsCmd.handleReviewDeleted(message, guild, message.client).catch(err => {
              console.warn('[Reviews] Error updating reviews count on delete:', err?.message);
            });
          }
        } catch (err) {
          console.warn('[Reviews] Failed to update reviews:', err?.message);
        }
      }

      if (author && author.bot) return;

      const audit = await findRecentAuditEntry(guild, e => {
        try {
          if (e.extra && e.extra.channel && String(e.extra.channel.id) === String(channel.id)) return true;
          if (String(e.targetId) === String(author && author.id)) return true;
        } catch (ee) {}
        return false;
      }, 15000);

      if (audit && audit.executor && String(audit.executor.id) === String(message.client.user.id)) return;
      const by = audit && audit.executor ? `<@${audit.executor.id}>` : (author ? `<@${author.id}> (сам)` : 'Неизвестно');
      const content = message.content ? (message.content.length > 1000 ? message.content.slice(0,1000) + '…' : message.content) : (message.embeds && message.embeds.length ? '[embed]' : '[нет текста]');
      const embed = new EmbedBuilder()
        .setTitle('🗑️ Удалено сообщение')
        .setColor(0x9E9E9E)
        .addFields(
          { name: 'Автор', value: author ? `<@${author.id}>` : 'Неизвестно', inline: true },
          { name: 'Удалил', value: by, inline: true },
          { name: 'Канал', value: channel ? `${channel.name}` : '—', inline: true },
          { name: 'Содержимое', value: content }
        )
        .setTimestamp();
      await sendActivityEmbed(guild, embed, config.messageEditLogChannelId);
    } catch (e) {
      console.error('messageDelete handler failed', e && e.message);
    }
  }
};