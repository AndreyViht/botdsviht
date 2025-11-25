const { SlashCommandBuilder } = require('discord.js');
const infoModule = require('./info');

// Create an alias command 'indo' that reuses info.execute
module.exports = {
	data: new SlashCommandBuilder()
		.setName('indo')
		.setDescription('Альтернатива /info — информация о пользователе')
		.addUserOption(opt => opt.setName('user').setDescription('Пользователь для отображения информации').setRequired(false)),
	async execute(interaction) {
		// delegate to info.execute
		return infoModule.execute(interaction);
	}
};
