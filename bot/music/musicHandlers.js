const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const playerManager = require('./playerManager');
const db = require('../libs/db');

const MUSIC_PANEL_CHANNEL = '1443194196172476636';

async function createControlPanel(guildId, client) {
  try {
    const channel = await client.channels.fetch(MUSIC_PANEL_CHANNEL).catch(() => null);
    if (!channel) return null;

    const nowPlaying = playerManager.nowPlaying.get(guildId);
    const queue = playerManager.getQueue(guildId);
    const owner = playerManager.owners.get(guildId);
    const isPlaying = playerManager.players.has(guildId);

    let description = 'Музыкальный плеер\n\n';
    if (nowPlaying) {
      description += `**Сейчас играет:** ${nowPlaying.title}\n`;
      description += `**Длительность:** ${nowPlaying.duration}s\n`;
      description += `**Запросил:** <@${nowPlaying.requesterId}>\n\n`;
    } else {
      description += 'Ничего не играет\n\n';
    }

    if (queue.length > 0) {
      description += `**Очередь:** ${queue.length} треков\n`;
      if (queue.length <= 5) {
        queue.forEach((song, i) => {
          description += `${i + 1}. ${song.title} - <@${song.requesterId}>\n`;
        });
      } else {
        for (let i = 0; i < 5; i++) {
          description += `${i + 1}. ${queue[i].title} - <@${queue[i].requesterId}>\n`;
        }
        description += `... и ещё ${queue.length - 5} треков`;
      }
    }

    const embed = new EmbedBuilder()
      .setTitle('🎵 Управление музыкой')
      .setDescription(description)
      .setColor(isPlaying ? 0x1DB954 : 0x5865F2)
      .setFooter({ text: owner ? `Сессия: <@${owner}>` : 'Нет активной сессии' })
      .setTimestamp();

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('music_search')
        .setLabel('Поиск')
        .setEmoji('🔍')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!owner),
      new ButtonBuilder()
        .setCustomId('music_skip')
        .setLabel('Пропустить')
        .setEmoji('⏭️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!isPlaying),
      new ButtonBuilder()
        .setCustomId('music_stop')
        .setLabel('Стоп')
        .setEmoji('⏹️')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!isPlaying)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('music_pause')
        .setLabel(isPlaying ? 'Пауза' : 'Возобновить')
        .setEmoji(isPlaying ? '⏸️' : '▶️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!isPlaying),
      new ButtonBuilder()
        .setCustomId('music_queue')
        .setLabel('Очередь')
        .setEmoji('📋')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(queue.length === 0)
    );

    const existingPanel = playerManager.getPanel(guildId);
    if (existingPanel) {
      try {
        const message = await channel.messages.fetch(existingPanel.messageId).catch(() => null);
        if (message) {
          await message.edit({ embeds: [embed], components: [row1, row2] });
          return message;
        }
      } catch (e) {
        console.warn('[MUSIC] Failed to edit existing panel:', e.message);
      }
    }

    // Create new panel
    const message = await channel.send({ embeds: [embed], components: [row1, row2] });
    playerManager.setPanel(guildId, channel.id, message.id);
    return message;
  } catch (e) {
    console.error('[MUSIC] createControlPanel error:', e.message);
    return null;
  }
}

async function handleMusicSearch(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('music_search_modal')
    .setTitle('Поиск песни');

  const input = new TextInputBuilder()
    .setCustomId('song_query')
    .setLabel('Название или артист')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  interaction.showModal(modal);
}

async function handleMusicSearchSubmit(interaction) {
  const query = interaction.fields.getTextInputValue('song_query');
  
  if (!query.trim()) {
    interaction.reply({ content: 'Введите название песни', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const results = await playerManager.search(query);
    
    if (results.length === 0) {
      interaction.editReply('❌ Песни не найдены');
      return;
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId('music_select')
      .setPlaceholder('Выберите песню')
      .addOptions(results.slice(0, 8).map((song, i) => ({
        label: `${i + 1}. ${song.title.substring(0, 80)}`,
        value: String(i),
        description: (song.author || song.channel || 'YouTube').substring(0, 100)
      })));

    const row = new ActionRowBuilder().addComponents(select);
    interaction.editReply({ 
      content: '🔍 Результаты поиска:',
      components: [row]
    });

    db.set(`searchResults_${interaction.user.id}`, { results, expires: Date.now() + 300000 });
  } catch (e) {
    console.error('[MUSIC] Search error:', e);
    interaction.editReply('❌ Ошибка поиска');
  }
}

async function handleMusicSelect(interaction) {
  if (interaction.customId !== 'music_select') return;

  const selectedIndex = parseInt(interaction.values[0]);
  
  // Получаем сохранённые результаты поиска
  const searchData = db.get(`searchResults_${interaction.user.id}`);
  
  if (!searchData || !searchData.results || selectedIndex >= searchData.results.length) {
    interaction.reply({ content: '❌ Результаты поиска истекли. Попробуйте снова.', ephemeral: true });
    return;
  }

  const song = searchData.results[selectedIndex];
  
  const voiceChannel = interaction.member?.voice?.channel;
  if (!voiceChannel) {
    interaction.reply({ content: '❌ Вы не в голосовом канале', ephemeral: true });
    return;
  }

  // передаём voiceChannel и client, чтобы плеер мог присоединиться и начать воспроизведение
  await playerManager.addToQueue(interaction.guildId, song, voiceChannel, interaction.client, interaction.user.id);
  
  await interaction.deferReply({ ephemeral: true });
  interaction.editReply(`✅ **${song.title}** добавлено в очередь`);

  try {
    await createControlPanel(interaction.guildId, interaction.client);
  } catch (e) {
    console.error('[MUSIC] Panel update error:', e);
  }
}

async function handleMusicButtons(interaction) {
  const { customId, guildId, user } = interaction;

  // Check if user is the session owner
  if (!playerManager.checkOwner(guildId, user.id)) {
    await interaction.reply({ content: '❌ Только владелец сессии может управлять музыкой!', ephemeral: true });
    return;
  }

  if (customId === 'music_search') {
    handleMusicSearch(interaction);
    return;
  }

  if (customId === 'music_skip') {
    playerManager.skip(guildId);
    await interaction.deferReply({ ephemeral: true });
    interaction.editReply('✅ Трек пропущен');
    // Update panel
    setTimeout(() => createControlPanel(guildId, interaction.client), 1000);
    return;
  }

  if (customId === 'music_stop') {
    const TARGET_CHANNEL = '1449757724274589829';
    await playerManager.stop(guildId, interaction.client, { moveTo: TARGET_CHANNEL });
    await interaction.deferReply({ ephemeral: true });
    interaction.editReply('⏹️ Плеер остановлен, бот перемещён');
    // Update panel
    setTimeout(() => createControlPanel(guildId, interaction.client), 1000);
    return;
  }

  if (customId === 'music_pause') {
    // TODO: Implement pause/resume if needed
    await interaction.reply({ content: '⏸️ Пауза/возобновление пока не реализовано', ephemeral: true });
    return;
  }

  if (customId === 'music_queue') {
    const queue = playerManager.getQueue(guildId);
    const nowPlaying = playerManager.nowPlaying.get(guildId);

    let description = '';
    if (nowPlaying) {
      description += `**Сейчас:** ${nowPlaying.title}\n\n`;
    }

    if (queue.length === 0) {
      description += 'Очередь пуста';
    } else {
      description += queue.slice(0, 10).map((song, i) => `${i + 1}. ${song.title}`).join('\n');
      if (queue.length > 10) description += `\n... и еще ${queue.length - 10}`;
    }

    const embed = new EmbedBuilder()
      .setTitle('📋 Очередь')
      .setDescription(description)
      .setColor(0x1DB954);

    interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }
}

async function updateMusicPanel(client) {
  // Update panels for all guilds with active sessions
  for (const guildId of playerManager.owners.keys()) {
    try {
      await createControlPanel(guildId, client);
    } catch (e) {
      console.warn(`[MUSIC] Failed to update panel for guild ${guildId}:`, e.message);
    }
  }
}

module.exports = {
  updateMusicPanel,
  handleMusicSearch,
  handleMusicSearchSubmit,
  handleMusicSelect,
  handleMusicButtons
};