const { AuditLogEvent } = require('discord.js');
const { logAction } = require('./voiceLog');

module.exports = {
  name: 'guildMemberUpdate',
  async execute(oldMember, newMember) {
    // 1. Nickname Change
    if (oldMember.nickname !== newMember.nickname) {
      const oldNick = oldMember.nickname || oldMember.user.username;
      const newNick = newMember.nickname || newMember.user.username;
      
      // Try to find who changed it (audit logs)
      let executorText = '';
      try {
        const fetchedLogs = await newMember.guild.fetchAuditLogs({
          limit: 1,
          type: AuditLogEvent.MemberUpdate,
        });
        const log = fetchedLogs.entries.first();
        if (log && log.target.id === newMember.id && log.createdTimestamp > (Date.now() - 5000)) {
           if (log.executor.id !== newMember.id) {
             executorText = ` (изменил: **${log.executor.tag}**)`;
           }
        }
      } catch (e) {}

      await logAction(newMember.client, `📝 **${newMember.user.tag}** сменил ник: \`${oldNick}\` ➡️ \`${newNick}\`${executorText}`, 0x3498DB);
    }

    // 2. Role Add/Remove (Bonus Log 1)
    const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
    const removedRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));

    if (addedRoles.size > 0) {
       // Filter out @everyone
       const roles = addedRoles.filter(r => r.name !== '@everyone').map(r => r.name).join(', ');
       if (roles) await logAction(newMember.client, `➕ **${newMember.user.tag}** получил роль: **${roles}**`, 0x9B59B6);
    }
    
    if (removedRoles.size > 0) {
       const roles = removedRoles.filter(r => r.name !== '@everyone').map(r => r.name).join(', ');
       if (roles) await logAction(newMember.client, `➖ **${newMember.user.tag}** потерял роль: **${roles}**`, 0x95A5A6);
    }
  }
};
