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
        // Optional: update existing message if needed
        // await existing.edit({ embeds: [embed], components: [row] }).catch(() => null);
        console.log('Review panel exists');
        return;
      }
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
  const action = interaction.customId.startsWith('review_approve_') ? 'approve' : 'reject';
  const reviewId = interaction.customId.split('_')[2];

  const reviews = db.get('reviews') || [];
  const reviewIndex = reviews.findIndex(r => r.id === reviewId);

  if (reviewIndex === -1) {
    return interaction.reply({ content: '❌ Отзыв не найден.', ephemeral: true });
  }

  const review = reviews[reviewIndex];

  if (action === 'reject') {
    reviews[reviewIndex].status = 'rejected';
    await db.set('reviews', reviews);
    await interaction.update({ content: `❌ Отзыв от ${review.userTag} отклонен.`, components: [], embeds: [] });
  } else {
    reviews[reviewIndex].status = 'approved';
    await db.set('reviews', reviews);

    // Publish to public channel
    const logChannel = await interaction.client.channels.fetch(config.reviewsLogChannelId).catch(() => null);
    if (logChannel) {
      const embed = new EmbedBuilder()
        .setTitle('🌟 Новый отзыв!')
        .setColor(0x00BFFF)
        .setAuthor({ name: review.userTag, iconURL: interaction.user.displayAvatarURL() }) // Note: might need fetch user for avatar if interaction user != author
        .setDescription(review.text)
        .setFooter({ text: 'Спасибо за ваш отзыв!' })
        .setTimestamp();

      // Try to fetch original author for avatar
      try {
        const author = await interaction.client.users.fetch(review.userId);
        embed.setAuthor({ name: author.tag, iconURL: author.displayAvatarURL() });
      } catch (e) {}

      await logChannel.send({ embeds: [embed] });

      // Update channel name counter
      try {
        const approvedCount = reviews.filter(r => r.status === 'approved').length;
        await logChannel.setName(`├・📃・все-отзывы-${approvedCount}`);
      } catch (e) {
        console.warn('Failed to update review channel name:', e.message);
      }
    }

    await interaction.update({ content: `✅ Отзыв от ${review.userTag} опубликован.`, components: [], embeds: [] });
  }
}

module.exports = { ensureReviewPanel, handleReviewButton, handleReviewModal };
