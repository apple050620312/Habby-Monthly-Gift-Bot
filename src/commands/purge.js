const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const db = require('../database/db');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Purge database to meet target size (MiB)')
        .addNumberOption(option =>
            option.setName('size')
                .setDescription('Target size in MiB')
                .setRequired(true))
        .setDMPermission(false),
    async execute(interaction) {
         if (!config.isDeveloper(interaction.user.id) && !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return await interaction.reply({ content: interaction.__('only_admins'), ephemeral: true });
        }

        const targetSize = interaction.options.getNumber('size');
        
        await interaction.reply({ content: interaction.__('purge_start', targetSize, '...'), fetchReply: true });

        // Run purge (could be long running)
        try {
            const result = await db.purgeOldData(targetSize);
            
            if (result.initialSize === result.finalSize && result.deletedMonths.length === 0) {
                 return await interaction.editReply({ content: interaction.__('purge_no_action') + ` Current: ${result.finalSize} MiB` });
            }

            const details = result.deletedMonths.join(', ');
            await interaction.editReply({ content: interaction.__('purge_complete', result.finalSize) + `\nDetails: ${details}` });
        } catch (error) {
            await interaction.editReply({ content: interaction.__('purge_error', error.message) });
        }
    },
};
