const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../libs/db');

const ALLOWED_ROLE_ID = '1436485697392607303'; // Founder

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reviews-info')
    .setDescription('📊 Информация о отзывах в БД (админ)'),

  async execute(interaction) {
    // Проверка роли
    const member = interaction.member;
    if (!member || !member.roles.cache.has(ALLOWED_ROLE_ID)) {
      return await interaction.reply({
        content: '❌ У тебя нет прав для этой команды!',
        ephemeral: true
      });
    }

    try {
      await db.ensureReady();
      const allReviews = db.get('reviews') || { approved: [] };
      const approved = allReviews.approved || [];

      const embed = new EmbedBuilder()
        .setTitle('📊 Информация об отзывах')
        .setColor(0xFF006E)
        .addFields(
          { name: '📌 Всего одобренных отзывов', value: `${approved.length}`, inline: true },
          { name: '🆔 ID сообщений', value: approved.length > 0 ? approved.map(r => r.messageId).join('\n') : 'Нет', inline: false }
        );

      await interaction.reply({
        embeds: [embed],
        ephemeral: true
      });

    } catch (error) {
      console.error('reviews-info error:', error);
      await interaction.reply({
        content: `❌ Ошибка: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
