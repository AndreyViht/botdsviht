const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const db = require('../libs/db');

const SUBSCRIBER_ROLE_ID = process.env.SUBSCRIBER_ROLE_ID || '1441744621641400353';
const ANNOUNCE_CHANNEL_ID = process.env.ANNOUNCE_CHANNEL_ID || '1436487981723680930';

async function sendWelcomeMessage(client, channelId) {
  const channel = await client.channels.fetch(channelId);
  if (!channel) {
    console.warn('Channel not found for welcome message:', channelId);
    return null;
  }

  // Check bot permissions in the channel and fail gracefully if missing
  const botMember = channel.guild?.members?.cache?.get(client.user.id) || await channel.guild?.members?.fetch(client.user.id).catch(() => null);
  const perms = channel.permissionsFor ? channel.permissionsFor(botMember || client.user) : null;
  const needed = ['ViewChannel', 'SendMessages', 'EmbedLinks', 'ReadMessageHistory'];
  const missing = perms ? needed.filter(p => !perms.has(p)) : needed;
  if (missing.length) {
    console.warn('Missing channel permissions for welcome message:', missing.join(', '), 'Channel:', channelId);
    return null;
  }

  const embed = new EmbedBuilder()
    .setColor(0xFF006E)
    .setImage('https://media.discordapp.net/attachments/1446801265219604530/1449749530139693166/image_1.jpg?ex=694007f7&is=693eb677&hm=064f42d3b3d9b6c47515e949319c6c62d86d99b950b21d548f94a7ac60faa19a&=&format=webp')
    .setFooter({ text: '💡 Нажми кнопку ниже для верификации' });

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('verify_start')
        .setLabel('Проверка на бота')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅')
    );

  try {
    const msg = await channel.send({ embeds: [embed], components: [row] });
    if (db && db.set) await db.set('welcome', { channelId, messageId: msg.id });
    return msg.id;
  } catch (err) {
    console.warn('Failed to send welcome message (caught):', err && err.message ? err.message : err);
    return null;
  }
}

// Helper: send announcement to announce channel
async function sendAnnouncement(client, member, action) {
  try {
    const announceChannel = await client.channels.fetch(ANNOUNCE_CHANNEL_ID).catch(() => null);
    if (!announceChannel) {
      console.warn('Announce channel not found:', ANNOUNCE_CHANNEL_ID);
      return;
    }

    const botMember = announceChannel.guild?.members?.cache?.get(client.user.id) || await announceChannel.guild?.members?.fetch(client.user.id).catch(() => null);
    const perms = announceChannel.permissionsFor ? announceChannel.permissionsFor(botMember || client.user) : null;
    const needed = ['ViewChannel', 'SendMessages', 'EmbedLinks'];
    const missing = perms ? needed.filter(p => !perms.has(p)) : needed;
    if (missing.length > 0) {
      console.warn('Missing permissions in announce channel:', missing.join(', '));
      return;
    }

    const color = action === 'add' ? 0x00AE86 : 0xE74C3C;
    const title = action === 'add' ? `🎉 Роль выдана` : `❌ Роль удалена`;
    
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setColor(color)
      .addFields(
        { name: 'Пользователь', value: `${member.user.tag} (<@${member.id}>)`, inline: false },
        { name: 'ID пользователя', value: `${member.id}`, inline: true },
        { name: 'Роль', value: `<@&${SUBSCRIBER_ROLE_ID}>`, inline: true }
      )
      .setTimestamp();

    await announceChannel.send({ embeds: [embed] }).catch(e => console.warn('Failed to send announce message:', e && e.message ? e.message : e));
  } catch (e) {
    console.warn('Error while sending announcement:', e && e.message ? e.message : e);
  }
}

async function handleVerificationButton(interaction) {
  if (interaction.customId !== 'verify_start') return;

  const code = Math.floor(1000 + Math.random() * 9000).toString(); // 4 digit code

  const modal = new ModalBuilder()
    .setCustomId(`verify_modal_${code}`)
    .setTitle(`Проверочный код: ${code}`);

  const input = new TextInputBuilder()
    .setCustomId('verify_input')
    .setLabel(`Введите код: ${code}`)
    .setPlaceholder(code)
    .setStyle(TextInputStyle.Short)
    .setMinLength(4)
    .setMaxLength(4)
    .setRequired(true);

  const row = new ActionRowBuilder().addComponents(input);
  modal.addComponents(row);

  await interaction.showModal(modal);
}

async function handleVerificationModal(interaction) {
  if (!interaction.customId.startsWith('verify_modal_')) return;

  const expectedCode = interaction.customId.split('_')[2];
  const inputCode = interaction.fields.getTextInputValue('verify_input');

  if (inputCode !== expectedCode) {
    await interaction.reply({ content: '❌ Неверный код. Попробуйте снова.', ephemeral: true });
    return;
  }

  const member = interaction.member;
  if (!member) {
     await interaction.reply({ content: '❌ Ошибка: пользователь не найден.', ephemeral: true });
     return;
  }

  const role = interaction.guild.roles.cache.get(SUBSCRIBER_ROLE_ID);
  if (!role) {
    await interaction.reply({ content: '❌ Ошибка конфигурации: роль не найдена.', ephemeral: true });
    return;
  }

  if (member.roles.cache.has(SUBSCRIBER_ROLE_ID)) {
      await interaction.reply({ content: '✅ У вас уже есть эта роль!', ephemeral: true });
      return;
  }

  try {
    await member.roles.add(role);
    await interaction.reply({ content: '✅ Вы успешно прошли проверку! Роль выдана.', ephemeral: true });
    await sendAnnouncement(interaction.client, member, 'add');
  } catch (err) {
    console.error('Failed to give role:', err);
    await interaction.reply({ content: '❌ Не удалось выдать роль. Проверьте права бота.', ephemeral: true });
  }
}

// Deprecated reaction handlers (kept for compatibility with index.js)
async function handleReactionAdd(reaction, user) { return; }
async function handleReactionRemove(reaction, user) { return; }

module.exports = { 
  sendWelcomeMessage, 
  handleReactionAdd, 
  handleReactionRemove,
  handleVerificationButton,
  handleVerificationModal
};
