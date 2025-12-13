const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, StringSelectMenuBuilder } = require('discord.js');
const db = require('../libs/db');

const PANEL_CHANNEL_ID = '1448413112423288903';
const PUBLISHER_ROLE_ID = '1441756621586829355';

// In-memory post sessions
const postSessions = new Map();

// Color presets
const COLOR_PRESETS = {
  'red': 0xFF0000,
  'green': 0x00FF00,
  'blue': 0x0000FF,
  'yellow': 0xFFFF00,
  'purple': 0x800080,
  'cyan': 0x00FFFF,
  'orange': 0xFFA500,
  'pink': 0xFF69B4
};

// Build manager panel embed
function buildPostManagerEmbed() {
  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('📝 Менеджер постов v2')
    .setDescription('Создавай и публикуй посты с фото, видео и файлами')
    .addFields(
      { name: '✨ Как использовать', value: '1. Нажми "Новый пост"\n2. Выбери канал\n3. Отправляй: заголовок, текст, файлы\n4. Выбери цвет и опубликуй' }
    )
    .setFooter({ text: 'Post Manager v2.0' });
}

// Build control buttons
function buildControlRow() {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('post_create')
        .setLabel('➕ Новый пост')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('post_preview')
        .setLabel('👁️ Просмотр')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('post_publish')
        .setLabel('📤 Опубликовать')
        .setStyle(ButtonStyle.Danger)
    );
}

// Post manager panel
async function postPostManagerPanel(client) {
  try {
    console.log('[POST_MANAGER] Posting panel...');
    
    const ch = await client.channels.fetch(PANEL_CHANNEL_ID).catch(() => null);
    if (!ch) {
      console.warn('[POST_MANAGER] Channel not found');
      return false;
    }

    const embed = buildPostManagerEmbed();
    const row = buildControlRow();

    try {
      await db.ensureReady();
    } catch (err) {
      console.warn('[POST_MANAGER] DB error:', err.message);
    }

    // Try to update existing message
    let existing = null;
    try {
      existing = db.get('postManagerPanel');
    } catch (err) {
      console.warn('[POST_MANAGER] DB get error:', err.message);
    }

    if (existing && existing.messageId) {
      try {
        const msg = await ch.messages.fetch(existing.messageId).catch(() => null);
        if (msg) {
          await msg.edit({ embeds: [embed], components: [row] }).catch(() => null);
          console.log('[POST_MANAGER] ✅ Panel updated');
          return true;
        }
      } catch (err) {
        console.warn('[POST_MANAGER] Update failed:', err.message);
      }
    }

    // Create new message
    const msg = await ch.send({ embeds: [embed], components: [row] }).catch(() => null);
    if (msg) {
      try {
        await db.set('postManagerPanel', { channelId: ch.id, messageId: msg.id });
      } catch (err) {
        console.warn('[POST_MANAGER] DB set error:', err.message);
      }
      console.log('[POST_MANAGER] ✅ Panel created');
      return true;
    }
    
    return false;
  } catch (e) {
    console.error('[POST_MANAGER] postPostManagerPanel error:', e.message);
    return false;
  }
}

// Handle new post creation
async function handlePostCreate(interaction) {
  try {
    const userId = interaction.user.id;
    
    // Create new session
    postSessions.set(userId, {
      userId,
      title: '',
      content: '',
      color: 0x5865F2,
      targetChannelId: null,
      attachments: []
    });

    // Show channel selection
    const channelSelect = new ActionRowBuilder()
      .addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId(`post_channel_${userId}`)
          .setPlaceholder('📌 Выбери канал для публикации')
      );

    await interaction.reply({
      content: '📌 **Выбери канал для публикации:**',
      components: [channelSelect],
      ephemeral: true
    }).catch(() => null);
  } catch (e) {
    console.error('[POST_MANAGER] handlePostCreate error:', e.message);
  }
}

// Handle channel selection
async function handleChannelSelect(interaction) {
  try {
    const userId = interaction.user.id;
    const session = postSessions.get(userId);

    if (!session) {
      return await interaction.reply({ content: '❌ Сессия потеряна', ephemeral: true }).catch(() => null);
    }

    session.targetChannelId = interaction.values[0];

    await interaction.reply({
      content: `✅ Канал выбран: <#${session.targetChannelId}>\n\n📝 **Теперь отправь сообщения в этот чат:**\n\n1️⃣ **Заголовок** поста\n2️⃣ **Содержание** поста\n3️⃣ **Файлы** (фото, видео и т.д.) - опционально\n4️⃣ **Выбери цвет** и **опубликуй**\n\n*Отправляй каждую часть отдельным сообщением*`,
      ephemeral: true
    }).catch(() => null);
  } catch (e) {
    console.error('[POST_MANAGER] handleChannelSelect error:', e.message);
  }
}

// Handle post input messages
async function handlePostMessageInput(message) {
  try {
    if (message.author.bot) return;
    if (message.channelId !== PANEL_CHANNEL_ID) return;

    const userId = message.author.id;
    const session = postSessions.get(userId);

    if (!session || !session.targetChannelId) return; // Not in post creation mode

    const content = message.content.trim();
    if (!content && message.attachments.size === 0) return; // Empty message

    // Check what stage we're at
    if (!session.title) {
      // First message = title
      session.title = content || '(no title)';
      await message.react('✅');
      await message.reply({
        content: `✅ Заголовок принят!\n\n📝 Теперь отправь **содержание поста**:`,
        allowedMentions: { repliedUser: false }
      }).catch(() => null);
      
      setTimeout(() => {
        message.delete().catch(() => null);
      }, 2000);
      return;
    }

    if (!session.content) {
      // Second message = content
      session.content = content || '(no content)';
      await message.react('✅');
      
      // Show color selection
      const colorSelect = new ActionRowBuilder()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`post_color_${userId}`)
            .setPlaceholder('🎨 Выбери цвет')
            .addOptions(
              { label: '🔴 Красный', value: 'red', emoji: '🔴' },
              { label: '🟢 Зелёный', value: 'green', emoji: '🟢' },
              { label: '🔵 Синий', value: 'blue', emoji: '🔵' },
              { label: '🟡 Жёлтый', value: 'yellow', emoji: '🟡' },
              { label: '🟣 Фиолетовый', value: 'purple', emoji: '🟣' },
              { label: '🔷 Голубой', value: 'cyan', emoji: '🔷' },
              { label: '🟠 Оранжевый', value: 'orange', emoji: '🟠' },
              { label: '🩷 Розовый', value: 'pink', emoji: '🩷' }
            )
        );

      await message.reply({
        content: `✅ Содержание принято!\n\n🎨 **Выбери цвет для поста:**`,
        components: [colorSelect],
        allowedMentions: { repliedUser: false }
      }).catch(() => null);

      setTimeout(() => {
        message.delete().catch(() => null);
      }, 2000);
      return;
    }

    // If we reach here and message has attachments, save them
    if (message.attachments.size > 0) {
      for (const attachment of message.attachments.values()) {
        session.attachments.push({
          url: attachment.url,
          name: attachment.name,
          size: attachment.size
        });
      }
      
      await message.react('✅');
      await message.reply({
        content: `✅ ${message.attachments.size} файл(ы) добавлены!`,
        allowedMentions: { repliedUser: false }
      }).catch(() => null);

      setTimeout(() => {
        message.delete().catch(() => null);
      }, 2000);
    }
  } catch (e) {
    console.error('[POST_MANAGER] handlePostMessageInput error:', e.message);
  }
}

// Build post embed
function buildPostEmbed(session) {
  const embed = new EmbedBuilder()
    .setColor(session.color)
    .setTitle(session.title || '(Заголовок)')
    .setDescription(session.content || '(Содержание)');

  // Add first image if available
  if (session.attachments.length > 0) {
    const imageAttachment = session.attachments.find(a => 
      a.url.match(/\.(jpg|jpeg|png|gif|webp)$/i)
    );
    if (imageAttachment) {
      embed.setImage(imageAttachment.url);
    }
  }

  return embed;
}

// Build link buttons
function buildLinkRow() {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setURL('https://vihtai.pro/')
        .setLabel('🌐 Наш Сайт')
        .setStyle(ButtonStyle.Link),
      new ButtonBuilder()
        .setURL('https://t.me/vihtikai')
        .setLabel('📱 Наш телеграмм')
        .setStyle(ButtonStyle.Link)
    );
}

// Handle preview
async function handlePostPreview(interaction) {
  try {
    const userId = interaction.user.id;
    const session = postSessions.get(userId);

    if (!session || !session.title || !session.content) {
      return await interaction.reply({ 
        content: '❌ Пост не готов. Введи заголовок и содержание сначала', 
        ephemeral: true 
      }).catch(() => null);
    }

    const embed = buildPostEmbed(session);
    const linkRow = buildLinkRow();

    await interaction.reply({
      embeds: [embed],
      components: [linkRow],
      ephemeral: true
    }).catch(() => null);
  } catch (e) {
    console.error('[POST_MANAGER] handlePostPreview error:', e.message);
  }
}

// Handle color selection
async function handleColorSelect(interaction) {
  try {
    const userId = interaction.user.id;
    const session = postSessions.get(userId);

    if (!session) {
      return await interaction.reply({ content: '❌ Сессия потеряна', ephemeral: true }).catch(() => null);
    }

    const colorKey = interaction.values[0];
    session.color = COLOR_PRESETS[colorKey] || 0x5865F2;

    const controlRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('post_preview')
          .setLabel('👁️ Просмотр')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('post_publish')
          .setLabel('📤 Опубликовать')
          .setStyle(ButtonStyle.Danger)
      );

    await interaction.reply({
      content: `✅ Цвет установлен: **${colorKey}**\n\n📤 Готово к публикации!`,
      components: [controlRow],
      ephemeral: true
    }).catch(() => null);
  } catch (e) {
    console.error('[POST_MANAGER] handleColorSelect error:', e.message);
  }
}

// Handle publish
async function handlePostPublish(interaction) {
  try {
    const userId = interaction.user.id;
    const session = postSessions.get(userId);

    if (!session) {
      return await interaction.reply({ content: '❌ Нет активной сессии', ephemeral: true }).catch(() => null);
    }

    if (!session.title || !session.content) {
      return await interaction.reply({ content: '❌ Заполни заголовок и содержание', ephemeral: true }).catch(() => null);
    }

    const targetCh = await interaction.client.channels.fetch(session.targetChannelId).catch(() => null);
    if (!targetCh) {
      return await interaction.reply({ content: '❌ Канал не найден', ephemeral: true }).catch(() => null);
    }

    // Build message
    const embed = buildPostEmbed(session);
    const linkRow = buildLinkRow();

    const messageOptions = {
      embeds: [embed],
      components: [linkRow]
    };

    // Add other attachments (non-images) as links in description
    const nonImages = session.attachments.filter(a => !a.url.match(/\.(jpg|jpeg|png|gif|webp)$/i));
    if (nonImages.length > 0) {
      const fileLinks = nonImages.map(f => `[📎 ${f.name}](${f.url})`).join('\n');
      embed.addFields({ name: '📎 Файлы', value: fileLinks });
    }

    const published = await targetCh.send(messageOptions).catch(e => {
      console.error('[POST_MANAGER] Publish error:', e.message);
      return null;
    });

    if (published) {
      postSessions.delete(userId);
      await interaction.reply({
        content: `✅ Пост опубликован в <#${session.targetChannelId}>!`,
        ephemeral: true
      }).catch(() => null);
    } else {
      await interaction.reply({
        content: '❌ Ошибка при публикации',
        ephemeral: true
      }).catch(() => null);
    }
  } catch (e) {
    console.error('[POST_MANAGER] handlePostPublish error:', e.message);
  }
}

// Handle button interactions
async function handlePostManagerButton(interaction) {
  const customId = interaction.customId;

  if (customId === 'post_create') {
    await handlePostCreate(interaction);
  } else if (customId === 'post_preview') {
    await handlePostPreview(interaction);
  } else if (customId === 'post_publish') {
    await handlePostPublish(interaction);
  }
}

// Handle select menu interactions
async function handlePostManagerSelect(interaction) {
  const customId = interaction.customId;

  if (customId.startsWith('post_channel_')) {
    await handleChannelSelect(interaction);
  } else if (customId.startsWith('post_color_')) {
    await handleColorSelect(interaction);
  }
}

module.exports = {
  postPostManagerPanel,
  handlePostManagerButton,
  handlePostManagerSelect,
  handlePostMessageInput
};
