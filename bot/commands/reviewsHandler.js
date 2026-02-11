const { 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle 
} = require('discord.js');
const db = require('../libs/db');
const config = require('../config');

const REVIEW_PANEL_KEY = 'reviewPanelPosted';

function makeReviewEmbed() {
  return new EmbedBuilder()
    .setTitle('📝 Отзывы о Viht Community')
    .setColor(0x00FF00)
    .setDescription('Оставьте свой отзыв о нашем Комьюнити Viht, тут вы можете рассказать всё от использования VPN до всяких случаев общения и так далее.')
    .setFooter({ text: 'Ваше мнение важно для нас!' });
}

function makeReviewButton() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('review_create')
      .setLabel('ОПУБЛИКОВАТЬ ОТЗЫВ')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('✍️')
  );
}

async function ensureReviewPanel(client) {
  try {
    if (!client) return;
    const ch = await client.channels.fetch(config.reviewsChannelId).catch(() => null);
    if (!ch) return console.warn('Reviews channel not found:', config.reviewsChannelId);

    const rec = db.get(REVIEW_PANEL_KEY);
    const embed = makeReviewEmbed();
    const row = makeReviewButton();

    if (rec && rec.channelId === config.reviewsChannelId && rec.messageId) {
      const existing = await ch.messages.fetch(rec.messageId).catch(() => null);
      if (existing) {
        console.log('Review panel exists');
        return;
      }
    }

    // Double check history
    const messages = await ch.messages.fetch({ limit: 5 });
    const botMsg = messages.find(m => m.author.id === client.user.id && m.embeds.length > 0 && m.embeds[0].title === '📝 Отзывы о Viht Community');

    if (botMsg) {
        console.log('Found existing review panel via search.');
        if (db && db.set) await db.set(REVIEW_PANEL_KEY, { channelId: config.reviewsChannelId, messageId: botMsg.id, postedAt: Date.now() });
        return;
    }

    const msg = await ch.send({ embeds: [embed], components: [row] }).catch(() => null);
    if (msg && db && db.set) await db.set(REVIEW_PANEL_KEY, { channelId: config.reviewsChannelId, messageId: msg.id, postedAt: Date.now() });
    console.log('Posted review panel to', config.reviewsChannelId);
  } catch (e) {
    console.error('ensureReviewPanel error', e && e.message ? e.message : e);
  }
}

async function handleReviewButton(interaction) {
  try {
    if (interaction.customId === 'review_create') {
      // Check if user already has an approved review
      let reviews = [];
      try {
        reviews = db.get('reviews');
        if (!Array.isArray(reviews)) reviews = [];
      } catch (e) {
        console.error('Error reading reviews from DB:', e);
        reviews = [];
      }
      
      const existing = reviews.find(r => r.userId === interaction.user.id && r.status === 'approved');
      
      if (existing) {
        return interaction.reply({ 
          content: '🚫 Твой отзыв уже есть, мы не накручиваем так что спасибо вам за ваш отзыв.', 
          ephemeral: true 
        });
      }

      const modal = new ModalBuilder()
        .setCustomId('review_modal')
        .setTitle('Ваш отзыв');

      const input = new TextInputBuilder()
        .setCustomId('review_text')
        .setLabel('Напишите ваш отзыв')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Расскажите о вашем опыте...')
        .setRequired(true)
        .setMaxLength(1000);

      const row = new ActionRowBuilder().addComponents(input);
      modal.addComponents(row);

      await interaction.showModal(modal);
    } else if (interaction.customId.startsWith('review_approve_') || interaction.customId.startsWith('review_reject_')) {
      await handleModerationAction(interaction);
    }
  } catch (err) {
    console.error('handleReviewButton fatal error:', err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: `Debug Error: ${err.message}`, ephemeral: true });
    }
  }
}

async function handleReviewModal(interaction) {
  try {
    if (interaction.customId !== 'review_modal') return;

    const text = interaction.fields.getTextInputValue('review_text');
    const reviewId = Date.now().toString();

    // Save pending review
    let reviews = [];
    try {
      reviews = db.get('reviews');
      if (!Array.isArray(reviews)) reviews = [];
    } catch (e) { reviews = []; }

    reviews.push({
      id: reviewId,
      userId: interaction.user.id,
      userTag: interaction.user.tag,
      text: text,
      status: 'pending',
      createdAt: Date.now()
    });
    await db.set('reviews', reviews);

    // Send to moderation channel
    const modChannel = await interaction.client.channels.fetch(config.reviewsModerationChannelId).catch(() => null);
    if (modChannel) {
      const embed = new EmbedBuilder()
        .setTitle('🆕 Новый отзыв на модерацию')
        .setColor(0xFFA500)
        .addFields(
          { name: 'Пользователь', value: `${interaction.user.tag} (<@${interaction.user.id}>)` },
          { name: 'Текст отзыва', value: text }
        )
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`review_approve_${reviewId}`).setLabel('Опубликовать').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`review_reject_${reviewId}`).setLabel('Отказать').setStyle(ButtonStyle.Danger)
      );

      await modChannel.send({ embeds: [embed], components: [row] });
    } else {
      console.warn('Review moderation channel not found:', config.reviewsModerationChannelId);
    }

    await interaction.reply({ content: '✅ Ваш отзыв отправлен на модерацию. Спасибо!', ephemeral: true });
  } catch (err) {
    console.error('handleReviewModal error:', err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ Ошибка при отправке отзыва. Попробуйте позже.', ephemeral: true });
    }
  }
}

async function handleModerationAction(interaction) {
  try {
    const action = interaction.customId.startsWith('review_approve_') ? 'approve' : 'reject';
    const reviewId = interaction.customId.split('_')[2];

    let reviews = [];
    try {
      reviews = db.get('reviews');
      if (!Array.isArray(reviews)) reviews = [];
    } catch (e) { reviews = []; }

    const reviewIndex = reviews.findIndex(r => r.id === reviewId);

    if (reviewIndex === -1) {
      // Try to reconstruct from embed
      if (interaction.message && interaction.message.embeds.length > 0) {
          const embed = interaction.message.embeds[0];
          // Try to extract data from embed fields
          // Format:
          // User: Tag (<@ID>)
          // Text: ...
          
          let userId = null;
          let userTag = 'Unknown';
          let text = '';

          try {
              const userField = embed.fields.find(f => f.name === 'Пользователь');
              const textField = embed.fields.find(f => f.name === 'Текст отзыва');
              
              if (userField && textField) {
                  const match = userField.value.match(/<@(\d+)>/);
                  if (match) userId = match[1];
                  userTag = userField.value.split(' (')[0];
                  text = textField.value;
              }
          } catch (e) {}

          if (userId && text) {
              // Reconstruct review object
              const restoredReview = {
                  id: reviewId,
                  userId: userId,
                  userTag: userTag,
                  text: text,
                  status: 'pending',
                  createdAt: Date.now()
              };
              
              // Add back to reviews list
              reviews.push(restoredReview);
              
              // Continue processing with the restored review
              // We need to find index again
              // (Fall through to processing logic)
              const newIndex = reviews.length - 1;
              
              // Proceed with action
              if (action === 'reject') {
                reviews[newIndex].status = 'rejected';
                await db.set('reviews', reviews);
                await interaction.update({ content: `❌ Отзыв от **${restoredReview.userTag}** отклонен модератором (восстановлен из сообщения).`, components: [], embeds: [] });
                return;
              } else {
                reviews[newIndex].status = 'approved';
                await db.set('reviews', reviews);
                
                // ... (Publish logic copied from below) ...
                // Publish to public channel
                const logChannel = await interaction.client.channels.fetch(config.reviewsLogChannelId).catch(() => null);
                if (logChannel) {
                    const publicEmbed = new EmbedBuilder()
                    .setTitle('🌟 Новый отзыв!')
                    .setColor(0x00BFFF)
                    .setDescription(restoredReview.text)
                    .setFooter({ text: 'Спасибо за ваш отзыв!' })
                    .setTimestamp();

                    try {
                        const author = await interaction.client.users.fetch(restoredReview.userId);
                        publicEmbed.setAuthor({ name: author.tag, iconURL: author.displayAvatarURL() });
                        publicEmbed.addFields({ name: 'Автор', value: `<@${restoredReview.userId}>`, inline: true });
                    } catch (e) {
                        publicEmbed.setAuthor({ name: restoredReview.userTag });
                    }

                    await logChannel.send({ embeds: [publicEmbed] });
                    
                    // Update channel name counter
                    try {
                        let approvedCount = reviews.filter(r => r.status === 'approved').length;
                        const currentName = logChannel.name;
                        const match = currentName.match(/-(\d+)$/);
                        let currentCount = match ? parseInt(match[1]) : 0;
                        
                        if (approvedCount < currentCount) {
                           approvedCount = currentCount + 1;
                        }

                        const newName = `├・📃・все-отзывы-${approvedCount}`;
                        if (logChannel.name !== newName) await logChannel.setName(newName);
                    } catch (e) {}
                }
                
                await interaction.update({ content: `✅ Отзыв от **${restoredReview.userTag}** успешно опубликован (восстановлен из сообщения)!`, components: [], embeds: [] });
                return;
              }
          }
      }

      // If reconstruction failed
      return interaction.update({ content: '❌ Отзыв не найден в базе данных и не удалось восстановить.', components: [], embeds: [] });
    }

    const review = reviews[reviewIndex];

    if (action === 'reject') {
      reviews[reviewIndex].status = 'rejected';
      await db.set('reviews', reviews);
      await interaction.update({ content: `❌ Отзыв от **${review.userTag}** отклонен модератором.`, components: [], embeds: [] });
    } else {
      // Approve logic
      reviews[reviewIndex].status = 'approved';
      await db.set('reviews', reviews);

      // Publish to public channel
      const logChannel = await interaction.client.channels.fetch(config.reviewsLogChannelId).catch(() => null);
      if (logChannel) {
        const embed = new EmbedBuilder()
          .setTitle('🌟 Новый отзыв!')
          .setColor(0x00BFFF)
          .setDescription(review.text)
          .setFooter({ text: 'Спасибо за ваш отзыв!' })
          .setTimestamp();

        // Try to fetch original author for avatar and mention
        try {
          const author = await interaction.client.users.fetch(review.userId);
          embed.setAuthor({ name: author.tag, iconURL: author.displayAvatarURL() });
          // Option: mention user in description or field
          embed.addFields({ name: 'Автор', value: `<@${review.userId}>`, inline: true });
        } catch (e) {
          embed.setAuthor({ name: review.userTag });
        }

        await logChannel.send({ embeds: [embed] });

        // Update channel name counter
        try {
          // If we lost DB, count might be wrong. Let's try to parse current channel name if DB count is 1 (fresh start)
          let approvedCount = reviews.filter(r => r.status === 'approved').length;
          
          // Heuristic: If we only have 1 approved review in DB (the one we just added),
          // but the channel name says "105", we should probably increment 105 instead of setting it to 1.
          // BUT: we want to sync DB with reality eventually.
          // Better approach: trust DB. If DB is wiped, user has to accept reset or we need to fetch all messages (slow).
          // Compromise: Read current channel name number.
          
          const currentName = logChannel.name; // e.g. "├・📃・все-отзывы-5"
          const match = currentName.match(/-(\d+)$/);
          let currentCount = match ? parseInt(match[1]) : 0;
          
          // If DB count is suspiciously low (e.g. 1) compared to channel name (e.g. 100), assume DB was reset
          // and just increment the channel name counter.
          if (approvedCount < currentCount) {
             approvedCount = currentCount + 1;
          }

          const newName = `├・📃・все-отзывы-${approvedCount}`;
          
          if (currentName !== newName) {
             await logChannel.setName(newName);
          }
        } catch (e) {
          console.warn('[REVIEWS] Failed to update channel name (rate limit?):', e.message);
        }
      }

      await interaction.update({ content: `✅ Отзыв от **${review.userTag}** успешно опубликован!`, components: [], embeds: [] });
    }
  } catch (err) {
    console.error('handleModerationAction fatal error:', err);
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: `❌ Ошибка при модерации: ${err.message}`, ephemeral: true });
      } else {
        await interaction.followUp({ content: `❌ Ошибка при выполнении: ${err.message}`, ephemeral: true });
      }
    } catch (e) {}
  }
}

module.exports = { ensureReviewPanel, handleReviewButton, handleReviewModal };
