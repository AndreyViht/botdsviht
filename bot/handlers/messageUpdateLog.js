const { logAction } = require('./voiceLog');

module.exports = {
  name: 'messageUpdate',
  async execute(oldMessage, newMessage) {
    if (!oldMessage.guild || oldMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;

    // Bonus Log 3: Message Edit
    const oldC = oldMessage.content ? oldMessage.content.substring(0, 50) : '';
    const newC = newMessage.content ? newMessage.content.substring(0, 50) : '';
    
    await logAction(oldMessage.client, `✏️ **${oldMessage.author.tag}** изменил в <#${oldMessage.channel.id}>:\n"${oldC}..." ➡️ "${newC}..."`, 0xF1C40F);
  }
};
