const { SlashCommandBuilder } = require('discord.js');
const db = require('../database/db');
const { presentIdModal, presentCaptcha } = require('../events/interactionCreate');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('redeem')
        .setDescription('Redeem a specific gift code')
        .addStringOption(option =>
            option.setName('code')
                .setDescription('The gift code to redeem')
                .setRequired(true))
        .setDMPermission(false),
    async execute(interaction) {

        const code = interaction.options.getString('code');

        const { startClaimFlow } = require('../utils/claimHelpers');
        await startClaimFlow(interaction, code, true);
    },
};
