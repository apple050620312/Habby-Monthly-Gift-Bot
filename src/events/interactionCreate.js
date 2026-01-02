const { PermissionsBitField } = require('discord.js');
const config = require('../config');
const db = require('../database/db');
const habbyService = require('../services/habbyService');
const { checkCanClaim, startClaimFlow, presentIdModal, presentCaptcha, presentCaptchaModal } = require('../utils/claimHelpers');
const logger = require('../utils/logger');
const moment = require('moment');
const { applyLang } = require('../utils/i18n');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        applyLang(interaction);

        if (config.isDeveloper(interaction.user.id) && interaction.member) {
             // interaction.member.premiumSinceTimestamp = 1; // Dev hack
        }

        // --- COMMANDS ---
        if (interaction.isChatInputCommand()) {
            if (interaction.channel.isDMBased() && !config.isDeveloper(interaction.user.id)) {
                return await interaction.reply(interaction.__('no_dm'));
            }
            if (!config.isDeveloper(interaction.user.id) && !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                 
                 if (interaction.commandName !== 'redeem') {
                     return await interaction.reply({ content: interaction.__('only_admins'), ephemeral: true });
                 }
            }

            const command = client.commands.get(interaction.commandName);
            if (!command) return;

            try {
                await command.execute(interaction, client);
            } catch (error) {
                logger.error(error);
                await interaction.reply({ content: interaction.__('command_error'), ephemeral: true }).catch(() => {});
            }

        // --- BUTTONS ---
        } else if (interaction.isButton()) {
            
            // Random Code Flow
            if (interaction.customId === 'getCode') {
                return await presentIdModal(interaction);
            }
            
            // Manual/Specific Code Flow
            if (interaction.customId.startsWith('manualRedeem-')) {
                const code = interaction.customId.replace('manualRedeem-', '');
                return await startClaimFlow(interaction, code);
            }

            // Captcha Entry Button
            if (interaction.customId.startsWith('captcha-')) {
                return await presentCaptchaModal(interaction, interaction.customId);
            }

        // --- MODALS ---
        } else if (interaction.isModalSubmit()) {
            
            // ID Input Submission
            if (interaction.customId.startsWith('idModal')) {
                await interaction.reply({ content: interaction.__('checking'), ephemeral: true });
                const playerId = interaction.fields.getTextInputValue('playerId');
                
                // Parse targetCode from customId if present
                // idModal or idModal-CODE
                let targetCode = null;
                const parts = interaction.customId.split('-');
                if (parts.length > 1) {
                    targetCode = parts.slice(1).join('-'); // Join back in case code has dashes?
                }

                if (!/^\d+$/.test(playerId)) {
                    return await interaction.editReply({ content: interaction.__('Invalid PlayerID \`%s\`. Please check again.', playerId), ephemeral: true });
                }

                // Only check cooldown for RANDOM bot codes (!targetCode)
                if (!targetCode) {
                    if (!await checkCanClaim(interaction, playerId)) return;
                }

                await interaction.editReply({ content: interaction.__('fetching_captcha'), ephemeral: true });
                return await presentCaptcha(interaction, playerId, targetCode);
            }

            // Captcha Submission
            if (interaction.customId.startsWith('captcha-')) {
                const parts = interaction.customId.split('-');
                // captcha-playerId-captchaId-targetCode
                const playerId = parts[1];
                const captchaId = parts[2];
                let targetCode = parts[3];
                
                if (targetCode === 'RANDOM') {
                    targetCode = null;
                }

                await interaction.update({ content: interaction.__('checking_captcha'), components: [], files: [] });
                const captchaAnswer = interaction.fields.getTextInputValue('captcha');

                if (!/^\d+$/.test(captchaAnswer) || captchaAnswer.length !== 4) {
                    await interaction.editReply({ content: interaction.__('invalid_captcha') });
                    return await presentCaptcha(interaction, playerId, targetCode);
                }

                // Only check cooldown for RANDOM bot codes (!targetCode). 
                // Manual codes (targetCode) bypass the monthly bot limit because they are external/public codes.
                if (!targetCode) {
                    if (!await checkCanClaim(interaction, playerId)) return;
                }

                let codeToRedeem = targetCode;
                let row = null;
                const table = (interaction.member.premiumSinceTimestamp && moment.utc().date() >= 16) ? "nitro_codes" : "codes";

                if (!codeToRedeem) {
                    // Fetch code from DB
                    row = db.getUnusedCode(table);
                    if (!row || !row.code) {
                        return await interaction.editReply({ content: interaction.__('no_more_gifts') });
                    }
                    codeToRedeem = row.code;
                } else {
                    // Using specific code
                    row = { code: codeToRedeem };
                    // Should we check if this specific code is valid/unused in our DB? 
                    // The request implies public input codes ("reedem codes they've input").
                    // Usually these are public codes not in our DB.
                    // But if it IS in our DB, we should mark it? 
                    // The prompt says "reedem codes they've input". Assuming these are EXTERNAL codes not necessarily managed by us.
                    // BUT /custom command says "claim buttons replace to codes that admins could input".
                    // If it's a "custom" code, it's likely a generic public code.
                    // We probably shouldn't check against OUR `codes` table for existence, but maybe used status?
                    // For now, assume we just try to claim it.
                }

                const result = await habbyService.claimGiftCodes(playerId, codeToRedeem, captchaId, captchaAnswer);

                if (!result) {
                    return await interaction.editReply({ content: interaction.__('a_problem_occured') });
                }

                const logChannel = client.channels.cache.get(config.logChannel);

                switch (result.code) {
                    case 0: // Success
                         // User Request: "if success need to log in to database as monthly codes does"
                         // This implies:
                         // 1. Mark as used (if it exists in our pool)
                         // 2. Record the claim (already done by recordClaim)
                         
                         // We attempt to mark it used in both potential tables. 
                         // If it's not there, no harm done (changes = 0).
                         
                         // User Request Update: "no need to mark reedem and custom code as used because those codes will be repeatable"
                         // So only mark used if it was a RANDOM code fetch (targetCode was null).
                         
                         if (!targetCode) {
                             db.markCodeUsed('codes', codeToRedeem);
                             db.markCodeUsed('nitro_codes', codeToRedeem);
                         }
                         
                         db.recordClaim(interaction.user.id, playerId, codeToRedeem);
                         
                         if (logChannel) {
                             logChannel.send(`[REDEEM] Discord: ${interaction.member} \`${interaction.user.username}\` PlayerID: \`${playerId}\` Code: \`${codeToRedeem}\` Locale: \`${interaction.locale}\``);
                         }
                         logger.info(`Redeem success Discord: ${interaction.user.username} PlayerID: ${playerId} Code: ${codeToRedeem} Locale: ${interaction.locale}`);
                         return await interaction.editReply({ content: interaction.__('congratulations'), ephemeral: true });
                    
                    case 20402: // Already claimed, or repeatable code limit reached
                         if (targetCode) {
                             // [Manual/Custom Code]
                             // Quiet failure for user input codes (likely already redeemed by them)
                             if (logChannel) logChannel.send(`[INFO] Discord: ${interaction.member} - Custom Code ${codeToRedeem} already redeemed/limit.`);
                             return await interaction.editReply({ content: interaction.__('already_redeemed'), ephemeral: true });
                         } else {
                             // [Monthly Code from DB]
                             // This is a SYSTEM ERROR. We gave them a code that was already used.
                             logger.warn(`User assigned ALREADY USED code from DB: ${codeToRedeem}`);
                             if (logChannel) logChannel.send(`[WARN] Database gave used code ${codeToRedeem} to ${interaction.member} (${interaction.user.id})`);
                             
                             // Mark it used in DB so we don't give it out again
                             db.markCodeUsed(table, codeToRedeem);
                             
                             // Generic error because this shouldn't happen to a fresh monthly code
                             return await interaction.editReply({ content: interaction.__('something_went_wrong'), ephemeral: true });
                         }

                    case 20401: case 20403: case 20404: case 20409: // Bad/Expired code
                         if (targetCode) {
                             // [Manual/Custom Code]
                             // User typed something wrong or old code
                             if (logChannel) logChannel.send(`[FAIL] Manual Code Invalid/Expire \`${codeToRedeem}\` ${result.code}`);
                             return await interaction.editReply({ content: interaction.__('already_redeemed'), ephemeral: true });
                         } else {
                             // [Monthly Code from DB]
                             // Our DB contains garbage/expired codes
                             logger.warn(`Invalid code in DB: ${codeToRedeem}`);
                             if (logChannel) logChannel.send(`[WARN] Database contained Invalid/Expire code \`${codeToRedeem}\` ${result.code}`);
                             
                             db.markCodeUsed(table, codeToRedeem);
                             
                             return await interaction.editReply({ content: interaction.__('something_went_wrong'), ephemeral: true });
                         }
                    
                    case 30001: case 20002: // Busy or Bad Captcha
                         return await presentCaptcha(interaction, playerId, targetCode);

                    case 20003: // Bad Player ID
                         if (logChannel) logChannel.send(`[FAIL] Bad Player ID: ${playerId}`);
                         return await interaction.editReply({ content: interaction.__('Invalid PlayerID \`%s\`. Please check again.', playerId), ephemeral: true });

                    default:
                        if (targetCode) {
                            // [Manual/Custom Code]
                            // User requested suppression of logs for manual codes
                            // User Update: "message should say that you might already redeemed this code"
                            return await interaction.editReply({ content: interaction.__('already_redeemed'), ephemeral: true });
                        } else {
                            // [Monthly Code]
                            logger.error(`Unknown error code: ${result.code}`);
                            if (logChannel) logChannel.send(`[ERROR] Unknown error code ${result.code} for code ${codeToRedeem}`);
                            return await interaction.editReply({ content: interaction.__('something_went_wrong'), ephemeral: true });
                        }
                }
            }
        }
    },
};
