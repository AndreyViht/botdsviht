const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../libs/db');

const achievements = {
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

module.exports = {
  data: new SlashCommandBuilder()
    .setName('achievements')
    .setDescription('🏅 Просмотр ваших достижений')
    .addUserOption(opt => opt.setName('user').setDescription('Пользователь (по умолчанию вы)').setRequired(false)),

  async execute(interaction) {
    await db.ensureReady();
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const userId = targetUser.id;

    const userAchievements = db.get('achievements') || {};
    const userAch = userAchievements[userId] || [];

    const embed = new EmbedBuilder()
      .setTitle(`🏅 Достижения ${targetUser.username}`)
      .setColor(0xFFD700)
      .setThumbnail(targetUser.displayAvatarURL({ extension: 'png', size: 128 }))
      .setDescription(`Получено достижений: **${userAch.length}/${Object.keys(achievements).length}**\n\n`);

    for (const [key, ach] of Object.entries(achievements)) {
      const unlocked = userAch.includes(key);
      const status = unlocked ? '✅' : '🔒';
      embed.addFields({
        name: `${status} ${ach.name}`,
        value: ach.description,
        inline: false
      });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
