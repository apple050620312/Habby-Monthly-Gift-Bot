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

async function startClaimFlow(interaction, targetCode = null) {
    // If we know the user's ID, skip modal? 
    // The original code check getLastPlayerId in presentIdModal logic but still SHOWS it I think? 
    // Wait, original presentIdModal logic: "if row ... input.setValue(...)". It PRE-FILLS but still shows modal.
    // So we should always show modal for confirmation unless we change that UX.
    // "trigger way from button to command" -> essentially just start the process.
    return await presentIdModal(interaction, targetCode);
}

async function presentIdModal(interaction, targetCode = null) {
    const customId = targetCode ? `idModal-${targetCode}` : 'idModal';
    
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

async function presentCaptcha(interaction, playerId, targetCode = null) {
    const captchaId = await habbyService.generateCaptcha();
    if (!captchaId) {
        return await interaction.editReply({ content: interaction.__('get_captcha_fail') });
    }

    const imageBuffer = await habbyService.getCaptchaImage(captchaId);
    if (!imageBuffer) {
        return await interaction.editReply({ content: interaction.__('get_captcha_fail') });
    }

    const captcha = new AttachmentBuilder(imageBuffer, { name: 'captcha.png' });
    
    // targetCode 'RANDOM' is a keyword to indicate regular flow if null
    const codePayload = targetCode || 'RANDOM';
    
    const enterButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`captcha-${playerId}-${captchaId}-${codePayload}`)
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
