const { SlashCommandBuilder } = require('discord.js');
const db = require('../libs/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('anon')
    .setDescription('Отправить анонимное личное сообщение пользователю')
    .addUserOption(opt => opt.setName('user').setDescription('Кому отправить').setRequired(true))
    .addStringOption(opt => opt.setName('text').setDescription('Текст сообщения').setRequired(true)),

  async execute(interaction) {
    const target = interaction.options.getUser('user');
    const text = interaction.options.getString('text');

    if (!target) return interaction.reply({ content: 'Пользователь не найден.', ephemeral: true });
    if (!text || !text.trim()) return interaction.reply({ content: 'Текст обязателен.', ephemeral: true });

    const record = {
      timestamp: new Date().toISOString(),
      fromId: interaction.user.id,
      fromTag: interaction.user.username + '#' + interaction.user.discriminator,
      toId: target.id,
      toTag: target.username + '#' + target.discriminator,
      content: text.slice(0, 1000)
    };

    // Try to send DM anonymously (from bot). If it fails, save to DB for admin review or retry.
    try {
      await target.send({ content: '📨 Анонимное сообщение:\n\n' + text });
      // log success
      try {
        const logs = db.get && db.get('anonLogs') ? db.get('anonLogs') : [];
        const arr = Array.isArray(logs) ? logs : [];
        arr.push(Object.assign({}, record, { delivered: true }));
        await db.set('anonLogs', arr);
      } catch (e) { console.warn('anon: failed to write log', e && e.message ? e.message : e); }

      return interaction.reply({ content: 'Анонимное сообщение отправлено пользователю ' + target.tag + '.', ephemeral: true });
    } catch (e) {
      // DM failed (closed DMs) — store pending and notify sender
      try {
        const pending = db.get && db.get('anonPending') ? db.get('anonPending') : [];
        const arr = Array.isArray(pending) ? pending : [];
        arr.push(Object.assign({}, record, { delivered: false }));
        await db.set('anonPending', arr);
      } catch (ee) { console.warn('anon: failed to save pending', ee && ee.message ? ee.message : ee); }

      return interaction.reply({ content: 'Не удалось доставить DM (возможно, закрыты личные сообщения). Сообщение сохранено и доступно администраторам.', ephemeral: true });
    }
  }
};
