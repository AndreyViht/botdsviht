const { EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
  async handleMusicButtons(interaction) {
    if (!interaction.isButton()) return;

    const customId = interaction.customId;

    // Включить музыку - модальное окно для ввода песни
    if (customId === 'music_play') {
      const modal = new ModalBuilder()
        .setCustomId('music_play_modal')
        .setTitle('🎵 Включить музыку');

      const songInput = new TextInputBuilder()
        .setCustomId('song_name')
        .setLabel('Название или ссылка на песню')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Например: see you again или spotify ссылка')
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(songInput);
      modal.addComponents(row);

      await interaction.showModal(modal);
    }

    // Пропустить трек
    if (customId === 'music_skip') {
      const embed = new EmbedBuilder()
        .setTitle('⏭️ Пропуск трека')
        .setDescription('Используй команду:\n\n`m!skip`')
        .setColor(0x1DB954)
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Выйти из канала
    if (customId === 'music_leave') {
      const embed = new EmbedBuilder()
        .setTitle('🚪 Выход из канала')
        .setDescription('Используй команду:\n\n`m!leave`')
        .setColor(0xFF0000)
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Справка
    if (customId === 'music_help') {
      const embed = new EmbedBuilder()
        .setTitle('❓ Справка Jockie Music')
        .setDescription('Вот основные команды:')
        .setColor(0x1DB954)
        .addFields(
          {
            name: '▶️ Воспроизведение',
            value: '`m!play <песня>` - Включить музыку\n`m!skip` - Пропустить\n`m!leave` - Выход',
            inline: false
          },
          {
            name: '📋 Очередь',
            value: '`m!queue` - Показать очередь\n`m!nowplaying` - Текущая песня',
            inline: false
          },
          {
            name: '⚙️ Опции play',
            value: '`--shuffle` - Перемешать\n`--insert` - Вставить в очередь\n`--now` - Включить сразу',
            inline: false
          },
          {
            name: '🔗 Где найти помощь',
            value: 'Используй `m!help` для полного списка или посети сайт Jockie Music'
          }
        )
        .setFooter({ text: 'Управление музыкой' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },

  async handleMusicModals(interaction) {
    if (!interaction.isModalSubmit()) return;

    if (interaction.customId === 'music_play_modal') {
      const songName = interaction.fields.getTextInputValue('song_name');

      const embed = new EmbedBuilder()
        .setTitle('▶️ Воспроизведение')
        .setDescription(`Используй эту команду в канале где находится Jockie Music бот:\n\n\`m!play ${songName}\``)
        .setColor(0x1DB954)
        .addFields(
          {
            name: '💡 Подсказка',
            value: 'Убедись что ты находишься в голосовом канале перед тем как вводить команду!'
          }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
};
