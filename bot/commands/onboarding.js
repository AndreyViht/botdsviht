const { SlashCommandBuilder } = require('discord.js');
const db = require('../libs/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('onboarding')
    .setDescription('Настройки приветственных сообщений (DM)')
    .addStringOption(opt => opt.setName('action').setDescription('optin|optout|status').setRequired(true)),

  async execute(interaction) {
    const action = interaction.options.getString('action');
    const userId = interaction.user.id;
    await db.ensureReady();
    const prefs = db.get('prefs') || {};
    prefs.onboarding = prefs.onboarding || {};

    if (action === 'optout') {
      prefs.onboarding[userId] = false;
      await db.set('prefs', prefs);
      return await interaction.reply({ content: 'Отключено приветственное DM.', ephemeral: true });
    }
    if (action === 'optin') {
      prefs.onboarding[userId] = true;
      await db.set('prefs', prefs);
      return await interaction.reply({ content: 'Включено приветственное DM.', ephemeral: true });
    }
    // status
    const status = prefs.onboarding[userId] !== false;
    await interaction.reply({ content: status ? 'Приветственные DM включены.' : 'Приветственные DM отключены.', ephemeral: true });
  }
};
