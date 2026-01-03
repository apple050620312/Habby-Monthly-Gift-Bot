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
        .addStringOption(option =>
            option.setName('message_id')
                .setDescription('Optional: Message ID to edit instead of sending new')
                .setRequired(false))
        .setDMPermission(false),
    async execute(interaction) {
        if (!config.isDeveloper(interaction.user.id) && !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return await interaction.reply({ content: interaction.__('only_admins'), ephemeral: true });
        }

        const channel = interaction.options.getChannel('channel');
        const messageContent = interaction.options.getString('message');
        const codesString = interaction.options.getString('codes');
        const messageId = interaction.options.getString('message_id');
        
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

        if (messageId) {
            try {
                const targetMessage = await channel.messages.fetch(messageId);
                if (!targetMessage) {
                    return await interaction.reply({ content: "Message not found in that channel.", ephemeral: true });
                }
                await targetMessage.edit({
                    content: messageContent,
                    components: rows
                });
                return await interaction.reply({ content: interaction.__('edited_success'), ephemeral: true });
            } catch (error) {
                return await interaction.reply({ content: `Failed to edit message: ${error.message}`, ephemeral: true });
            }
        } else {
            await channel.send({
                content: messageContent,
                components: rows
            });
            return await interaction.reply({ content: interaction.__('posted_buttons', codes.length), ephemeral: true });
        }
    },
};
