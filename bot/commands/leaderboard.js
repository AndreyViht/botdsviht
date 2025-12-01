const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../libs/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('🏆 Топ-10 пользователей по репутации'),

  async execute(interaction) {
    await db.ensureReady();
    const tickets = db.get('tickets') || [];
    const aiStats = db.get('stats') || { aiRequests: 0 };

    // Get all unique user IDs from tickets
    const userIds = [...new Set(tickets.map(t => t.creatorId))];

    // Calculate reputation for each user
    const userReputation = [];
    for (const userId of userIds) {
      const userTickets = tickets.filter(t => t.creatorId === userId).length;
      const reputation = (userTickets * 5) + (aiStats.aiRequests || 0) * 1;
      if (reputation > 0) {
        userReputation.push({ userId, reputation, tickets: userTickets });
      }
    }

    // Sort by reputation
    userReputation.sort((a, b) => b.reputation - a.reputation);
    const top10 = userReputation.slice(0, 10);

    if (top10.length === 0) {
      return await interaction.reply({
        content: 'На сервере ещё нет активных пользователей.',
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setTitle('🏆 Лидерборд репутации')
      .setColor(0xFFD700)
      .setDescription('Топ-10 активных членов сообщества')
      .setTimestamp();

    let rank = 1;
    for (const user of top10) {
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
      embed.addFields({
        name: `${medal} <@${user.userId}>`,
        value: `⭐ **${user.reputation}** репутация | 🎫 **${user.tickets}** тикетов`,
        inline: false
      });
      rank++;
    }

    embed.setFooter({ text: 'Репутация = Тикеты×5 + AI запросы×1' });
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
