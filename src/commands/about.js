const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('about')
        .setDescription('Shows bot information'),
    async execute(interaction, client) {
        const apiPing = Date.now() - interaction.createdTimestamp;
        const wsPing = Math.round(client.ws.ping);
        
        const content = `Original Developed by Reformed(mayvary), Maintaining by <@523114942434639873> (sangege)
GitHub: https://github.com/apple050620312/Habby-Monthly-Gift-Bot
API Ping: ${apiPing}ms | WS Ping: ${wsPing}ms`;
        
        await interaction.reply({ content, ephemeral: false });
    }
};
