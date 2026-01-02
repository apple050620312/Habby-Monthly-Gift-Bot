const Database = require('better-sqlite3');
const fs = require('fs');
const logger = require('../utils/logger');
const path = require('path');

let db;

function init() {
    db = new Database('database.sqlite');
    // Enable WAL mode for better concurrency
    db.pragma('journal_mode = WAL');

    db.exec("CREATE TABLE IF NOT EXISTS codes (code TEXT NOT NULL UNIQUE ON CONFLICT IGNORE, used BOOL DEFAULT FALSE)");
    db.exec("CREATE TABLE IF NOT EXISTS nitro_codes (code TEXT NOT NULL UNIQUE ON CONFLICT IGNORE, used BOOL DEFAULT FALSE)");
    db.exec("CREATE TABLE IF NOT EXISTS generic_codes (code TEXT NOT NULL UNIQUE, expired BOOL DEFAULT FALSE)");
    db.exec("CREATE TABLE IF NOT EXISTS players (discordid TEXT NOT NULL, playerid TEXT NOT NULL, code TEXT NOT NULL, date DATETIME DEFAULT CURRENT_TIMESTAMP)");

    logger.info("Database initialized and tables verified.");

    // Check for startup files
    if (fs.existsSync('codes.txt')) {
        processFileCodes('codes.txt', 'normal');
    }
    if (fs.existsSync('nitro.txt')) {
        processFileCodes('nitro.txt', 'nitro');
    }
}

function processFileCodes(filePath, type = 'normal') {
    if (!fs.existsSync(filePath)) return;

    const table = type === 'nitro' ? 'nitro_codes' : 'codes';
    const stmt = db.prepare(`INSERT INTO ${table} (code) VALUES (?)`);
    
    const insertMany = db.transaction((lines) => {
        for (let line of lines) {
            line = line.trim();
            if (line.length) {
                try {
                    stmt.run(line);
                } catch (error) {
                    // Ignore duplicates
                }
            }
        }
    });

    try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        insertMany(fileContent.split(/\r?\n/));
        fs.rmSync(filePath);
        logger.info(`Processed and removed ${filePath}`);
    } catch (err) {
        logger.error(`Error processing code file ${filePath}: ${err.message}`);
    }
}

function getStats() {
    const row = db.prepare(`SELECT
        (SELECT count() FROM codes where used=0) as codes_left,
        (SELECT count() FROM codes) as codes_total,
        (SELECT count() FROM nitro_codes where used=0) as nitro_left,
        (SELECT count() FROM nitro_codes) as nitro_total
    `).get();
    return row;
}

function getPlayerHistory(discordId) {
    return db.prepare('SELECT * FROM players WHERE discordId=? ORDER BY date DESC').all(discordId);
}
function getPlayerHistoryById(playerId) {
    return db.prepare('SELECT * FROM players WHERE playerId=? ORDER BY date DESC').all(playerId);
}

function getLastClaim(discordId, playerId) {
     return db.prepare('SELECT * FROM players WHERE discordId=? OR playerId=? ORDER BY date DESC LIMIT 1').get(discordId, playerId);
}

function getLastPlayerId(discordId) {
    return db.prepare('SELECT * FROM players WHERE discordId=? ORDER BY date DESC LIMIT 1').get(discordId);
}

function getUnusedCode(table = 'codes') {
    // Valid tables: codes, nitro_codes
    if (!['codes', 'nitro_codes'].includes(table)) throw new Error("Invalid table");
    return db.prepare(`SELECT * FROM ${table} WHERE used=FALSE ORDER BY RANDOM() LIMIT 1`).get();
}

function markCodeUsed(table, code) {
     if (!['codes', 'nitro_codes'].includes(table)) throw new Error("Invalid table");
     return db.prepare(`UPDATE ${table} SET used=TRUE WHERE code = ?`).run(code);
}

function recordClaim(discordId, playerId, code) {
    return db.prepare(`INSERT INTO players(discordid, playerid, code, date) VALUES(?, ?, ?, ?)`).run(discordId, playerId, code, Date.now());
}

function resetCodes() {
    db.prepare('DELETE FROM nitro_codes').run();
    db.prepare('DELETE FROM codes').run();
}

// Add codes from array (for attachment handling)
function addCodes(codeArray, type = 'normal') {
    const table = type === 'nitro' ? 'nitro_codes' : 'codes';
    const stmt = db.prepare(`INSERT INTO ${table} (code) VALUES (?)`);
    const insertMany = db.transaction((codes) => {
        for (const code of codes) {
            if (code && code.trim().length) {
                try {
                    stmt.run(code.trim());
                } catch (e) {}
            }
        }
    });
    insertMany(codeArray);
}

module.exports = {
    init,
    processFileCodes,
    getStats,
    getPlayerHistory,
    getPlayerHistoryById,
    getLastClaim,
    getLastPlayerId,
    getUnusedCode,
    markCodeUsed,
    recordClaim,
    resetCodes,
    addCodes,
    addCodes,
    getDb: () => db,
    logStats: () => {
        const row = getStats();
        logger.info(`Normal codes remaining: ${Math.round(row.codes_left / row.codes_total * 100)}% (${row.codes_left} / ${row.codes_total})`);
        logger.info(`Nitro codes remaining: ${Math.round(row.nitro_left / row.nitro_total * 100)}% (${row.nitro_left} / ${row.nitro_total})`);
    },
    close: () => {
        if (db) {
            db.close();
            logger.info("Database connection closed.");
        }
    }
};
