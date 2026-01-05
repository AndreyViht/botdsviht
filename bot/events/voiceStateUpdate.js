const { EmbedBuilder, ChannelType } = require('discord.js');
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
  name: 'voiceStateUpdate',
  async execute(oldState, newState) {
    try {
      const guild = oldState.guild || newState.guild;
      if (!guild) {
        console.warn('[VOICE] No guild found in voiceStateUpdate');
        return;
      }

      const member = newState.member || oldState.member;
      if (!member) {
        console.warn('[VOICE] No member found in voiceStateUpdate');
        return;
      }

      console.log(`[VOICE] Update for ${member.user.tag}: old=${oldState.channel?.name || 'none'} -> new=${newState.channel?.name || 'none'}`);

      // Join voice channel
      if (!oldState.channel && newState.channel) {
        console.log(`[VOICE] ${member.user.tag} JOINED ${newState.channel.name}`);
        try {
          const embed = new EmbedBuilder()
            .setTitle('🔊 Вошел в голосовой')
            .setColor(0x4CAF50)
            .setDescription(`<@${member.id}> присоединился к каналу **${newState.channel.name}**`)
            .addFields(
              { name: 'Пользователь', value: `${member.user.tag}`, inline: true },
              { name: 'Канал', value: `${newState.channel.name}`, inline: true },
              { name: 'Время', value: new Date().toLocaleString('ru-RU'), inline: false }
            )
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setTimestamp();
          await sendActivityEmbed(guild, embed, config.voiceLogChannelId);
          console.log(`[VOICE] Sent JOIN notification for ${member.user.tag}`);
        } catch (e) {
          console.error(`[VOICE] Failed to send JOIN notification: ${e.message}`);
        }
      }
      // Move voice channel
      else if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
        console.log(`[VOICE] ${member.user.tag} MOVED from ${oldState.channel.name} to ${newState.channel.name}`);
        try {
          const embed = new EmbedBuilder()
            .setTitle('↔️ Переместился в голосовой')
            .setColor(0x2196F3)
            .setDescription(`<@${member.id}> переместился из **${oldState.channel.name}** в **${newState.channel.name}**`)
            .addFields(
              { name: 'Из канала', value: `${oldState.channel.name}`, inline: true },
              { name: 'В канал', value: `${newState.channel.name}`, inline: true }
            )
            .setTimestamp();
          await sendActivityEmbed(guild, embed, config.voiceLogChannelId);
          console.log(`[VOICE] Sent MOVE notification for ${member.user.tag}`);
        } catch (e) {
          console.error(`[VOICE] Failed to send MOVE notification: ${e.message}`);
        }
      }

      // Server mute/unmute
      if (oldState.serverMute !== newState.serverMute) {
        console.log(`[VOICE] ${member.user.tag} serverMute: ${oldState.serverMute} -> ${newState.serverMute}`);
        try {
          const action = newState.serverMute ? 'Выключил микрофон' : 'Включил микрофон';
          const audit = await findRecentAuditEntry(guild, e => String(e.targetId) === String(member.id));
          const by = audit && audit.executor ? `<@${audit.executor.id}>` : 'система';
          const embed = new EmbedBuilder()
            .setTitle('🔇 Изменение микрофона')
            .setColor(newState.serverMute ? 0xFF5252 : 0x4CAF50)
            .setDescription(`${by} — ${action} у <@${member.id}>`)
            .addFields(
              { name: 'Пользователь', value: `${member.user.tag}`, inline: true },
              { name: 'Действие', value: action, inline: true }
            )
            .setTimestamp();
          await sendActivityEmbed(guild, embed, config.voiceLogChannelId);
          console.log(`[VOICE] Sent MUTE notification for ${member.user.tag}`);
        } catch (e) {
          console.error(`[VOICE] Failed to send MUTE notification: ${e.message}`);
        }
      }

      // Leave voice channel
      if (oldState.channel && !newState.channel) {
        console.log(`[VOICE] ${member.user.tag} LEFT ${oldState.channel.name}`);
        try {
          const audit = await findRecentAuditEntry(guild, e => String(e.targetId) === String(member.id));
          const by = audit && audit.executor ? `<@${audit.executor.id}>` : null;

          if (by) {
            // Kicked
            const embed = new EmbedBuilder()
              .setTitle('👢 Выгнан из голосового')
              .setColor(0xFF7043)
              .setDescription(`${by} выгнал(а) <@${member.id}> из голосового канала **${oldState.channel.name}**`)
              .addFields(
                { name: 'Пользователь', value: `${member.user.tag}`, inline: true },
                { name: 'Из канала', value: `${oldState.channel.name}`, inline: true }
              )
              .setTimestamp();
            await sendActivityEmbed(guild, embed, config.voiceLogChannelId);
            console.log(`[VOICE] Sent KICK notification for ${member.user.tag}`);
          } else {
            // Left
            const embed = new EmbedBuilder()
              .setTitle('🏃 Вышел из голосового')
              .setColor(0x607D8B)
              .setDescription(`<@${member.id}> покинул(а) голосовой канал **${oldState.channel.name}**`)
              .addFields(
                { name: 'Пользователь', value: `${member.user.tag}`, inline: true },
                { name: 'Из канала', value: `${oldState.channel.name}`, inline: true }
              )
              .setTimestamp();
            await sendActivityEmbed(guild, embed, config.voiceLogChannelId);
            console.log(`[VOICE] Sent LEAVE notification for ${member.user.tag}`);
          }
        } catch (e) {
          console.error(`[VOICE] Failed to send LEAVE/KICK notification: ${e.message}`);
        }
      }
    } catch (e) {
      console.error('[VOICE] voiceStateUpdate handler error:', e && e.message ? e.message : e);
    }
  }
};