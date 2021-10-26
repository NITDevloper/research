import { getCurrentTime } from '../helpers';
import { ravenCaptureException } from '../helpers/raven';
import { getPreChatFields } from '../connection/parsers';

export const getOperator = (state, operatorId) => {
    const foundOperator = state.operators.find(operator => operator.id === operatorId);
    if (!foundOperator) {
        return { id: '' };
    }
    return foundOperator || { id: '' };
};

export const getFirstMessageByType = (state, type) =>
    state.messages.find(message => message.type === type);

export const getMessageIndexByType = (state, type) =>
    state.messages.findIndex(message => message.type === type);

export const getPreChatMessage = state => getFirstMessageByType(state, 'preChat');

export const alwaysOnlineMessagesExist = state =>
    typeof getFirstMessageByType(state, 'alwaysOnline') !== 'undefined';

export const getAllMessagesByType = (state, type) =>
    state.messages.filter(message => message.type === type);

export const getLatestAlwaysOnlineMessage = state => {
    const messages = getAllMessagesByType(state, 'alwaysOnline');
    return messages.length > 0 ? messages[messages.length - 1] : undefined;
};

export const alwaysOnlineMessageExpirationThresholdInSeconds = 3600;
export const isAlwaysOnlineMessageExpired = message => {
    const currentTimestamp = getCurrentTime();
    return currentTimestamp - alwaysOnlineMessageExpirationThresholdInSeconds >= message.time_sent;
};

export const hasLatestAlwaysOnlineMessageExpired = state => {
    try {
        const latest = getLatestAlwaysOnlineMessage(state);
        return isAlwaysOnlineMessageExpired(latest);
    } catch (e) {
        ravenCaptureException(e);
        return false;
    }
};

export const isLastMessage = (state, messageId) => {
    const lastMessageIndex = state.messages.length - 1;
    return state.messages[lastMessageIndex].id === messageId;
};

export const getLastMessage = state => {
    const currentMessages = state.messages;
    const messagesAmount = currentMessages.length;
    if (messagesAmount > 0) {
        return state.messages[messagesAmount - 1];
    }
    return undefined;
};

export const isLastMessage24hOld = state => {
    const currentMessages = state.messages;
    const hasMessages = currentMessages.length > 0;
    const lastMessageTimestamp = hasMessages
        ? currentMessages[currentMessages.length - 1].time_sent
        : 0;
    const oneDay = 24 * 60 * 60;
    const nowTimestamp = Math.floor(new Date().getTime() / 1000);
    return nowTimestamp - lastMessageTimestamp > oneDay;
};

export const getWidgetLabelStatus = state =>
    state.widgetLabelStatus && !state.isMobile && state.sidebarIframeStyles === false;

export const isPreChatFilled = state => state.preChat.isFilled;

export const isPreChatEnabledButNotFilled = state => {
    const preChatFields = getPreChatFields(state.preChat.data, state.visitor);
    const preChatFilled = isPreChatFilled(state);
    return !preChatFilled && preChatFields.length !== 0;
};

export const getAwesomeIframe = state =>
    state.isAwesomeIframe && state.sidebarIframeStyles === false;

export const getFlyMessage = state => state.messageForFly || null;
