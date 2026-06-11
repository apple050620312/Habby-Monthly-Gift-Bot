const { SlashCommandBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('button')
        .setDescription('Post claim buttons to channels')
        .addSubcommand(subcommand =>
            subcommand
                .setName('monthly')
                .setDescription('Post a button for users to claim a random code from the database')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Channel to post to')
                        .setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('custom')
                .setDescription('Post buttons for specific custom gift codes')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Channel to post to')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('message_id')
                        .setDescription('Optional: Message ID to edit instead of sending new')
                        .setRequired(false))
        )
        .setDMPermission(false),

    async execute(interaction) {
        if (!config.isDeveloper(interaction.user.id) && !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return await interaction.reply({ content: interaction.__('only_admins'), ephemeral: true });
        }

        const subcommand = interaction.options.getSubcommand();
        const channel = interaction.options.getChannel('channel');

        // Check permissions in target channel
        if (!interaction.guild.members.me.permissionsIn(channel).has([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages], true)) {
             return await interaction.reply({ content: interaction.__('permission_error'), ephemeral: true });
        }

        const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

        if (subcommand === 'monthly') {
            const modal = new ModalBuilder()
                .setCustomId(`btnModal-monthly-${channel.id}`)
                .setTitle('Monthly Button Form');

            const messageInput = new TextInputBuilder()
                .setCustomId('message')
                .setLabel('Message Content')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            const labelInput = new TextInputBuilder()
                .setCustomId('label')
                .setLabel('Button Label')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(messageInput), new ActionRowBuilder().addComponents(labelInput));
            
            await interaction.showModal(modal);
        } 
        else if (subcommand === 'custom') {
            const messageId = interaction.options.getString('message_id') || 'NONE';
            
            const modal = new ModalBuilder()
                .setCustomId(`btnModal-custom-${channel.id}-${messageId}`)
                .setTitle('Custom Buttons Form');

            const messageInput = new TextInputBuilder()
                .setCustomId('message')
                .setLabel('Message Content')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            const codesInput = new TextInputBuilder()
                .setCustomId('codes')
                .setLabel('Codes (comma separated)')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(messageInput), new ActionRowBuilder().addComponents(codesInput));
            
            await interaction.showModal(modal);
        }
    },
};
