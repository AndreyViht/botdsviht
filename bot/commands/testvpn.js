const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const db = require('../libs/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('testvpn')
    .setDescription('🧸 Показать/протестировать тестовый VPN (IP защищен)'),

  async execute(interaction) {
    await interaction.deferReply();
    try {
      const ip = db.get && db.get('testVpnIp') ? db.get('testVpnIp') : null;
      if (!ip) return await interaction.editReply('Тестовый IP не задан. Админ может установить его командой /setvpn.');

      // Do a geo lookup but avoid exposing raw IP to non-admins
      const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,city,regionName,isp,org,query,proxy`;
      const resp = await axios.get(url, { timeout: 8000 }).catch(() => null);
      let country = 'Неизвестно', city = 'Неизвестно', isp = 'Неизвестно', org = '', proxy = false;
      if (resp && resp.data && resp.data.status === 'success') {
        country = resp.data.country || country;
        city = resp.data.city || city;
        isp = resp.data.isp || isp;
        org = resp.data.org || '';
        proxy = resp.data.proxy || false;
      }

      const embed = new EmbedBuilder()
        .setTitle('🔎 Тест VPN')
        .setColor(0x3498db)
        .setDescription('Информация по тестовому адресу (IP скрыт для безопасности).')
        .addFields(
          { name: 'Страна', value: country, inline: true },
          { name: 'Город/Регион', value: city + (org ? ` (${org})` : ''), inline: true },
          { name: 'Провайдер', value: isp, inline: true },
          { name: 'Proxy/VPN Detected', value: proxy ? 'Возможен прокси/VPN' : 'Похоже на прямое подключение', inline: false }
        )
        .setFooter({ text: 'Админ может увидеть IP через /setvpn или просмотр db.json' });

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('testvpn error', err && err.message ? err.message : err);
      await interaction.editReply('Не удалось выполнить тест VPN.');
    }
  }
};
