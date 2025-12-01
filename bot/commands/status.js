const { SlashCommandBuilder } = require('discord.js');
const db = require('../libs/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('💬 Установить или просмотреть кастомный статус')
    .addSubcommand(sub => sub
      .setName('set')
      .setDescription('Установить кастомный статус (до 100 символов)')
      .addStringOption(opt => opt.setName('text').setDescription('Текст статуса').setRequired(true).setMaxLength(100)))
    .addSubcommand(sub => sub
      .setName('get')
      .setDescription('Просмотреть кастомный статус')
      .addUserOption(opt => opt.setName('user').setDescription('Пользователь (по умолчанию вы)').setRequired(false)))
    .addSubcommand(sub => sub
      .setName('clear')
      .setDescription('Удалить свой кастомный статус')),

  async execute(interaction) {
    await db.ensureReady();
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    const userStatuses = db.get('userStatuses') || {};

    if (sub === 'set') {
      const statusText = interaction.options.getString('text');
      userStatuses[userId] = statusText;
      await db.set('userStatuses', userStatuses);
      return await interaction.reply({
        content: `✅ Ваш статус установлен: **"${statusText}"**`,
        ephemeral: true
      });
    }

    if (sub === 'get') {
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const targetId = targetUser.id;
      const status = userStatuses[targetId] || 'Нет статуса';
      return await interaction.reply({
        content: `📝 Статус ${targetUser.username}: **"${status}"**`,
        ephemeral: true
      });
    }

    if (sub === 'clear') {
      delete userStatuses[userId];
      await db.set('userStatuses', userStatuses);
      return await interaction.reply({
        content: '✅ Ваш статус удалён.',
        ephemeral: true
      });
    }
  }
};
