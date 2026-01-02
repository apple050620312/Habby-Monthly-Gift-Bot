const { SlashCommandBuilder } = require('discord.js');
const db = require('../database/db');
const moment = require('moment');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lookup')
        .setDescription('Looks up a playerid')
        .addSubcommand(subcommand =>
            subcommand
                .setName('user')
                .setDescription('Info about a discord user')
                .addUserOption(option =>
                    option.setName('target')
                        .setDescription('user')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('id')
                .setDescription('Info about a player id')
                .addStringOption(option =>
                    option.setName('target')
                        .setDescription('id')
                        .setRequired(true)))
        .setDMPermission(false),
    async execute(interaction) {
        // No permission check explicitly in original for lookup except the global admin check at line 265
        
        let rows = [];
        if (interaction.options.getSubcommand() === 'user') {
            const user = interaction.options.getMember('target');
            rows = db.getPlayerHistory(user.id);
        } else if (interaction.options.getSubcommand() === 'id') {
            const playerId = interaction.options.getString('target');
            if (!/^\d+$/.test(playerId)) {
                return await interaction.reply({ content: interaction.__('Invalid playerID \`%s\`. Please check again.', playerId), ephemeral: true });
            }
            rows = db.getPlayerHistoryById(playerId);
        }

        const msg = rows.map((row) => {
            const claimDate = moment(new Date(row.date)).unix();
             return `Discord: \`${row.discordid}\` PlayerID: \`${row.playerid}\` Code: \`${row.code}\` RedeemedAt: <t:${claimDate}:f> <t:${claimDate}:R>`
        }).join('\n');

        return await interaction.reply({ content: msg || "None", ephemeral: false });
    },
};
