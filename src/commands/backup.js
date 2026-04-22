const { SlashCommandBuilder, PermissionsBitField, AttachmentBuilder } = require('discord.js');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('backup')
        .setDescription('Backup a copy of the database')
        .setDMPermission(false),
    async execute(interaction) {
        if (!config.isDeveloper(interaction.user.id) && !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return await interaction.reply({ content: interaction.__('only_admins'), ephemeral: true });
        }

        await interaction.reply({ 
            content: "Here you go :)", 
            files: [new AttachmentBuilder('database.sqlite')], 
            ephemeral: false 
        });
    },
};
