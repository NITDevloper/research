// TODO delete after migration from old widget

import { extractPublickeyFromScriptTag } from '../helpers';
import { defaultState } from './reducer';
import { ravenCaptureException } from '../helpers/raven';
import { generateVisitorMetadata } from '../visitor';

let tidioStateStorageKey = null;
const getOldStorageKey = () => {
    if (!tidioStateStorageKey) {
        const publicKey = extractPublickeyFromScriptTag() || 'preview';
        tidioStateStorageKey = `tidio_${publicKey}_`;
    }
    return tidioStateStorageKey;
};

const getMessagesCountInChatLog = () => {
    const oldChatLogKey = `${getOldStorageKey()}tidioChatLog`;
    const serializedOldChatLogString = localStorage.getItem(oldChatLogKey);
    if (serializedOldChatLogString) {
        let serializedOldChatLogObject = JSON.parse(serializedOldChatLogString);
        if (!serializedOldChatLogObject || !serializedOldChatLogObject.data) {
            return 0;
        }
        serializedOldChatLogObject = serializedOldChatLogObject.data;
        if (!Array.isArray(serializedOldChatLogObject)) {
            return 0;
        }
        return serializedOldChatLogObject.length;
    }
    return false;
};

export default function importDataFromOldWidgetFormat() {
    try {
        const oldVisitorDataKey = `${getOldStorageKey()}visitorData`;
        let serializedOldVisitorDataString;
        try {
            serializedOldVisitorDataString = localStorage.getItem(oldVisitorDataKey);
        } catch (e) {
            return undefined;
        }
        if (!serializedOldVisitorDataString) {
            return undefined;
        }
        let serializedOldVisitorDataObject = JSON.parse(serializedOldVisitorDataString);
        if (!serializedOldVisitorDataObject || !serializedOldVisitorDataObject.data) {
            return undefined;
        }
        serializedOldVisitorDataObject = serializedOldVisitorDataObject.data;
        const visitor = {
            ...serializedOldVisitorDataObject,
            id: serializedOldVisitorDataObject.id,
            ...generateVisitorMetadata(),
            project_public_key: extractPublickeyFromScriptTag(),
        };

        const oldVisitorIdKey = `${getOldStorageKey()}visitorId`;
        let serializedOldVisitorIdKeyString;
        try {
            serializedOldVisitorIdKeyString = localStorage.getItem(oldVisitorIdKey);
        } catch (e) {
            //
        }
        if (serializedOldVisitorIdKeyString) {
            const serializedVisitorIdObject = JSON.parse(serializedOldVisitorIdKeyString);
            if (
                serializedVisitorIdObject?.data &&
                typeof serializedVisitorIdObject.data === 'string' &&
                serializedVisitorIdObject.data.length === 32
            ) {
                visitor.id = serializedVisitorIdObject.data;
            }
        }

        const oldOriginalVisitorIdKey = `${getOldStorageKey()}visitorIdOrigin`;
        let serializedOldOriginalVisitorIdString;
        try {
            serializedOldOriginalVisitorIdString = localStorage.getItem(oldOriginalVisitorIdKey);
        } catch (e) {
            //
        }
        let originalVisitorId = visitor.id;
        if (serializedOldOriginalVisitorIdString) {
            const serializedOldOriginalVisitorIdObject = JSON.parse(
                serializedOldOriginalVisitorIdString,
            );
            if (
                serializedOldOriginalVisitorIdObject?.data &&
                typeof serializedOldOriginalVisitorIdObject.data === 'string' &&
                serializedOldOriginalVisitorIdObject.data.length === 32
            ) {
                originalVisitorId = serializedOldOriginalVisitorIdObject.data;
            }
        }
        visitor.originalVisitorId = originalVisitorId;

        const chatLogLength = getMessagesCountInChatLog();

        return {
            ...defaultState,
            visitor,
            importedMessagesCount: chatLogLength,
        };
    } catch (e) {
        ravenCaptureException(e);
        return undefined;
    }
}

export function getMessagesCountInOldWidget() {
    return getMessagesCountInChatLog();
}
