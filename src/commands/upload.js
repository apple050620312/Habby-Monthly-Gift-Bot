const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const config = require('../config');
const db = require('../database/db');
const axios = require('axios');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('upload')
        .setDescription('Upload a list of gift codes')
        .addAttachmentOption(option =>
            option.setName('file')
                .setDescription('The .txt or .csv file containing the codes')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('type')
                .setDescription('The type of codes')
                .setRequired(true)
                .addChoices(
                    { name: 'Normal', value: 'normal' },
                    { name: 'Nitro', value: 'nitro' }
                ))
        .addStringOption(option =>
            option.setName('month')
                .setDescription('Optional: Future month to activate these codes (YYYY-MM)')
                .setRequired(false))
        .setDMPermission(false),
    async execute(interaction) {
        if (!config.isDeveloper(interaction.user.id) && !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return await interaction.reply({ content: interaction.__('only_admins'), ephemeral: true });
        }

        const attachment = interaction.options.getAttachment('file');
        const type = interaction.options.getString('type');
        const month = interaction.options.getString('month');

        if (!attachment.name.endsWith('.txt') && !attachment.name.endsWith('.csv')) {
             return await interaction.reply({ content: "Please upload a valid .txt or .csv file.", ephemeral: true });
        }
        if (month && !/^\d{4}-\d{2}$/.test(month)) {
             return await interaction.reply({ content: "Invalid month format. Please use YYYY-MM (e.g., 2024-05).", ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: false });

        try {
            const response = await axios.get(attachment.url, { responseType: 'text' });
            const text = response.data;

            const codes = text.split(/[\r\n,]+/).map(c => c.trim()).filter(c => c.length > 0);
            
            if (codes.length === 0) {
                 return await interaction.editReply({ content: "The uploaded file is empty or contains no valid codes." });
            }

            db.addCodes(codes, type, month || null);

            return await interaction.editReply({ content: `Successfully uploaded ${codes.length} ${type} codes.` + (month ? ` They will become active in ${month}.` : ` They are active immediately.`) });
        } catch (error) {
            return await interaction.editReply({ content: `Failed to process the uploaded file: ${error.message}` });
        }
    },
};
