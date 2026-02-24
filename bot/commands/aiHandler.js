const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config');

// Store conversation history per thread
const conversationHistory = new Map();

// Initialize AI welcome message
async function ensureAiWelcomeMessage(client) {
  try {
    if (!client) return;
    const channel = await client.channels.fetch(config.aiChannelId).catch(() => null);
    if (!channel) return console.warn('AI channel not found:', config.aiChannelId);

    // Check if message already exists
    const messages = await channel.messages.fetch({ limit: 10 });
    const botMsg = messages.find(m => m.author.id === client.user.id && m.embeds.length > 0 && m.embeds[0].title?.includes('Viht AI'));
    
    if (botMsg) {
      console.log('AI welcome message already exists');
      return;
    }

    // Create embed
    const embed = new EmbedBuilder()
      .setTitle('🤖 Viht AI')
      .setColor(0x00D4FF)
      .setDescription(
        'Добро пожаловать в AI Viht!\n\n' +
        'Нажмите кнопку ниже, чтобы начать приватное общение с искусственным интеллектом. ' +
        'Для каждого пользователя будет создана приватная ветка, видимая только вам.\n\n' +
        '✨ Используется передовая модель AI для качественных ответов'
      )
      .setFooter({ text: 'Приватное общение между вами и Viht AI' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ai_start_chat')
        .setLabel('💬 Начать общение')
        .setStyle(ButtonStyle.Primary)
    );

    const msg = await channel.send({ embeds: [embed], components: [row] }).catch(() => null);
    if (msg) {
      console.log('Posted AI welcome message');
    }
  } catch (e) {
    console.error('ensureAiWelcomeMessage error:', e.message);
  }
}

// Handle start chat button
async function handleAiStartChat(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    // Create private thread
    const channel = await interaction.client.channels.fetch(config.aiChannelId);
    const thread = await channel.threads.create({
      name: `💬 ${interaction.user.username}'s Chat`,
      autoArchiveDuration: 1440, // 24 часа
      invitable: false,
      reason: `AI chat for ${interaction.user.tag}`
    });

    // Initialize conversation history for this thread
    conversationHistory.set(thread.id, [
      {
        role: 'system',
        content: 'Ты - Viht AI, полезный и дружелюбный помощник. Твой создатель - Viht. Отвечай на русском языке, будь вежлив и информативен. Помогай пользователю в его вопросах и задачах.'
      }
    ]);

    // Send welcome message in thread
    const welcomeEmbed = new EmbedBuilder()
      .setTitle('👋 Добро пожаловать в Viht AI')
      .setColor(0x00D4FF)
      .setDescription('Я готов помочь вам с любыми вопросами. Просто напишите ваше сообщение!')
      .setFooter({ text: 'Это приватная ветка, видна только вам' });

    await thread.send({ embeds: [welcomeEmbed] });

    await interaction.editReply({
      content: `✅ Приватная ветка создана! <#${thread.id}>`,
      ephemeral: true
    });

    console.log(`[AI] Created chat thread for ${interaction.user.tag}`);
  } catch (e) {
    console.error('handleAiStartChat error:', e.message);
    try {
      await interaction.editReply({
        content: '❌ Ошибка при создании чата. Попробуйте ещё раз.',
        ephemeral: true
      });
    } catch (er) {}
  }
}

// Call OpenRouter API
async function callOpenRouterAPI(messages) {
  try {
    const response = await fetch(`${config.aiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.aiApiKey}`
      },
      body: JSON.stringify({
        model: config.aiModel,
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('OpenRouter error:', error);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (e) {
    console.error('callOpenRouterAPI error:', e.message);
    return null;
  }
}

// Handle messages in AI thread
async function handleAiMessage(message) {
  try {
    // Ignore bot messages
    if (message.author.bot) return;

    // Only respond in threads
    if (!message.channel.isThread()) return;

    // Check if this thread has AI conversation history
    if (!conversationHistory.has(message.channelId)) return;

    // Show typing indicator
    await message.channel.sendTyping();

    // Get conversation history
    let history = conversationHistory.get(message.channelId) || [];

    // Add user message
    history.push({
      role: 'user',
      content: message.content
    });

    // Call API
    const reply = await callOpenRouterAPI(history);

    if (!reply) {
      await message.reply({
        content: '❌ Ошибка при получении ответа от AI. Попробуйте ещё раз.',
        ephemeral: true
      });
      return;
    }

    // Add AI response to history
    history.push({
      role: 'assistant',
      content: reply
    });

    // Keep only last 20 messages in history
    if (history.length > 21) {
      history = [history[0], ...history.slice(-20)];
    }

    // Update history
    conversationHistory.set(message.channelId, history);

    // Send response (split if too long)
    const maxLength = 2000;
    if (reply.length > maxLength) {
      const chunks = reply.match(new RegExp(`.{1,${maxLength}}`, 'g'));
      for (const chunk of chunks) {
        await message.reply({ content: chunk });
      }
    } else {
      await message.reply({ content: reply });
    }

    console.log(`[AI] Responded to ${message.author.tag} in thread ${message.channelId}`);
  } catch (e) {
    console.error('handleAiMessage error:', e.message);
  }
}

// Clean up history when thread is deleted
async function cleanupThreadHistory(threadId) {
  conversationHistory.delete(threadId);
  console.log(`[AI] Cleaned up history for thread ${threadId}`);
}

module.exports = {
  ensureAiWelcomeMessage,
  handleAiStartChat,
  handleAiMessage,
  cleanupThreadHistory
};
