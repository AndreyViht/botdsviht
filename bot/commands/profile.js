const { SlashCommandBuilder } = require('discord.js');
const db = require('../libs/db');
const chatHistory = require('../ai/chatHistory');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Показывает простую статистику профиля пользователя'),

  async execute(interaction) {
    await db.ensureReady();
    const tickets = db.get('tickets') || [];
    const myTickets = tickets.filter(t => t.creatorId === interaction.user.id).length;
    const aiStats = db.get('stats') || { aiRequests: 0 };
    const historyStats = chatHistory.getStats();
    const myHistory = chatHistory.getHistory(interaction.user.id) || [];

    const lines = [];
    lines.push(`Пользователь: ${interaction.user.tag}`);
    lines.push(`Тикетов: ${myTickets}`);
    lines.push(`Сообщений в истории ИИ (локально): ${myHistory.length}`);
    lines.push(`Всего сохранённых историй (пользователей): ${historyStats.usersWithHistory}`);
    lines.push(`Глобально AI запросов: ${aiStats.aiRequests || 0}`);

    await interaction.reply({ content: lines.join('\n'), ephemeral: true });
  }
};
