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

    try { db.exec("ALTER TABLE codes ADD COLUMN active_month TEXT DEFAULT NULL"); } catch(e) {}
    try { db.exec("ALTER TABLE nitro_codes ADD COLUMN active_month TEXT DEFAULT NULL"); } catch(e) {}

    logger.info("Database initialized and tables verified.");
}



function getStats() {
    const currentMonth = new Date().toISOString().slice(0, 7);
    db.prepare('DELETE FROM codes WHERE active_month < ? AND active_month IS NOT NULL').run(currentMonth);
    db.prepare('DELETE FROM nitro_codes WHERE active_month < ? AND active_month IS NOT NULL').run(currentMonth);

    const codes = db.prepare(`SELECT active_month, count() as count, sum(case when used=0 then 1 else 0 end) as left FROM codes GROUP BY active_month`).all();
    const nitro = db.prepare(`SELECT active_month, count() as count, sum(case when used=0 then 1 else 0 end) as left FROM nitro_codes GROUP BY active_month`).all();
    return { codes, nitro };
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
    const currentMonth = new Date().toISOString().slice(0, 7);
    return db.prepare(`SELECT * FROM ${table} WHERE used=FALSE AND (active_month IS NULL OR active_month = ?) ORDER BY RANDOM() LIMIT 1`).get(currentMonth);
}

function markCodeUsed(table, code) {
     if (!['codes', 'nitro_codes'].includes(table)) throw new Error("Invalid table");
     return db.prepare(`UPDATE ${table} SET used=TRUE WHERE code = ?`).run(code);
}

function recordClaim(discordId, playerId, code) {
    return db.prepare(`INSERT INTO players(discordid, playerid, code, date) VALUES(?, ?, ?, ?)`).run(discordId, playerId, code, Date.now());
}



// Add codes from array
function addCodes(codeArray, type = 'normal', activeMonth = null) {
    const table = type === 'nitro' ? 'nitro_codes' : 'codes';
    const stmt = db.prepare(`INSERT INTO ${table} (code, active_month) VALUES (?, ?)`);
    const insertMany = db.transaction((codes) => {
        for (const code of codes) {
            if (code && code.trim().length) {
                try {
                    stmt.run(code.trim(), activeMonth);
                } catch (e) {}
            }
        }
    });
    insertMany(codeArray);
}

// Remove unused codes for a specific month
function removeMonthCodes(type, month) {
    const table = type === 'nitro' ? 'nitro_codes' : 'codes';
    
    let stmt;
    if (month === 'active') {
        stmt = db.prepare(`DELETE FROM ${table} WHERE used=FALSE AND active_month IS NULL`);
    } else {
        stmt = db.prepare(`DELETE FROM ${table} WHERE used=FALSE AND active_month = ?`);
    }

    const info = month === 'active' ? stmt.run() : stmt.run(month);
    return info.changes;
}

module.exports = {
    init,
    getStats,
    getPlayerHistory,
    getPlayerHistoryById,
    getLastClaim,
    getLastPlayerId,
    getUnusedCode,
    markCodeUsed,
    recordClaim,

    addCodes,
    removeMonthCodes,
    getDb: () => db,
    logStats: () => {
        const stats = getStats();
        let totalLeft = 0, totalCount = 0;
        let nitroLeft = 0, nitroCount = 0;
        
        stats.codes.forEach(row => { totalLeft += row.left; totalCount += row.count; });
        stats.nitro.forEach(row => { nitroLeft += row.left; nitroCount += row.count; });
        
        let pct = totalCount > 0 ? Math.round(totalLeft / totalCount * 100) : 0;
        let nPct = nitroCount > 0 ? Math.round(nitroLeft / nitroCount * 100) : 0;
        
        logger.info(`Normal codes remaining: ${pct}% (${totalLeft} / ${totalCount})`);
        logger.info(`Nitro codes remaining: ${nPct}% (${nitroLeft} / ${nitroCount})`);
    },
    purgeOldData: async (targetSizeMb) => {
        // targetSizeMb is in Megabytes
        const targetSizeBytes = targetSizeMb * 1000 * 1000;
        let stats = fs.statSync('database.sqlite');
        
        let result = {
            initialSize: (stats.size / 1000 / 1000).toFixed(2),
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
        
        result.finalSize = (stats.size / 1000 / 1000).toFixed(2);
        return result;
    },
    close: () => {
        if (db) {
            db.close();
            logger.info("Database connection closed.");
        }
    }
};
