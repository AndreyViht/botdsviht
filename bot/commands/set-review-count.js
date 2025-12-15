const { SlashCommandBuilder } = require('discord.js');
const db = require('../libs/db');

const VOICE_CHANNEL_ID = '1449757724274589829';
const ALLOWED_ROLE_ID = '1436485697392607303'; // Founder

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-review-count')
    .setDescription('🔢 Установить количество отзывов вручную (админ)')
    .addIntegerOption(option =>
      option.setName('count')
        .setDescription('Количество отзывов')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(1000)
    ),

  async execute(interaction) {
    // Проверка роли
    const member = interaction.member;
    if (!member || !member.roles.cache.has(ALLOWED_ROLE_ID)) {
      return await interaction.reply({
        content: '❌ У тебя нет прав для этой команды!',
        ephemeral: true
      });
    }

    const count = interaction.options.getInteger('count');

    try {
      await db.ensureReady();
      
      // Создаём фиктивные отзывы для БД (чтобы счётчик был правильный)
      const approved = Array.from({ length: count }, (_, i) => ({
        messageId: `fake-${i}`,
        userId: 'unknown',
        username: 'unknown',
        text: 'Отзыв восстановлен',
        rating: 5,
        timestamp: Date.now()
      }));

      const reviews = { approved };
      await db.set('reviews', reviews);

      console.log(`[SET-REVIEW-COUNT] Установлено ${count} отзывов`);

      // Обновляем название канала
      const voiceChannel = await interaction.client.channels.fetch(VOICE_CHANNEL_ID).catch(() => null);
      if (voiceChannel) {
        const newName = `🤝 Отзывы  - ${count}`;
        try {
          await voiceChannel.setName(newName);
          console.log(`[SET-REVIEW-COUNT] ✅ Обновлено название: ${newName}`);
        } catch (err) {
          console.warn('[SET-REVIEW-COUNT] Ошибка при обновлении имени:', err?.message);
        }
      }

      await interaction.reply({
        content: `✅ Счётчик отзывов установлен на: ${count}\n📌 Название канала обновлено на: 🤝 Отзывы  - ${count}`,
        ephemeral: true
      });

    } catch (error) {
      console.error('set-review-count error:', error);
      await interaction.reply({
        content: `❌ Ошибка: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
