const { SlashCommandBuilder } = require('discord.js');
const db = require('../database/db');
const config = require('../config');

// Reconstruct logic from index.js:246
module.exports = {
    data: new SlashCommandBuilder()
        .setName('status')
        .setDescription('Checks bot status'),
    async execute(interaction, client) {
        if (!config.isDeveloper(interaction.user.id)) {
             // Logic in index.js says "NO DM!" but status is likely generally available or admin?
             // Actually line 265 limits almost everything to Admins or Developers.
             // Im implementing the admin check in the interaction handler or per command.
             // Original logic: if not dev and not admin returns "Sorry only admins :("
        }

        const before = Date.now();
        const message = await interaction.reply({ content: interaction.__('checking'), fetchReply: true });
        const after = Date.now();
        
        const row = db.getStats();

        // Calculate ping
        const apiPing = message.createdTimestamp - interaction.createdTimestamp;
        const wsPing = Math.round(client.ws.ping);
        const dbPing = Date.now() - after;

        const content = `Original Developed by Reformed(mayvary), Maintaining by <@523114942434639873> (sangege)
Real time total ${Date.now() - before}ms | API ${apiPing}ms | WS ${wsPing}ms | DB ${dbPing}ms
Normal codes remaining: ${Math.round(row.codes_left / row.codes_total * 100)}% (${row.codes_left} / ${row.codes_total})
Nitro codes remaining: ${Math.round(row.nitro_left / row.nitro_total * 100)}% (${row.nitro_left} / ${row.nitro_total})
`;
        await interaction.editReply(content);
    },
};
