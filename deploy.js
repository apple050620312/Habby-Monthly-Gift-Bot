const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./src/config');
const logger = require('./src/utils/logger');

const deployCommands = async () => {
    try {
        const commands = [];
        const commandsPath = path.join(__dirname, 'src/commands');
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const command = require(path.join(commandsPath, file));
            if ('data' in command && 'execute' in command) {
                commands.push(command.data.toJSON());
            } else {
                logger.warn(`The command at ${file} is missing a required "data" or "execute" property.`);
            }
        }

        const rest = new REST({ version: '10' }).setToken(config.token);

        logger.info(`Started refreshing ${commands.length} application (/) commands.`);

        // Determine if we are deploying globally or to a specific guild
        // The original deploy.js had a section for Guild commands (captcha test?) and global commands.
        // We will deploy all current commands as application commands (Global).
        // If config.guildId is present, you might want to deploy there for faster updates during dev.
        
        const data = await rest.put(
            Routes.applicationCommands(config.clientId),
            { body: commands },
        );

        logger.info(`Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        logger.error(error);
    }
};

// Check if run directly
if (require.main === module) {
    deployCommands();
}

module.exports = { deployCommands };
