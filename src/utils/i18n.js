const { I18n } = require('i18n');
const path = require('path');
const logger = require('./logger');

function applyLang(target) {
    const locale = target.locale || 'en';
    
    // Original logic restored
    const i18n = new I18n({
        register: target,
        defaultLocale: 'en',
        fallbacks: {
            'en-*': 'en',
            'es-*': 'es',
            'pt-*': 'pt',
            'sv-*': 'sv',
            'zh-*': 'zh',
        },
        directory: path.join(__dirname, '../../locales'),
        autoReload: false,
        updateFiles: false,
        syncFiles: false,
        logDebugFn: () => {},
        logWarnFn: () => {},
        logErrorFn: (msg) => logger.error(msg),
    });

    target.setLocale(locale);
}

module.exports = { applyLang };
