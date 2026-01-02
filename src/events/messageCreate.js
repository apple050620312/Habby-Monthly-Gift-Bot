const config = require('../config');
const db = require('../database/db');
const { AttachmentBuilder } = require('discord.js');
const axios = require('axios');
const logger = require('../utils/logger');

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        if (!config.isDeveloper(message.author.id)) return;
        if (message.channel.id !== config.adminChannel) return;

        switch (message.content) {
            case "help":
                message.reply(`Available commands:
- \`reset\` : Deletes all current codes. Use before adding new codes for the next month.
- \`codes\` : Use when uploading a text file with new **normal** codes
- \`nitro\` : Use when uploading a text file with new **nitro** codes
- \`backup\` : Backup a copy of the database
`);
                break;
            case "codes":
            case "nitro":
                if (!message.attachments || !message.attachments.size) {
                    return await message.reply("No attachement. Upload a text file with the codes with this command.");
                }
                const type = message.content === 'nitro' ? 'nitro' : 'normal';
                
                message.attachments.forEach(async (att, key) => {
                    try {
                        const response = await axios.get(att.url);
                        const codes = response.data.split(/\r?\n/);
                        db.addCodes(codes, type);
                        message.reply(`Processed attachment ${att.name}. Check /status`);
                    } catch (err) {
                        logger.error(`Failed to process attachment: ${err.message}`);
                        message.reply(`Error processing attachment: ${err.message}`);
                    }
                });
                break;
            case "reset":
                try {
                     await message.reply({content: "Clearing DB of used codes! Check /status", files: [new AttachmentBuilder('database.sqlite')]});
                     db.resetCodes();
                } catch (e) {
                    logger.error("Error resetting codes: " + e.message);
                }
                break;
            case "backup":
                await message.reply({content: "Here you go :)", files: [new AttachmentBuilder('database.sqlite')]});
                break;
            default:
                // message.reply("Unknown command. Try `help`");
                break;
        }
    },
};
