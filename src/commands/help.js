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
\`/codes upload\` - Upload new codes (TXT/CSV)
\`/codes remove\` - Remove unused gift codes by month
\`/codes get\` - Manually fetch an unused code
\`/button monthly\` - Post the monthly random code button
\`/button custom\` - Post a button for specific custom codes
\`/system status\` - Checks bot and database status
\`/system backup\` - Download a copy of the database
\`/lookup\` - Search claim history by user or player ID
`;
        }
        await interaction.reply({ content: text, ephemeral: true });
    }
};
