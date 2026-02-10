// Jest setup file
require('dotenv').config();

// Mock Discord.js to avoid real API calls during tests
jest.mock('discord.js', () => {
  const mockCollection = {
    set: jest.fn(),
    get: jest.fn(),
    has: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn(),
    forEach: jest.fn(),
    map: jest.fn(),
    filter: jest.fn(),
    find: jest.fn(),
    some: jest.fn(),
    every: jest.fn(),
    reduce: jest.fn(),
    size: 0,
    [Symbol.iterator]: function* () { }
  };

  const mockEmbedBuilder = jest.fn().mockImplementation(() => ({
    setTitle: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    setColor: jest.fn().mockReturnThis(),
    setThumbnail: jest.fn().mockReturnThis(),
    setFooter: jest.fn().mockReturnThis(),
    setTimestamp: jest.fn().mockReturnThis(),
    setImage: jest.fn().mockReturnThis(),
    addFields: jest.fn().mockReturnThis(),
    setAuthor: jest.fn().mockReturnThis(),
    setURL: jest.fn().mockReturnThis()
  }));

  const mockActionRowBuilder = jest.fn().mockImplementation(() => ({
    addComponents: jest.fn().mockReturnThis()
  }));

  const mockButtonBuilder = jest.fn().mockImplementation(() => ({
    setCustomId: jest.fn().mockReturnThis(),
    setLabel: jest.fn().mockReturnThis(),
    setStyle: jest.fn().mockReturnThis(),
    setEmoji: jest.fn().mockReturnThis(),
    setURL: jest.fn().mockReturnThis(),
    setDisabled: jest.fn().mockReturnThis()
  }));

  const mockSelectMenuBuilder = jest.fn().mockImplementation(() => ({
    setCustomId: jest.fn().mockReturnThis(),
    setPlaceholder: jest.fn().mockReturnThis(),
    addOptions: jest.fn().mockReturnThis(),
    setMinValues: jest.fn().mockReturnThis(),
    setMaxValues: jest.fn().mockReturnThis()
  }));

  const mockModalBuilder = jest.fn().mockImplementation(() => ({
    setCustomId: jest.fn().mockReturnThis(),
    setTitle: jest.fn().mockReturnThis(),
    addComponents: jest.fn().mockReturnThis()
  }));

  const mockTextInputBuilder = jest.fn().mockImplementation(() => ({
    setCustomId: jest.fn().mockReturnThis(),
    setLabel: jest.fn().mockReturnThis(),
    setStyle: jest.fn().mockReturnThis(),
    setPlaceholder: jest.fn().mockReturnThis(),
    setRequired: jest.fn().mockReturnThis(),
    setValue: jest.fn().mockReturnThis(),
    setMinLength: jest.fn().mockReturnThis(),
    setMaxLength: jest.fn().mockReturnThis()
  }));

  const mockChannel = {
    id: '123456789',
    name: 'test-channel',
    type: 0,
    isTextBased: true,
    isVoiceBased: false,
    send: jest.fn().mockResolvedValue({ id: 'msg123' }),
    fetchMessage: jest.fn(),
    messages: {
      fetch: jest.fn().mockResolvedValue({ id: 'msg123', edit: jest.fn() }),
      cache: mockCollection
    },
    threads: {
      create: jest.fn()
    },
    members: {
      add: jest.fn(),
      remove: jest.fn()
    },
    setArchived: jest.fn(),
    setLocked: jest.fn()
  };

  const mockGuild = {
    id: 'guild123',
    name: 'Test Guild',
    channels: {
      fetch: jest.fn().mockResolvedValue(mockChannel),
      cache: mockCollection
    },
    members: {
      fetch: jest.fn().mockResolvedValue({
        id: 'user123',
        user: { id: 'user123', tag: 'TestUser#1234', username: 'TestUser' },
        roles: {
          cache: mockCollection,
          add: jest.fn(),
          remove: jest.fn()
        }
      }),
      cache: mockCollection
    },
    roles: {
      cache: mockCollection,
      fetch: jest.fn()
    },
    voiceAdapterCreator: jest.fn(),
    fetchAuditLogs: jest.fn().mockResolvedValue({
      entries: mockCollection
    })
  };

  const mockUser = {
    id: 'user123',
    tag: 'TestUser#1234',
    username: 'TestUser',
    displayAvatarURL: jest.fn().mockReturnValue('https://example.com/avatar.png'),
    bot: false
  };

  const mockMember = {
    id: 'user123',
    user: mockUser,
    guild: mockGuild,
    roles: {
      cache: mockCollection,
      add: jest.fn(),
      remove: jest.fn()
    },
    voice: {
      channel: mockChannel
    }
  };

  const mockClient = {
    user: mockUser,
    guilds: {
      fetch: jest.fn().mockResolvedValue(mockGuild),
      cache: mockCollection
    },
    channels: {
      fetch: jest.fn().mockResolvedValue(mockChannel),
      cache: mockCollection
    },
    commands: mockCollection,
    userLangs: new Map(),
    login: jest.fn().mockResolvedValue('token'),
    destroy: jest.fn().mockResolvedValue(),
    once: jest.fn(),
    on: jest.fn()
  };

  const mockInteraction = {
    id: 'interaction123',
    user: mockUser,
    member: mockMember,
    guild: mockGuild,
    channel: mockChannel,
    client: mockClient,
    commandName: 'test',
    customId: 'test_button',
    values: [],
    fields: {
      getTextInputValue: jest.fn()
    },
    deferReply: jest.fn().mockResolvedValue(),
    reply: jest.fn().mockResolvedValue(),
    editReply: jest.fn().mockResolvedValue(),
    followUp: jest.fn().mockResolvedValue(),
    update: jest.fn().mockResolvedValue(),
    showModal: jest.fn().mockResolvedValue(),
    isCommand: jest.fn().mockReturnValue(false),
    isButton: jest.fn().mockReturnValue(false),
    isStringSelectMenu: jest.fn().mockReturnValue(false),
    isModalSubmit: jest.fn().mockReturnValue(false),
    safeReply: jest.fn(),
    safeUpdate: jest.fn(),
    safeShowModal: jest.fn()
  };

  return {
    Client: jest.fn().mockImplementation(() => mockClient),
    Collection: jest.fn().mockImplementation(() => mockCollection),
    GatewayIntentBits: {
      Guilds: 1,
      GuildMessages: 2,
      GuildMessageReactions: 4,
      GuildVoiceStates: 8,
      MessageContent: 16,
      GuildMembers: 32
    },
    Partials: {
      Message: 1,
      Channel: 2,
      Reaction: 4
    },
    EmbedBuilder: mockEmbedBuilder,
    ActionRowBuilder: mockActionRowBuilder,
    ButtonBuilder: mockButtonBuilder,
    ButtonStyle: {
      Primary: 1,
      Secondary: 2,
      Success: 3,
      Danger: 4,
      Link: 5
    },
    SelectMenuBuilder: mockSelectMenuBuilder,
    ModalBuilder: mockModalBuilder,
    TextInputBuilder: mockTextInputBuilder,
    TextInputStyle: {
      Short: 1,
      Paragraph: 2
    },
    ChannelType: {
      PrivateThread: 12
    }
  };
});

// Mock @discordjs/voice
jest.mock('@discordjs/voice', () => ({
  joinVoiceChannel: jest.fn(),
  entersState: jest.fn().mockResolvedValue(),
  VoiceConnectionStatus: {
    Ready: 'ready'
  }
}));

// Mock lowdb before other modules
jest.mock('lowdb', () => ({
  Low: jest.fn().mockImplementation(() => ({
    data: {},
    read: jest.fn().mockResolvedValue(),
    write: jest.fn().mockResolvedValue()
  })),
  JSONFile: jest.fn()
}));

// Mock the db module
jest.mock('./bot/libs/db', () => ({
  ensureReady: jest.fn().mockResolvedValue(),
  get: jest.fn(),
  set: jest.fn().mockResolvedValue(),
  incrementAi: jest.fn(),
  initStats: jest.fn(),
  cleanupOldStats: jest.fn()
}));

// Global test utilities
global.testUtils = {
  createMockInteraction: (overrides = {}) => ({
    id: 'interaction123',
    user: { id: 'user123', tag: 'TestUser#1234', username: 'TestUser', bot: false },
    member: {
      id: 'user123',
      user: { id: 'user123', tag: 'TestUser#1234', username: 'TestUser', bot: false },
      roles: { cache: { has: jest.fn().mockReturnValue(false) } }
    },
    guild: { id: 'guild123' },
    channel: { id: 'channel123', isTextBased: true, send: jest.fn() },
    client: { user: { id: 'bot123', tag: 'Bot#1234' } },
    deferReply: jest.fn().mockResolvedValue(),
    reply: jest.fn().mockResolvedValue(),
    editReply: jest.fn().mockResolvedValue(),
    followUp: jest.fn().mockResolvedValue(),
    update: jest.fn().mockResolvedValue(),
    showModal: jest.fn().mockResolvedValue(),
    isCommand: jest.fn().mockReturnValue(false),
    isButton: jest.fn().mockReturnValue(false),
    isStringSelectMenu: jest.fn().mockReturnValue(false),
    isModalSubmit: jest.fn().mockReturnValue(false),
    safeReply: jest.fn(),
    safeUpdate: jest.fn(),
    safeShowModal: jest.fn(),
    ...overrides
  }),

  createMockMessage: (overrides = {}) => ({
    id: 'message123',
    content: 'test message',
    author: { id: 'user123', tag: 'TestUser#1234', username: 'TestUser', bot: false },
    member: {
      id: 'user123',
      user: { id: 'user123', tag: 'TestUser#1234', username: 'TestUser', bot: false },
      roles: { cache: { has: jest.fn().mockReturnValue(false) } }
    },
    guild: { id: 'guild123' },
    channel: { id: 'channel123', isTextBased: true, send: jest.fn() },
    client: { user: { id: 'bot123', tag: 'Bot#1234' } },
    reply: jest.fn().mockResolvedValue(),
    react: jest.fn().mockResolvedValue(),
    ...overrides
  })
};