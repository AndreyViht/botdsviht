const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../libs/db');

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roulette')
    .setDescription('🎡 Русская рулетка - 1 из 6 шанс (выигрыш +3 репутация)'),

  async execute(interaction) {
    await db.ensureReady();
    const userId = interaction.user.id;

    const random = randInt(1, 6);
    const won = random === 3; // один шанс из 6
    const rewardRep = won ? 3 : 0;

    // Update stats
    const gameStats = db.get('gameStats') || {};
    if (!gameStats[userId]) gameStats[userId] = { wins: 0, losses: 0, totalRep: 0 };
    if (won) {
      gameStats[userId].wins++;
      gameStats[userId].totalRep += rewardRep;
    } else {
      gameStats[userId].losses++;
    }
    await db.set('gameStats', gameStats);

    // Awards
    try {
      const ach = require('../libs/achievements');
      await ach.checkFirstCommand(userId, interaction);
      await ach.checkGameAchievements(userId, interaction);
    } catch (e) {}

    const chamber = Array(6).fill('💨').map((v, i) => i === 2 ? '💥' : v);
    const chambers = chamber.join('');

    const embed = new EmbedBuilder()
      .setTitle('🎡 Русская рулетка')
      .setColor(won ? 0xFF6600 : 0xAA0000)
      .addFields(
        { name: 'Барабан', value: chambers, inline: false },
        { name: 'Результат', value: won ? '💥 **БУМ! ВЫЖИЛ!** +3 репутация' : '💨 Хлопок... осечка', inline: false }
      )
      .setFooter({ text: `Всего побед: ${gameStats[userId].wins} | Всего поражений: ${gameStats[userId].losses}` });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
