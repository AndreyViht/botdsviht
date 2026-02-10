const { EmbedBuilder } = require('discord.js');
const db = require('../libs/db');
const config = require('../config');

const RULES_PANEL_KEY = 'rulesPanelPosted';

function makeRulesEmbed() {
  return new EmbedBuilder()
    .setTitle('📜 Устав Сообщества Viht')
    .setColor(0x2B2D31) // Темный современный цвет
    .setDescription('Добро пожаловать в наше официальное сообщество! Мы ценим открытость, скорость и взаимное уважение. Соблюдение этих простых правил делает сервер полезным для всех.')
    .addFields(
      { 
        name: '🛡️ 1. Приоритет Безопасности и Уважения (Zero Tolerance)', 
        value: '> **1.1 Уважение:** Запрещены оскорбления, травля, токсичность и дискриминация.\n> **1.2 Конфиденциальность:** Запрещена публикация чужих личных данных.\n> **1.3 Запрещенный контент:** 18+, шок-контент, обсуждение нелегальной деятельности.\n> **1.4 Обход наказаний:** Заход с твинков при активном муте/бане = **Бан на 30 дней**.' 
      },
      { 
        name: '🚀 2. Правила Канала (Порядок и Скорость)', 
        value: '> **2.1 Выбор канала:** Вопросы по VPN — в чат-vpn, баги — в помощь.\n> **2.2 Спам:** Запрещены флуд, реклама и несогласованные ссылки.\n> **2.3 Упоминания:** Пингуйте команду только в крайних случаях.\n> **2.4 Флудилка:** Общение на отвлеченные темы — только там.' 
      },
      { 
        name: '📝 3. Взаимодействие с Командой (Viht Team)', 
        value: '> **3.1 Техподдержка:** Описывайте проблему подробно (устройство, действия).\n> **3.2 Обратная связь:** Идеи и баги — в канал предложений.\n> **3.3 Модерация:** Решения команды не обсуждаются публично.' 
      },
      {
        name: '⚖️ Наказания',
        value: 'Нарушение правил ведет к предупреждению, а при повторном нарушении — к временной блокировке или полному бану.',
        inline: false
      }
    )
    .setImage('https://media.discordapp.net/attachments/1446801265219604530/1449749530139693166/image_1.jpg?ex=694007f7&is=693eb677&hm=064f42d3b3d9b6c47515e949319c6c62d86d99b950b21d548f94a7ac60faa19a&=&format=webp') // Используем тот же баннер для красоты
    .setFooter({ text: 'Viht Community • Обновлено 2026' });
}

async function ensureRulesPanel(client) {
  try {
    if (!client) return;
    const ch = await client.channels.fetch(config.rulesChannelId).catch(() => null);
    if (!ch) return console.warn('Rules channel not found:', config.rulesChannelId);

    const rec = db.get(RULES_PANEL_KEY);
    const embed = makeRulesEmbed();

    if (rec && rec.channelId === config.rulesChannelId && rec.messageId) {
      const existing = await ch.messages.fetch(rec.messageId).catch(() => null);
      if (existing) {
        // Optional: update rules in place if changed
        // await existing.edit({ embeds: [embed] }).catch(() => null);
        console.log('Rules panel exists');
        return;
      }
    }

    const msg = await ch.send({ embeds: [embed] }).catch(() => null);
    if (msg && db && db.set) await db.set(RULES_PANEL_KEY, { channelId: config.rulesChannelId, messageId: msg.id, postedAt: Date.now() });
    console.log('Posted rules panel to', config.rulesChannelId);
  } catch (e) {
    console.error('ensureRulesPanel error', e && e.message ? e.message : e);
  }
}

module.exports = { ensureRulesPanel };
