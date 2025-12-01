const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../libs/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('transfer')
    .setDescription('💸 Отправить монеты другому пользователю')
    .addUserOption(opt => opt.setName('recipient').setDescription('Получатель').setRequired(true))
    .addIntegerOption(opt => opt.setName('amount').setDescription('Количество монет').setMinValue(1).setRequired(true)),

  async execute(interaction) {
    await db.ensureReady();
    const sender = interaction.user;
    const senderId = sender.id;
    const recipient = interaction.options.getUser('recipient');
    const recipientId = recipient.id;
    const amount = interaction.options.getInteger('amount');

    if (senderId === recipientId) {
      return await interaction.reply({ content: '❌ Вы не можете отправить монеты самому себе.', ephemeral: true });
    }

    const balances = db.get('balances') || {};
    const senderBalance = balances[senderId] || 0;

    if (senderBalance < amount) {
      return await interaction.reply({ content: `❌ Недостаточно монет. У вас есть **${senderBalance}** 🪙, а нужно **${amount}** 🪙`, ephemeral: true });
    }

    // Выполнить трансфер
    balances[senderId] = senderBalance - amount;
    balances[recipientId] = (balances[recipientId] || 0) + amount;
    await db.set('balances', balances);

    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('💸 Трансфер выполнен')
      .addFields(
        { name: 'От', value: sender.username, inline: true },
        { name: 'Кому', value: recipient.username, inline: true },
        { name: 'Сумма', value: `**${amount}** 🪙`, inline: false },
        { name: 'Ваш новый баланс', value: `**${balances[senderId]}** 🪙`, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    // Уведомление получателю
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('💸 Вы получили монеты!')
        .addFields(
          { name: 'От', value: sender.username, inline: true },
          { name: 'Сумма', value: `**${amount}** 🪙`, inline: true },
          { name: 'Ваш новый баланс', value: `**${balances[recipientId]}** 🪙`, inline: false }
        )
        .setTimestamp();
      await recipient.send({ embeds: [dmEmbed] });
    } catch (err) {
      // Silent fail если DM не отправляется
    }
  }
};
