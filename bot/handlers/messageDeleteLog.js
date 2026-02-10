const { logAction } = require('./voiceLog');

module.exports = {
  name: 'messageDelete',
  async execute(message) {
    if (!message.guild || message.author?.bot) return;

    // Bonus Log 2: Message Delete
    // Keep it short: "User deleted msg in #channel: Content..."
    const content = message.content ? message.content.substring(0, 100) : '[Вложение/Embed]';
    await logAction(message.client, `🗑️ **${message.author.tag}** удалил сообщение в <#${message.channel.id}>: "${content}"`, 0xED4245);
  }
};
