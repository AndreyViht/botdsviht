const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const db = require('../libs/db');

// VK API конфигурация
const VK_API_VERSION = '5.199';
const VK_SERVICE_TOKEN = 'e2ebdd8ae2ebdd8ae2ebdd8a96e1d5d4bbee2ebe2ebdd8a8bd6c87dd4d1725a4e44f66a';
const VK_API_BASE = 'https://api.vk.com/method';

// In-memory VK sessions: { userId -> { vkId, musicList, selectedIndex, sessionType } }
const vkSessions = new Map();

/**
 * Запрашивает VK ID пользователя
 */
async function askForVkId(interaction) {
  try {
    const userId = interaction.user.id;
    
    // Проверяем сохранён ли уже VK ID
    let userVkData = null;
    try {
      userVkData = await db.get(`vk_user_${userId}`);
    } catch (e) {
      console.log('[VK] Не удалось получить VK ID из БД:', e.message);
    }

    if (userVkData && userVkData.vkId) {
      console.log('[VK] Найден сохранённый VK ID:', userVkData.vkId);
      // Используем сохранённый ID
      await loadVkMusic(interaction, userVkData.vkId);
      return;
    }

    // Показываем модаль для ввода VK ID
    const modal = new (require('discord.js').ModalBuilder)()
      .setCustomId(`vk_id_modal_${userId}`)
      .setTitle('🎵 Введи свой VK ID')
      .addComponents(
        new (require('discord.js').ActionRowBuilder)().addComponents(
          new (require('discord.js').TextInputBuilder)()
            .setCustomId('vk_id_input')
            .setLabel('Твой VK ID (числа)')
            .setStyle(require('discord.js').TextInputStyle.Short)
            .setPlaceholder('например: 123456789')
            .setRequired(true)
        )
      );

    await interaction.showModal(modal);
  } catch (e) {
    console.error('[VK] Ошибка askForVkId:', e.message);
    await interaction.reply({ content: '❌ Ошибка: ' + e.message, ephemeral: true }).catch(() => null);
  }
}

/**
 * Обработка ввода VK ID
 */
async function handleVkIdModal(interaction) {
  try {
    const userId = interaction.user.id;
    const vkId = interaction.fields.getTextInputValue('vk_id_input').trim();

    // Проверяем что это число
    if (!/^\d+$/.test(vkId)) {
      return await interaction.reply({ content: '❌ VK ID должен содержать только цифры!', ephemeral: true });
    }

    console.log('[VK] Получен VK ID:', vkId);

    // Сохраняем VK ID в БД
    try {
      await db.set(`vk_user_${userId}`, { vkId, savedAt: Date.now() });
      console.log('[VK] VK ID сохранён в БД');
    } catch (e) {
      console.warn('[VK] Не удалось сохранить VK ID в БД:', e.message);
    }

    await interaction.reply({ content: '⏳ Загружаю твою музыку из VK...', ephemeral: true });

    // Загружаем музыку
    await loadVkMusic(interaction, vkId);
  } catch (e) {
    console.error('[VK] Ошибка handleVkIdModal:', e.message);
    try {
      await interaction.reply({ content: '❌ Ошибка: ' + e.message, ephemeral: true });
    } catch (replyErr) {
      console.error('[VK] Не удалось отправить ошибку:', replyErr.message);
    }
  }
}

/**
 * Загружает музыку пользователя из VK
 */
async function loadVkMusic(interaction, vkId) {
  try {
    const userId = interaction.user.id;

    console.log('[VK] Начинаю загрузку музыки для VK ID:', vkId);

    // Запрашиваем аудиозаписи пользователя
    const audioUrl = `${VK_API_BASE}/audio.get?owner_id=${vkId}&access_token=${VK_SERVICE_TOKEN}&v=${VK_API_VERSION}`;
    
    console.log('[VK] Запрашиваю:', audioUrl.split('access_token')[0] + 'access_token=***');

    const response = await fetch(audioUrl);
    const data = await response.json();

    if (data.error) {
      console.error('[VK] Ошибка VK API:', data.error);
      return await interaction.followUp({ 
        content: `❌ Ошибка VK API: ${data.error.error_msg || data.error}`, 
        ephemeral: true 
      }).catch(() => null);
    }

    if (!data.response || !data.response.items || data.response.items.length === 0) {
      console.log('[VK] Музыка не найдена');
      return await interaction.followUp({ 
        content: '❌ В твоём аккаунте VK не найдено музыки', 
        ephemeral: true 
      }).catch(() => null);
    }

    const musicList = data.response.items;
    console.log('[VK] Загружено песен:', musicList.length);

    // Сохраняем сессию
    vkSessions.set(userId, {
      vkId,
      musicList,
      selectedIndex: 0,
      sessionType: 'vk_personal'
    });

    // Показываем меню выбора песни
    await showMusicMenu(interaction, userId, musicList);
  } catch (e) {
    console.error('[VK] Ошибка loadVkMusic:', e.message);
    await interaction.followUp({ 
      content: '❌ Ошибка загрузки музыки: ' + e.message, 
      ephemeral: true 
    }).catch(() => null);
  }
}

/**
 * Показывает меню с песнями
 */
async function showMusicMenu(interaction, userId, musicList) {
  try {
    // Берём первые 20 песен (лимит Discord select menu)
    const songs = musicList.slice(0, 20);

    const select = new StringSelectMenuBuilder()
      .setCustomId(`vk_music_select_${userId}`)
      .setPlaceholder('🎵 Выбери песню')
      .addOptions(
        songs.map((song, idx) => ({
          label: `${song.artist || 'Unknown'} - ${song.title}`.slice(0, 100),
          value: String(idx),
          description: `${Math.floor(song.duration / 60)}:${String(song.duration % 60).padStart(2, '0')}`.slice(0, 100)
        }))
      );

    const row = new ActionRowBuilder().addComponents(select);

    const embed = new EmbedBuilder()
      .setTitle('🎵 Твоя музыка из VK')
      .setColor(0x0077FF)
      .setDescription(`Найдено **${musicList.length}** песен\n\nВыбери песню для воспроизведения:`)
      .setFooter({ text: 'Показаны первые 20 песен' });

    await interaction.followUp({
      embeds: [embed],
      components: [row],
      ephemeral: true
    }).catch(() => null);
  } catch (e) {
    console.error('[VK] Ошибка showMusicMenu:', e.message);
  }
}

/**
 * Обработка выбора песни
 */
async function handleMusicSelect(interaction) {
  try {
    const userId = interaction.user.id;
    const selectedIdx = parseInt(interaction.values[0]);

    const session = vkSessions.get(userId);
    if (!session) {
      return await interaction.reply({ content: '❌ Сессия потеряна', ephemeral: true });
    }

    const song = session.musicList[selectedIdx];
    console.log('[VK] Выбрана песня:', `${song.artist} - ${song.title}`);

    // Проверяем есть ли URL
    if (!song.url) {
      return await interaction.reply({ 
        content: '❌ Эта песня недоступна для воспроизведения', 
        ephemeral: true 
      });
    }

    session.selectedIndex = selectedIdx;

    // Деферим ответ
    await interaction.deferReply({ ephemeral: true });

    // Проверяем активную сессию плеера
    const playerModule = require('../music-interface/playerPanel');
    const activeSessions = playerModule.getPlayerSessions ? playerModule.getPlayerSessions() : new Map();

    const playerSession = Array.from(activeSessions.values()).find(s => s.userId === userId);
    if (!playerSession) {
      return await interaction.editReply({ 
        content: '❌ Сначала занимите плеер кнопкой "Занять плеер"' 
      });
    }

    // Запускаем воспроизведение
    const musicPlayer = require('../music/player2');
    const query = `${song.artist} ${song.title}`;
    
    await musicPlayer.playNow(
      playerSession.guildId,
      { id: playerSession.voiceChannelId },
      query,
      interaction.channel,
      userId
    );

    await interaction.editReply({ 
      content: `▶️ **${song.artist} - ${song.title}** запущена!` 
    });
  } catch (e) {
    console.error('[VK] Ошибка handleMusicSelect:', e.message);
    await interaction.reply({ content: '❌ Ошибка: ' + e.message, ephemeral: true }).catch(() => null);
  }
}

module.exports = {
  askForVkId,
  handleVkIdModal,
  loadVkMusic,
  showMusicMenu,
  handleMusicSelect,
  vkSessions
};
