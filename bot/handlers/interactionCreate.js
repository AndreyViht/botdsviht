const { InteractionType } = require('discord.js');
const { safeReply, safeUpdate, safeShowModal } = require('../libs/interactionUtils');
const { handleMenuButton } = require('../menus/menuHandler');
const { handleReviewButton, handleReviewModal } = require('../commands/reviewsHandler');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    try {
      // Attach helpers
      try {
        interaction.safeReply = (opts) => safeReply(interaction, opts);
        interaction.safeUpdate = (opts) => safeUpdate(interaction, opts);
        interaction.safeShowModal = (modal) => safeShowModal(interaction, modal);
      } catch (e) {}

      if (interaction.type === InteractionType.ApplicationCommand) {
        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) {
            await safeReply(interaction, { content: 'Команда больше не доступна или не найдена.', ephemeral: true });
            return;
        }
        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            await safeReply(interaction, { content: 'Ошибка при выполнении команды.', ephemeral: true });
        }
        return;
      }

      if (interaction.isButton()) {
        await handleButton(interaction);
        return;
      }

      if (interaction.isModalSubmit()) {
        await handleModalSubmit(interaction);
        return;
      }

    } catch (err) {
      console.error('interactionCreate handler error', err);
    }
  }
};

async function handleButton(interaction) {
  const customId = interaction.customId;

  // Verification button
  if (customId === 'verify_start') {
    try {
      const verification = require('../roles/reactionRole');
      if (verification.handleVerificationButton) {
        await verification.handleVerificationButton(interaction);
      }
    } catch (err) {
      console.error('Verification button error', err);
      await safeReply(interaction, { content: 'Ошибка верификации.', ephemeral: true });
    }
    return;
  }

  // Menu buttons
  if (customId && customId.startsWith('menu_')) {
    try { await handleMenuButton(interaction); } catch (err) { console.error('Menu button error', err); await safeReply(interaction, { content: 'Ошибка при обработке меню.', ephemeral: true }); }
    return;
  }

  // Review buttons
  if (customId && customId.startsWith('review_')) {
    try { await handleReviewButton(interaction); } catch (err) { console.error('Review button error', err); await safeReply(interaction, { content: 'Ошибка при обработке отзыва.', ephemeral: true }); }
    return;
  }
}

async function handleModalSubmit(interaction) {
  const customId = interaction.customId;

  // Verification modal
  if (customId && customId.startsWith('verify_modal_')) {
    try {
      const verification = require('../roles/reactionRole');
      if (verification.handleVerificationModal) {
        await verification.handleVerificationModal(interaction);
      }
    } catch (err) {
      console.error('Verification modal error', err);
      await safeReply(interaction, { content: 'Ошибка верификации.', ephemeral: true });
    }
    return;
  }

  // Review modal
  if (customId === 'review_modal') {
    try { await handleReviewModal(interaction); } catch (err) { console.error('Review modal error', err); await safeReply(interaction, { content: 'Ошибка при отправке отзыва.', ephemeral: true }); }
    return;
  }
}
