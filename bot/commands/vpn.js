const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');

// The real IP is considered private and must not be shown. We will analyze
// the IP 45.135.182.8 but not print it — only show location/provider info.
const PROTECTED_IP = '45.135.182.8';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vpn')
    .setDescription('🌐 Анализ VPN: местоположение, провайдер (IP защищен)'),

  async execute(interaction) {
    await interaction.deferReply();
    try {
      // Use ip-api.com for a free geo lookup. If it fails, show graceful fallback.
      const url = `http://ip-api.com/json/${PROTECTED_IP}?fields=status,country,city,regionName,isp,org,query,proxy`;
      const resp = await axios.get(url, { timeout: 8000 }).catch(() => null);
      let country = 'Неизвестно';
      let city = 'Неизвестно';
      let isp = 'Неизвестно';
      let org = '';
      let proxy = false;
      if (resp && resp.data && resp.data.status === 'success') {
        country = resp.data.country || country;
        city = resp.data.city || city;
        isp = resp.data.isp || isp;
        org = resp.data.org || '';
        proxy = resp.data.proxy || false;
      }

      const embed = new EmbedBuilder()
        .setTitle('🔒 Анализ VPN-соединения')
        .setColor(0x2ecc71)
        .setDescription('IP адрес скрыт в целях безопасности. Ниже — результаты анализа публичных метаданных.')
        .addFields(
          { name: 'Страна', value: country, inline: true },
          { name: 'Город/Регион', value: city + (org ? ` (${org})` : ''), inline: true },
          { name: 'Провайдер', value: isp, inline: true },
          { name: 'Proxy/VPN Detected', value: proxy ? 'Возможен прокси/VPN' : 'Похоже, что это прямое подключение', inline: false },
          { name: 'Скорость подключения', value: 'Невозможно точно определить скорость по IP. Для оценки используйте команду /test (локальный тест задержки и AI).', inline: false }
        )
        .setFooter({ text: 'Сведения получены по публичным данным геолокации. IP не раскрывается.' });

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('VPN command error:', err && err.message ? err.message : err);
      await interaction.editReply('Не удалось выполнить анализ VPN. Попробуйте позже.');
    }
  }
};
