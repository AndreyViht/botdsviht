const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const BADWORDS_FILE = path.join(__dirname, '..', 'moderation', 'badwords.txt');

function buildRegexFromWords(words) {
  const esc = words.map(w => w.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'));
  return new RegExp('\\b(' + esc.join('|') + ')\\b', 'iu');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('automodtest')
    .setDescription('Test automod matching for a given text (admin only)')
    .addStringOption(opt => opt.setName('text').setDescription('Text to test').setRequired(true)),
  async execute(interaction) {
    if (!interaction.memberPermissions || !interaction.memberPermissions.has('Administrator')) {
      // allow server owner or admins only
      if (!interaction.memberPermissions || !interaction.memberPermissions.has('Administrator')) {
        return interaction.reply({ content: 'Только администраторы могут использовать эту команду.', ephemeral: true });
      }
    }
    const text = interaction.options.getString('text');
    let words = [];
    try {
      if (fs.existsSync(BADWORDS_FILE)) {
        const txt = fs.readFileSync(BADWORDS_FILE, 'utf8');
        words = txt.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
      }
    } catch (e) {
      console.warn('automodtest: failed to read badwords', e && e.message ? e.message : e);
    }

    if (!words.length) return interaction.reply({ content: 'Список плохих слов пуст.', ephemeral: true });
    const rx = buildRegexFromWords(words);
    const m = rx.exec(text);
    if (m) {
      return interaction.reply({ content: `Matched: ${m[0]}
Context: ${text.slice(0,200)}`, ephemeral: true });
    }
    return interaction.reply({ content: 'No match', ephemeral: true });
  }
};
