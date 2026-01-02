const axios = require('axios').create({ timeout: 5 * 60 * 1000 });
const config = require('../config');
const sharp = require('sharp');
const logger = require('../utils/logger');

async function generateCaptcha() {
    try {
        const url = `https://${config.host}/api/v1/captcha/generate`;
        const res = await axios.post(url);
        if (res.status === 200 && res.data && res.data.code === 0) {
            return res.data.data.captchaId;
        }
    } catch (err) {
        logger.error(`Error generating captcha: ${err.message}`);
    }
    return null;
}

async function getCaptchaImage(captchaId) {
    try {
        const url = `https://${config.host}/api/v1/captcha/image/${captchaId}`;
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
        logger.error(`Error fetching captcha image: ${err.message}`);
    }
    return null;
}

async function claimGiftCodes(playerId, giftCode, captchaId, captchaAnswer) {
    try {
        const url = `https://${config.host}/api/v1/giftcode/claim`;
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
        logger.error(`Error claiming gift code: ${err.message}`);
    }
    return null;
}

module.exports = {
    generateCaptcha,
    getCaptchaImage,
    claimGiftCodes
};
