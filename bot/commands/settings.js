const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const db = require('../libs/db');

const ALLOWED_ROLE_ID = '1436485697392607303';

const LANGUAGES = {
  'ru': '🇷🇺 Русский',
  'en': '🇬🇧 English',
  'uk': '🇺🇦 Українська'
};

const COLORS = {
  'red': { name: '🔴 Красный', value: 0xFF0000 },
  'blue': { name: '🔵 Синий', value: 0x0099FF },
  'green': { name: '🟢 Зелёный', value: 0x00FF00 },
  'purple': { name: '🟣 Фиолетовый', value: 0x800080 },
  'pink': { name: '💗 Розовый', value: 0xFF1493 },
  'orange': { name: '🟠 Оранжевый', value: 0xFFA500 }
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('settings')
    .setDescription('🔧 Панель настроек сервера'),

  async execute(interaction) {
    // Проверка роли
    const member = interaction.member;
    if (!member || !member.roles.cache.has(ALLOWED_ROLE_ID)) {
      return await interaction.reply({
        content: '❌ У тебя нет прав для этой команды!',
        ephemeral: true
      });
    }

    await db.ensureReady();
    const guildSettings = db.get(`guild_${interaction.guildId}`) || {};

    // Создаём главную панель
    const embed = new EmbedBuilder()
      .setTitle('⚙️ Панель настроек')
      .setColor(0x9b59b6)
      .setDescription('Выбери что хочешь настроить:')
      .addFields(
        { name: '📌 Префикс', value: guildSettings.prefix || '/', inline: true },
        { name: '🌐 Язык', value: LANGUAGES[guildSettings.language || 'ru'] || '🇷🇺 Русский', inline: true },
        { name: '🎨 Цвет embeds', value: guildSettings.color ? `#${guildSettings.color.toString(16).toUpperCase().padStart(6, '0')}` : '🔵 Синий', inline: true }
      )
      .setFooter({ text: 'Нажми на кнопку для изменения' });

    const prefixBtn = new ButtonBuilder()
      .setCustomId('settings_prefix')
      .setLabel('Префикс')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('📌');

    const languageBtn = new ButtonBuilder()
      .setCustomId('settings_language')
      .setLabel('Язык')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🌐');

    const colorBtn = new ButtonBuilder()
      .setCustomId('settings_color')
      .setLabel('Цвет')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🎨');

    const row = new ActionRowBuilder().addComponents(prefixBtn, languageBtn, colorBtn);

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });
  }
};

// Обработчик кнопок
module.exports.handleButton = async (interaction) => {
  if (!interaction.customId.startsWith('settings_')) return;

  const member = interaction.member;
  if (!member || !member.roles.cache.has(ALLOWED_ROLE_ID)) {
    return await interaction.reply({
      content: '❌ У тебя нет прав!',
      ephemeral: true
    });
  }

  if (interaction.customId === 'settings_prefix') {
    const modal = new ModalBuilder()
      .setCustomId('settings_prefix_modal')
      .setTitle('Изменить префикс');

    const input = new TextInputBuilder()
      .setCustomId('prefix_input')
      .setLabel('Новый префикс')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('/')
      .setMaxLength(3)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
  }

  if (interaction.customId === 'settings_language') {
    const select = new SelectMenuBuilder()
      .setCustomId('settings_language_select')
      .setPlaceholder('Выбери язык')
      .addOptions(
        { label: '🇷🇺 Русский', value: 'ru' },
        { label: '🇬🇧 English', value: 'en' },
        { label: '🇺🇦 Українська', value: 'uk' }
      );

    const row = new ActionRowBuilder().addComponents(select);
    await interaction.reply({
      content: '🌐 Выбери язык бота:',
      components: [row],
      ephemeral: true
    });
  }

  if (interaction.customId === 'settings_color') {
    const select = new SelectMenuBuilder()
      .setCustomId('settings_color_select')
      .setPlaceholder('Выбери цвет')
      .addOptions(
        ...Object.entries(COLORS).map(([key, color]) => ({
          label: color.name,
          value: key
        }))
      );

    const row = new ActionRowBuilder().addComponents(select);
    await interaction.reply({
      content: '🎨 Выбери цвет для embeds:',
      components: [row],
      ephemeral: true
    });
  }
};

// Обработчик селектов
module.exports.handleSelect = async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;

  const member = interaction.member;
  if (!member || !member.roles.cache.has(ALLOWED_ROLE_ID)) {
    return await interaction.reply({
      content: '❌ У тебя нет прав!',
      ephemeral: true
    });
  }

  await db.ensureReady();

  if (interaction.customId === 'settings_language_select') {
    const language = interaction.values[0];
    const guildSettings = db.get(`guild_${interaction.guildId}`) || {};
    guildSettings.language = language;
    await db.set(`guild_${interaction.guildId}`, guildSettings);

    await interaction.reply({
      content: `✅ Язык изменён на ${LANGUAGES[language]}`,
      ephemeral: true
    });
  }

  if (interaction.customId === 'settings_color_select') {
    const colorKey = interaction.values[0];
    const color = COLORS[colorKey];
    const guildSettings = db.get(`guild_${interaction.guildId}`) || {};
    guildSettings.color = color.value;
    await db.set(`guild_${interaction.guildId}`, guildSettings);

    await interaction.reply({
      content: `✅ Цвет изменён на ${color.name}`,
      ephemeral: true
    });
  }
};

// Обработчик модалей
module.exports.handleModal = async (interaction) => {
  if (!interaction.isModalSubmit()) return;

  const member = interaction.member;
  if (!member || !member.roles.cache.has(ALLOWED_ROLE_ID)) {
    return await interaction.reply({
      content: '❌ У тебя нет прав!',
      ephemeral: true
    });
  }

  await db.ensureReady();

  if (interaction.customId === 'settings_prefix_modal') {
    const prefix = interaction.fields.getTextInputValue('prefix_input');
    const guildSettings = db.get(`guild_${interaction.guildId}`) || {};
    guildSettings.prefix = prefix;
    await db.set(`guild_${interaction.guildId}`, guildSettings);

    await interaction.reply({
      content: `✅ Префикс изменён на \`${prefix}\``,
      ephemeral: true
    });
  }
};
