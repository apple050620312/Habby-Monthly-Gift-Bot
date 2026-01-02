const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, PermissionsBitField } = require('discord.js');
const config = require('../config');
const db = require('../database/db');
const habbyService = require('../services/habbyService');
const { checkCanClaim } = require('../utils/claimHelpers');
const logger = require('../utils/logger');
const moment = require('moment');

const { applyLang } = require('../utils/i18n');

async function presentCaptcha(interaction, playerId) {
    const captchaId = await habbyService.generateCaptcha();
    if (!captchaId) {
        return await interaction.editReply({ content: interaction.__('get_captcha_fail') });
    }

    const imageBuffer = await habbyService.getCaptchaImage(captchaId);
    if (!imageBuffer) {
        return await interaction.editReply({ content: interaction.__('get_captcha_fail') });
    }

    const captcha = new AttachmentBuilder(imageBuffer, { name: 'captcha.png' });
    const enterButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`captcha-${playerId}-${captchaId}`)
            .setLabel(interaction.__('answer_captcha'))
            .setStyle(ButtonStyle.Primary)
    );

    await interaction.editReply({ content: interaction.__('answer_captcha_below'), files: [captcha], components: [enterButton] });
}

async function presentIdModal(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('idModal')
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

async function presentCaptchaModal(interaction) {
    const modal = new ModalBuilder()
        .setCustomId(interaction.customId)
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
    name: 'interactionCreate',
    async execute(interaction, client) {
        applyLang(interaction);

        if (config.isDeveloper(interaction.user.id) && interaction.member) {
             // interaction.member.premiumSinceTimestamp = 1; // Dev hack
        }

        if (interaction.isChatInputCommand()) {
            if (interaction.channel.isDMBased() && !config.isDeveloper(interaction.user.id)) {
                return await interaction.reply("NO DM!");
            }
            if (!config.isDeveloper(interaction.user.id) && !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                 return await interaction.reply({ content: `Sorry only admins :(`, ephemeral: true });
            }

            const command = client.commands.get(interaction.commandName);
            if (!command) return;

            try {
                await command.execute(interaction, client);
            } catch (error) {
                logger.error(error);
                await interaction.reply({ content: 'There was an error executing this command!', ephemeral: true }).catch(() => {});
            }

        } else if (interaction.isButton()) {
            if (interaction.customId === 'getCode') {
                return await presentIdModal(interaction);
            }
            if (interaction.customId.startsWith('captcha-')) {
                return await presentCaptchaModal(interaction);
            }

        } else if (interaction.isModalSubmit()) {
            if (interaction.customId === 'idModal') {
                await interaction.reply({ content: interaction.__('checking'), ephemeral: true });
                const playerId = interaction.fields.getTextInputValue('playerId');
                
                if (!/^\d+$/.test(playerId)) {
                    return await interaction.editReply({ content: interaction.__('Invalid PlayerID \`%s\`. Please check again.', playerId), ephemeral: true });
                }

                if (!await checkCanClaim(interaction, playerId)) return;

                await interaction.editReply({ content: interaction.__('fetching_captcha'), ephemeral: true });
                return await presentCaptcha(interaction, playerId);
            }

            if (interaction.customId.startsWith('captcha-')) {
                const parts = interaction.customId.split('-');
                const playerId = parts[1];
                const captchaId = parts[2];

                await interaction.update({ content: interaction.__('checking_captcha'), components: [], files: [] });
                const captchaAnswer = interaction.fields.getTextInputValue('captcha');

                if (!/^\d+$/.test(captchaAnswer) || captchaAnswer.length !== 4) {
                    await interaction.editReply({ content: interaction.__('invalid_captcha') });
                    return await presentCaptcha(interaction, playerId);
                }

                if (!await checkCanClaim(interaction, playerId)) return;

                const table = (interaction.member.premiumSinceTimestamp && moment.utc().date() >= 16) ? "nitro_codes" : "codes";
                const row = db.getUnusedCode(table);

                if (!row || !row.code) {
                    return await interaction.editReply({ content: interaction.__('no_more_gifts') });
                }

                const result = await habbyService.claimGiftCodes(playerId, row.code, captchaId, captchaAnswer);

                if (!result) {
                    return await interaction.editReply({ content: interaction.__('a_problem_occured') });
                }

                const logChannel = client.channels.cache.get(config.logChannel);

                switch (result.code) {
                    case 0: // Success
                         db.markCodeUsed(table, row.code);
                         db.recordClaim(interaction.user.id, playerId, row.code);
                         
                         if (logChannel) {
                             logChannel.send(`[REDEEM] Discord: ${interaction.member} \`${interaction.user.username}\` PlayerID: \`${playerId}\` Code: \`${row.code}\` Locale: \`${interaction.locale}\``);
                         }
                         return await interaction.editReply({ content: interaction.__('congratulations'), ephemeral: true });
                    
                    case 20402: // Already claimed
                         logger.warn(`User claimed bad code ${row.code}`);
                         if (logChannel) logChannel.send(`[FAIL] Discord: ${interaction.member} - already claimed?`);
                         return await interaction.editReply({ content: interaction.__('something_went_wrong'), ephemeral: true });

                    case 20401: case 20403: case 20404: case 20409: // Bad/Expired code
                         logger.warn(`Invalid code in DB: ${row.code}`);
                         if (logChannel) logChannel.send(`[FAIL] Invalid/Expire code \`${row.code}\` ${result.code}`);
                         db.markCodeUsed(table, row.code); // Mark as used so we don't dispense again
                         // Logic suggests we retry? Original didn't really retry automatically, just stopped.
                         return await interaction.editReply({ content: interaction.__('something_went_wrong'), ephemeral: true });
                    
                    case 30001: case 20002: // Busy or Bad Captcha
                         return await presentCaptcha(interaction, playerId);

                    case 20003: // Bad Player ID
                         if (logChannel) logChannel.send(`[FAIL] Bad Player ID: ${playerId}`);
                         return await interaction.editReply({ content: interaction.__('Invalid PlayerID \`%s\`. Please check again.', playerId), ephemeral: true });

                    default:
                        logger.error(`Unknown error code: ${result.code}`);
                        return await interaction.editReply({ content: interaction.__('something_went_wrong'), ephemeral: true });
                }
            }
        }
    },
};
