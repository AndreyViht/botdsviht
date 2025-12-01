const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../libs/db');

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dice')
    .setDescription('🎲 Бросить кубик (1-6), получить репутацию за выигрыш'),

  async execute(interaction) {
    await db.ensureReady();
    const userId = interaction.user.id;

    // Dice roll: 1-6
    const roll = randInt(1, 6);
    const userRoll = randInt(1, 6);

    // Win = user roll >= bot roll, get +2 reputation
    const won = userRoll >= roll;
    const rewardRep = won ? 2 : 0;

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

    const embed = new EmbedBuilder()
      .setTitle('🎲 Игра в кубики')
      .setColor(won ? 0x00AA00 : 0xAA0000)
      .addFields(
        { name: 'Твой бросок', value: `🎲 **${userRoll}**`, inline: true },
        { name: 'Бросок бота', value: `🎲 **${roll}**`, inline: true },
        { name: 'Результат', value: won ? '✅ **ПОБЕДА!** +2 репутация' : '❌ Поражение', inline: false }
      )
      .setFooter({ text: `Всего побед: ${gameStats[userId].wins} | Всего поражений: ${gameStats[userId].losses}` });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
