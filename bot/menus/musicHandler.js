const { EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../libs/db');

module.exports = {
  async handleMusicButtons(interaction) {
    if (!interaction.isButton()) return;

    const customId = interaction.customId;

    // Включить музыку - модальное окно для ввода песни
    if (customId === 'music_play' || customId === 'jockie_play') {
      const modal = new ModalBuilder()
        .setCustomId('jockie_play_modal')
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
    if (customId === 'music_skip' || customId === 'jockie_skip') {
      await interaction.deferReply({ ephemeral: true });
      try {
        await interaction.channel.send('m!skip');
        await interaction.editReply({
          content: '⏭️ Трек пропущен!',
          ephemeral: true
        });
      } catch (e) {
        await interaction.editReply({
          content: '❌ Ошибка при пропуске трека.',
          ephemeral: true
        });
      }
    }

    // Остановить музыку
    if (customId === 'music_stop' || customId === 'jockie_stop') {
      await interaction.deferReply({ ephemeral: true });
      try {
        await interaction.channel.send('m!stop');
        await interaction.editReply({
          content: '⏹️ Музыка остановлена!',
          ephemeral: true
        });
      } catch (e) {
        await interaction.editReply({
          content: '❌ Ошибка при остановке.',
          ephemeral: true
        });
      }
    }

    // Выйти из канала
    if (customId === 'music_leave' || customId === 'jockie_leave') {
      await interaction.deferReply({ ephemeral: true });
      try {
        await interaction.channel.send('m!leave');
        await interaction.editReply({
          content: '🚪 Бот отключился!',
          ephemeral: true
        });
      } catch (e) {
        await interaction.editReply({
          content: '❌ Ошибка при отключении.',
          ephemeral: true
        });
      }
    }

    // Справка
    if (customId === 'music_help' || customId === 'jockie_help') {
      const embed = new EmbedBuilder()
        .setTitle('❓ Справка Jockie Music')
        .setDescription('Основные команды:')
        .setColor(0x1DB954)
        .addFields(
          {
            name: '▶️ Воспроизведение',
            value: '`m!play <песня>` - Включить\n`m!skip` - Пропустить\n`m!stop` - Остановить',
            inline: false
          },
          {
            name: '📋 Очередь',
            value: '`m!queue` - Очередь\n`m!nowplaying` - Текущий трек',
            inline: false
          }
        )
        .setFooter({ text: 'Управление музыкой' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Очередь
    if (customId === 'jockie_queue') {
      await interaction.deferReply({ ephemeral: true });
      try {
        await interaction.channel.send('m!queue');
        await interaction.editReply({
          content: '📋 Очередь загружается...',
          ephemeral: true
        });
      } catch (e) {
        await interaction.editReply({
          content: '❌ Ошибка при загрузке очереди.',
          ephemeral: true
        });
      }
    }
  },

  async handleMusicModals(interaction) {
    if (!interaction.isModalSubmit()) return;

    if (interaction.customId === 'jockie_play_modal' || interaction.customId === 'music_play_modal') {
      await interaction.deferReply({ ephemeral: true });
      
      try {
        const songName = interaction.fields.getTextInputValue('song_name');
        const member = interaction.member;

        // Проверка: пользователь в голосовом канале?
        if (!member.voice.channel) {
          await interaction.editReply({
            content: '❌ Ты должен быть в голосовом канале!',
            ephemeral: true
          });
          return;
        }

        // Отправляем команду Jockie Music в чат
        const command = `m!play ${songName}`;
        const msg = await interaction.channel.send(command);

        // Показываем инструкцию
        const embed = new EmbedBuilder()
          .setTitle('▶️ Команда отправлена!')
          .setDescription(`Команда:\n\`\`\`\n${command}\n\`\`\``)
          .setColor(0x1DB954)
          .addFields(
            {
              name: '⏳ Ожидание...',
              value: 'Jockie Music обрабатывает запрос...\n\nЕсли ничего не происходит, убедись что:'
            },
            {
              name: '✅ Проверь:',
              value: '• Ты в голосовом канале\n• Jockie Music имеет права\n• Песня существует в базе'
            }
          )
          .setFooter({ text: 'Если не сработает, Jockie выведет сообщение об ошибке' })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } catch (e) {
        console.error('Ошибка при запуске музыки:', e);
        await interaction.editReply({
          content: '❌ Ошибка при запуске музыки.',
          ephemeral: true
        });
      }
    }
  }
};
