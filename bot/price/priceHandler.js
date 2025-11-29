const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createPriceMainEmbed, getMainRow, createSiteEmbed, createBotEmbed, createOtherEmbed, getBackRow } = require('./priceEmbeds');

async function handlePriceButton(interaction) {
  const id = interaction.customId;

  try {
    if (id === 'price_main' || id === 'price_back') {
      const embed = createPriceMainEmbed();
      const row = getMainRow();
      await interaction.update({ embeds: [embed], components: [row] });
      return;
    }

    if (id === 'price_site') {
      const embed = createSiteEmbed();
      const row = getBackRow();
      await interaction.update({ embeds: [embed], components: [row] });
      return;
    }

    if (id === 'price_bot') {
      const embed = createBotEmbed();
      const row = getBackRow();
      await interaction.update({ embeds: [embed], components: [row] });
      return;
    }

    if (id === 'price_other') {
      const embed = createOtherEmbed();
      const row = getBackRow();
      await interaction.update({ embeds: [embed], components: [row] });
      return;
    }

    // Unknown id — ignore
    await interaction.deferUpdate().catch(() => {});
  } catch (e) {
    console.error('priceHandler error', e && e.message ? e.message : e);
    try { await interaction.reply({ content: '❌ Ошибка при обработке меню прайса.', ephemeral: true }); } catch (ignore) {}
  }
}

module.exports = { handlePriceButton };
