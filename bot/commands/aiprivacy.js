const { SlashCommandBuilder } = require('discord.js');
const db = require('../libs/db');
const chatHistory = require('../ai/chatHistory');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('aiprivacy')
    .setDescription('Настройки приватности для AI (история)')
    .addStringOption(opt => opt.setName('action').setDescription('optin|optout|delete').setRequired(true)),

  async execute(interaction) {
    const action = interaction.options.getString('action');
    const userId = interaction.user.id;
    await db.ensureReady();
    const aiPrefs = db.get('aiPrefs') || {};

    if (action === 'optout') {
      aiPrefs[userId] = { optOut: true };
      await db.set('aiPrefs', aiPrefs);
      return await interaction.reply({ content: 'Вы отключили сохранение истории общения с ИИ.', ephemeral: true });
    }
    if (action === 'optin') {
      aiPrefs[userId] = { optOut: false };
      await db.set('aiPrefs', aiPrefs);
      return await interaction.reply({ content: 'Вы включили сохранение истории общения с ИИ.', ephemeral: true });
    }
    if (action === 'delete') {
      chatHistory.clearHistory(userId);
      // Also remove from aiPrefs
      if (aiPrefs[userId]) delete aiPrefs[userId];
      await db.set('aiPrefs', aiPrefs);
      return await interaction.reply({ content: 'Ваша история с ИИ удалена.', ephemeral: true });
    }

    await interaction.reply({ content: 'Неизвестная команда.', ephemeral: true });
  }
};
