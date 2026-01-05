const db = require('../libs/db');
const statsTracker = require('../libs/statsTracker');
const { createUserMenu } = require('../dm-menu');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    try {
      await db.ensureReady();

      // Track user join for statistics
      try {
        statsTracker.initStats();
        statsTracker.trackUserJoin(member.id, member.guild.id);

        // Track user role
        if (member.roles.cache.size > 0) {
          member.roles.cache.forEach(role => {
            statsTracker.trackUserRole(member.id, role.name);
          });
        }
      } catch (e) {
        console.warn('Stats tracking failed:', e.message);
      }

      const prefs = db.get('prefs') || {};
      const enabled = (prefs.onboarding && prefs.onboarding[member.id] !== false);
      if (!enabled) return;
      const welcome = `Привет, ${member.user.username}! Добро пожаловать на сервер. Если хотите, используйте команду /onboarding optout чтобы отключить приветственные сообщения.`;
      await member.send(welcome).catch(() => null);

      // Create DM menu for new members
      try {
        await createUserMenu(member.client, member.id, member.guild.id);
      } catch (err) {
        console.error('guildMemberAdd DM menu error:', err.message);
      }
    } catch (e) {
      console.warn('onboarding send failed', e && e.message);
    }
  }
};