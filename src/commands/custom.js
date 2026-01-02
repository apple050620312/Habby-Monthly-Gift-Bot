const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('custom')
        .setDescription('Post buttons for specific gift codes')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Channel to post to')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('message')
                .setDescription('The message to send')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('codes')
                .setDescription('Comma separated list of codes (e.g. Code1, Code2)')
                .setRequired(true))
        .setDMPermission(false),
    async execute(interaction) {
        if (!config.isDeveloper(interaction.user.id) && !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return await interaction.reply({ content: interaction.__('only_admins'), ephemeral: true });
        }

        const channel = interaction.options.getChannel('channel');
        const message = interaction.options.getString('message');
        const codesString = interaction.options.getString('codes');
        
        // Split and clean codes
        const codes = codesString.split(',').map(c => c.trim()).filter(c => c.length > 0);
        
        if (codes.length === 0) {
            return await interaction.reply({ content: interaction.__('no_valid_codes'), ephemeral: true });
        }
        if (codes.length > 25) {
             return await interaction.reply({ content: interaction.__('max_codes_limit'), ephemeral: true });
        }

        if (!interaction.guild.members.me.permissionsIn(channel).has([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages], true)) {
            return await interaction.reply({ content: interaction.__('permission_error'), ephemeral: true });
        }

        const rows = [];
        let currentRow = new ActionRowBuilder();
        
        codes.forEach((code, index) => {
            if (index > 0 && index % 5 === 0) {
                rows.push(currentRow);
                currentRow = new ActionRowBuilder();
            }
            currentRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`manualRedeem-${code}`)
                    .setLabel(code)
                    .setStyle(ButtonStyle.Success)
            );
        });
        if (currentRow.components.length > 0) {
            rows.push(currentRow);
        }

        await channel.send({
            content: message,
            components: rows
        });

        return await interaction.reply({ content: interaction.__('posted_buttons', codes.length), ephemeral: true });
    },
};
