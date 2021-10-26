import debounce from 'lodash.debounce';
import {
    ADD_MESSAGE,
    BOT_TRIGGER,
    BOTS_GET_STARTED,
    CANCEL_BOTS,
    SEND_FILLED_ALWAYS_ONLINE_MESSAGE,
    SEND_FILLED_PRECHAT,
    SEND_MESSAGE_FROM_VISITOR,
    SEND_RATE_CONVERSATION_COMMENT,
    SET_CHAT_OPENED_STATE,
    TIDIOCHATAPI_TRACK,
    UPDATE_ATTACHMENT,
    VISITOR_IS_TYPING,
    VISITOR_REGISTER_IMPORT_DATA,
    VISITOR_SET_RATING,
    VISITOR_UPDATE_DATA,
    UPDATE_VISITOR_URL,
    SET_NOTIFICATION_STATUS,
    SET_VIEW,
    CLOSE_SOCKET_CONNECTION,
    SET_VISITOR_MERGED_EMIT_QUEUE,
    VISITOR_CLICKS_ON_CHAT_ICON,
    VISITOR_ADD_TAGS,
    SET_PAGE_VISIBLITY_STATUS,
    SET_CONTACT_PROPERTIES,
    SHOPIFY_ORDER_CREATED,
    VISITOR_WIDGET_POSITION,
    SET_WIDGET_MOUNT_STATE,
    SHOW_USER_DATA_MODAL,
    TOGGLE_EMOJI_PANEL,
    WIDGET_ACTIVITY_TRACKING,
    FETCH_SHOPIFY_CART_CONTENT,
    RATE_CHAT_BOT,
} from './actions';
import {
    visitorIsTyping,
    visitorNewMessage,
    visitorReadMessages,
    visitorSetRating,
    visitorPreChat,
    visitorSetComment,
    visitorGetConversationHistory,
    visitorTracking,
    visitorUpdateData,
    botTrigger,
    botCancelBotApps,
    botGetStarted,
    updateVisitorUrl,
    visitorClicksOnChatIcon,
    visitorAddTags,
    shopifyOrderCreated,
    setVisitorWidgetPosition,
    trackWidgetActivity,
    sendCartData,
    chatBotRated,
} from '../connection/emits';
import { apiData, shopifyCartRequest } from '../helpers/apiData';
import { ravenCaptureException } from '../helpers/raven';
import GoogleAnalyticsTracker from '../tracking/GoogleAnalyticsTracker';
import { views } from '../helpers/views';
import { senders } from '../connection/parsers';
import { PRECHAT_FIELD_TYPE_EMAIL_CONSENT } from '../connection/prechatFieldTypes';
import { trackingEvents } from './activityTrackingHelpers';

// mock methods to allow for tracker usage before it's initialized
let googleAnalyticsTracker = {
    trackEventOnce: () => {},
    trackEvent: () => {},
    trackEventOnceInInterval: () => {},
};

const defaultDebounceEmitTime = 500;

const fullDay = 86400;

export default function socketEmitsMiddleware({ emitQueue, closeConnection }) {
    return ({ getState, dispatch }) => {
        const emit = emitQueue(getState, dispatch);
        const debounceEmit = debounce(emit, defaultDebounceEmitTime, {
            maxWait: defaultDebounceEmitTime,
        });
        return next => action => {
            switch (action.type) {
                case VISITOR_REGISTER_IMPORT_DATA: {
                    if (
                        action.data.visitor_status === 'banned' ||
                        action.data.visitor_status === 'blacklisted'
                    ) {
                        closeConnection();
                        action.callback(false);
                        return false;
                    }
                    if (
                        action.data.widget_data?.integrations &&
                        Array.isArray(action.data.widget_data.integrations) &&
                        !(googleAnalyticsTracker instanceof GoogleAnalyticsTracker)
                    ) {
                        const googleAnalyticsIntegration = action.data.widget_data.integrations.find(
                            integration => integration.platform === 'ga',
                        );
                        if (googleAnalyticsIntegration) {
                            googleAnalyticsTracker = new GoogleAnalyticsTracker();
                        }
                    }
                    const state = getState();
                    const { unread_messages: unreadMessages = 0 } = action.data;
                    if (unreadMessages > 0) {
                        emit(visitorGetConversationHistory);
                        if (state.view === views.chat && state.isPageVisible) {
                            emit(visitorReadMessages);
                        }
                    }
                    if (state.importedOldWidgetData) {
                        emit(visitorGetConversationHistory);
                    }
                    const retVal = next(action);
                    action.callback(true);
                    return retVal;
                }
                case SEND_MESSAGE_FROM_VISITOR: {
                    if (action.emit) {
                        debounceEmit.cancel();
                        emit(visitorNewMessage, action.payload);
                        googleAnalyticsTracker.trackEventOnce('Chat started');
                        const { messages, assignedOperators } = getState();
                        const messagesLength = messages.length;
                        const isOperatorAssigned = assignedOperators.length > 0;
                        try {
                            const lastMessageOlderThanOneDay =
                                messagesLength > 0 &&
                                action.payload.time_sent - messages[messagesLength - 1].time_sent >
                                    fullDay;
                            if (
                                messagesLength === 0 ||
                                (!isOperatorAssigned && lastMessageOlderThanOneDay)
                            ) {
                                googleAnalyticsTracker.trackEvent(
                                    'Visitor started the conversation',
                                );
                            }
                        } catch (error) {
                            //
                        }
                    }
                    return next(action);
                }
                case SEND_FILLED_PRECHAT: {
                    const { updateData } = action;
                    if (updateData) {
                        emit(visitorPreChat, updateData);
                        googleAnalyticsTracker.trackEvent('Pre-Chat Survey finished');
                        if (
                            (updateData.signUpNewsletter ||
                                updateData[PRECHAT_FIELD_TYPE_EMAIL_CONSENT]) &&
                            updateData.email
                        ) {
                            // send newsletter requests
                            const state = getState();
                            const { publicKey } = state;
                            const { email } = updateData;
                            try {
                                const newsletterField = state.preChat.data.fields.find(
                                    field => field.type === 'signUpNewsletter',
                                );
                                if (newsletterField) {
                                    newsletterField.value.forEach(integration => {
                                        // send api request per each integration
                                        apiData(`apps/${integration}/signup`, {
                                            email,
                                            project_public_key: publicKey,
                                        }).catch(() => {
                                            // ravenCaptureException(e);
                                        });
                                    });
                                }
                            } catch (e) {
                                ravenCaptureException(e);
                            }
                        }
                    }
                    return next(action);
                }
                case SEND_FILLED_ALWAYS_ONLINE_MESSAGE: {
                    const { email } = action;
                    if (email) {
                        emit(visitorPreChat, { email });
                    }
                    return next(action);
                }
                case SET_CHAT_OPENED_STATE: {
                    const shouldOpen = action.open;
                    if (shouldOpen) {
                        emit(visitorReadMessages);
                        googleAnalyticsTracker.trackEvent('Click on the chat widget');
                    } else {
                        googleAnalyticsTracker.trackEvent('Close the chat widget');
                    }
                    return next(action);
                }
                case ADD_MESSAGE: {
                    const { view, messages, isPageVisible } = getState();
                    if (view === views.chat && isPageVisible) {
                        emit(visitorReadMessages);
                    }
                    if (action.message.type === 'alwaysOnline') {
                        googleAnalyticsTracker.trackEvent('Offline message');
                    }
                    if (action.message.type === 'preChat') {
                        googleAnalyticsTracker.trackEvent('Pre-Chat Survey started');
                    }

                    const messagesLength = messages.length;
                    const lastMessageOlderThanOneDay =
                        messagesLength > 0 &&
                        action.time_sent - messages[messagesLength - 1].time_sent > fullDay;
                    if (
                        action.message.sender === senders.operator &&
                        action.message.type !== 'alwaysOnline' &&
                        (messagesLength === 0 || lastMessageOlderThanOneDay)
                    ) {
                        googleAnalyticsTracker.trackEvent('Operator started the conversation');
                    }
                    if (
                        action.message.sender === senders.bot &&
                        (messagesLength === 0 || lastMessageOlderThanOneDay)
                    ) {
                        googleAnalyticsTracker.trackEvent('Automation started the conversation');
                    }

                    return next(action);
                }
                case VISITOR_SET_RATING: {
                    emit(visitorSetRating, action.ratingIsGood);
                    if (action.ratingIsGood) {
                        googleAnalyticsTracker.trackEvent('Chat rated good');
                    } else {
                        googleAnalyticsTracker.trackEvent('Chat rated bad');
                    }

                    return next(action);
                }
                case VISITOR_IS_TYPING: {
                    debounceEmit(visitorIsTyping, action.message);
                    return next(action);
                }
                case SEND_RATE_CONVERSATION_COMMENT: {
                    emit(visitorSetComment, action.comment);
                    return next(action);
                }
                case UPDATE_ATTACHMENT: {
                    const result = next(action);
                    const uploadMessage = getState().messages.find(
                        message => message.id === action.messageId,
                    );
                    if (uploadMessage) {
                        debounceEmit.cancel();
                        emit(visitorNewMessage, uploadMessage);
                    }
                    return result;
                }
                case VISITOR_UPDATE_DATA: {
                    if (action.emit) {
                        emit(visitorUpdateData, action.updateData);
                    }
                    return next(action);
                }
                case VISITOR_ADD_TAGS: {
                    emit(visitorAddTags, action.tags);
                    return next(action);
                }
                case SET_CONTACT_PROPERTIES: {
                    emit(visitorUpdateData, { properties: action.properties });
                    return next(action);
                }
                case TIDIOCHATAPI_TRACK: {
                    emit(
                        visitorTracking,
                        action.eventName,
                        action.eventData,
                        action.successCallback,
                    );
                    return next(action);
                }
                case BOT_TRIGGER: {
                    const { ids } = action;
                    emit(botTrigger, ids);
                    return next(action);
                }
                case CANCEL_BOTS: {
                    emit(botCancelBotApps);
                    return next(action);
                }
                case BOTS_GET_STARTED: {
                    emit(botGetStarted);
                    googleAnalyticsTracker.trackEventOnceInInterval('Start the Bot');
                    return next(action);
                }
                case UPDATE_VISITOR_URL: {
                    emit(updateVisitorUrl, action.url);
                    return next(action);
                }
                case SET_NOTIFICATION_STATUS: {
                    if (action.status) {
                        googleAnalyticsTracker.trackEvent('Mute notifications');
                        emit(trackWidgetActivity, trackingEvents.notificationsTurnedOff);
                    } else {
                        emit(trackWidgetActivity, trackingEvents.notificationsTurnedOn);
                    }
                    return next(action);
                }
                case SET_VIEW: {
                    const { isPageVisible, unreadMessages } = getState();
                    if (action.view === views.chat && isPageVisible && unreadMessages) {
                        emit(visitorReadMessages);
                    }
                    if (action.view === views.fly) {
                        googleAnalyticsTracker.trackEvent('Fly message displayed');
                        emit(trackWidgetActivity, trackingEvents.flyMessageDisplayed);
                    }
                    return next(action);
                }
                case CLOSE_SOCKET_CONNECTION: {
                    closeConnection();
                    return next(action);
                }
                case SET_VISITOR_MERGED_EMIT_QUEUE: {
                    emit(action.callback, closeConnection);
                    return next(action);
                }
                case VISITOR_CLICKS_ON_CHAT_ICON: {
                    emit(visitorClicksOnChatIcon);
                    return next(action);
                }
                case SET_PAGE_VISIBLITY_STATUS: {
                    const { view, unreadMessages } = getState();
                    if (view === views.chat && unreadMessages && action.status) {
                        emit(visitorReadMessages);
                    }
                    return next(action);
                }
                case SHOPIFY_ORDER_CREATED: {
                    emit(shopifyOrderCreated, action.params);
                    return next(action);
                }
                case VISITOR_WIDGET_POSITION: {
                    emit(setVisitorWidgetPosition, action.params);
                    return next(action);
                }
                case SET_WIDGET_MOUNT_STATE: {
                    if (action.status) {
                        emit(trackWidgetActivity, trackingEvents.widgetLoaded);
                    }
                    return next(action);
                }
                case SHOW_USER_DATA_MODAL: {
                    const { modal } = action;
                    if (modal) {
                        emit(
                            trackWidgetActivity,
                            modal === 'prechat'
                                ? trackingEvents.prechatOpened
                                : trackingEvents.alwaysOnlineOpened,
                        );
                    }

                    return next(action);
                }
                case TOGGLE_EMOJI_PANEL: {
                    if (action.status === true) {
                        emit(trackWidgetActivity, trackingEvents.emojiPanelOpened);
                    }
                    return next(action);
                }
                case WIDGET_ACTIVITY_TRACKING: {
                    emit(trackWidgetActivity, action.event, action.additionalData);
                    return next(action);
                }
                case FETCH_SHOPIFY_CART_CONTENT: {
                    shopifyCartRequest()
                        .then(data => {
                            emit(sendCartData, { data });
                        })
                        .catch(error => {
                            ravenCaptureException('Shopify Cart request error', {
                                message: error?.message,
                            });
                        });
                    return next(action);
                }
                case RATE_CHAT_BOT: {
                    emit(chatBotRated, action.ratingId, action.rating);
                    return next(action);
                }
                default: {
                    return next(action);
                }
            }
        };
    };
}
