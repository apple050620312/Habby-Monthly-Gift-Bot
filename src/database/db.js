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
    addCodes,
    getDb: () => db,
    logStats: () => {
        const row = getStats();
        logger.info(`Normal codes remaining: ${Math.round(row.codes_left / row.codes_total * 100)}% (${row.codes_left} / ${row.codes_total})`);
        logger.info(`Nitro codes remaining: ${Math.round(row.nitro_left / row.nitro_total * 100)}% (${row.nitro_left} / ${row.nitro_total})`);
    },
    purgeOldData: async (targetSizeMib) => {
        // targetSizeMib is in Megabytes
        const targetSizeBytes = targetSizeMib * 1024 * 1024;
        let stats = fs.statSync('database.sqlite');
        
        let result = {
            initialSize: (stats.size / 1024 / 1024).toFixed(2),
            finalSize: 0,
            deletedMonths: []
        };

        if (stats.size <= targetSizeBytes) {
            result.finalSize = result.initialSize;
            return result;
        }

        // Loop to delete oldest month
        while (stats.size > targetSizeBytes) {
            // Find oldest date
            const oldest = db.prepare('SELECT date FROM players ORDER BY date ASC LIMIT 1').get();
            if (!oldest) break; // No more data

            const date = new Date(oldest.date); // or if it's stored as timestamp vs buffer? 
            // In init we said: date DATETIME DEFAULT CURRENT_TIMESTAMP. 
            // SQLite stores this as string "YYYY-MM-DD HH:MM:SS" usually.
            // But verify: getPlayerHistory logic uses "moment(new Date(row.date))".
            // So new Date() should work.
            
            // Delete everything for that month
            // Example: DELETE FROM players WHERE strftime('%Y-%m', date) = '2023-01'
            // We need to construct the query carefully to match SQLite generic date format or timestamp.
            // Let's assume standard ISO string from CURRENT_TIMESTAMP.
            
            // To be safe and efficient:
            // "DELETE FROM players WHERE date < [First of Next Month]"
            
            const currentMonthStart = new Date(date.getFullYear(), date.getMonth(), 1);
            const nextMonthStart = new Date(date.getFullYear(), date.getMonth() + 1, 1);
            
            // SQLite date comparison works with strings if ISO8601.
            // If stored as INTEGER (unix millis), we need numbers.
            // The original code used "moment().unix() * 1000" in INSERT:
            // db.run(`INSERT INTO players... VALUES(?, ?, ?, ?)`, [..., moment().unix() * 1000], ...);
            // So it IS stored as INTEGER (milliseconds).
            
            const nextMonthTs = nextMonthStart.getTime();

            const info = db.prepare('DELETE FROM players WHERE date < ?').run(nextMonthTs);
            
            if (info.changes === 0) {
                 // Should not happen if we found 'oldest', but safety break
                 break;
            }

            // VACUUM to reclaim space and update file size
            db.exec('VACUUM');
            
            stats = fs.statSync('database.sqlite');
            result.deletedMonths.push(`${date.getFullYear()}-${date.getMonth()+1} (${info.changes} rows)`);
            
            logger.info(`Purged data before ${nextMonthStart.toISOString()}. New size: ${stats.size}`);
        }
        
        result.finalSize = (stats.size / 1024 / 1024).toFixed(2);
        return result;
    },
    close: () => {
        if (db) {
            db.close();
            logger.info("Database connection closed.");
        }
    }
};
