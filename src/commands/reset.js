const { SlashCommandBuilder, PermissionsBitField, AttachmentBuilder } = require('discord.js');
const db = require('../database/db');
const config = require('../config');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reset')
        .setDescription('Deletes all current codes and backs up the database')
        .setDMPermission(false),
    async execute(interaction) {
        if (!config.isDeveloper(interaction.user.id) && !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return await interaction.reply({ content: interaction.__('only_admins'), ephemeral: true });
        }

        try {
            await interaction.reply({
                content: "Clearing DB of used codes! Check /status", 
                files: [new AttachmentBuilder('database.sqlite')],
                ephemeral: false
            });
            db.resetCodes();
        } catch (e) {
            logger.error("Error resetting codes: " + e.message);
            if (!interaction.replied) {
                await interaction.reply({ content: "Error resetting codes.", ephemeral: true });
            }
        }
    },
};
