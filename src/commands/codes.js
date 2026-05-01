const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const config = require('../config');
const db = require('../database/db');
const axios = require('axios');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('codes')
        .setDescription('Manage gift codes in the database')
        .addSubcommand(subcommand =>
            subcommand
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
                        .setDescription('The active month for these codes (YYYY-MM)')
                        .setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove unused gift codes in bulk')
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('The type of codes to remove')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Normal', value: 'normal' },
                            { name: 'Nitro', value: 'nitro' }
                        ))
                .addStringOption(option =>
                    option.setName('month')
                        .setDescription('The month to remove (YYYY-MM), or type "active" to remove immediately active codes')
                        .setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('get')
                .setDescription('Get a single unused normal code directly')
        )
        .setDMPermission(false),

    async execute(interaction) {
        if (!config.isDeveloper(interaction.user.id) && !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return await interaction.reply({ content: interaction.__('only_admins'), ephemeral: true });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'upload') {
            const attachment = interaction.options.getAttachment('file');
            const type = interaction.options.getString('type');
            const month = interaction.options.getString('month');

            if (!attachment.name.endsWith('.txt') && !attachment.name.endsWith('.csv')) {
                 return await interaction.reply({ content: "Please upload a valid .txt or .csv file.", ephemeral: true });
            }
            if (!/^\d{4}-\d{2}$/.test(month)) {
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

                db.addCodes(codes, type, month);

                return await interaction.editReply({ content: `✅ Successfully uploaded **${codes.length}** ${type} codes assigned to the **${month}** batch.` });
            } catch (error) {
                return await interaction.editReply({ content: `Failed to process the uploaded file: ${error.message}` });
            }
        } 
        else if (subcommand === 'remove') {
            const type = interaction.options.getString('type');
            const month = interaction.options.getString('month');

            if (month !== 'active' && !/^\d{4}-\d{2}$/.test(month)) {
                 return await interaction.reply({ content: "Invalid month format. Please use YYYY-MM (e.g., 2024-05) or 'active'.", ephemeral: true });
            }

            await interaction.deferReply({ ephemeral: false });

            try {
                const deletedCount = db.removeMonthCodes(type, month);
                return await interaction.editReply({ content: `Successfully removed **${deletedCount}** unused ${type} codes from the '${month}' batch.` });
            } catch (error) {
                return await interaction.editReply({ content: `Failed to remove codes: ${error.message}` });
            }
        }
        else if (subcommand === 'get') {
            await interaction.reply({ content: interaction.__('fetching_code'), ephemeral: false });
            
            const row = db.getUnusedCode('codes');
            if (!row || !row.code) {
                 return await interaction.editReply({ content: interaction.__('no_more_gifts'), components: [], files: [] });
            }

            db.markCodeUsed('codes', row.code);
            return await interaction.editReply({ content: interaction.__('your_code_is', row.code), components: [], files: [] });
        }
    },
};
