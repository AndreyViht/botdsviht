const { SlashCommandBuilder } = require('discord.js');
const db = require('../libs/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lang')
    .setDescription('Выбрать язык для бота')
    .addStringOption(o => o.setName('locale').setDescription('ru|en').setRequired(true)),

  async execute(interaction) {
    const locale = interaction.options.getString('locale') === 'en' ? 'en' : 'ru';
    await db.ensureReady();
    const userLangs = db.get('userLangs') || {};
    userLangs[interaction.user.id] = locale;
    await db.set('userLangs', userLangs);
    // Also keep on client for quick access
    if (interaction.client) {
      interaction.client.userLangs = interaction.client.userLangs || new Map();
      interaction.client.userLangs.set(interaction.user.id, locale);
    }
    await interaction.reply({ content: locale === 'en' ? 'Language set to English.' : 'Язык установлен: Русский.', ephemeral: true });
  }
};
