const { SlashCommandBuilder, PermissionsBitField, AttachmentBuilder } = require('discord.js');
const db = require('../database/db');
const config = require('../config');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('system')
        .setDescription('System maintenance and status')
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Checks bot and database status')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('backup')
                .setDescription('Backup a copy of the database')
        )
        .setDMPermission(false),
        
    async execute(interaction, client) {
        if (!config.isDeveloper(interaction.user.id) && !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
             return await interaction.reply({ content: interaction.__('only_admins'), ephemeral: true });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'status') {
            const before = Date.now();
            const message = await interaction.reply({ content: interaction.__('checking'), fetchReply: true });
            const after = Date.now();
            
            const stats = db.getStats();

            // Calculate ping
            const apiPing = message.createdTimestamp - interaction.createdTimestamp;
            const wsPing = Math.round(client.ws.ping);
            const dbPing = Date.now() - after;

            let dbSizeMb = '0.00';
            try {
                const fileStats = fs.statSync('database.sqlite');
                dbSizeMb = (fileStats.size / 1000 / 1000).toFixed(2);
            } catch (e) {}

            let content = `Real time total ${Date.now() - before}ms | API ${apiPing}ms | WS ${wsPing}ms | DB ${dbPing}ms | DB Size ${dbSizeMb}MB\n`;

            const formatStats = (rows, label) => {
                if (!rows || rows.length === 0) return `${label}: 0 codes`;
                let totalLeft = 0, totalCount = 0;
                let breakdown = [];
                rows.forEach(r => {
                    totalLeft += r.left;
                    totalCount += r.count;
                    const currentMonth = new Date().toISOString().slice(0, 7);
                    let monthLabel;
                    if (!r.active_month) {
                        monthLabel = 'Active (No Expiry)';
                    } else if (r.active_month === currentMonth) {
                        monthLabel = `Active (${r.active_month})`;
                    } else {
                        monthLabel = `Future (${r.active_month})`;
                    }
                    breakdown.push(`  - ${monthLabel}: ${Math.round((r.count > 0 ? r.left / r.count : 0) * 100)}% (${r.left} / ${r.count})`);
                });
                let pct = totalCount > 0 ? Math.round((totalLeft / totalCount) * 100) : 0;
                return `${label} remaining: ${pct}% (${totalLeft} / ${totalCount})\n` + breakdown.join('\n');
            };

            content += formatStats(stats.codes, 'Normal codes') + '\n';
            content += formatStats(stats.nitro, 'Nitro codes') + '\n';

            await interaction.editReply(content);
        } 
        else if (subcommand === 'backup') {
            await interaction.reply({ 
                content: "Here you go :)", 
                files: [new AttachmentBuilder('database.sqlite')], 
                ephemeral: false 
            });
        }
    },
};
