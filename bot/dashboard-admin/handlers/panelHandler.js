// Panel handler — обработка кнопок панели управления
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../libs/db');
const presidentModel = require('../models/presidentModel');
const votingModel = require('../models/votingModel');
const userCabinetEmbeds = require('../embeds/userCabinet');
const governmentEmbeds = require('../embeds/government');

const PANEL_CHANNEL_ID = '1443194196172476636';

async function createMainPanel(client) {
  try {
    const channel = await client.channels.fetch(PANEL_CHANNEL_ID).catch(() => null);
    if (!channel) return console.warn('Panel channel not found');

    const embed = new EmbedBuilder()
      .setTitle('🎛️ Панель управления Viht')
      .setColor(0x2F3136)
      .setDescription('Привет! Выбери из кнопок что тебе необходимо');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('cabinet_main').setLabel('👤 Личный кабинет').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('government_main').setLabel('🏛️ Государственная Дума').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('shop_main').setLabel('🛍️ Магазин').setStyle(ButtonStyle.Secondary)
    );

    const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
    let panelMsg = messages?.find(m => m.author.id === client.user.id && m.content.includes('🎛️'));
    
    if (panelMsg) {
      await panelMsg.edit({ embeds: [embed], components: [row] }).catch(() => null);
    } else {
      await channel.send({ embeds: [embed], components: [row] }).catch(() => null);
    }
    console.log('[Panel] Main panel created/updated');
  } catch (e) {
    console.error('createMainPanel error:', e.message);
  }
}

async function handlePanelButton(interaction) {
  const customId = interaction.customId;
  const user = interaction.user;
  const guild = interaction.guild;

  try {
    // Defer reply to prevent timeout
    await interaction.deferUpdate().catch(() => null);

    if (customId === 'cabinet_main') {
      const member = await guild.members.fetch(user.id).catch(() => null);
      const embed = userCabinetEmbeds.createUserInfoEmbed(member);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('cabinet_commands').setLabel('📋 Команды').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('cabinet_balance').setLabel('💰 Баланс').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('cabinet_status').setLabel('📊 Мой статус').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('back_main').setLabel('← Назад').setStyle(ButtonStyle.Danger)
      );
      await interaction.editReply({ embeds: [embed], components: [row] }).catch(() => null);
    }

    if (customId === 'cabinet_commands') {
      const embed = userCabinetEmbeds.createCommandsEmbed();
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('back_cabinet').setLabel('← Назад').setStyle(ButtonStyle.Danger)
      );
      await interaction.editReply({ embeds: [embed], components: [row] }).catch(() => null);
    }

    if (customId === 'cabinet_balance') {
      const embed = userCabinetEmbeds.createBalanceEmbed(user);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('back_cabinet').setLabel('← Назад').setStyle(ButtonStyle.Danger)
      );
      await interaction.editReply({ embeds: [embed], components: [row] }).catch(() => null);
    }

    if (customId === 'cabinet_status') {
      const member = await guild.members.fetch(user.id).catch(() => null);
      const presidentData = await presidentModel.getCurrentPresident(guild);
      const embed = userCabinetEmbeds.createUserStatusEmbed(member, presidentData);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('back_cabinet').setLabel('← Назад').setStyle(ButtonStyle.Danger)
      );
      await interaction.editReply({ embeds: [embed], components: [row] }).catch(() => null);
    }

    if (customId === 'government_main') {
      const embed = governmentEmbeds.createGovernmentMenuEmbed();
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('gov_president_info').setLabel('👑 Кто Президент?').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('gov_reelection').setLabel('🗳️ Переизбрание').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('gov_voting').setLabel('📊 Голосование').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('back_main').setLabel('← Назад').setStyle(ButtonStyle.Danger)
      );
      await interaction.editReply({ embeds: [embed], components: [row] }).catch(() => null);
    }

    if (customId === 'gov_president_info') {
      const presidentData = await presidentModel.getCurrentPresident(guild);
      const embed = governmentEmbeds.createPresidentInfoEmbed(presidentData);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('back_government').setLabel('← Назад').setStyle(ButtonStyle.Danger)
      );
      await interaction.editReply({ embeds: [embed], components: [row] }).catch(() => null);
    }

    if (customId === 'gov_reelection') {
      const member = await guild.members.fetch(user.id).catch(() => null);
      const isAdmin = member && member.roles.cache.has('1436485697392607303');
      
      if (!isAdmin) {
        await interaction.followUp({ content: '❌ Только администраторы могут начать переизбрание', ephemeral: true }).catch(() => null);
        return;
      }

      // Remove president role from everyone
      await presidentModel.removePresidentRole(guild);

      // Get valid candidates
      const candidatesCollection = await guild.members.fetch().catch(() => null);
      const validCandidates = candidatesCollection ? Array.from(candidatesCollection.values()).filter(m => 
        presidentModel.VALID_VOTER_ROLES.some(r => m.roles.cache.has(r)) && !m.user.bot
      ) : [];

      // Start voting with candidates
      const candidateData = validCandidates.map(m => ({ id: m.id, username: m.user.username, tag: m.user.tag }));
      await votingModel.startPresidentVoting(guild, user.id, candidateData);
      
      const embed = new EmbedBuilder()
        .setTitle('🗳️ Голосование за нового Президента')
        .setColor(0x1a472a)
        .setDescription(`✅ Голосование запущено!\nКандидатов: ${validCandidates.length}\nДлительность: 10 минут`)
        .setTimestamp();

      const votingRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('gov_vote_start').setLabel('🗳️ Голосовать').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('back_government').setLabel('← Назад').setStyle(ButtonStyle.Danger)
      );

      await interaction.editReply({ embeds: [embed], components: [votingRow] }).catch(() => null);
      
      // Notify all users
      const panelChannel = await guild.channels.fetch('1443194196172476636').catch(() => null);
      if (panelChannel) {
        await panelChannel.send({
          content: `🗳️ **Началось голосование за нового Президента!**\nПроголосуйте в панели управления. У вас есть 10 минут!`
        }).catch(() => null);
      }
    }

    if (customId === 'gov_voting') {
      const voting = votingModel.getActiveVoting();
      if (!voting) {
        await interaction.followUp({ content: '❌ Нет активного голосования', ephemeral: true }).catch(() => null);
        return;
      }

      const remaining = votingModel.getVotingRemainingSeconds();
      const embed = new EmbedBuilder()
        .setTitle('🗳️ Активное голосование')
        .setColor(0x1a472a)
        .addFields(
          { name: 'Тип', value: 'Выбор Президента', inline: true },
          { name: 'Осталось', value: `${remaining} сек`, inline: true }
        )
        .setTimestamp();

      const votingRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('gov_vote_start').setLabel('🗳️ Голосовать').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('back_government').setLabel('← Назад').setStyle(ButtonStyle.Danger)
      );

      await interaction.editReply({ embeds: [embed], components: [votingRow] }).catch(() => null);
    }

    if (customId === 'back_main' || customId === 'back_cabinet' || customId === 'back_government') {
      const embed = new EmbedBuilder()
        .setTitle('🎛️ Панель управления Viht')
        .setColor(0x2F3136)
        .setDescription('Привет! Выбери из кнопок что тебе необходимо');
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('cabinet_main').setLabel('👤 Личный кабинет').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('government_main').setLabel('🏛️ Государственная Дума').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('shop_main').setLabel('🛍️ Магазин').setStyle(ButtonStyle.Secondary)
      );
      await interaction.editReply({ embeds: [embed], components: [row] }).catch(() => null);
    }

    if (customId === 'shop_main') {
      const embed = new EmbedBuilder()
        .setTitle('🛍️ Магазин')
        .setColor(0x2F3136)
        .setDescription('🔧 Магазин в разработке...');
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('back_main').setLabel('← Назад').setStyle(ButtonStyle.Danger)
      );
      await interaction.editReply({ embeds: [embed], components: [row] }).catch(() => null);
    }

    if (customId === 'gov_vote_start') {
      const voting = votingModel.getActiveVoting();
      if (!voting) {
        await interaction.followUp({ content: '❌ Голосование завершилось', ephemeral: true }).catch(() => null);
        return;
      }

      // Get candidates from voting data
      const validCandidates = voting.candidates || [];

      if (validCandidates.length === 0) {
        await interaction.followUp({ content: '❌ Нет кандидатов для голосования', ephemeral: true }).catch(() => null);
        return;
      }

      // Create vote buttons (max 5 per row, max 25 total)
      const rows = [];
      for (let i = 0; i < validCandidates.length; i += 5) {
        const chunk = validCandidates.slice(i, i + 5);
        const row = new ActionRowBuilder().addComponents(
          ...chunk.map((c, idx) => new ButtonBuilder()
            .setCustomId(`vote_${c.id}`)
            .setLabel(c.username.slice(0, 20))
            .setStyle(ButtonStyle.Secondary)
          )
        );
        rows.push(row);
      }

      const embed = new EmbedBuilder()
        .setTitle('🗳️ Выберите кандидата')
        .setColor(0x1a472a)
        .setDescription(`Выберите, за кого вы голосуете\nКандидатов: ${validCandidates.length}`)
        .setTimestamp();

      await interaction.followUp({ embeds: [embed], components: rows, ephemeral: true }).catch(() => null);
    }

    // Vote handlers
    if (customId.startsWith('vote_')) {
      const candidateId = customId.replace('vote_', '');
      const voting = votingModel.getActiveVoting();

      if (!voting) {
        await interaction.followUp({ content: '❌ Голосование завершилось', ephemeral: true }).catch(() => null);
        return;
      }

      // Record vote using votingModel
      const voted = await votingModel.recordVote(user.id, candidateId);
      
      if (!voted) {
        await interaction.followUp({ content: '❌ Не удалось записать голос', ephemeral: true }).catch(() => null);
        return;
      }

      const candidate = voting.candidates?.find(c => c.id === candidateId);
      const candidateName = candidate?.username || 'неизвестный';
      await interaction.followUp({ content: `✅ Ваш голос за **${candidateName}** учтён!`, ephemeral: true }).catch(() => null);
    }
  } catch (e) {
    console.error('handlePanelButton error:', e.message);
    try {
      await interaction.followUp({ content: '❌ Ошибка при обработке кнопки', ephemeral: true }).catch(() => null);
    } catch (e2) {}
  }
}

module.exports = {
  createMainPanel,
  handlePanelButton
};
