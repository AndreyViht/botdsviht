const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../libs/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('💰 Проверить или управлять виртуальным балансом')
    .addSubcommand(sub => sub
      .setName('check')
      .setDescription('Проверить ваш баланс (опционально чужой)')
      .addUserOption(opt => opt.setName('user').setDescription('Пользователь').setRequired(false)))
    .addSubcommand(sub => sub
      .setName('add')
      .setDescription('➕ [АДМИН] Добавить монеты пользователю')
      .addUserOption(opt => opt.setName('user').setDescription('Пользователь').setRequired(true))
      .addIntegerOption(opt => opt.setName('amount').setDescription('Количество').setMinValue(1).setRequired(true)))
    .addSubcommand(sub => sub
      .setName('remove')
      .setDescription('➖ [АДМИН] Снять монеты с пользователя')
      .addUserOption(opt => opt.setName('user').setDescription('Пользователь').setRequired(true))
      .addIntegerOption(opt => opt.setName('amount').setDescription('Количество').setMinValue(1).setRequired(true)))
    .addSubcommand(sub => sub
      .setName('set')
      .setDescription('⚙️ [АДМИН] Установить точный баланс')
      .addUserOption(opt => opt.setName('user').setDescription('Пользователь').setRequired(true))
      .addIntegerOption(opt => opt.setName('amount').setDescription('Количество').setMinValue(0).setRequired(true))),

  async execute(interaction) {
    await db.ensureReady();
    const sub = interaction.options.getSubcommand();
    const ADMIN_ROLE = '1436485697392607303';
    const balances = db.get('balances') || {};

    if (sub === 'check') {
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const balance = balances[targetUser.id] || 0;
      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('💰 Баланс')
        .setDescription(`Пользователь: ${targetUser.username}`)
        .addFields({ name: 'Монеты', value: `**${balance}** 🪙`, inline: true })
        .setThumbnail(targetUser.displayAvatarURL());
      return await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Проверка админ прав
    const isAdmin = interaction.member.roles.cache.has(ADMIN_ROLE);
    if (!isAdmin) {
      return await interaction.reply({ content: '❌ Только администраторы могут это делать.', ephemeral: true });
    }

    const targetUser = interaction.options.getUser('user');
    const targetId = targetUser.id;
    const amount = interaction.options.getInteger('amount');

    if (sub === 'add') {
      balances[targetId] = (balances[targetId] || 0) + amount;
      await db.set('balances', balances);
      return await interaction.reply({ content: `✅ Добавлено **${amount}** 🪙 для ${targetUser.username}. Новый баланс: **${balances[targetId]}** 🪙`, ephemeral: true });
    }

    if (sub === 'remove') {
      balances[targetId] = Math.max(0, (balances[targetId] || 0) - amount);
      await db.set('balances', balances);
      return await interaction.reply({ content: `✅ Снято **${amount}** 🪙 с ${targetUser.username}. Новый баланс: **${balances[targetId]}** 🪙`, ephemeral: true });
    }

    if (sub === 'set') {
      balances[targetId] = amount;
      await db.set('balances', balances);
      return await interaction.reply({ content: `✅ Баланс ${targetUser.username} установлен на **${amount}** 🪙`, ephemeral: true });
    }
  }
};
