const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

function loadFaq() {
  const f = path.join(__dirname, '..', 'data', 'faq.json');
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return []; }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('faq')
    .setDescription('Поиск в часто задаваемых вопросах')
    .addStringOption(opt => opt.setName('query').setDescription('Ваш вопрос или ключевые слова').setRequired(true)),

  async execute(interaction) {
    const query = interaction.options.getString('query').toLowerCase().trim();
    const lang = interaction.options.getString('lang') || (interaction.client && interaction.client.userLangs && interaction.client.userLangs.get(interaction.user.id)) || 'ru';
    const faq = loadFaq();

    // Simple search: match query in question or answer
    const matches = faq.filter(item => {
      return (item['question_ru'] && item['question_ru'].toLowerCase().includes(query)) ||
             (item['answer_ru'] && item['answer_ru'].toLowerCase().includes(query)) ||
             (item['question_en'] && item['question_en'].toLowerCase().includes(query)) ||
             (item['answer_en'] && item['answer_en'].toLowerCase().includes(query));
    });

    if (matches.length === 0) {
      await interaction.reply({ content: lang === 'en' ? 'No FAQ matches found.' : 'По запросу ничего не найдено.', ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder().setTitle(lang === 'en' ? 'FAQ Search Results' : 'Результаты поиска в FAQ').setColor(0x2b6cb0);
    for (const m of matches.slice(0,6)) {
      embed.addFields({ name: lang === 'en' ? m.question_en || m.question_ru : m.question_ru, value: lang === 'en' ? m.answer_en || m.answer_ru : m.answer_ru, inline: false });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
