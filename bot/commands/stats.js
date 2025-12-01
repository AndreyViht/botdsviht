const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../libs/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('📊 Просмотр расширенной статистики игрока (победы, поражения)')
    .addUserOption(opt => opt.setName('user').setDescription('Пользователь (по умолчанию вы)').setRequired(false)),

  async execute(interaction) {
    await db.ensureReady();
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const userId = targetUser.id;

    const gameStats = db.get('gameStats') || {};
    const dailyRewards = db.get('dailyRewards') || {};
    const userGameStats = gameStats[userId] || { wins: 0, losses: 0, totalRep: 0 };
    const userDailyStats = dailyRewards[userId] || { streak: 0 };

    const totalGames = userGameStats.wins + userGameStats.losses;
    const winRate = totalGames > 0 ? ((userGameStats.wins / totalGames) * 100).toFixed(1) : 0;

    const embed = new EmbedBuilder()
      .setTitle(`📊 Статистика ${targetUser.username}`)
      .setColor(0x5865F2)
      .setThumbnail(targetUser.displayAvatarURL({ extension: 'png', size: 128 }))
      .addFields(
        { name: '🎮 Игры', value: `Всего игр: **${totalGames}**\nПобед: **${userGameStats.wins}** 🏆\nПоражений: **${userGameStats.losses}** 💀\nПроцент побед: **${winRate}%**`, inline: true },
        { name: '⭐ Награды', value: `Репутация от игр: **${userGameStats.totalRep}**\nТекущая серия дней: **${userDailyStats.streak}** 🔥`, inline: true }
      )
      .setFooter({ text: 'Играйте в игры и зарабатывайте репутацию!' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
