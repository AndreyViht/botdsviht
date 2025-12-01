const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vers')
    .setDescription('📦 Версия бота (только администраторы)
    ,

  async execute(interaction) {
    try {
      // control role id used elsewhere in the code
      const CONTROL_ROLE_ID = '1436485697392607303';
      const member = interaction.member || (interaction.guild ? await interaction.guild.members.fetch(interaction.user.id).catch(() => null) : null);
      const isAllowed = member && member.roles && member.roles.cache && member.roles.cache.has(CONTROL_ROLE_ID);
      if (!isAllowed) return await interaction.reply({ content: 'У вас нет прав для этой команды.', ephemeral: true });

      // Read version from VERSION file if present
      const fs = require('fs');
      const path = require('path');
      let version = 'v-0.037';
      try {
        const vf = path.join(process.cwd(), 'VERSION');
        if (fs.existsSync(vf)) {
          const vv = fs.readFileSync(vf, 'utf8').trim();
          if (vv) version = `v-${vv}`;
        }
      } catch (e) { /* ignore */ }

      const embed = new EmbedBuilder()
        .setTitle('Версия бота')
        .setColor(0x00AE86)
        .setDescription(`Версия: **${version}**`)
        .setFooter({ text: 'Viht Bot' });

      await interaction.reply({ embeds: [embed], ephemeral: false });
    } catch (e) {
      console.error('vers command error', e && e.message ? e.message : e);
      try { await interaction.reply({ content: 'Ошибка при выполнении команды.', ephemeral: true }); } catch (err) {}
    }
  }
};
