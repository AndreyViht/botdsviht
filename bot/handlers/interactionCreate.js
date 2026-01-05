const { InteractionType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType } = require('discord.js');
const db = require('../libs/db');
const pointSystem = require('../libs/pointSystem');
const { safeReply, safeUpdate, safeShowModal } = require('../libs/interactionUtils');
const { sendPrompt } = require('../ai/vihtAi');
const { handleAiButton, createAiPanelEmbed, makeButtons: makeAiButtons } = require('../ai/aiHandler');
const { ensureMenuPanel, handleMenuButton } = require('../menus/menuHandler');
const { postPostManagerPanel, handlePostManagerButton, handlePostManagerSelect, handlePostManagerModal } = require('../post-manager/postManager');
const { handlePriceButton } = require('../price/priceHandler');
const config = require('../config');

// Optional handlers
let handleReactionAdd = null;
let handleReactionRemove = null;
try {
  const roleHandlers = require('../roles/reactionRole');
  handleReactionAdd = roleHandlers.handleReactionAdd;
  handleReactionRemove = roleHandlers.handleReactionRemove;
} catch (e) { /* optional */ }

try { const { initAutomod } = require('../moderation/automod'); initAutomod(null); } catch (e) { /* ignore */ }

// Music handlers
let handleMusicButtons = null;
let handleMusicSelect = null;
let handleMusicSearch = null;
let musicPlayer = null;
let handlePlayerPanelButton = null;
let updateControlMessageWithError = null;
try {
  const musicHandlers = require('../music/musicHandlers');
  handleMusicButtons = musicHandlers.handleMusicButtons;
  handleMusicSelect = musicHandlers.handleMusicSelect;
  handleMusicSearch = musicHandlers.handleMusicSearch;
  musicPlayer = musicHandlers.musicPlayer;
  updateControlMessageWithError = musicHandlers.updateControlMessageWithError;
} catch (e) { console.warn('Music handlers not available:', e.message); }

try {
  const playerPanel = require('../music-interface/playerPanel');
  handlePlayerPanelButton = playerPanel.handlePlayerPanelButton;
} catch (e) { console.warn('Player panel not available:', e.message); }

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    try {
      // Attach helpers
      try {
        interaction.safeReply = (opts) => safeReply(interaction, opts);
        interaction.safeUpdate = (opts) => safeUpdate(interaction, opts);
        interaction.safeShowModal = (modal) => safeShowModal(interaction, modal);
      } catch (e) {}

      if (interaction.type === InteractionType.ApplicationCommand) {
        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) return;

        // Log command
        try {
          const logChannel = interaction.client.channels.cache.get(config.commandLogChannelId);
          if (logChannel && logChannel.isTextBased) {
            const user = interaction.user;
            const commandName = interaction.commandName;
            await logChannel.send(`${user.toString()} использовал команду /${commandName}`).catch(() => null);
          }
        } catch (logErr) {
          console.error('Failed to log command:', logErr && logErr.message ? logErr.message : logErr);
        }

        try {
          await pointSystem.checkFirstCommand(interaction.user.id, interaction.client);
        } catch (e) { console.warn('[ACH] checkFirstCommand error:', e.message); }

        try {
          await command.execute(interaction);
        } catch (err) {
          console.error('Command error', err);
          await safeReply(interaction, { content: 'Ошибка при выполнении команды.', ephemeral: true });
        }
        return;
      }

      if (interaction.isButton()) {
        await handleButton(interaction);
        return;
      }

      if (interaction.isStringSelectMenu()) {
        await handleStringSelectMenu(interaction);
        return;
      }

      if (interaction.isModalSubmit()) {
        await handleModalSubmit(interaction);
        return;
      }

      // Handle other select menus
      if (interaction.isChannelSelectMenu() || interaction.isRoleSelectMenu() || interaction.isUserSelectMenu()) {
        await handleOtherSelectMenu(interaction);
        return;
      }
    } catch (err) {
      console.error('interactionCreate handler error', err);
    }
  }
};

async function handleButton(interaction) {
  const customId = interaction.customId;

  // Snowball reply button
  if (customId && customId.startsWith('snowball_reply_')) {
    try {
      const parts = customId.split('_');
      const targetId = parts[2];
      const attackerId = parts[3];
      const clickerId = interaction.user.id;

      if (clickerId !== targetId) {
        return await safeReply(interaction, {
          content: `❌ Только <@${targetId}> может ответить на снежок от <@${attackerId}>!`,
          ephemeral: true
        });
      }

      const damage = Math.floor(Math.random() * 30) + 10;
      const hit = Math.random() < 0.7;
      const pointsReward = hit ? Math.floor(damage / 2) : 5;

      await db.ensureReady();
      const snowballStats = db.get('snowballStats') || {};
      const targetStats = snowballStats[targetId] || { hits: 0, misses: 0, totalDamage: 0 };
      if (hit) {
        targetStats.hits += 1;
        targetStats.totalDamage += damage;
      } else {
        targetStats.misses += 1;
      }
      snowballStats[targetId] = targetStats;
      await db.set('snowballStats', snowballStats);

      await pointSystem.addPoints(targetId, pointsReward);
      if (hit) {
        await pointSystem.addPoints(attackerId, -Math.floor(damage / 2));
      }

      const embed = new EmbedBuilder()
        .setColor(hit ? '#0099FF' : '#FF6B6B')
        .setTitle(`❄️ ОТВЕТНЫЙ УДАР!`)
        .setDescription(`<@${targetId}> ответил снежком на <@${attackerId}>!\n\n${hit ? `⚡ Попадание! Урон: ${damage}` : '❌ Промах!'}`)
        .addFields(
          { name: '💰 Награда', value: `+${pointsReward} очков`, inline: true },
          { name: '📊 Ваша статистика', value: `Попаданий: ${targetStats.hits}\nПромахов: ${targetStats.misses}`, inline: true }
        )
        .setThumbnail(interaction.user.displayAvatarURL())
        .setFooter({ text: 'Снежная война продолжается!' });

      await safeReply(interaction, { embeds: [embed] });

      if (damage > 25 && hit) {
        try {
          const channel = await interaction.guild.channels.fetch('1450486721878954006').catch(() => null);
          if (channel) {
            const announce = new EmbedBuilder()
              .setColor('#FFD700')
              .setTitle('🎯 ОТВЕТНЫЙ КРИТ!')
              .setDescription(`<@${targetId}> нанёс **${damage}** урона в ответ <@${attackerId}>!`)
              .setThumbnail(interaction.user.displayAvatarURL());
            await channel.send({ embeds: [announce] });
          }
        } catch (e) {}
      }
    } catch (e) {
      console.error('snowball reply error', e);
      await safeReply(interaction, { content: '❌ Ошибка при ответе снежком.', ephemeral: true });
    }
    return;
  }

  // Music buttons
  if (customId && customId.startsWith('music_')) {
    try {
      if (handleMusicButtons) await handleMusicButtons(interaction);
    } catch (e) { console.error('music button error', e); await safeReply(interaction, { content: 'Ошибка при обработке кнопки.', ephemeral: true }); }
    return;
  }

  // Support create modal
  if (customId === 'support_create') {
    const modal = new ModalBuilder()
      .setCustomId('support_modal')
      .setTitle('Создать обращение');
    const subj = new TextInputBuilder().setCustomId('subject').setLabel('Тема').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(60);
    const msg = new TextInputBuilder().setCustomId('message').setLabel('Текст обращения').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(2000);
    modal.addComponents(new ActionRowBuilder().addComponents(subj), new ActionRowBuilder().addComponents(msg));
    try { await safeShowModal(interaction, modal); } catch (e) { console.error('showModal failed', e); await safeReply(interaction, { content: 'Не удалось открыть форму.', ephemeral: true }); }
    return;
  }

  // Support close all
  if (customId === 'support_close_all') {
    const member = interaction.member;
    const isStaff = member && member.roles && member.roles.cache && config.staffRoles.some(r => member.roles.cache.has(r));
    if (!isStaff) { await safeReply(interaction, { content: 'У вас нет прав для этой операции.', ephemeral: true }); return; }
    const confirmRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('confirm_close_all').setLabel('Да, закрыть все').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('cancel_close_all').setLabel('Отмена').setStyle(ButtonStyle.Secondary)
    );
    await safeReply(interaction, { content: 'Вы уверены? Это закроет все открытые обращения.', components: [confirmRow], ephemeral: true });
    return;
  }

  if (customId === 'confirm_close_all' || customId === 'cancel_close_all') {
    const member = interaction.member;
    const isStaff = member && member.roles && member.roles.cache && config.staffRoles.some(r => member.roles.cache.has(r));
    if (!isStaff) { await safeReply(interaction, { content: 'У вас нет прав для этой операции.', ephemeral: true }); return; }
    if (customId === 'cancel_close_all') { await safeUpdate(interaction, { content: 'Операция отменена.', components: [] }); return; }
    try { await interaction.deferReply({ flags: 64 }); } catch (e) { /* ignore */ }
    const tickets = db.get('tickets') || [];
    let closedCount = 0;
    for (const t of tickets) {
      if (!t || t.status === 'closed') continue;
      try {
        const ch = await interaction.client.channels.fetch(t.threadId).catch(() => null);
        if (ch) {
          try { if (ch.send) await ch.send('Обращение закрыто администратором.'); } catch (e) {}
          try { if (!ch.archived) { if (ch.setLocked) await ch.setLocked(true); await ch.setArchived(true); } } catch (e) {}
        }
      } catch (e) {}
      t.status = 'closed'; t.closedAt = new Date().toISOString(); closedCount += 1;
    }
    await db.set('tickets', tickets);
    await safeReply(interaction, { content: `Готово — закрыто обращений: ${closedCount}`, ephemeral: true });
  }

  // Infopol clear
  if (customId && customId.startsWith('infopol_clear_')) {
    try {
      const userId = customId.split('_')[2];
      const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
      const isAdmin = member && member.roles && config.adminRoles && config.adminRoles.some(rid => member.roles.cache.has(rid));
      if (!isAdmin) return await safeReply(interaction, { content: 'У вас нет прав для этой операции.', ephemeral: true });

      const userViolations = db.get('userViolations') || {};
      const userMutes = db.get('userMutes') || {};
      const userBans = db.get('userBans') || {};

      delete userViolations[userId];
      delete userMutes[userId];
      delete userBans[userId];

      await db.set('userViolations', userViolations);
      await db.set('userMutes', userMutes);
      await db.set('userBans', userBans);

      await safeReply(interaction, { content: `✅ Данные пользователя <@${userId}> очищены.`, ephemeral: true });
    } catch (err) {
      console.error('Infopol clear button error', err);
      await safeReply(interaction, { content: 'Ошибка при очистке данных.', ephemeral: true });
    }
    return;
  }

  // Price buttons
  if (customId && customId.startsWith('price_')) {
    try { await handlePriceButton(interaction); } catch (err) { console.error('Price button error', err); await safeReply(interaction, { content: 'Ошибка при обработке прайса.', ephemeral: true }); }
    return;
  }

  // AI buttons
  if (customId && customId.startsWith('ai_')) {
    if (customId.startsWith('ai_action_goto_') || customId.startsWith('ai_action_close_')) {
      try {
        await db.ensureReady();
        const userId = String(interaction.user.id);
        const allChats = db.get('aiChats') || {};
        const userChat = allChats[userId];

        if (!userChat) {
          await safeReply(interaction, { content: '❌ Ветка не найдена.', ephemeral: true });
          return;
        }

        if (customId.startsWith('ai_action_goto_')) {
          if (!userChat.threadId) {
            await safeReply(interaction, { content: '❌ Тред не найден.', ephemeral: true });
            return;
          }
          await safeReply(interaction, { content: `🚀 Ссылка на ветку: <#${userChat.threadId}>`, ephemeral: true });
        } else if (customId.startsWith('ai_action_close_')) {
          if (userChat.threadId) {
            const thread = await interaction.client.channels.fetch(userChat.threadId).catch(() => null);
            if (thread && thread.setArchived) {
              try { await thread.setArchived(true); } catch (e) { console.warn('Failed to archive thread', e); }
            }
          }
          userChat.status = 'closed';
          userChat.closedAt = new Date().toISOString();
          await db.set('aiChats', allChats);
          await safeReply(interaction, { content: `✅ Ветка ${userChat.chatId} закрыта.`, ephemeral: true });
        }
      } catch (err) {
        console.error('AI action button error', err);
        await safeReply(interaction, { content: 'Ошибка при выполнении действия.', ephemeral: true });
      }
      return;
    }

    try { await handleAiButton(interaction); } catch (err) { console.error('AI button error', err); await safeReply(interaction, { content: 'Ошибка при обработке кнопки ИИ.', ephemeral: true }); }
    return;
  }

  // Menu buttons
  if (customId && customId.startsWith('menu_')) {
    try { await handleMenuButton(interaction); } catch (err) { console.error('Menu button error', err); await safeReply(interaction, { content: 'Ошибка при обработке меню.', ephemeral: true }); }
    return;
  }

  // Post Manager buttons
  if (customId && (customId.startsWith('post_') || customId.startsWith('pm_'))) {
    try { await handlePostManagerButton(interaction); } catch (err) { console.error('Post manager button error', err); await safeReply(interaction, { content: 'Ошибка при управлении постом.', ephemeral: true }); }
    return;
  }

  // Player panel buttons
  if (customId && customId.startsWith('player_')) {
    try { if (handlePlayerPanelButton) await handlePlayerPanelButton(interaction, interaction.client); } catch (err) { console.error('Player panel button error', err); await safeReply(interaction, { content: 'Ошибка при управлении плеером.', ephemeral: true }); }
    return;
  }

  // Statistics graph buttons
  if (customId && (customId.startsWith('grafs_recent') || customId.startsWith('grafs_all') || customId.startsWith('grafs_test') || customId === 'grafs_back')) {
    try {
      const grafsCommand = interaction.client.commands.get('grafs');
      if (grafsCommand) {
        if (customId === 'grafs_back') {
          await grafsCommand.handleBackButton(interaction);
        } else {
          await grafsCommand.handleButton(interaction);
        }
      }
    } catch (err) { console.error('Grafs button error', err); await safeReply(interaction, { content: 'Ошибка при загрузке статистики.', ephemeral: true }); }
    return;
  }

  // Control panel buttons
  if (customId.includes('cabinet') || customId.includes('main_menu') || customId === 'info_btn') {
    try { await handleControlPanelButton(interaction); } catch (err) { console.error('Control panel button error', err); await safeReply(interaction, { content: 'Ошибка при обработке кнопки.', ephemeral: true }); }
    return;
  }

  // Radio buttons
  if (customId.startsWith('radio_')) {
    try { if (handlePlayerPanelButton) await handlePlayerPanelButton(interaction, interaction.client); } catch (err) { console.error('Music button error', err); await safeReply(interaction, { content: 'Ошибка при обработке кнопки музыки.', ephemeral: true }); }
    return;
  }

  // Profile buttons
  if (customId === 'profile_music_stats') {
    try {
      const musicEmbeds = require('../music-interface/musicEmbeds');
      const music = db.get('music') || {};
      const userId = interaction.user.id;
      const guildId = interaction.guildId;
      const historyTracks = (music.history && music.history[`${guildId}_${userId}`]) || [];
      const favTracks = (music.favorites && music.favorites[`${guildId}_${userId}`]) || [];
      const playlists = (music.playlists && music.playlists[`${guildId}_${userId}`]) || {};

      const embed = musicEmbeds.createPlaylistsEmbed(playlists);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('profile_show_history').setLabel('История').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('profile_show_favorites').setLabel('Избранное').setStyle(ButtonStyle.Secondary)
      );
      await safeReply(interaction, { embeds: [embed], components: [row], ephemeral: true });
    } catch (err) {
      console.error('Profile music stats error', err);
      await safeReply(interaction, { content: 'Ошибка при загрузке статистики музыки.', ephemeral: true });
    }
    return;
  }

  if (customId === 'profile_show_history') {
    try {
      const musicEmbeds = require('../music-interface/musicEmbeds');
      const music = db.get('music') || {};
      const userId = interaction.user.id;
      const guildId = interaction.guildId;
      const historyTracks = (music.history && music.history[`${guildId}_${userId}`]) || [];

      const embed = musicEmbeds.createHistoryEmbed(historyTracks);
      await safeUpdate(interaction, { embeds: [embed] });
    } catch (err) {
      console.error('Profile history error', err);
      await safeReply(interaction, { content: 'Ошибка при загрузке истории.', ephemeral: true });
    }
    return;
  }

  if (customId === 'profile_show_favorites') {
    try {
      const musicEmbeds = require('../music-interface/musicEmbeds');
      const music = db.get('music') || {};
      const userId = interaction.user.id;
      const guildId = interaction.guildId;
      const favTracks = (music.favorites && music.favorites[`${guildId}_${userId}`]) || [];

      const embed = musicEmbeds.createFavoritesEmbed(favTracks);
      await safeUpdate(interaction, { embeds: [embed] });
    } catch (err) {
      console.error('Profile favorites error', err);
      await safeReply(interaction, { content: 'Ошибка при загрузке избранного.', ephemeral: true });
    }
    return;
  }

  if (customId === 'profile_achievements') {
    try {
      const musicPlayer = require('../music-interface/musicPlayer');
      const achievements = musicPlayer.getAchievements(interaction.user.id);
      const achievementList = Object.entries(achievements).map(([name, data]) => {
        return `**${name}**: ${data.count || 0} (разблокировано: ${data.unlockedAt || '—'})`;
      }).join('\n') || 'Нет достижений';

      const embed = new EmbedBuilder()
        .setTitle(`🏆 Достижения — ${interaction.user.username}`)
        .setDescription(achievementList)
        .setColor(0xFFD700)
        .setFooter({ text: 'Заработайте достижения, используя различные функции бота!' });

      await safeReply(interaction, { embeds: [embed], ephemeral: true });
    } catch (err) {
      console.error('Profile achievements error', err);
      await safeReply(interaction, { content: 'Ошибка при загрузке достижений.', ephemeral: true });
    }
    return;
  }

  // DM Menu buttons
  if (customId && customId.startsWith('dm_menu_')) {
    try {
      const dmMenu = require('../dm-menu');
      await dmMenu.handleDMMenuButton(interaction);
    } catch (err) {
      console.error('DM menu button error', err);
      await safeReply(interaction, { content: 'Ошибка при обработке меню.', ephemeral: true });
    }
    return;
  }

  // Settings and moderation buttons
  if (customId && (customId.startsWith('settings_') || customId.startsWith('mod_'))) {
    try {
      if (customId.startsWith('settings_')) {
        const settingsCmd = interaction.client.commands.get('settings');
        if (settingsCmd && settingsCmd.handleButton) {
          await settingsCmd.handleButton(interaction);
        }
      } else if (customId.startsWith('mod_')) {
        const modCmd = interaction.client.commands.get('moderation');
        if (modCmd && modCmd.handleButton) {
          await modCmd.handleButton(interaction);
        }
      }
    } catch (err) {
      console.error('Settings/moderation button error', err);
      await safeReply(interaction, { content: '❌ Ошибка при обработке команды.', ephemeral: true });
    }
    return;
  }

  // Reviews buttons
  if (customId && customId.startsWith('review_')) {
    try {
      const reviewsCmd = interaction.client.commands.get('reviews');
      if (reviewsCmd && reviewsCmd.handleButton) {
        await reviewsCmd.handleButton(interaction);
      }
      if (customId.startsWith('review_approve_') || customId.startsWith('review_reject_')) {
        if (reviewsCmd && reviewsCmd.handleReviewButton) {
          await reviewsCmd.handleReviewButton(interaction);
        }
      }
    } catch (err) {
      console.error('Reviews button error', err);
      await safeReply(interaction, { content: '❌ Ошибка при обработке отзыва.', ephemeral: true });
    }
    return;
  }
}

async function handleStringSelectMenu(interaction) {
  const customId = interaction.customId;

  // Settings and moderation select menus
  if (customId && (customId.startsWith('settings_') || customId.startsWith('mod_'))) {
    try {
      if (customId.startsWith('settings_')) {
        const settingsCmd = interaction.client.commands.get('settings');
        if (settingsCmd && settingsCmd.handleSelect) {
          await settingsCmd.handleSelect(interaction);
        }
      } else if (customId.startsWith('mod_')) {
        const modCmd = interaction.client.commands.get('moderation');
        if (modCmd && modCmd.handleSelect) {
          await modCmd.handleSelect(interaction);
        }
      }
    } catch (err) {
      console.error('Settings/moderation select error', err);
      await safeReply(interaction, { content: '❌ Ошибка при обработке команды.', ephemeral: true });
    }
    return;
  }

  // AI chat select
  if (customId && customId.startsWith('ai_chat_select_')) {
    try {
      await db.ensureReady();
      const allChats = db.get('aiChats') || {};
      const selectedUserId = String(interaction.values[0]);
      const userChat = allChats[selectedUserId];

      if (!userChat) {
        await safeReply(interaction, { content: '❌ Ветка не найдена.', ephemeral: true });
        return;
      }

      const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`ai_action_goto_${selectedUserId}`)
          .setLabel('Перейти в ветку')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🚀'),
        new ButtonBuilder()
          .setCustomId(`ai_action_close_${selectedUserId}`)
          .setLabel('Закрыть ветку')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('❌')
      );

      const embed = new EmbedBuilder()
        .setTitle('📌 Управление веткой')
        .setDescription(`**ID:** ${userChat.chatId}\n**Статус:** ${userChat.status || 'open'}`)
        .setColor(0x0055ff)
        .setFooter({ text: 'Выберите действие' });

      await safeReply(interaction, { embeds: [embed], components: [actionRow], ephemeral: true });
    } catch (e) {
      console.error('AI chat select error', e);
      await safeReply(interaction, { content: '❌ Ошибка при выборе ветки.', ephemeral: true });
    }
    return;
  }

  // Music search select
  if (customId && customId.startsWith('music_search_select_')) {
    try {
      const searchId = customId.split('music_search_select_')[1];
      const cache = global._musicSearchCache && global._musicSearchCache[searchId];
      if (!cache) {
        await safeReply(interaction, { content: '❌ Поиск истёк. Попробуйте ещё раз.', ephemeral: true });
        return;
      }
      const selectedIndices = interaction.values.map(v => parseInt(v, 10));
      const guild = interaction.guild || (interaction.client && await interaction.client.guilds.fetch(cache.guildId).catch(() => null));
      const voiceChannel = guild && await guild.channels.fetch(cache.voiceChannelId).catch(() => null);
      if (!guild || !voiceChannel) {
        await safeReply(interaction, { content: '❌ Не удалось найти сервер или голосовой канал.', ephemeral: true });
        return;
      }
      await safeReply(interaction, { content: `🎵 Начинаю воспроизведение ${selectedIndices.length} трека(ов)...`, ephemeral: true });

      let firstPlayed = false;
      for (let i = 0; i < selectedIndices.length; i++) {
        const idx = selectedIndices[i];
        const candidate = cache.candidates[idx];
        if (!candidate) continue;
        const query = candidate.url || candidate.title || candidate;
        if (i === 0) {
          for (let k = 0; k < selectedIndices.length; k++) {
            const candIdx = selectedIndices[k];
            const cand = cache.candidates[candIdx];
            if (!cand) continue;
            const q = cand.url || cand.title || cand;
            try {
              const ok = await musicPlayer.playNow(guild, voiceChannel, q, interaction.channel, cache.userId).catch(err => { console.error('playNow error', err); return false; });
              if (ok) { firstPlayed = true; break; }
            } catch (e) { console.error('playNow threw', e); }
          }
        } else {
          if (firstPlayed) await musicPlayer.addToQueue(guild, query).catch(e => console.error('addToQueue error', e));
        }
      }
      if (!firstPlayed) {
        try { if (updateControlMessageWithError) await updateControlMessageWithError(guild.id, interaction.client, '❌ Не удалось воспроизвести выбранный трек(и).'); } catch (e) {}
        try { await safeReply(interaction, { content: '❌ Не удалось воспроизвести выбранный трек(и).', ephemeral: true }); } catch (e) {}
      }
      delete global._musicSearchCache[searchId];
    } catch (e) {
      console.error('music search select error', e);
      await safeReply(interaction, { content: '❌ Ошибка при выборе трека.', ephemeral: true });
    }
    return;
  }

  // Player panel search select
  if (customId && customId.startsWith('player_search_select_')) {
    try {
      const playerPanel = require('../music-interface/playerPanel');
      await playerPanel.handlePlayerPanelSelectMenu(interaction, interaction.client);
    } catch (e) {
      console.error('player panel select menu error', e);
      await safeReply(interaction, { content: '❌ Ошибка при выборе трека.', ephemeral: true });
    }
    return;
  }
}

async function handleModalSubmit(interaction) {
  const customId = interaction.customId;

  // Settings and moderation modals
  if (customId && (customId.startsWith('settings_') || customId.startsWith('mod_'))) {
    try {
      if (customId.startsWith('settings_')) {
        const settingsCmd = interaction.client.commands.get('settings');
        if (settingsCmd && settingsCmd.handleModal) {
          await settingsCmd.handleModal(interaction);
        }
      } else if (customId.startsWith('mod_')) {
        const modCmd = interaction.client.commands.get('moderation');
        if (modCmd && modCmd.handleModal) {
          await modCmd.handleModal(interaction);
        }
      }
    } catch (err) {
      console.error('Settings/moderation modal error', err);
      await safeReply(interaction, { content: '❌ Ошибка: ' + (err.message || err), ephemeral: true });
    }
    return;
  }

  // Reviews modal
  if (customId && customId.startsWith('review_')) {
    try {
      const reviewsCmd = interaction.client.commands.get('reviews');
      if (reviewsCmd && reviewsCmd.handleModal) {
        await reviewsCmd.handleModal(interaction);
      }
    } catch (err) {
      console.error('Reviews modal error', err);
      await safeReply(interaction, { content: '❌ Ошибка: ' + (err.message || err), ephemeral: true });
    }
    return;
  }

  // Support modal
  if (customId === 'support_modal') {
    try {
      const subject = interaction.fields.getTextInputValue('subject').slice(0,60);
      const message = interaction.fields.getTextInputValue('message').slice(0,2000);
      const member = interaction.member;
      const allowed = member && member.roles && member.roles.cache && config.allowedCreatorRoles.some(r => member.roles.cache.has(r));
      if (!allowed) return await safeReply(interaction, { content: 'У вас нет роли для создания обращения.', ephemeral: true });
      const channel = await interaction.client.channels.fetch(config.ticketChannelId).catch(() => null);
      if (!channel) return await safeReply(interaction, { content: 'Канал поддержки не найден.', ephemeral: true });
      const threadName = `ticket-${interaction.user.username}-${subject.replace(/[^a-zA-Z0-9-_]/g,'_').slice(0,40)}`;
      let thread = null;
      try { thread = await channel.threads.create({ name: threadName, autoArchiveDuration: 1440, type: ChannelType.PrivateThread }); } catch (err) { console.error('thread create failed', err); thread = null; }
      let threadId = null; const ping = config.staffRoles.map(r => `<@&${r}>`).join(' ');
      if (thread) {
        threadId = thread.id;
        try { await thread.members.add(interaction.user.id).catch(() => null); for (const rid of config.staffRoles) { const members = interaction.guild.members.cache.filter(m => m.roles.cache.has(rid)); for (const m of members.values()) { try { await thread.members.add(m.id); } catch (e) {} } } } catch (e) {}
        await thread.send({ content: `${ping}\n**Тема:** ${subject}\n**От:** <@${interaction.user.id}>\n\n${message}` });
      } else { const sent = await channel.send({ content: `${ping}\n**Новая заявка**: ${subject}\n**От:** <@${interaction.user.id}>\n\n${message}` }); threadId = sent.id; }
      const all = db.get('tickets') || [];
      const ticket = { id: `t_${Date.now()}`, threadId, channelId: channel.id, creatorId: interaction.user.id, subject, message, status: 'open', createdAt: new Date().toISOString() };
      all.push(ticket); await db.set('tickets', all);
      return await safeReply(interaction, { content: `Обращение создано. ${thread ? `Тред: <#${thread.id}>` : 'Сделано в канале.'}`, ephemeral: true });
    } catch (e) { console.error('modal submit error', e); return await safeReply(interaction, { content: 'Ошибка при создании обращения.', ephemeral: true }); }
  }

  // Music modals
  if (customId === 'music_modal') {
    try {
      const query = interaction.fields.getTextInputValue('music_query').slice(0, 400);
      const guild = interaction.guild;
      const member = interaction.member || (guild ? await guild.members.fetch(interaction.user.id).catch(() => null) : null);
      const voiceChannel = member && member.voice ? member.voice.channel : null;
      if (!voiceChannel) {
        await safeReply(interaction, { content: 'Вы не в голосовом канале.', ephemeral: true });
        return;
      }
      await safeReply(interaction, { content: '🔎 Ищу и начинаю воспроизведение...', ephemeral: true });
      if (musicPlayer) await musicPlayer.playNow(guild, voiceChannel, query, interaction.channel, interaction.user.id).catch(async (e) => { console.error('playNow error', e); });
    } catch (e) { console.error('music_modal submit error', e); return await safeReply(interaction, { content: 'Ошибка при обработке формы музыки.', ephemeral: true }); }
  }

  if (customId === 'music_play_modal' || customId === 'jockie_play_modal') {
    try {
      const musicHandler = require('../menus/musicHandler');
      await musicHandler.handleMusicModals(interaction);
    } catch (err) {
      console.error('Music modal error', err);
      await safeReply(interaction, { content: 'Ошибка при обработке формы.', ephemeral: true });
    }
    return;
  }

  if (customId === 'music_modal_queue') {
    try {
      const query = interaction.fields.getTextInputValue('music_query').slice(0, 400);
      const guild = interaction.guild;
      if (musicPlayer) {
        const ok = await musicPlayer.addToQueue(guild, query);
        if (ok) {
          await safeReply(interaction, { content: 'Добавлено в очередь ✅', ephemeral: true });
        } else {
          await safeReply(interaction, { content: 'Не удалось добавить в очередь.', ephemeral: true });
        }
      }
    } catch (e) { console.error('music_modal_queue submit error', e); return await safeReply(interaction, { content: 'Ошибка при обработке формы музыки.', ephemeral: true }); }
  }

  if (customId === 'music_search_modal') {
    try {
      if (handleMusicSearch) await handleMusicSearch(interaction);
    } catch (e) { console.error('music_search_modal error', e); return await safeReply(interaction, { content: 'Ошибка поиска песни.', ephemeral: true }); }
  }

  // Post Manager modals
  if (customId && (customId.startsWith('post_') || customId.startsWith('pm_'))) {
    try {
      console.log('[POST_MANAGER] Обработка модали:', customId);
      await handlePostManagerModal(interaction);
    } catch (err) {
      console.error('[POST_MANAGER] Ошибка модали:', err.message, err.stack);
      try {
        await interaction.reply({ content: '❌ Ошибка формы: ' + err.message, ephemeral: true });
      } catch (replyErr) {
        console.error('[POST_MANAGER] Не удалось отправить ошибку пользователю:', replyErr.message);
      }
    }
    return;
  }
}

async function handleOtherSelectMenu(interaction) {
  const customId = interaction.customId;

  // Music select
  if (customId === 'music_select') {
    try {
      if (handleMusicSelect) await handleMusicSelect(interaction);
    } catch (e) { console.error('music_select error', e); await safeReply(interaction, { content: 'Ошибка при выборе песни.', ephemeral: true }); }
    return;
  }

  // Moroz select
  if (customId === 'moroz_select') {
    try {
      await db.ensureReady();
      const moduleStates = db.get('botModules') || {};
      const selectedModule = interaction.values[0];

      moduleStates[selectedModule] = !moduleStates[selectedModule];
      await db.set('botModules', moduleStates);

      const status = moduleStates[selectedModule] ? '✅ Включен' : '❌ Отключен';
      await interaction.reply({
        content: `${status}`,
        ephemeral: true
      }).catch(() => null);
    } catch (err) { console.error('Moroz toggle error', err); await safeReply(interaction, { content: 'Ошибка при переключении.', ephemeral: true }); }
    return;
  }

  // Post Manager select
  if (customId && (customId.startsWith('post_') || customId.startsWith('pm_'))) {
    try { await handlePostManagerSelect(interaction); } catch (err) { console.error('Post manager select error', err); await safeReply(interaction, { content: 'Ошибка при выборе.', ephemeral: true }); }
    return;
  }
}

// Missing function
async function handleControlPanelButton(interaction) {
  // Placeholder - implement if needed
  console.warn('handleControlPanelButton not implemented');
}