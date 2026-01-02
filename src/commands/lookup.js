const { SlashCommandBuilder } = require('discord.js');
const db = require('../database/db');
const moment = require('moment');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lookup')
        .setDescription('Looks up a playerid')
        .addSubcommand(subcommand =>
            subcommand
                .setName('user')
                .setDescription('Info about a discord user')
                .addUserOption(option =>
                    option.setName('target')
                        .setDescription('user')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('id')
                .setDescription('Info about a player id')
                .addStringOption(option =>
                    option.setName('target')
                        .setDescription('id')
                        .setRequired(true)))
        .setDMPermission(false),
    async execute(interaction) {
        let rows = [];
        let title = '';
        
        if (interaction.options.getSubcommand() === 'user') {
            const user = interaction.options.getMember('target');
            title = `Lookup: ${user.user.username} (${user.id})`;
            rows = db.getPlayerHistory(user.id);
        } else if (interaction.options.getSubcommand() === 'id') {
            const playerId = interaction.options.getString('target');
            if (!/^\d+$/.test(playerId)) {
                return await interaction.reply({ content: interaction.__('Invalid playerID \`%s\`. Please check again.', playerId), ephemeral: true });
            }
            title = `Lookup: PlayerID ${playerId}`;
            rows = db.getPlayerHistoryById(playerId);
        }

        if (rows.length === 0) {
             return await interaction.reply({ content: "No records found.", ephemeral: false });
        }

        const ITEMS_PER_PAGE = 10;
        const totalPages = Math.ceil(rows.length / ITEMS_PER_PAGE);
        let currentPage = 0;

        const generateEmbed = (page) => {
            const start = page * ITEMS_PER_PAGE;
            const currentRows = rows.slice(start, start + ITEMS_PER_PAGE);
            
            const { EmbedBuilder } = require('discord.js');
            const embed = new EmbedBuilder()
                .setTitle(`${title} (Page ${page + 1}/${totalPages})`)
                .setColor(0x0099FF)
                .setTimestamp();

            const description = currentRows.map((row) => {
                 const claimDate = moment(new Date(row.date)).unix();
                 return `• **Code:** \`${row.code}\`\n  **ID:** \`${row.playerid}\` • <t:${claimDate}:f> (<t:${claimDate}:R>)`;
            }).join('\n');

            embed.setDescription(description);
            return embed;
        };

        const generateComponents = (page) => {
             const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
             const row = new ActionRowBuilder();

             row.addComponents(
                 new ButtonBuilder()
                     .setCustomId('prev')
                     .setLabel('Previous')
                     .setStyle(ButtonStyle.Primary)
                     .setDisabled(page === 0),
                 new ButtonBuilder()
                     .setCustomId('next')
                     .setLabel('Next')
                     .setStyle(ButtonStyle.Primary)
                     .setDisabled(page === totalPages - 1)
             );

             return [row];
        };

        const initialEmbed = generateEmbed(currentPage);
        const initialComponents = generateComponents(currentPage);

        const response = await interaction.reply({ 
            embeds: [initialEmbed], 
            components: initialComponents, 
            ephemeral: false,
            fetchReply: true 
        });

        if (totalPages <= 1) return;

        const collector = response.createMessageComponentCollector({ time: 300000 }); // 5 minutes

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: 'These buttons are not for you!', ephemeral: true });
            }

            if (i.customId === 'prev') {
                currentPage = Math.max(0, currentPage - 1);
            } else if (i.customId === 'next') {
                currentPage = Math.min(totalPages - 1, currentPage + 1);
            }

            await i.update({
                embeds: [generateEmbed(currentPage)],
                components: generateComponents(currentPage)
            });
        });

        collector.on('end', () => {
             // Optional: Disable buttons after timeout
             // interaction.editReply({ components: [] }).catch(() => {});
        });
    },
};
