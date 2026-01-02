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
             return await interaction.reply({ content: interaction.__('only_admins'), ephemeral: true });
        }

        await interaction.reply({ content: interaction.__('fetching_code'), ephemeral: false });
        
        const row = db.getUnusedCode('codes');
        if (!row || !row.code) {
             return await interaction.editReply({ content: interaction.__('no_more_gifts'), components: [], files: [] });
        }

        db.markCodeUsed('codes', row.code);
        return await interaction.editReply({ content: interaction.__('your_code_is', row.code), components: [], files: [] });
    },
};
