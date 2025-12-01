const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

function loadRoles() {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'selfroles.json'), 'utf8')); } catch (e) { return []; }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('🎭 Управление самоназначаемыми ролями (только администраторы)')
    .addStringOption(o => o.setName('action').setDescription('assign|remove|list').setRequired(true))
    .addStringOption(o => o.setName('roleid').setDescription('ID роли для assign/remove').setRequired(false)),

  async execute(interaction) {
    // Check admin role
    const ADMIN_ROLE = '1436485697392607303';
    const member = interaction.member || (interaction.guild ? await interaction.guild.members.fetch(interaction.user.id).catch(() => null) : null);
    if (!member || !member.roles || !member.roles.cache || !member.roles.cache.has(ADMIN_ROLE)) {
      return await interaction.reply({ content: 'У вас нет доступа к этой команде. Требуется административная роль.', ephemeral: true });
    }

    const action = interaction.options.getString('action');
    const roleId = interaction.options.getString('roleid');
    const available = loadRoles();

    if (action === 'list') {
      const list = available.map(r => `${r.id} — ${r.name}`).join('\n');
      return await interaction.reply({ content: `Доступные роли:\n${list}`, ephemeral: true });
    }

    if (!roleId) return await interaction.reply({ content: 'Укажите roleid.', ephemeral: true });
    const roleInfo = available.find(r => r.id === roleId);
    if (!roleInfo) return await interaction.reply({ content: 'Роль не найдена в selfroles.', ephemeral: true });

    const member = interaction.guild && interaction.guild.members.cache.get(interaction.user.id) ? interaction.guild.members.cache.get(interaction.user.id) : await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    if (!member) return await interaction.reply({ content: 'Не удалось получить информацию о пользователе.', ephemeral: true });

    if (action === 'assign') {
      try { await member.roles.add(roleId); return await interaction.reply({ content: `Роль ${roleInfo.name} назначена.`, ephemeral: true }); } catch (e) { return await interaction.reply({ content: 'Не удалось назначить роль. У бота недостаточно прав.', ephemeral: true }); }
    }
    if (action === 'remove') {
      try { await member.roles.remove(roleId); return await interaction.reply({ content: `Роль ${roleInfo.name} удалена.`, ephemeral: true }); } catch (e) { return await interaction.reply({ content: 'Не удалось удалить роль. У бота недостаточно прав.', ephemeral: true }); }
    }

    await interaction.reply({ content: 'Неизвестная команда.', ephemeral: true });
  }
};
