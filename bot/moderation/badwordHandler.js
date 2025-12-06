const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const db = require('../libs/db');

const badwordsList = require('./badwords.json');
const BADWORD_LOG_CHANNEL = '1446796960697679953';

// Создаем регулярное выражение для поиска матерных слов
function createBadwordRegex() {
  const words = badwordsList.badwords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`\\b(${words.join('|')})\\b`, 'gi');
}

/**
 * Проверяет сообщение на матерные слова
 * @param {Message} message - Discord сообщение
 * @param {Client} client - Discord клиент
 */
async function checkMessage(message, client) {
  try {
    // Игнорируем боты
    if (message.author.bot) return;
    
    // Игнорируем системные сообщения
    if (!message.content || message.content.length === 0) return;

    const regex = createBadwordRegex();
    const matches = message.content.match(regex);

    if (matches && matches.length > 0) {
      const guild = message.guild;
      if (!guild) return;

      // Получаем мьют роль или создаем
      const mutedRole = guild.roles.cache.find(r => r.name === 'Muted') || 
                        await guild.roles.create({ name: 'Muted', color: '#808080' }).catch(() => null);

      if (!mutedRole) {
        console.warn('Could not create or find Muted role');
        return;
      }

      // Применяем мьют на 1 минуту
      const member = message.member;
      const muteTime = 60000; // 1 минута в миллисекундах

      try {
        await member.roles.add(mutedRole, `Автоматический мьют за матерные слова: ${matches.join(', ')}`);
      } catch (e) {
        console.error('Failed to mute member:', e.message);
        return;
      }

      // Логируем в канал
      try {
        const logChannel = await client.channels.fetch(BADWORD_LOG_CHANNEL).catch(() => null);
        if (logChannel && logChannel.isTextBased()) {
          const embed = new EmbedBuilder()
            .setTitle('🚫 Обнаружены матерные слова')
            .setColor(0xFF6B6B)
            .setDescription(`Пользователь <@${message.author.id}> использовал матерные слова`)
            .addFields(
              { name: 'Пользователь', value: `<@${message.author.id}> (${message.author.tag})`, inline: true },
              { name: 'Канал', value: `<#${message.channelId}>`, inline: true },
              { name: 'Матерные слова', value: matches.join(', '), inline: false },
              { name: 'Полный текст', value: message.content.substring(0, 1024), inline: false },
              { name: 'Наказание', value: `Мьют на ${badwordsList.muteTime} ${badwordsList.muteUnit === 'minute' ? 'минуту' : 'минут'}`, inline: false }
            )
            .setTimestamp();

          await logChannel.send({ embeds: [embed] }).catch(() => null);
        }
      } catch (e) {
        console.error('Failed to log badword message:', e.message);
      }

      // Удаляем сообщение
      try {
        await message.delete();
      } catch (e) {
        console.warn('Failed to delete message with badwords:', e.message);
      }

      // Отправляем сообщение пользователю в DM
      try {
        const dmEmbed = new EmbedBuilder()
          .setTitle('⚠️ Нарушение правил')
          .setDescription(`Вы нарушили правила сервера, используя матерные слова`)
          .addFields(
            { name: 'Сервер', value: guild.name, inline: false },
            { name: 'Наказание', value: `Мьют на ${badwordsList.muteTime} ${badwordsList.muteUnit === 'minute' ? 'минуту' : 'минут'}`, inline: false },
            { name: 'Причина', value: `Использование матерных слов: ${matches.join(', ')}`, inline: false }
          )
          .setColor('#FF6B6B')
          .setTimestamp();

        await message.author.send({ embeds: [dmEmbed] }).catch(() => null);
      } catch (e) {
        console.warn('Failed to send DM to user:', e.message);
      }

      // Запланировать снятие мьюта через 1 минуту
      setTimeout(async () => {
        try {
          const updatedMember = await guild.members.fetch(message.author.id).catch(() => null);
          if (updatedMember) {
            await updatedMember.roles.remove(mutedRole, 'Автоматическое снятие мьюта истекло');
          }
        } catch (e) {
          console.error('Failed to unmute member:', e.message);
        }
      }, muteTime);

      // Сохраняем в логи БД
      try {
        const badwordLogs = db.get('badwordLogs') || [];
        badwordLogs.push({
          userId: message.author.id,
          username: message.author.tag,
          guildId: guild.id,
          channelId: message.channelId,
          content: message.content,
          badwords: matches,
          timestamp: new Date().toISOString()
        });

        // Сохраняем только последние 1000 логов
        if (badwordLogs.length > 1000) {
          badwordLogs.splice(0, badwordLogs.length - 1000);
        }

        await db.set('badwordLogs', badwordLogs);
      } catch (e) {
        console.warn('Failed to save badword log to DB:', e.message);
      }
    }
  } catch (e) {
    console.error('badwordHandler error:', e.message);
  }
}

module.exports = { checkMessage, createBadwordRegex };
