const db = require('../libs/db');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { safeUpdate } = require('../libs/interactionUtils');

const MENU_KEY = 'menuPanelPosted';
const MENU_CHANNEL_ID = '1445738068337496074';

// Хранилище таймеров для восстановления сообщений
const messageRestoreTimers = new Map();
const RESTORE_DELAY = 20000; // 20 секунд

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
        // Try to update it to ensure buttons are latest
        try {
           await existing.edit({ embeds: [embed], components: rows });
           console.log('Updated existing menu panel');
        } catch (e) {}
        return;
      }
    }

    // Double check history
    const messages = await ch.messages.fetch({ limit: 5 });
    const botMsg = messages.find(m => m.author.id === client.user.id && m.embeds.length > 0 && m.embeds[0].title === '🧭 Навигация по Discord серверу Viht');
    
    if (botMsg) {
        console.log('Found existing menu panel via search.');
        // Update it
        try { await botMsg.edit({ embeds: [embed], components: rows }); } catch (e) {}
        if (db && db.set) await db.set(MENU_KEY, { channelId: MENU_CHANNEL_ID, messageId: botMsg.id, postedAt: Date.now() });
        return;
    }

    const msg = await ch.send({ embeds: [embed], components: rows }).catch(() => null);
    if (msg && db && db.set) await db.set(MENU_KEY, { channelId: MENU_CHANNEL_ID, messageId: msg.id, postedAt: Date.now() });
    console.log('Posted new menu panel to', MENU_CHANNEL_ID);
  } catch (e) { console.error('ensureMenuPanel error', e && e.message ? e.message : e); }
}

function makeBackRow() {
  return [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('menu_main').setLabel('◀️ Назад').setStyle(ButtonStyle.Secondary))];
}

async function scheduleMessageRestore(messageId, restoreData) {
  // Отменяем предыдущий таймер если существует
  if (messageRestoreTimers.has(messageId)) {
    clearTimeout(messageRestoreTimers.get(messageId));
  }

  // Устанавливаем новый таймер на восстановление через 20 секунд
  const timerId = setTimeout(() => {
    messageRestoreTimers.delete(messageId);
  }, RESTORE_DELAY);

  messageRestoreTimers.set(messageId, timerId);
}

async function shouldRestoreMessage(messageId) {
  return messageRestoreTimers.has(messageId);
}

async function handleMenuButton(interaction) {
  try {
    const id = interaction.customId;
    const messageId = interaction.message.id;
    
    // Build views
    if (id === 'menu_main') {
      await safeUpdate(interaction, { embeds: [makeMainEmbed()], components: mainRow() });
      scheduleMessageRestore(messageId, { embeds: [makeMainEmbed()], components: mainRow() });
      
      // Восстанавливаем исходное состояние через 20 секунд
      setTimeout(async () => {
        try {
          const msg = await interaction.message.channel.messages.fetch(messageId);
          if (msg && shouldRestoreMessage(messageId)) {
            await msg.edit({ embeds: [makeMainEmbed()], components: mainRow() });
            messageRestoreTimers.delete(messageId);
          }
        } catch (e) {
          console.error('Error restoring main menu:', e && e.message ? e.message : e);
        }
      }, RESTORE_DELAY);
      return;
    }

    if (id === 'menu_vpn') {
      const e = new EmbedBuilder()
        .setTitle('🔐 VihtAI VPN — твой интернет без границ 🌍')
        .setColor(0x00AE86)
        .setDescription(
          'Устал от блокировок, ограничений и медленного соединения?\n' +
          '**Viht VPN** открывает интернет таким, каким он должен быть — **быстрым, свободным и безопасным** ⚡️\n\n' +
          '✨ **Что ты получаешь с Viht VPN:**\n' +
          '🚀 Высокую скорость без лагов\n' +
          '🛡 Надёжную защиту данных и приватности\n' +
          '🌐 Доступ к сайтам и сервисам из любой точки мира\n' +
          '📱 Поддержку ПК, ноутбуков и мобильных устройств\n' +
          '🧠 Простую настройку — справится даже новичок\n\n' +
          '🔓 **Никаких сложных схем**\n' +
          '⏱️ **Минимум кликов**\n' +
          '😌 **Максимум комфорта**\n\n' +
          '👉 **Начни прямо сейчас:**'
        )
        .setFooter({ text: 'Viht VPN — контроль над интернетом в твоих руках. Подключайся сегодня!' });

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setURL('https://vihtai.pro/').setLabel('🌐 Главная страница').setStyle(ButtonStyle.Link),
        new ButtonBuilder().setURL('https://vihtai.pro/downloads').setLabel('⬇️ Скачать VPN').setStyle(ButtonStyle.Link)
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setURL('https://vihtai.pro/instructions').setLabel('📖 Инструкции').setStyle(ButtonStyle.Link),
        new ButtonBuilder().setURL('https://t.me/VihtVPNbot').setLabel('🫧 Бот управления').setStyle(ButtonStyle.Link),
        new ButtonBuilder().setURL('https://t.me/vihtikai').setLabel('❤️ Новости (TG)').setStyle(ButtonStyle.Link)
      );

      await safeUpdate(interaction, { embeds: [e], components: [row1, row2, ...makeBackRow()] });
      scheduleMessageRestore(messageId, { embeds: [makeMainEmbed()], components: mainRow() });
      
      // Восстанавливаем исходное состояние через 20 секунд
      setTimeout(async () => {
        try {
          const msg = await interaction.message.channel.messages.fetch(messageId);
          if (msg && shouldRestoreMessage(messageId)) {
            await msg.edit({ embeds: [makeMainEmbed()], components: mainRow() });
            messageRestoreTimers.delete(messageId);
          }
        } catch (e) {
          console.error('Error restoring main menu after VPN:', e && e.message ? e.message : e);
        }
      }, RESTORE_DELAY);
      return;
    }

    if (id === 'menu_ds') {
      const e = new EmbedBuilder().setTitle('💬 DS Viht').setColor(0x5865F2).setDescription('Полезные ссылки сервера:');
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setURL('https://discord.com/channels/1428051812103094282/1470872101580832982').setLabel('🗣️ Флудилка').setStyle(ButtonStyle.Link)
      );
      await safeUpdate(interaction, { embeds: [e], components: [row, ...makeBackRow()] });
      scheduleMessageRestore(messageId, { embeds: [makeMainEmbed()], components: mainRow() });
      
      // Восстанавливаем исходное состояние через 20 секунд
      setTimeout(async () => {
        try {
          const msg = await interaction.message.channel.messages.fetch(messageId);
          if (msg && shouldRestoreMessage(messageId)) {
            await msg.edit({ embeds: [makeMainEmbed()], components: mainRow() });
            messageRestoreTimers.delete(messageId);
          }
        } catch (e) {
          console.error('Error restoring main menu after DS:', e && e.message ? e.message : e);
        }
      }, RESTORE_DELAY);
      return;
    }

    if (id === 'menu_goods') {
      const e = new EmbedBuilder().setTitle('🛍️ Товары').setColor(0xFFA500).setDescription('Этот раздел скоро появится! Следите за новостями.');
      await safeUpdate(interaction, { embeds: [e], components: makeBackRow() });
      scheduleMessageRestore(messageId, { embeds: [makeMainEmbed()], components: mainRow() });
      
      // Восстанавливаем исходное состояние через 20 секунд
      setTimeout(async () => {
        try {
          const msg = await interaction.message.channel.messages.fetch(messageId);
          if (msg && shouldRestoreMessage(messageId)) {
            await msg.edit({ embeds: [makeMainEmbed()], components: mainRow() });
            messageRestoreTimers.delete(messageId);
          }
        } catch (e) {
          console.error('Error restoring main menu after goods:', e && e.message ? e.message : e);
        }
      }, RESTORE_DELAY);
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
