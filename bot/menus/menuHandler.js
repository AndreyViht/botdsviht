const db = require('../libs/db');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { safeUpdate } = require('../libs/interactionUtils');

const MENU_KEY = 'menuPanelPosted';
const MENU_CHANNEL_ID = '1445738068337496074';

function makeMainEmbed() {
  return new EmbedBuilder()
    .setTitle('🧭 Навигация по Discord серверу Viht')
    .setColor(0x6a5acd)
    .setDescription('Добро пожаловать! Здесь удобная навигация по важным каналам и возможностям сервера. Нажмите кнопку, чтобы открыть раздел — сообщение обновится на месте.')
    .addFields(
      { name: 'Правила', value: 'Коротко о правилах поведения на сервере.', inline: true },
      { name: 'Новости', value: 'Последние объявления и обновления.', inline: true },
      { name: 'Общение', value: 'Чат для общения и обсуждений.', inline: true }
    )
    .setFooter({ text: 'Все ссылки и управление — прямо из этого меню.' });
}

function mainRow() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('menu_vpn').setLabel('🌐 VPN').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('menu_ds').setLabel('💬 DS Viht').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('menu_goods').setLabel('🛍️ Товары').setStyle(ButtonStyle.Secondary)
    )
  ];
}

async function ensureMenuPanel(client) {
  try {
    if (!client) return;
    const ch = await client.channels.fetch(MENU_CHANNEL_ID).catch(() => null);
    if (!ch) return console.warn('Menu channel not found:', MENU_CHANNEL_ID);
    const rec = db.get(MENU_KEY);
    const embed = makeMainEmbed();
    const rows = mainRow();
    if (rec && rec.channelId === MENU_CHANNEL_ID && rec.messageId) {
      const existing = await ch.messages.fetch(rec.messageId).catch(() => null);
      if (existing) {
        await existing.edit({ embeds: [embed], components: rows }).catch(() => null);
        console.log('Updated existing menu panel');
        return;
      }
    }
    const msg = await ch.send({ embeds: [embed], components: rows }).catch(() => null);
    if (msg && db && db.set) await db.set(MENU_KEY, { channelId: MENU_CHANNEL_ID, messageId: msg.id, postedAt: Date.now() });
    console.log('Posted new menu panel to', MENU_CHANNEL_ID);
  } catch (e) { console.error('ensureMenuPanel error', e && e.message ? e.message : e); }
}

function makeBackRow() {
  return [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('menu_main').setLabel('◀️ Назад').setStyle(ButtonStyle.Secondary))];
}

async function handleMenuButton(interaction) {
  try {
    const id = interaction.customId;
    // Build views
    if (id === 'menu_main') {
      await safeUpdate(interaction, { embeds: [makeMainEmbed()], components: mainRow() });
      return;
    }

    if (id === 'menu_vpn') {
      const e = new EmbedBuilder().setTitle('🌐 Viht VPN').setColor(0x00AE86).setDescription('Безопасный и быстрый VPN. Выберите действие:');
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setURL('https://t.me/VihtVPNbot').setLabel('🤖 Бот для VPN').setStyle(ButtonStyle.Link),
        new ButtonBuilder().setURL('https://vihtai.pro/').setLabel('🌍 Сайт').setStyle(ButtonStyle.Link),
        new ButtonBuilder().setURL('https://vihtai.pro/instructions').setLabel('📄 Инструкции').setStyle(ButtonStyle.Link)
      );
      await safeUpdate(interaction, { embeds: [e], components: [row, ...makeBackRow()] });
      return;
    }

    if (id === 'menu_ds') {
      const e = new EmbedBuilder().setTitle('💬 DS Viht').setColor(0x5865F2).setDescription('Полезные ссылки сервера:');
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setURL('https://discord.com/channels/1428051812103094282/1448411376291938336').setLabel('🗣️ Флудилка').setStyle(ButtonStyle.Link),
        new ButtonBuilder().setURL('https://discord.com/channels/1428051812103094282/1442575929044897792').setLabel('🛠️ Поддержка').setStyle(ButtonStyle.Link)
      );
      await safeUpdate(interaction, { embeds: [e], components: [row, ...makeBackRow()] });
      return;
    }

    if (id === 'menu_goods') {
      const e = new EmbedBuilder().setTitle('🛍️ Товары').setColor(0xFFA500).setDescription('Этот раздел скоро появится! Следите за новостями.');
      await safeUpdate(interaction, { embeds: [e], components: makeBackRow() });
      return;
    }

    // Fallback: go back to main
    await safeUpdate(interaction, { embeds: [makeMainEmbed()], components: mainRow() });
  } catch (e) {
    console.error('handleMenuButton error', e && e.message ? e.message : e);
    try { await safeUpdate(interaction, { content: 'Ошибка при навигации.', components: [] }); } catch (er) {}
  }
}

module.exports = { ensureMenuPanel, handleMenuButton };
