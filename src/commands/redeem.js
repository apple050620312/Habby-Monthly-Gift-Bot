const { SlashCommandBuilder } = require('discord.js');
const db = require('../database/db');
const { presentIdModal, presentCaptcha } = require('../events/interactionCreate'); // Circular dependency handling needed? 
// Actually interactionCreate exports the handler, not the helpers usuall. 
// I might need to move helpers to a separate file or duplicate/refactor.
// For now, I'll rely on a refactor of `interactionCreate` to export these, or move them to `claimHelpers`.

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
        // This will be handled in interactionCreate conceptually if I just fire the modal/captcha flow.
        // But the command handler needs to trigger it.
        // We will implement the trigger logic here.
        
        const code = interaction.options.getString('code');
        
        // We can't import `presentIdModal` easily if it's inside `interactionCreate.js`.
        // I should move `presentIdModal` and `presentCaptcha` to `src/utils/claimHelpers.js` or `src/services/uiService.js` to avoid circular deps.
        // For now, I'll write this file assuming I'll refactor the helpers out.
        
        const { startClaimFlow } = require('../utils/claimHelpers'); 
        await startClaimFlow(interaction, code);
    },
};
