const { InteractionType } = require('discord.js');
const { safeReply, safeUpdate, safeShowModal } = require('../libs/interactionUtils');
const { handleMenuButton } = require('../menus/menuHandler');
const { handlePetSpeciesSelect, handlePetBreedButton, handlePetButton, handleMyPetsList } = require('../menus/petsHandler');
const { handleReviewButton, handleReviewModal } = require('../commands/reviewsHandler');
const { handleMusicButton } = require('../commands/musicHandler');

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

      if (interaction.isStringSelectMenu()) {
        // НЕ дефирим! Просто передаём на обработку
        await handleSelectMenu(interaction);
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

  // Music buttons
  if (customId && customId.startsWith('music_')) {
    try { await handleMusicButton(interaction); } catch (err) { console.error('Music button error', err); await safeReply(interaction, { content: 'Ошибка музыки.', ephemeral: true }); }
    return;
  }

  // Pet breed buttons
  if (customId && customId.startsWith('pet_breed_button_')) {
    try { await handlePetBreedButton(interaction); } catch (err) { console.error('Pet breed button error', err); await safeReply(interaction, { content: 'Ошибка при выборе породы.', ephemeral: true }); }
    return;
  }

  // Pet action buttons
  if (customId && customId.startsWith('pet_')) {
    try { await handlePetButton(interaction); } catch (err) { console.error('Pet button error', err); await safeReply(interaction, { content: 'Ошибка при управлении питомцем.', ephemeral: true }); }
    return;
  }

  // My pets list button
  if (customId === 'my_pets_list') {
    try { await handleMyPetsList(interaction); } catch (err) { console.error('My pets list error', err); await safeReply(interaction, { content: 'Ошибка при загрузке питомцев.', ephemeral: true }); }
    return;
  }
}

async function handleSelectMenu(interaction) {
  const customId = interaction.customId;
  console.log(`[SELECT_MENU] Received: ${customId}`);

  // Pet species select
  if (customId === 'pet_species_select') {
    try { 
      await handlePetSpeciesSelect(interaction); 
    } catch (err) { 
      console.error('[SELECT_MENU] Species select error:', err.message); 
      try {
        await safeReply(interaction, { content: 'Ошибка при выборе вида.', ephemeral: true });
      } catch (e) {}
    }
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

  // Pet name modal
  if (customId && customId.startsWith('pet_name_modal_')) {
    try {
      const { handlePetNameModal } = require('../menus/petsHandler');
      await handlePetNameModal(interaction);
    } catch (err) { console.error('Pet name modal error', err); await safeReply(interaction, { content: 'Ошибка при создании питомца.', ephemeral: true }); }
    return;
  }
}
