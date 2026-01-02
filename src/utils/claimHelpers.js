const db = require('../database/db');
const moment = require('moment');
// const config = require('../config');

async function checkCanClaim(interaction, playerId) {
    const row = db.getLastClaim(interaction.user.id, playerId);

    if (row && row.date) {
        let prevClaim = moment(new Date(row.date)).utc();
        let claimDate = prevClaim.clone().utc();

        // access member.premiumSinceTimestamp from interaction
        if (interaction.member.premiumSinceTimestamp && prevClaim.date() < 16) {
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

module.exports = {
    checkCanClaim
};
