// Music handler stub - module disabled

async function handleMusicButton(interaction) {
  try {
    await interaction.reply({
      content: '🎵 Музыкальный модуль отключен.',
      ephemeral: true
    });
  } catch (e) {
    console.error('Music button error:', e.message);
  }
}

module.exports = { handleMusicButton };
