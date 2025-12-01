const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../libs/db');

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('flip')
    .setDescription('🪙 Подкинуть монетку (орёл/решка), получить репутацию'),

  async execute(interaction) {
    await db.ensureReady();
    const userId = interaction.user.id;

    const coinFlip = randInt(0, 1);
    const userGuess = randInt(0, 1); // 0 = орёл, 1 = решка
    const won = coinFlip === userGuess;
    const rewardRep = won ? 1 : 0;

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

    const result = coinFlip === 0 ? '🦅 Орёл' : '⚙️ Решка';
    const guess = userGuess === 0 ? '🦅 Орёл' : '⚙️ Решка';

    const embed = new EmbedBuilder()
      .setTitle('🪙 Монетка')
      .setColor(won ? 0x00AA00 : 0xAA0000)
      .addFields(
        { name: 'Твой выбор', value: guess, inline: true },
        { name: 'Результат', value: result, inline: true },
        { name: 'Исход', value: won ? '✅ **ПРАВИЛЬНО!** +1 репутация' : '❌ Не угадал', inline: false }
      )
      .setFooter({ text: `Всего побед: ${gameStats[userId].wins} | Всего поражений: ${gameStats[userId].losses}` });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
