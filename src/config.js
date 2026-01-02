require('dotenv').config();

const developerIds = (process.env.DEVELOPER_IDS || '').split(',').map(id => id.trim()).filter(id => id.length > 0);

const isDeveloper = (uid) => {
    return developerIds.includes(uid);
};

module.exports = {
    isDeveloper,
    guildId: process.env.GUILD_ID,
    logChannel: process.env.LOG_CHANNEL_ID,
    adminChannel: process.env.ADMIN_CHANNEL_ID,
    clientId: process.env.CLIENT_ID,
    token: process.env.TOKEN,
    host: process.env.HOSTNAME,
    game: process.env.GAME_STATUS,
};
