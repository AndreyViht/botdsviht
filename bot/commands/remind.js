const { SlashCommandBuilder } = require('discord.js');
const db = require('../libs/db');

function parseDuration(s) {
  // supports 10m 2h 1d or minutes as number
  if (!s) return null;
  s = s.trim();
  const m = /^([0-9]+)m$/.exec(s);
  if (m) return parseInt(m[1],10)*60*1000;
  const h = /^([0-9]+)h$/.exec(s);
  if (h) return parseInt(h[1],10)*60*60*1000;
  const d = /^([0-9]+)d$/.exec(s);
  if (d) return parseInt(d[1],10)*24*60*60*1000;
  const n = parseInt(s,10);
  if (!isNaN(n)) return n*60*1000;
  return null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remind')
    .setDescription('⏰ Установить напоминание (например: 10m, 2h, 1d)')
    .addStringOption(o => o.setName('when').setDescription('Через какое время (10m/2h/1d)').setRequired(true))
    .addStringOption(o => o.setName('text').setDescription('Текст напоминания').setRequired(true)),

  async execute(interaction) {
    const when = interaction.options.getString('when');
    const text = interaction.options.getString('text').slice(0,200);
    const dur = parseDuration(when);
    if (!dur) return await interaction.reply({ content: 'Непонятный формат времени. Примеры: 10m, 2h, 1d', ephemeral: true });
    await db.ensureReady();
    const reminders = db.get('reminders') || [];
    const id = `r_${Date.now()}`;
    const rec = { id, userId: interaction.user.id, channelId: interaction.channelId, when: Date.now()+dur, text };
    reminders.push(rec);
    await db.set('reminders', reminders);

    // schedule immediate
    setTimeout(async () => {
      try { const ch = await interaction.client.channels.fetch(rec.channelId).catch(()=>null); if (ch) await ch.send(`<@${rec.userId}> Напоминание: ${rec.text}`); } catch (e) {}
      // remove
      const cur = db.get('reminders') || [];
      await db.set('reminders', cur.filter(r => r.id !== id));
    }, dur);

    await interaction.reply({ content: `Напоминание установлено (ID: ${id}).`, ephemeral: true });
  }
};
