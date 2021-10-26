import { cloneDeep, extractPublickeyFromScriptTag } from '../helpers';
import { generateVisitorMetadata } from '../visitor';
import { ravenCaptureException } from '../helpers/raven';
import { views } from '../helpers/views';

let persistedStateRevNo = 0;
export const persistedStateRev = {
    get: () => persistedStateRevNo,
    set: newRev => {
        persistedStateRevNo = newRev;
    },
};

let tidioStateStorageKey = null;
const getStorageKey = () => {
    if (!tidioStateStorageKey) {
        const publicKey = extractPublickeyFromScriptTag() || 'preview';
        tidioStateStorageKey = `tidio_state_${publicKey}`;
    }
    return tidioStateStorageKey;
};

// TODO fallback to cookies?
let localStorageAvailable = true;
export const saveState = state => {
    if (!localStorageAvailable) {
        return false;
    }
    try {
        const copiedState = cloneDeep(state);
        // Bump persisted state revision, which will be read when syncing state between tabs
        persistedStateRev.set(persistedStateRev.get() + 1);
        copiedState.persistedStateRev = persistedStateRev.get();
        const serializedState = JSON.stringify(copiedState);
        localStorage.setItem(getStorageKey(), serializedState);
        return true;
    } catch (e) {
        localStorageAvailable = false;
        return false;
    }
};

const transformMessagesOnLoad = messages =>
    messages
        .map(message => {
            if (message.type === 'uploadedFile' && message.attachmentType === 'image') {
                const tmpMessage = message;
                tmpMessage.imageLoaded = false;
                return tmpMessage;
            }
            if (message.type !== 'uploadingFile') {
                return message;
            }
            // remove all messages with 'uploadingFile' type
            return undefined;
        })
        .filter(message => message !== undefined);

export const loadState = (resetToDefaults = true) => {
    try {
        if (!localStorageAvailable) {
            return false;
        }
        const serializedState = localStorage.getItem(getStorageKey());
        if (!serializedState) {
            return undefined;
        }
        try {
            const oneDay = 24 * 60 * 60;
            const parsed = JSON.parse(serializedState);
            if (resetToDefaults) {
                parsed.isMounted = false;
                parsed.tidioIdentifyChanged = false;
                parsed.operatorIsTyping = false;
                parsed.showOptionsDropdown = false;
                parsed.newMessageEmoji = null;
                parsed.blockedMessage = null;
                parsed.isEmojiPanelVisible = false;
                parsed.sendVisitorMessageFlag = false;
                parsed.newMessageDisabled = false;
                parsed.isDragAndDropActive = false;
                parsed.showUserDataModal = false;
                parsed.isPageVisible = true;
                parsed.popupImageSrc = '';
                parsed.mobileHash = true;
                parsed.messageForFly = null;
                if (parsed.view === views.fly) {
                    parsed.view = views.closed;
                }
                if (
                    parsed.showMessagesButtonClickedTimestamp &&
                    Math.floor(Date.now() / 1000) - parsed.showMessagesButtonClickedTimestamp >
                        oneDay
                ) {
                    parsed.showMessagesButtonClickedTimestamp = null;
                    parsed.showOldMessages = false;
                }
            }
            parsed.messages = transformMessagesOnLoad(parsed.messages);
            return parsed;
        } catch (e) {
            ravenCaptureException(e);
            return undefined;
        }
    } catch (e) {
        return undefined;
    }
};

export function rebuildStateIfVersionsDiffer(savedState, defaultState) {
    try {
        if (savedState.version === defaultState.version) {
            return savedState;
        }
        const defaultStateCopy = cloneDeep(defaultState);
        const messages = cloneDeep(savedState.messages);
        // preserve following visitor data:
        // id
        // originalVisitorId,
        // distinct_id
        const visitor = {
            ...savedState.visitor,
            ...generateVisitorMetadata(),
        };
        const preChat = {
            ...savedState.preChat,
        };
        const tidioIdentifyData = cloneDeep(savedState.tidioIdentifyData);

        return {
            ...defaultStateCopy,
            messages,
            visitor,
            tidioIdentifyData,
            preChat,
        };
    } catch (e) {
        ravenCaptureException(e);
        return cloneDeep(defaultState);
    }
}

export const saveTranslationsToStorage = translations => {
    localStorage.setItem(`${getStorageKey()}_translations`, JSON.stringify(translations));
};

export const getTranslationsFromStorage = () =>
    JSON.parse(localStorage.getItem(`${getStorageKey()}_translations`));

export const saveKeyToStorage = (key, value) => {
    if (!localStorageAvailable) {
        return false;
    }
    try {
        const serializedValue = JSON.stringify(value);
        localStorage.setItem(`${getStorageKey()}_${key}`, serializedValue);
        return true;
    } catch (e) {
        localStorageAvailable = false;
        return false;
    }
};

export const getKeyFromStorage = key => {
    if (!localStorageAvailable) {
        return undefined;
    }
    try {
        const serializedValue = localStorage.getItem(`${getStorageKey()}_${key}`);
        return JSON.parse(serializedValue);
    } catch (e) {
        localStorageAvailable = false;
        return undefined;
    }
};

export const removeKeyFromStorage = key => {
    if (!localStorageAvailable) {
        return undefined;
    }
    try {
        localStorage.removeItem(`${getStorageKey()}_${key}`);
        return true;
    } catch (e) {
        localStorageAvailable = false;
        return undefined;
    }
};

export const removeSavedStateFromStorage = () => {
    if (!localStorageAvailable) {
        return undefined;
    }
    try {
        localStorage.removeItem(getStorageKey());
        return true;
    } catch (e) {
        localStorageAvailable = false;
        return undefined;
    }
};
