const moment = require('moment');

function format(level, message) {
    const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
}

module.exports = {
    info: (msg) => console.log(format('info', msg)),
    warn: (msg) => console.warn(format('warn', msg)),
    error: (msg) => console.error(format('error', msg)),
    debug: (msg) => console.debug(format('debug', msg)),
};
