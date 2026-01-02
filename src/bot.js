const { Client, Collection, GatewayIntentBits, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const db = require('./database/db');
const logger = require('./utils/logger');
const { applyLang } = require('./utils/i18n');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessages,
    ],
    partials: [Partials.Channel, Partials.Message],
});

client.commands = new Collection();

function loadCommands() {
    const commandsPath = path.join(__dirname, 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        } else {
            logger.warn(`The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }
}

function loadEvents() {
    const eventsPath = path.join(__dirname, 'events');
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args, client));
        } else {
            client.on(event.name, (...args) => event.execute(...args, client));
        }
    }
}

function start() {
    const startTime = Date.now();
    applyLang({}); // Test for logging errors at start
    db.init();
    db.logStats();
    logger.info(`Done loading codes! ${(Date.now() - startTime) / 1000}s`);
    loadCommands();
    loadEvents();
    
    // DM Error reporting
    process.on('uncaughtException', async (err) => {
        logger.error(`Uncaught Exception: ${err.message}`);
        console.error(err);

        if (err.name === 'DiscordAPIError[10062]') return;
        if (err.name === 'ConnectTimeoutError') return;

        try {
            // Hardcoded dev ID from original source
            const devId = '523114942434639873'; 
            const developer = await client.users.fetch(devId);
            if (developer) {
                await developer.send(`\`\`\`${err.name}\n${err.stack}\`\`\``);
            }
        } catch (error) {
            logger.error(`Failed to DM developer: ${error.message}`);
        }
    });

    if (config.token) {
        client.login(config.token);
    } else {
        logger.error("No token provided in config!");
    }

    // Graceful Shutdown Logic
    const shutdown = async () => {
        logger.info("Shutting down...");
        
        // destroy client to stop receiving new events
        await client.destroy();
        
        // close database
        db.close();
        
        logger.info("Goodbye.");
        process.exit(0);
    };

    // Handle Ctrl+C and other signals
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // Handle Console Input for 'stop' command
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (data) => {
        const input = data.toString().trim();
        if (input === 'stop' || input === 'exit') {
            shutdown();
        }
    });
}

module.exports = { start };
