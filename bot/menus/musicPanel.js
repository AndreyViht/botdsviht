const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../libs/db');

const MUSIC_PANEL_CHANNEL_ID = '1443194196172476636';
const MUSIC_PANEL_KEY = 'musicPanelPosted';

async function postMusicPanel(client) {
  try {
    await db.ensureReady();
    
    const channel = await client.channels.fetch(MUSIC_PANEL_CHANNEL_ID).catch(() => null);
    if (!channel || !channel.isTextBased?.()) {
      console.warn('[MUSIC PANEL] Channel not found:', MUSIC_PANEL_CHANNEL_ID);
      return;
    }

    // Проверяем статус музыки
    const musicState = db.get('musicState') || {};
    const isPlaying = musicState.isPlaying || false;

    const embed = new EmbedBuilder()
      .setTitle('🎵 Музыкальный плеер')
      .setDescription(isPlaying ? '🎶 **Музыка играет!**' : 'Управление музыкой через **Jockie Music**')
      .setColor(isPlaying ? 0x1DB954 : 0x1DB954)
      .addFields(
        {
          name: '▶️ Включить',
          value: 'Нажми кнопку ниже и введи название или ссылку на песню',
          inline: true
        },
        {
          name: '⏭️ Пропустить',
          value: 'Пропусти текущий трек',
          inline: true
        },
        {
          name: '🚪 Выход',
          value: 'Отключить бота от канала',
          inline: true
        },
        {
          name: '📝 Прямые команды Jockie Music:',
          value: '`m!play <песня>` - Включить\n`m!skip` - Пропустить\n`m!leave` - Выход\n`m!queue` - Очередь\n`m!nowplaying` - Сейчас играет',
          inline: false
        }
      )
      .setFooter({ text: isPlaying ? '🎵 Плеер активен' : 'Управление музыкой Jockie Music' })
      .setTimestamp();

    // Динамические кнопки в зависимости от статуса
    const row1 = new ActionRowBuilder()
      .addComponents(
        isPlaying 
          ? new ButtonBuilder()
              .setLabel('Stop')
              .setEmoji('⏹️')
              .setStyle(ButtonStyle.Danger)
              .setCustomId('jockie_stop')
          : new ButtonBuilder()
              .setLabel('Включить музыку')
              .setEmoji('▶️')
              .setStyle(ButtonStyle.Success)
              .setCustomId('jockie_play'),
        isPlaying
          ? new ButtonBuilder()
              .setLabel('Next')
              .setEmoji('⏭️')
              .setStyle(ButtonStyle.Primary)
              .setCustomId('jockie_skip')
          : new ButtonBuilder()
              .setLabel('Очередь')
              .setEmoji('📋')
              .setStyle(ButtonStyle.Secondary)
              .setCustomId('jockie_queue'),
        new ButtonBuilder()
          .setLabel('Выход')
          .setEmoji('🚪')
          .setStyle(ButtonStyle.Danger)
          .setCustomId('jockie_leave')
      );

    const row2 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Справка')
          .setEmoji('❓')
          .setStyle(ButtonStyle.Secondary)
          .setCustomId('jockie_help')
      );

    const panelRecord = db.get(MUSIC_PANEL_KEY);

    if (panelRecord && panelRecord.messageId) {
      try {
        const existingMsg = await channel.messages.fetch(panelRecord.messageId).catch(() => null);
        if (existingMsg) {
          await existingMsg.edit({ embeds: [embed], components: [row1, row2] });
          console.log('[MUSIC PANEL] ✅ Updated existing message:', panelRecord.messageId);
          return;
        }
      } catch (e) {
        console.warn('[MUSIC PANEL] Failed to update existing message:', e.message);
      }
    }

    // Post new message
    const msg = await channel.send({ embeds: [embed], components: [row1, row2] });
    if (msg && db.set) {
      await db.set(MUSIC_PANEL_KEY, { 
        channelId: MUSIC_PANEL_CHANNEL_ID, 
        messageId: msg.id, 
        postedAt: Date.now() 
      });
      console.log('[MUSIC PANEL] ✅ Posted new message:', msg.id);
    }
  } catch (e) {
    console.error('[MUSIC PANEL] Error posting panel:', e.message);
  }
}

module.exports = {
  postMusicPanel,
  MUSIC_PANEL_CHANNEL_ID,
  MUSIC_PANEL_KEY
};
