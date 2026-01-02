const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('post')
        .setDescription('Post the gift button to a specific channel')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Channel to post to')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('message')
                .setDescription('The message to send')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('label')
                .setDescription('The text of the button')
                .setRequired(true))
        .setDMPermission(false),
    async execute(interaction) {
         if (!config.isDeveloper(interaction.user.id) && !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return await interaction.reply({ content: interaction.__('only_admins'), ephemeral: true });
        }

        const channel = interaction.options.getChannel('channel');
        const message = interaction.options.getString('message');
        const label = interaction.options.getString('label');

        // Check permissions in target channel
        if (!interaction.guild.members.me.permissionsIn(channel).has([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages], true)) {
             return await interaction.reply({ content: interaction.__('permission_error'), ephemeral: true });
        }

        await channel.send({
            content: message,
            components: [new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('getCode')
                        .setLabel(label)
                        .setStyle(ButtonStyle.Primary),
                )
            ]
        });

        return await interaction.reply({ content: interaction.__('posted_success'), ephemeral: true });
    },
};
