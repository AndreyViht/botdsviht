const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const config = require('../config');

// Admin commands with descriptions
const adminCommands = [
  // User Management
  { name: 'ban', emoji: '🚫', category: 'users', ru: 'Забанить пользователя', en: 'Ban user' },
  { name: 'unban', emoji: '✅', category: 'users', ru: 'Разбанить пользователя', en: 'Unban user' },
  { name: 'mute', emoji: '🔇', category: 'users', ru: 'Замутить пользователя', en: 'Mute user' },
  { name: 'unmute', emoji: '🔊', category: 'users', ru: 'Размутить пользователя', en: 'Unmute user' },
  { name: 'warn', emoji: '⚠️', category: 'users', ru: 'Выдать предупреждение', en: 'Give warning' },
  { name: 'unwarn', emoji: '📋', category: 'users', ru: 'Снять предупреждение', en: 'Remove warning' },

  // Server Management
  { name: 'clearchat', emoji: '🗑️', category: 'server', ru: 'Очистить чат (удалить сообщения)', en: 'Clear chat (bulk delete)' },
  { name: 'schedule', emoji: '📅', category: 'server', ru: 'Запланировать событие', en: 'Schedule event' },
  { name: 'backup', emoji: '💾', category: 'server', ru: 'Создать резервную копию', en: 'Create backup' },
  { name: 'audit', emoji: '📊', category: 'server', ru: 'Просмотр логов аудита', en: 'View audit logs' },
  { name: 'analytics', emoji: '📈', category: 'server', ru: 'Статистика активности', en: 'Activity statistics' },

  // Role Management  
  { name: 'role', emoji: '🎭', category: 'roles', ru: 'Управление самоназначением ролей', en: 'Manage self-roles' },

  // Music Control
  { name: 'mstop', emoji: '⏹️', category: 'music', ru: '👑 ТОЛЬКО ОСНОВАТЕЛЬ - Остановить музыку', en: '👑 FOUNDER ONLY - Stop music' },

  // Support & Info
  { name: 'ticket', emoji: '🎫', category: 'support', ru: 'Просмотр статуса тикетов', en: 'Check ticket status' },
  { name: 'register', emoji: '📝', category: 'support', ru: 'Регистрация ключей', en: 'Register keys' },

  // Settings
  { name: 'onboarding', emoji: '📨', category: 'settings', ru: 'Управление приветствием', en: 'Manage welcome messages' },
  { name: 'setvpn', emoji: '🌐', category: 'settings', ru: 'Установить статус VPN', en: 'Set VPN status' },
  { name: 'automodtest', emoji: '🤖', category: 'settings', ru: 'Тест антиспама', en: 'Automod test' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('afaq')
    .setDescription('👑 Администраторские команды'),

  async execute(interaction) {
    // Check if user has admin role
    const member = interaction.member;
    const isAdmin = member && member.roles && member.roles.cache && config.adminRoles && config.adminRoles.some(rid => member.roles.cache.has(rid));

    if (!isAdmin) {
      await interaction.reply({
        content: '⛔ У вас нет доступа к этой команде. Требуется администраторская роль.',
        ephemeral: true
      });
      return;
    }

    const lang = (interaction.client && interaction.client.userLangs && interaction.client.userLangs.get(interaction.user.id)) || 'ru';
    const isRu = lang === 'ru';

    const embed = new EmbedBuilder()
      .setTitle(isRu ? '👑 АДМИНИСТРАТОРСКИЕ КОМАНДЫ' : '👑 ADMIN COMMANDS')
      .setColor(0xff6b6b)
      .setDescription(isRu ? 
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🔐 Команды только для администраторов\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' :
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🔐 Commands for administrators only\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
      );

    // Group commands by category
    const categories = {
      users: { name: isRu ? '👤 Управление пользователями' : '👤 User Management', commands: [] },
      server: { name: isRu ? '🏢 Управление сервером' : '🏢 Server Management', commands: [] },
      roles: { name: isRu ? '🎭 Роли' : '🎭 Roles', commands: [] },
      music: { name: isRu ? '🎵 Музыка' : '🎵 Music', commands: [] },
      support: { name: isRu ? '🆘 Поддержка' : '🆘 Support', commands: [] },
      settings: { name: isRu ? '⚙️ Настройки' : '⚙️ Settings', commands: [] },
    };

    // Categorize commands
    for (const cmd of adminCommands) {
      categories[cmd.category].commands.push(cmd);
    }

    // Add category fields
    for (const [cat, data] of Object.entries(categories)) {
      if (data.commands.length === 0) continue;
      
      const lines = data.commands.map(cmd => 
        `${cmd.emoji} \`/${cmd.name}\` — ${isRu ? cmd.ru : cmd.en}`
      ).join('\n');
      
      embed.addFields({ 
        name: data.name,
        value: lines,
        inline: false
      });
    }

    embed.addFields({
      name: isRu ? '\n━━━━━━━━━━━━━━━━━━━━━━━━━━' : '\n━━━━━━━━━━━━━━━━━━━━━━━━━━',
      value: isRu ? 
        '⚠️ **Осторожно с этими командами!**\n' +
        '📚 Для пользовательских команд используй `/faq`' :
        '⚠️ **Use these commands with caution!**\n' +
        '📚 Use `/faq` for user commands'
    });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
