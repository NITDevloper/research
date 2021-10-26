import mitt from 'mitt';

export const translationsEmitter = mitt();

let currentTranslations = { data: {} };

export function getCurrentLanguageKey() {
    return currentTranslations.lang || 'en';
}

export function isRTL() {
    const lang = getCurrentLanguageKey();
    return ['ar', 'dv', 'fa', 'he', 'ku', 'ps', 'sd', 'ug', 'ur', 'yi'].indexOf(lang) > -1;
}

function getUserFallbackTranslations(translations) {
    try {
        if (window.parent.document.tidioChatLang) {
            const lang = window.parent.document.tidioChatLang;
            if (typeof lang === 'string') {
                const languageKeyWithoutRegionCode = lang.split('-')[0].toLowerCase();
                const translation = translations.find(
                    currentTranslation => currentTranslation.lang === languageKeyWithoutRegionCode,
                );
                if (translation) {
                    return translation;
                }
            }
        }
        if (
            navigator.languages &&
            Array.isArray(navigator.languages) &&
            navigator.languages.length > 0
        ) {
            for (let i = 0; i < navigator.languages.length; i += 1) {
                const language = navigator.languages[i].toLowerCase();
                let translation = translations.find(
                    currentTranslation => currentTranslation.lang === language,
                );
                if (translation) {
                    return translation;
                }
                const languageKeyWithoutRegionCode = language.split('-')[0];
                translation = translations.find(
                    currentTranslation => currentTranslation.lang === languageKeyWithoutRegionCode,
                );
                if (translation) {
                    return translation;
                }
            }
        }
        if (navigator.language && typeof navigator.language === 'string') {
            const languageKey = navigator.language.split('-')[0];
            if (languageKey.length === 2) {
                const translation = translations.find(
                    currentTranslation => currentTranslation.lang === languageKey,
                );
                if (translation) {
                    return translation;
                }
            }
        }
    } catch (e) {
        //
    }
    return translations[0];
}

export function trans(key, props = null, fallback = null) {
    let translation = currentTranslations.data[key];
    if (!props) {
        if (translation) {
            return translation;
        }
        if (fallback !== null) {
            return fallback;
        }
        // TODO report to sentry
        return '';
    }
    Object.keys(props).forEach(propKey => {
        translation = translation.replace(propKey, props[propKey]);
    });
    return translation;
}

/**
 * @param {Object[]} availableTranslations
 * @param {string} availableTranslations.lang
 * @param {Object} availableTranslations.data
 * @param {string} userDefaultLang
 */
export function setCurrentTranslations(availableTranslations, userDefaultLang) {
    try {
        const existingTranslation = availableTranslations.find(
            translation => translation.lang === userDefaultLang,
        );

        if (existingTranslation) {
            currentTranslations = existingTranslation;
        } else {
            currentTranslations = getUserFallbackTranslations(availableTranslations);
        }
        if (!currentTranslations.data) {
            currentTranslations.data = {};
        }
        translationsEmitter.emit('translationsChanged');
    } catch (e) {
        currentTranslations = { data: {} };
    }
}
