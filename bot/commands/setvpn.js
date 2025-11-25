const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const db = require('../libs/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setvpn')
    .setDescription('Установить тестовый IP/адрес VPN (только для админов)')
    .addStringOption(opt => opt.setName('ip').setDescription('IP или адрес сервера').setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    try {
      // require manage guild permission or administrator OR special control role
      const CONTROL_ROLE_ID = '1436485697392607303';
      const perms = interaction.member && interaction.member.permissions;
      const hasPerm = perms && (perms.has(PermissionsBitField.Flags.ManageGuild) || perms.has(PermissionsBitField.Flags.Administrator));
      const hasRole = interaction.member && interaction.member.roles && interaction.member.roles.cache && interaction.member.roles.cache.has(CONTROL_ROLE_ID);
      if (!hasPerm && !hasRole) {
        console.log(`[setvpn] Denied: user ${interaction.user.id} missing perms/role`);
        return await interaction.editReply('Ошибка: у вас нет прав для установки тестового IP (требуется Manage Guild, Администратор или роль создателя).');
      }

      const ip = interaction.options.getString('ip').trim();
      console.log(`[setvpn] Setting testVpnIp to ${ip} by user ${interaction.user.id}`);
      await db.set('testVpnIp', ip);
      await interaction.editReply(`Тестовый VPN IP установлен: ${ip} (публичный показ IP ограничен).`);
    } catch (e) {
      console.error('setvpn error', e && e.message ? e.message : e);
      await interaction.editReply('Не удалось установить тестовый IP.');
    }
  }
};
