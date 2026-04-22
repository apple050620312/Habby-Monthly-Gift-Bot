const { SlashCommandBuilder } = require('discord.js');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Shows available commands'),
    async execute(interaction) {
        let text = `**User Commands:**\n\`/redeem\` - Redeem a specific gift code\n\`/about\` - View bot information\n\n`;
        
        const isAdmin = config.isDeveloper(interaction.user.id) || (interaction.member && interaction.member.permissions.has('Administrator'));
        
        if (isAdmin) {
            text += `**Admin Commands:**
\`/status\` - Checks bot status
\`/upload\` - Upload new codes (TXT/CSV)
\`/reset\` - Deletes all codes and backs up DB
\`/backup\` - Backup DB
\`/post\` - Post the random code button
\`/custom\` - Post buttons for specific codes
\`/code\` - Get a single code directly
\`/lookup user\` - Lookup player history by discord user
\`/lookup id\` - Lookup player history by player ID
`;
        }
        await interaction.reply({ content: text, ephemeral: true });
    }
};
