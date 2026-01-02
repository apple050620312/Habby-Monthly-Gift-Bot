const config = require('../config');
const logger = require('../utils/logger');
const { ActivityType, PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'ready',
    once: true,
    execute(client) {
        logger.info(`Bot has started as ${client.user.tag}`);
        client.user.setActivity(config.game, { type: ActivityType.Playing });

        const channel = client.channels.cache.get(config.logChannel);
        if (!channel) {
            logger.warn(`Log channel ${config.logChannel} not found!`);
        } else {
            if (!channel.guild.members.me.permissionsIn(channel).has([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages], true)) {
                logger.error("Missing permissions to post in log channel");
            }
        }
        
        // Log Guilds
        client.guilds.fetch().then((guilds) => {
             for (let [_, guild] of guilds) {
                client.guilds.fetch(guild.id).then(g => {
                   logger.info(`Guild: ${guild.name} (${guild.id}) - Members: ${g.memberCount}`);
                });
             }
        });
    },
};
