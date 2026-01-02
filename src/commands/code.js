const { SlashCommandBuilder } = require('discord.js');
const db = require('../database/db');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('code')
        .setDescription('Get code')
        .setDMPermission(false),
    async execute(interaction) {
        if (!config.isDeveloper(interaction.user.id) && !interaction.member.permissions.has('Administrator')) {
             return await interaction.reply({ content: `Sorry only admins :(`, ephemeral: true });
        }

        await interaction.reply({ content: `Fetching a code. Hold on one moment.`, ephemeral: false });
        
        const row = db.getUnusedCode('codes');
        if (!row || !row.code) {
             return await interaction.editReply({ content: interaction.__('no_more_gifts'), components: [], files: [] });
        }

        db.markCodeUsed('codes', row.code);
        return await interaction.editReply({ content: `Your code is \`${row.code}\`!`, components: [], files: [] });
    },
};
