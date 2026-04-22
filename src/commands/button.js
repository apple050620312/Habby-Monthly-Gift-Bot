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
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('The message to send')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('label')
                        .setDescription('The text of the button')
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

        if (subcommand === 'monthly') {
            const message = interaction.options.getString('message');
            const label = interaction.options.getString('label');

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

            return await interaction.reply({ content: interaction.__('posted_success'), ephemeral: false });
        } 
        else if (subcommand === 'custom') {
            const messageContent = interaction.options.getString('message');
            const codesString = interaction.options.getString('codes');
            const messageId = interaction.options.getString('message_id');
            
            const codes = codesString.split(',').map(c => c.trim()).filter(c => c.length > 0);
            
            if (codes.length === 0) {
                return await interaction.reply({ content: interaction.__('no_valid_codes'), ephemeral: true });
            }
            if (codes.length > 25) {
                 return await interaction.reply({ content: interaction.__('max_codes_limit'), ephemeral: true });
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
                    return await interaction.reply({ content: interaction.__('edited_success'), ephemeral: false });
                } catch (error) {
                    return await interaction.reply({ content: `Failed to edit message: ${error.message}`, ephemeral: true });
                }
            } else {
                await channel.send({
                    content: messageContent,
                    components: rows
                });
                return await interaction.reply({ content: interaction.__('posted_buttons', codes.length), ephemeral: false });
            }
        }
    },
};
