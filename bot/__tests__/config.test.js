const config = require('../config');

describe('Config', () => {
  test('should export all required configuration properties', () => {
    expect(config).toBeDefined();
    expect(typeof config).toBe('object');

    // Check for essential properties
    expect(config).toHaveProperty('token');
    expect(config).toHaveProperty('defaultGuildId');
    expect(config).toHaveProperty('defaultVoiceChannelId');
    expect(config).toHaveProperty('commandLogChannelId');
    expect(config).toHaveProperty('voiceLogChannelId');
    expect(config).toHaveProperty('muteRoleId');
    expect(config).toHaveProperty('aiChatChannelId');
    expect(config).toHaveProperty('supportChannelId');
    expect(config).toHaveProperty('welcomeChannelId');
    expect(config).toHaveProperty('priceChannelId');
    expect(config).toHaveProperty('subscriberRoleId');
  });

  test('should have valid channel/role IDs', () => {
    // Channel IDs should be strings or undefined
    const channelIds = [
      config.commandLogChannelId,
      config.voiceLogChannelId,
      config.aiChatChannelId,
      config.supportChannelId,
      config.welcomeChannelId,
      config.priceChannelId
    ];

    channelIds.forEach(id => {
      if (id !== undefined) {
        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(0);
      }
    });

    // Role IDs should be strings or undefined
    const roleIds = [
      config.muteRoleId,
      config.subscriberRoleId
    ];

    roleIds.forEach(id => {
      if (id !== undefined) {
        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(0);
      }
    });
  });

  test('should have valid intent flags', () => {
    expect(typeof config.messageContentIntent).toBe('boolean');
    expect(typeof config.guildMembersIntent).toBe('boolean');
  });

  test('should have valid staff roles array', () => {
    expect(Array.isArray(config.staffRoles)).toBe(true);
    config.staffRoles.forEach(roleId => {
      expect(typeof roleId).toBe('string');
      expect(roleId.length).toBeGreaterThan(0);
    });
  });

  test('should have valid admin roles array', () => {
    expect(Array.isArray(config.adminRoles)).toBe(true);
    config.adminRoles.forEach(roleId => {
      expect(typeof roleId).toBe('string');
      expect(roleId.length).toBeGreaterThan(0);
    });
  });
});