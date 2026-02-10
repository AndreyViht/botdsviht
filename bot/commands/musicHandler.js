const { 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} = require('discord.js');
const { 
  joinVoiceChannel, 
  createAudioPlayer, 
  createAudioResource, 
  AudioPlayerStatus, 
  VoiceConnectionStatus 
} = require('@discordjs/voice');
const db = require('../libs/db');
const config = require('../config');

const MUSIC_PANEL_KEY = 'musicPanelPosted';

// Stream URLs (Direct MP3 streams or Radio links)
const STREAMS = {
  lofi: 'https://stream.zeno.fm/0r0xa854rp8uv', // Lofi Radio
  phonk: 'https://stream.zeno.fm/g4n28113rp8uv', // Phonk Radio
  pop: 'https://stream.zeno.fm/f3wvbbqmdg8uv',   // Pop Radio
};

// State management
// Map<guildId, { player: AudioPlayer, connection: VoiceConnection, ownerId: string, channelId: string }>
const activeSessions = new Map();

function makeMusicEmbed() {
  return new EmbedBuilder()
    .setTitle('🎵 Музыкальный Пульт Viht')
    .setColor(0xFF00FF)
    .setDescription('Украсьте скучные посиделки отличной музыкой! Нажмите на кнопку, чтобы бот присоединился к вашему каналу.')
    .addFields(
      { name: '☕ Lofi / Chill', value: 'Спокойная музыка для работы и отдыха.', inline: true },
      { name: '🔥 Phonk / Bass', value: 'Энергичная музыка для игр.', inline: true },
      { name: '💃 Pop Hits', value: 'Популярные хиты и радио.', inline: true }
    )
    .setFooter({ text: 'Управлять ботом может только тот, кто его вызвал.' });
}

function makeMusicButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music_lofi').setLabel('☕ Lofi / Chill').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_phonk').setLabel('🔥 Phonk / Bass').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('music_pop').setLabel('💃 Pop Hits').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('music_stop').setLabel('🛑 Стоп').setStyle(ButtonStyle.Danger)
  );
}

async function ensureMusicPanel(client) {
  try {
    if (!client) return;
    const ch = await client.channels.fetch(config.musicChannelId).catch(() => null);
    if (!ch) return console.warn('Music channel not found:', config.musicChannelId);

    const rec = db.get(MUSIC_PANEL_KEY);
    const embed = makeMusicEmbed();
    const rows = makeMusicButtons();

    if (rec && rec.channelId === config.musicChannelId && rec.messageId) {
      const existing = await ch.messages.fetch(rec.messageId).catch(() => null);
      if (existing) {
        // Optional: update if needed
        // await existing.edit({ embeds: [embed], components: [rows] }).catch(() => null);
        console.log('Music panel exists');
        return;
      }
    }

    const msg = await ch.send({ embeds: [embed], components: [rows] }).catch(() => null);
    if (msg && db && db.set) await db.set(MUSIC_PANEL_KEY, { channelId: config.musicChannelId, messageId: msg.id, postedAt: Date.now() });
    console.log('Posted music panel to', config.musicChannelId);
  } catch (e) {
    console.error('ensureMusicPanel error', e && e.message ? e.message : e);
  }
}

async function handleMusicButton(interaction) {
  const guildId = interaction.guildId;
  const member = interaction.member;
  const voiceChannel = member.voice.channel;
  const customId = interaction.customId;

  // 1. Check Voice State
  if (!voiceChannel && customId !== 'music_stop') {
    return interaction.reply({ content: '🚫 Вы должны быть в голосовом канале!', ephemeral: true });
  }

  // 2. Check Session
  let session = activeSessions.get(guildId);

  // Stop Logic
  if (customId === 'music_stop') {
    if (!session) {
      return interaction.reply({ content: '💤 Я и так не играю.', ephemeral: true });
    }
    // Access Control: Only owner or admin can stop
    const isOwner = session.ownerId === member.id;
    const isAdmin = member.permissions.has('Administrator');

    if (!isOwner && !isAdmin) {
      return interaction.reply({ content: `🔒 Бота использует <@${session.ownerId}>. Вы не можете его остановить.`, ephemeral: true });
    }

    session.connection.destroy();
    activeSessions.delete(guildId);
    return interaction.reply({ content: '🛑 Музыка остановлена. До связи!', ephemeral: true });
  }

  // Play Logic
  // Check if bot is busy with someone else
  if (session) {
    // If bot is in another channel
    if (session.channelId !== voiceChannel.id) {
       return interaction.reply({ content: `🚫 Я уже занят в канале <#${session.channelId}> пользователем <@${session.ownerId}>.`, ephemeral: true });
    }
    // If in same channel, update owner to current user (optional, or keep original owner)
    // allowing anyone in the SAME channel to switch tracks is usually better UX
  }

  const genre = customId.split('_')[1]; // lofi, phonk, pop
  const streamUrl = STREAMS[genre];

  if (!streamUrl) return interaction.reply({ content: '❌ Ошибка ссылки потока.', ephemeral: true });

  await interaction.deferReply({ ephemeral: true });

  try {
    // Connect
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guildId,
      adapterCreator: interaction.guild.voiceAdapterCreator,
    });

    const player = createAudioPlayer();
    const resource = createAudioResource(streamUrl);

    player.play(resource);
    connection.subscribe(player);

    // Save session
    activeSessions.set(guildId, {
      player,
      connection,
      ownerId: member.id,
      channelId: voiceChannel.id
    });

    // Handle disconnect/idle
    connection.on(VoiceConnectionStatus.Disconnected, () => {
      try { connection.destroy(); } catch (e) {}
      activeSessions.delete(guildId);
    });

    player.on(AudioPlayerStatus.Idle, () => {
      // Auto-restart stream if it drops (for radio)
      // or just stay silent. For now, we assume streams are continuous.
    });

    await interaction.editReply({ content: `🎶 Включено радио: **${genre.toUpperCase()}**` });

  } catch (e) {
    console.error('Music Error:', e);
    activeSessions.delete(guildId);
    await interaction.editReply({ content: '❌ Ошибка при подключении к голосу.' });
  }
}

module.exports = { ensureMusicPanel, handleMusicButton };
