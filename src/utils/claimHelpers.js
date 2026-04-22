const db = require('../database/db');
const moment = require('moment');
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const habbyService = require('../services/habbyService');
const logger = require('./logger');

async function checkCanClaim(interaction, playerId) {
    const row = db.getLastClaim(interaction.user.id, playerId);

    if (row && row.date) {
        let prevClaim = moment(new Date(row.date)).utc();
        let claimDate = prevClaim.clone().utc();

        // access member.premiumSinceTimestamp from interaction
        if (interaction.member && interaction.member.premiumSinceTimestamp && prevClaim.date() < 16) {
            claimDate.date(16);
        } else {
            claimDate.second(0).minute(0).hour(0).date(1).month(prevClaim.month() + 1);
        }

        if (claimDate > moment()) {
             await interaction.editReply({ content: interaction.__('cant_claim_until', `<t:${claimDate.unix()}:f> <t:${claimDate.unix()}:R>`), ephemeral: true });
             return false;
        }
    }
    return true;
}

// UI Helpers

async function startClaimFlow(interaction, targetCode = null, isCommand = false) {
    return await presentIdModal(interaction, targetCode, isCommand);
}

async function presentIdModal(interaction, targetCode = null, isCommand = false) {
    const originFlag = isCommand ? 'CMD' : 'BTN';
    const codePayload = targetCode || 'RANDOM';
    const customId = `idModal-${originFlag}-${codePayload}`;
    
    const modal = new ModalBuilder()
        .setCustomId(customId)
        .setTitle(interaction.__('enter_id'));
    const playerIdInput = new TextInputBuilder()
        .setCustomId('playerId')
        .setLabel(interaction.__('enter_id'))
        .setMinLength(4)
        .setMaxLength(10)
        .setStyle(TextInputStyle.Short);

    const row = db.getLastPlayerId(interaction.user.id);
    if (row && row.playerid) {
        playerIdInput.setValue(row.playerid);
    }
    
    modal.addComponents(new ActionRowBuilder().addComponents(playerIdInput));
    try {
        await interaction.showModal(modal);
    } catch (error) {
        logger.error("Error showing ID modal: " + error.message);
    }
}

async function presentCaptcha(interaction, playerId, targetCode = null, origin = 'BTN') {
    const captchaId = await habbyService.generateCaptcha();
    if (!captchaId) {
        return await interaction.editReply({ content: interaction.__('get_captcha_fail') });
    }

    const imageBuffer = await habbyService.getCaptchaImage(captchaId);
    if (!imageBuffer) {
        return await interaction.editReply({ content: interaction.__('get_captcha_fail') });
    }

    const captcha = new AttachmentBuilder(imageBuffer, { name: 'captcha.png' });
    
    const codePayload = targetCode || 'RANDOM';
    
    const enterButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`captcha-${playerId}-${captchaId}-${codePayload}-${origin}`)
            .setLabel(interaction.__('answer_captcha'))
            .setStyle(ButtonStyle.Primary)
    );

    await interaction.editReply({ content: interaction.__('answer_captcha_below'), files: [captcha], components: [enterButton] });
}

async function presentCaptchaModal(interaction, customId) {
    const modal = new ModalBuilder()
        .setCustomId(customId) // Pass through the full customId so we preserve params
        .setTitle(interaction.__('answer_captcha'));
    const captchaInput = new TextInputBuilder()
        .setCustomId('captcha')
        .setLabel(interaction.__('whats_captcha_answer'))
        .setMinLength(4)
        .setMaxLength(4)
        .setStyle(TextInputStyle.Short);
    modal.addComponents(new ActionRowBuilder().addComponents(captchaInput));
    try {
        await interaction.showModal(modal);
    } catch (error) {
        logger.error("Error showing Captcha modal: " + error.message);
    }
}

module.exports = {
    checkCanClaim,
    startClaimFlow,
    presentIdModal,
    presentCaptcha,
    presentCaptchaModal
};
