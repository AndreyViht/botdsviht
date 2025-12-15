const { SlashCommandBuilder } = require('discord.js');
const db = require('../libs/db');

const ADMIN_REVIEW_CHANNEL_ID = '1446801265219604530'; // Канал для проверки отзывов
const VOICE_CHANNEL_ID = '1449757724274589829';
const ALLOWED_ROLE_ID = '1436485697392607303'; // Founder

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sync-reviews')
    .setDescription('🔄 Синхронизировать отзывы с каналом (удалить потерянные) (админ)'),

  async execute(interaction) {
    // Проверка роли
    const member = interaction.member;
    if (!member || !member.roles.cache.has(ALLOWED_ROLE_ID)) {
      return await interaction.reply({
        content: '❌ У тебя нет прав для этой команды!',
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      console.log('[SYNC-REVIEWS] Начинаем синхронизацию...');
      
      // Получаем канал с отзывами
      const reviewChannel = await interaction.client.channels.fetch(ADMIN_REVIEW_CHANNEL_ID).catch(() => null);
      if (!reviewChannel) {
        return await interaction.editReply({
          content: '❌ Канал отзывов не найден'
        });
      }

      // Получаем все сообщения в канале отзывов
      const messages = await reviewChannel.messages.fetch({ limit: 100 }).catch(() => []);
      const messageIds = new Set();
      
      messages.forEach(msg => {
        // Проверяем что это отзыв (есть embed с заголовком "Отзыв")
        if (msg.embeds && msg.embeds.length > 0) {
          const embed = msg.embeds[0];
          if (embed.title && embed.title.includes('Отзыв')) {
            messageIds.add(msg.id);
          }
        }
      });

      console.log(`[SYNC-REVIEWS] Найдено ${messageIds.size} отзывов в канале`);

      // Получаем отзывы из БД
      await db.ensureReady();
      let allReviews = db.get('reviews') || { approved: [] };
      const approved = allReviews.approved || [];
      
      console.log(`[SYNC-REVIEWS] В БД ${approved.length} отзывов`);

      // Удаляем из БД отзывы, которых нет в канале
      const beforeCount = approved.length;
      const cleanedApproved = approved.filter(review => messageIds.has(review.messageId));
      const deletedCount = beforeCount - cleanedApproved.length;

      if (deletedCount > 0) {
        console.log(`[SYNC-REVIEWS] 🗑️ Удалено ${deletedCount} потерянных отзывов из БД`);
        allReviews.approved = cleanedApproved;
        await db.set('reviews', allReviews);
      }

      // Обновляем название канала
      const voiceChannel = await interaction.client.channels.fetch(VOICE_CHANNEL_ID).catch(() => null);
      if (voiceChannel) {
        const newName = `🤝 Отзывы  - ${cleanedApproved.length}`;
        try {
          await voiceChannel.setName(newName);
          console.log(`[SYNC-REVIEWS] ✅ Обновлено название: ${newName}`);
        } catch (err) {
          console.warn('[SYNC-REVIEWS] Ошибка при обновлении имени:', err?.message);
        }
      }

      await interaction.editReply({
        content: `✅ Синхронизация завершена!\n📊 В канале: ${messageIds.size} отзывов\n🗑️ Удалено из БД: ${deletedCount} потерянных\n📌 Финальный счёт: ${cleanedApproved.length}`
      });

    } catch (error) {
      console.error('sync-reviews error:', error);
      await interaction.editReply({
        content: `❌ Ошибка: ${error.message}`
      });
    }
  }
};
