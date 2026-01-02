const axios = require('axios').create({ timeout: 5 * 60 * 1000 });
const config = require('../config');
const sharp = require('sharp');
const logger = require('../utils/logger');

async function generateCaptcha() {
    if (!config.host) {
        logger.error("Configuration Error: config.host (HOSTNAME) is missing. Please check your .env file.");
        return null;
    }
    try {
        // Handle if user put https:// or not, and handle subpaths
        let baseUrl = config.host;
        if (!baseUrl.startsWith('http')) {
            baseUrl = `https://${baseUrl}`;
        }
        // Remove trailing slash if present to avoid double slash with /api
        baseUrl = baseUrl.replace(/\/$/, '');
        
        const url = `${baseUrl}/api/v1/captcha/generate`;
        // logger.debug(`Requesting: ${url}`); // enable for deep debug
        
        const res = await axios.post(url);
        if (res.status === 200 && res.data && res.data.code === 0) {
            return res.data.data.captchaId;
        }
    } catch (err) {
        const msg = err.message || err.toString(); 
        // If it's an axios error with a response, log that too
        if (err.response) {
            logger.error(`Error generating captcha (${err.response.status}): ${JSON.stringify(err.response.data)}`);
        } else {
            logger.error(`Error generating captcha: ${msg}`);
            if (!err.message) console.error(err); // Fallback to raw log
        }
    }
    return null;
}

async function getCaptchaImage(captchaId) {
    if (!config.host) return null;
    try {
        let baseUrl = config.host;
        if (!baseUrl.startsWith('http')) {
            baseUrl = `https://${baseUrl}`;
        }
        baseUrl = baseUrl.replace(/\/$/, '');
        
        const url = `${baseUrl}/api/v1/captcha/image/${captchaId}`;
        const res = await axios.get(url, { responseType: 'arraybuffer' });
        if (res.status === 200 && res.data) {
            // Process buffer with sharp
             const buffer = await sharp(res.data)
                .flatten({ background: { r: 255, g: 255, b: 255 } })
                .toFormat('png')
                .toBuffer();
            return buffer;
        }
    } catch (err) {
        const msg = err.message || err.toString();
        logger.error(`Error fetching captcha image: ${msg}`);
    }
    return null;
}

async function claimGiftCodes(playerId, giftCode, captchaId, captchaAnswer) {
    if (!config.host) return null;
    try {
        let baseUrl = config.host;
        if (!baseUrl.startsWith('http')) {
            baseUrl = `https://${baseUrl}`;
        }
        baseUrl = baseUrl.replace(/\/$/, '');

        const url = `${baseUrl}/api/v1/giftcode/claim`;
        const payload = {
            userId: playerId,
            giftCode: giftCode,
            captchaId: captchaId,
            captcha: captchaAnswer,
        };
        const res = await axios.post(url, payload);
        if (res.data) {
            return res.data; // Return full response data { code: 0, msg: '...' }
        }
    } catch (err) {
        const msg = err.message || err.toString();
        if (err.response) {
             logger.error(`Error claiming gift code (${err.response.status}): ${JSON.stringify(err.response.data)}`);
        } else {
             logger.error(`Error claiming gift code: ${msg}`);
        }
    }
    return null;
}

module.exports = {
    generateCaptcha,
    getCaptchaImage,
    claimGiftCodes
};
