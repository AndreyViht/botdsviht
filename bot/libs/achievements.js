const db = require('./db');
const { EmbedBuilder } = require('discord.js');

const ACHIEVEMENTS = {
  'first_command': { name: '🎯 Первый шаг', description: 'Использовать первую команду' },
  'first_game': { name: '🎮 Геймер', description: 'Выиграть первую игру' },
  'rep_100': { name: '⭐ Начинающий', description: 'Набрать 100 репутации' },
  'rep_500': { name: '✨ Мастер', description: 'Набрать 500 репутации' },
  'rep_1000': { name: '👑 Легенда', description: 'Набрать 1000 репутации' },
  'wins_10': { name: '🏆 Десятикратный чемпион', description: 'Выиграть 10 игр' },
  'wins_50': { name: '🥇 Чемпион сервера', description: 'Выиграть 50 игр' },
  'daily_7': { name: '🔥 Верный друг', description: 'Получить награду 7 дней подряд' },
  'daily_30': { name: '⚡ Супер верный друг', description: 'Получить награду 30 дней подряд' },
};

async function addAchievement(userId, key, interaction) {
  await db.ensureReady();
  const achievements = db.get('achievements') || {};
  if (!achievements[userId]) achievements[userId] = [];
  if (achievements[userId].includes(key)) return false; // already

  achievements[userId].push(key);
  await db.set('achievements', achievements);

  // Send DM to user
  try {
    const user = interaction.client.users.cache.get(userId) || await interaction.client.users.fetch(userId);
    const ach = ACHIEVEMENTS[key] || { name: key, description: '' };
    const embed = new EmbedBuilder()
      .setTitle('🏅 Достижение разблокировано!')
      .setDescription(`**${ach.name}**\n${ach.description}`)
      .setColor('#FFD700')
      .setTimestamp();
    await user.send({ embeds: [embed] }).catch(() => {});
  } catch (e) {
    // ignore DM errors
  }

  // Optionally notify in channel where command was executed
  try {
    if (interaction.channel) {
      const ach = ACHIEVEMENTS[key] || { name: key, description: '' };
      const embed = new EmbedBuilder()
        .setTitle('🏅 Достижение')
        .setDescription(`<@${userId}> разблокировал достижение **${ach.name}**`)
        .setColor('#FFD700')
        .setTimestamp();
      await interaction.channel.send({ embeds: [embed] }).catch(() => {});
    }
  } catch (e) {}

  return true;
}

async function checkGameAchievements(userId, interaction) {
  await db.ensureReady();
  const gameStats = db.get('gameStats') || {};
  const stats = gameStats[userId] || { wins: 0, losses: 0, totalRep: 0 };

  // first_game
  if (stats.wins >= 1) await addAchievement(userId, 'first_game', interaction);
  if (stats.wins >= 10) await addAchievement(userId, 'wins_10', interaction);
  if (stats.wins >= 50) await addAchievement(userId, 'wins_50', interaction);

  if ((stats.totalRep || 0) >= 100) await addAchievement(userId, 'rep_100', interaction);
  if ((stats.totalRep || 0) >= 500) await addAchievement(userId, 'rep_500', interaction);
  if ((stats.totalRep || 0) >= 1000) await addAchievement(userId, 'rep_1000', interaction);
}

async function checkDailyAchievements(userId, interaction) {
  await db.ensureReady();
  const dailyRewards = db.get('dailyRewards') || {};
  const data = dailyRewards[userId] || { lastClaim: 0, streak: 0 };
  const s = data.streak || 0;
  if (s >= 7) await addAchievement(userId, 'daily_7', interaction);
  if (s >= 30) await addAchievement(userId, 'daily_30', interaction);
}

async function checkFirstCommand(userId, interaction) {
  await db.ensureReady();
  const achievements = db.get('achievements') || {};
  const userAch = achievements[userId] || [];
  if (!userAch.includes('first_command')) {
    await addAchievement(userId, 'first_command', interaction);
  }
}

module.exports = {
  addAchievement,
  checkGameAchievements,
  checkDailyAchievements,
  checkFirstCommand,
  ACHIEVEMENTS,
};
