const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Удалить указанное количество сообщений')
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Количество сообщений (1-100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages), // Default restriction to those who can manage messages
  async execute(interaction) {
    // 1. Check for specific role ID if configured
    // If you want to restrict to ONLY a specific role ID regardless of permissions:
    const ALLOWED_ROLE_ID = '1442572573534552174'; // Replace with your specific role ID if needed, or use config
    
    // Check if user has the role OR is admin
    if (!interaction.member.roles.cache.has(ALLOWED_ROLE_ID) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '🚫 У вас нет прав на использование этой команды.', ephemeral: true });
    }

    const amount = interaction.options.getInteger('amount');

    await interaction.deferReply({ ephemeral: true });

    try {
      const deleted = await interaction.channel.bulkDelete(amount, true); // true = filterOld (ignore messages older than 14 days)
      await interaction.editReply({ content: `✅ Удалено **${deleted.size}** сообщений.` });
    } catch (error) {
      console.error(error);
      await interaction.editReply({ content: '❌ Ошибка при удалении сообщений. Возможно, они слишком старые (старше 14 дней).' });
    }
  }
};
