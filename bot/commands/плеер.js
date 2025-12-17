const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('player')
    .setDescription('🎵 Управление музыкой через Jockie Music'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('🎵 Музыкальный плеер')
      .setDescription('Используй кнопки ниже для управления музыкой.\n\nДля воспроизведения песни нажми **Включить музыку** и введи название или ссылку.')
      .setColor(0x1DB954)
      .addFields(
        { 
          name: '📝 Основные команды Jockie Music:', 
          value: '• `m!play <песня>` - Включить музыку\n• `m!skip` - Пропустить\n• `m!leave` - Выйти из канала',
          inline: false
        },
        {
          name: '💡 Примеры:',
          value: '`m!play see you again`\n`m!play https://open.spotify.com/track/...`',
          inline: false
        }
      )
      .setFooter({ text: 'Управление музыкой через Jockie Music' })
      .setTimestamp();

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Включить музыку')
          .setEmoji('▶️')
          .setStyle(ButtonStyle.Success)
          .setCustomId('music_play'),
        new ButtonBuilder()
          .setLabel('Пропустить')
          .setEmoji('⏭️')
          .setStyle(ButtonStyle.Primary)
          .setCustomId('music_skip'),
        new ButtonBuilder()
          .setLabel('Выход')
          .setEmoji('🚪')
          .setStyle(ButtonStyle.Danger)
          .setCustomId('music_leave')
      );

    const row2 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Справка Jockie Music')
          .setEmoji('❓')
          .setStyle(ButtonStyle.Secondary)
          .setCustomId('music_help')
      );

    await interaction.reply({ embeds: [embed], components: [row, row2] });
  }
};
