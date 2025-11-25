const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Channel where the command is allowed (as requested)
const ALLOWED_CHANNEL_ID = '1437190113187594322';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('apiviht')
    .setDescription('Информация о Vith API и интеграции (только в закреплённом канале)'),

  async execute(interaction) {
    // Only allow in the configured channel
    if (interaction.channelId !== ALLOWED_CHANNEL_ID) {
      return interaction.reply({ ephemeral: true, content: `Эта команда доступна только в канале <#${ALLOWED_CHANNEL_ID}>.` });
    }

    const embed = new EmbedBuilder()
      .setTitle('Vith API')
      .setColor(0x2b90d9)
      .setDescription('_Ниже — краткая информация о том, как Viht интегрирован с Discord и как мы защищаем данные._')
      .addFields(
        {
          name: 'Описание',
          value: "```\nViht AI подключён к этому серверу для помощи и автоматизации. Система предоставляет ответы и сервисы, не раскрывая приватные ключи, токены или служебные данные.\n\nИнтеграция сделана через разрешённые и безопасные механизмы: конфигурация хранится отдельно от публичных каналов, секреты не добавляются в сообщения, а доступ к ним ограничен правами сервисов и администраторов.\n```"
        },
        {
          name: 'Интеграция и разработка',
          value: '[vihtai.pro](https://vihtai.pro) — разработчик и поставщик интеграций'
        }
      )
      .setFooter({ text: 'Если нужны детали по интеграции — обратитесь к разработчику через vihtai.pro' });

    try {
      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error('Failed to send /apiviht reply', err);
      await interaction.reply({ ephemeral: true, content: 'Не удалось отправить сообщение. Проверьте права бота.' });
    }
  }
};
