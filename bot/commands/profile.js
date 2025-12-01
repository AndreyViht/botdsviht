const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../libs/db');
const chatHistory = require('../ai/chatHistory');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('👤 Просмотр вашего профиля со статистикой и репутацией')

  async execute(interaction) {
    await db.ensureReady();
    const tickets = db.get('tickets') || [];
    const myTickets = tickets.filter(t => t.creatorId === interaction.user.id).length;
    const aiStats = db.get('stats') || { aiRequests: 0 };
    const myHistory = chatHistory.getHistory(interaction.user.id) || [];

    // Get member info for roles and join date (best effort)
    let member = interaction.member;
    if ((!member || !member.joinedAt) && interaction.guild) {
      member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    }

    const roles = (member && member.roles && member.roles.cache) ? member.roles.cache.filter(r => r.id !== interaction.guild?.id).map(r => r.name) : [];
    const joined = member && member.joinedAt ? `${member.joinedAt.toLocaleDateString()} ${member.joinedAt.toLocaleTimeString()}` : '—';

    // Simple reputation score: tickets*5 + aiMessages*1 + roles*2
    const reputation = (myTickets * 5) + (myHistory.length * 1) + (roles.length * 2);

    const embed = new EmbedBuilder()
      .setTitle(`Профиль — ${interaction.user.username}`)
      .setThumbnail(interaction.user.displayAvatarURL({ extension: 'png', size: 128 }))
      .setColor(0x5865F2)
      .addFields(
        { name: 'ID', value: String(interaction.user.id), inline: true },
        { name: 'Вход на сервер', value: joined, inline: true },
        { name: 'Роли (кол-во)', value: String(roles.length || 0), inline: true },
        { name: 'Тикетов создано', value: String(myTickets), inline: true },
        { name: 'Сообщений в истории ИИ (локально)', value: String(myHistory.length), inline: true },
        { name: 'Глобально AI запросов', value: String(aiStats.aiRequests || 0), inline: true },
        { name: 'Репутация', value: String(reputation), inline: true },
        { name: 'Панель управления', value: '[Открыть панель управления](https://discord.com/channels/1428051812103094282/1443194196172476636)', inline: false }
      )
      .setFooter({ text: 'Интерактивный профиль — данные видны только вам.' });

    // Additional explanation (ephemeral as separate message) about how to earn
    const how = `Как получать и зарабатывать очки репутации:\n` +
      `- Создавайте тикеты (каждый тикет = +5 очков)\n` +
      `- Используйте AI (локальные сообщения в истории = +1 очко за сообщение)\n` +
      `- Получайте роли сообщества (каждая роль = +2 очка)\n\n` +
      `Примечание: сообщения ИИ сохраняются локально в памяти бота по умолчанию; администраторы могут управлять политикой хранения.`;

    await interaction.reply({ embeds: [embed], ephemeral: true });
    await interaction.followUp({ content: how, ephemeral: true });
  }
};
