const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const db = require('../libs/db');

// Config: channel and allowed roles
const SUPPORT_CHANNEL_ID = '1442575929044897792';
const CATEGORY_ID = '1442575852993777866';
const FOUNDER_ROLE_ID = '1436485697392607303'; // Only founder can use /support
const config = require('../config');
const STAFF_ROLES = (config.adminRoles && config.adminRoles.length > 0) ? config.adminRoles : [ '1436485697392607303', '1436486253066326067' ];

const supportCommand = new SlashCommandBuilder()
  .setName('support')
  .setDescription('Управление обращениями в суппорт')
  .addSubcommand(cmd => cmd.setName('create').setDescription('Создать обращение')
    .addStringOption(o => o.setName('subject').setDescription('Тема обращения').setRequired(true))
    .addStringOption(o => o.setName('message').setDescription('Текст обращения').setRequired(true)))
  .addSubcommand(cmd => cmd.setName('close').setDescription('Закрыть обращение (staff only)')
    .addStringOption(o => o.setName('threadid').setDescription('ID треда (если не в треде)')));

module.exports = {
  data: supportCommand,
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    try {
      if (sub === 'create') {
        // check creator roles - ONLY FOUNDER
        const member = interaction.member;
        const hasRole = member && member.roles && member.roles.cache && member.roles.cache.has(FOUNDER_ROLE_ID);
        if (!hasRole) {
          return interaction.reply({ 
            content: '⛔ **Доступ закрыт**\n👑 Эту команду может использовать только Основатель (Founder) сервера.\n\n`/support` — команда для создания тикетов поддержки через Discord.',
            ephemeral: true 
          });
        }

        const subject = interaction.options.getString('subject').slice(0, 60);
        const message = interaction.options.getString('message').slice(0, 2000);
        await interaction.deferReply({ ephemeral: true });

        const channel = await interaction.client.channels.fetch(SUPPORT_CHANNEL_ID).catch(() => null);
        if (!channel) return interaction.editReply('Канал поддержки не найден.');

        // create a private thread in the support channel and add creator + staff members
        const threadName = `ticket-${interaction.user.username}-${subject.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 40)}`;
        let thread = null;
        try {
          thread = await channel.threads.create({ name: threadName, autoArchiveDuration: 1440, type: ChannelType.PrivateThread });
        } catch (err) {
          console.error('thread create failed', err);
          thread = null;
        }

        let threadId = null;
        const ping = STAFF_ROLES.map(r => `<@&${r}>`).join(' ');
        if (thread) {
          threadId = thread.id;
          try {
            await thread.members.add(interaction.user.id).catch(() => null);
            // add all staff members who currently have the staff roles
            for (const rid of STAFF_ROLES) {
              const members = interaction.guild.members.cache.filter(m => m.roles.cache.has(rid));
              for (const m of members.values()) {
                try { await thread.members.add(m.id); } catch (e) { /* ignore */ }
              }
            }
          } catch (e) { /* ignore */ }
          await thread.send({ content: `${ping}\n**Тема:** ${subject}\n**От:** <@${interaction.user.id}>\n\n${message}` });
        } else {
          const sent = await channel.send({ content: `${ping}\n**Новая заявка**: ${subject}\n**От:** <@${interaction.user.id}>\n\n${message}` });
          threadId = sent.id; // store message id
        }

        // store ticket in db
        const all = db.get && db.get('tickets') ? db.get('tickets') : [];
        const ticket = { id: `t_${Date.now()}`, threadId, channelId: SUPPORT_CHANNEL_ID, creatorId: interaction.user.id, subject, message, status: 'open', createdAt: new Date().toISOString() };
        all.push(ticket);
        await db.set('tickets', all);

        const replyContent = thread ? `Обращение создано. Тред: <#${thread.id}>` : 'Обращение создано. Сделано в канале.';
        return interaction.editReply({ content: replyContent, ephemeral: true });
      }

      if (sub === 'close') {
        // only staff roles allowed
        const member = interaction.member;
        const isStaff = member && member.roles && member.roles.cache && STAFF_ROLES.some(r => member.roles.cache.has(r));
        if (!isStaff) return interaction.reply({ content: 'Только сотрудники могут закрывать обращения.', ephemeral: true });
        await interaction.deferReply({ ephemeral: true });
        let thread = null;
        const threadIdOpt = interaction.options.getString('threadid');
        if (threadIdOpt) {
          // try fetch as thread
          thread = await interaction.client.channels.fetch(threadIdOpt).catch(() => null);
        } else {
          // if in a thread, close current
          if (interaction.channel && interaction.channel.isThread && interaction.channel.parentId === SUPPORT_CHANNEL_ID) thread = interaction.channel;
        }
        if (!thread) return interaction.editReply('Не найден тред для закрытия. Укажите `threadid` или вызовите команду внутри треда.');
        // Ensure we have a thread channel object
        try {
          if (!thread.isThread) thread = await interaction.client.channels.fetch(thread.id).catch(() => thread);
        } catch (e) { /* ignore fetch issues */ }

        // Send closing message first (works even if thread will be archived)
        try {
          if (typeof thread.send === 'function') await thread.send('Обращение закрыто.');
        } catch (e) { /* ignore send failures */ }

        // If not already archived, try to lock first then archive.
        try {
          if (!thread.archived) {
            try {
              if (typeof thread.setLocked === 'function') await thread.setLocked(true);
            } catch (e) {
              console.error('lock failed', e);
            }
            try {
              await thread.setArchived(true);
            } catch (e) {
              console.error('archive failed', e);
            }
          } else {
            // already archived - can't change locked state when archived, so skip
            console.log('thread already archived; skipping lock/archive calls');
          }
        } catch (e) { console.error('close thread error', e); }

        // update db ticket status
        const tickets = db.get && db.get('tickets') ? db.get('tickets') : [];
        for (const t of tickets) if (t.threadId === (thread.id || threadIdOpt)) { t.status = 'closed'; t.closedAt = new Date().toISOString(); }
        await db.set('tickets', tickets);
        return interaction.editReply({ content: 'Обращение закрыто.', ephemeral: true });
      }
    } catch (err) {
      console.error('support command error', err);
      return interaction.reply({ content: 'Ошибка при обработке команды support.', ephemeral: true });
    }
  }
};
