import {
    botTrigger as botTriggerAction,
    mergeFetchedMessages,
    mergeVisitorDataFromIdentify,
    setVisitorMessageDeliveryStatus,
    setWidgetMountState,
    visitorRegisterImportData,
    widgetActivityTracking,
} from '../store/actions';
import {
    generateHash,
    getCurrentTime,
    isInSandboxMode,
    getSandboxParams,
    getCurrentUrl,
} from '../helpers';
import GenericTracker from '../tracking/GenericTracker';
import ShopifyTracker from '../tracking/ShopifyTracker';
import Automation from '../Automation';
import { removeSavedStateFromStorage } from '../store/savedState';
import { ravenCaptureInfo } from '../helpers/raven';
import bindTidioChatApiMethods from '../store/tidioChatApiHelper';
import { trackingEvents } from '../store/activityTrackingHelpers';

let genericEventsTracker;
let shopifyEventsTracker;
let automation;

let lastUrl = getCurrentUrl();

// all emits except visitorRegister and visitorIdentify have visitorId and projectPublicKey automatically passed later in connectionManager

export function visitorIdentify(
    emit,
    {
        tidioIdentifyData: identifyData,
        publicKey: projectPublicKey,
        visitor: { originalVisitorId },
    },
    dispatch,
    callback,
) {
    emit(
        'visitorIdentify',
        { identifyData, projectPublicKey },
        (visitorIdFromIdentify, errorData) => {
            // eslint-disable-next-line no-console
            console.debug('visitorIdentifyAck', visitorIdFromIdentify);

            function handleInsufficientData() {
                const visitorData = {};
                if (typeof originalVisitorId === 'string' && originalVisitorId.length === 32) {
                    visitorData.id = originalVisitorId;
                } else {
                    const newId = generateHash();
                    visitorData.id = newId;
                    visitorData.originalVisitorId = newId;
                }
                return visitorData;
            }

            if (errorData?.message) {
                const visitorData = handleInsufficientData();
                dispatch(mergeVisitorDataFromIdentify(visitorData));
                callback();
                return true;
            }
            let mergeData = { identifyData };
            if (typeof visitorIdFromIdentify === 'string' && visitorIdFromIdentify.length === 32) {
                mergeData.id = visitorIdFromIdentify;
            } else if (identifyData.distinct_id || identifyData.email) {
                mergeData.id = generateHash();
            } else {
                const visitorData = handleInsufficientData();
                mergeData = { ...mergeData, ...visitorData };
            }
            dispatch(mergeVisitorDataFromIdentify(mergeData));
            callback();
            return true;
        },
    );
}

let firstVisitorRegister = true;

export function visitorRegister(emit, state, dispatch, closeConnection) {
    const {
        visitor,
        isProjectOnline,
        hideWhenOffline,
        visitor: { is_chat_on_site: isChatOnSite },
    } = state;
    const isSandboxMode = isInSandboxMode();
    emit(
        'visitorRegister',
        { ...visitor, sandbox: isSandboxMode, isProjectOnline },
        (data, error) => {
            // eslint-disable-next-line no-console
            console.debug('visitorRegisterAck', data, error);
            if (!data || error === 'INVALID_PROJECT_PUBLIC_KEY') {
                ravenCaptureInfo('visitorId collision', {
                    visitorId: visitor.id,
                });
                closeConnection();
                setTimeout(() => {
                    removeSavedStateFromStorage();
                    window.location.reload();
                }, 1000 * 10);
                return false;
            }
            dispatch(
                visitorRegisterImportData(data, shouldMount => {
                    if (isSandboxMode) {
                        const { automationId, timeout = 100 } = getSandboxParams();
                        if (automationId) {
                            setTimeout(() => {
                                dispatch(botTriggerAction([+automationId]));
                            }, timeout);
                        }
                    } else {
                        if (data.widget_data?.tracking) {
                            if (
                                data.widget_data.tracking.generic &&
                                !(genericEventsTracker instanceof GenericTracker)
                            ) {
                                const genericEvents = data.widget_data.tracking.generic;
                                genericEventsTracker = new GenericTracker(genericEvents);
                            }
                            if (
                                data.widget_data.tracking.platform_tracked === 'shopify' &&
                                !(shopifyEventsTracker instanceof ShopifyTracker)
                            ) {
                                shopifyEventsTracker = new ShopifyTracker({
                                    dispatch,
                                    mode: 'advanced',
                                });
                            }
                        }

                        if (
                            data.widget_data &&
                            data.widget_data.platform === 'shopify' &&
                            !(shopifyEventsTracker instanceof ShopifyTracker)
                        ) {
                            shopifyEventsTracker = new ShopifyTracker({
                                dispatch,
                                mode: 'simple',
                            });
                        }

                        if (
                            data.widget_data?.bots &&
                            Array.isArray(data.widget_data.bots) &&
                            data.widget_data.bots.length > 0
                        ) {
                            if (!(automation instanceof Automation)) {
                                const botTriggerDispatch = ids => {
                                    dispatch(botTriggerAction(ids));
                                };
                                const projectOnline = isProjectOnline;
                                automation = new Automation(
                                    data.widget_data.bots,
                                    visitor.id,
                                    botTriggerDispatch,
                                    projectOnline,
                                    hideWhenOffline,
                                    isChatOnSite,
                                );
                            } else {
                                automation.setVisitorId(visitor.id);
                            }
                        }
                    }
                    if (!shouldMount) {
                        // if shouldMount here = false it means visitor is banned/blacklisted. Do not allow to modify widget state via tidioChatApi
                        bindTidioChatApiMethods({ dispatch: () => {} });
                    }
                    if (firstVisitorRegister) {
                        dispatch(setWidgetMountState(shouldMount));
                        firstVisitorRegister = false;
                    }
                }),
            );
            return true;
        },
    );
}

export function visitorNewMessage(emit, state, dispatch, messagePayload) {
    const { id: messageId } = messagePayload;
    const timeoutTime = 6000;
    const isNotDeliveredTimeout = setTimeout(() => {
        const idFromServer = null;
        dispatch(setVisitorMessageDeliveryStatus(messageId, idFromServer, false));
    }, timeoutTime);
    emit(
        'visitorNewMessage',
        {
            message: messagePayload.content,
            messageId,
            payload: messagePayload.payload,
            url: messagePayload.url,
        },
        (ack, { id: idFromServer }) => {
            if (!ack) {
                return false;
            }
            clearTimeout(isNotDeliveredTimeout);
            dispatch(setVisitorMessageDeliveryStatus(messageId, idFromServer, true));
            return true;
        },
    );
}

export function visitorGetConversationHistory(emit, { messages }, dispatch) {
    let lastMessageId = null;
    if (messages.length > 0) {
        const withIdFromServer = messages.filter(message => message.idFromServer);
        if (withIdFromServer.length > 0) {
            lastMessageId = withIdFromServer[withIdFromServer.length - 1].idFromServer;
        }
    }
    emit(
        'visitorGetConversationHistory',
        {
            lastMessageId,
        },
        ack => {
            if (!ack) {
                return false;
            }
            dispatch(mergeFetchedMessages(ack.messages, lastMessageId));
            return true;
        },
    );
    if (!lastMessageId) {
        dispatch(widgetActivityTracking(trackingEvents.fullConversationHistoryRequested));
    }
}

export function visitorReadMessages(emit) {
    emit('visitorReadMessages');
}

export function visitorIsTyping(emit, state, dispatch, message) {
    emit('visitorIsTyping', {
        message,
        time: getCurrentTime(),
    });
}

export function visitorUpdateData(emit, state, dispatch, updateData) {
    emit('visitorUpdateData', { updateData });
}

export function visitorAddTags(emit, state, dispatch, tags) {
    emit('visitorAddTags', { tags });
}

export function visitorLastSeenUpdate(emit, { visitor: { id } }) {
    emit('visitorLastSeenUpdate', { id });
}

export function visitorSetRating(emit, state, dispatch, ratingIsGood) {
    emit('visitorSetRating', { value: ratingIsGood ? '1' : '0' });
}

export function visitorPreChat(emit, state, dispatch, updateData) {
    emit('visitorPreForm', { updateData: { ...updateData } }, () => {});
}

export function visitorSetComment(emit, state, dispatch, comment) {
    emit('visitorSetComment', { comment });
}

export function visitorTracking(emit, state, dispatch, eventName, eventData, successCallback) {
    emit('visitorTracking', { event: eventName }, successCallback);
}

export function botTrigger(emit, state, dispatch, ids) {
    emit('botTrigger', { bots: ids });
}

export function botCancelBotApps(emit) {
    emit('botCancelBotApps');
}

export function botGetStarted(emit) {
    emit('botGetStarted');
}

export function updateVisitorUrl(emit, state, dispatch, url) {
    if (url !== lastUrl) {
        lastUrl = url;
        emit('visitorEnterPage', {
            url,
        });
    }
}

export function visitorClicksOnChatIcon(emit) {
    emit('visitorClicksOnChatIcon');
}

export function setVisitorWidgetPosition(emit, state, dispatch, params) {
    emit('visitorWidgetPosition', params);
}

export function shopifyOrderCreated(emit, state, dispatch, params) {
    emit('shopifyOrderCreated', params);
}

export function trackWidgetActivity(emit, state, dispatch, eventName, params) {
    emit('widgetAnalytics', { eventName, ...params });
}

export function sendCartData(emit, state, dispatch, data) {
    emit('sendCartData', data);
}

export function chatBotRated(emit, state, dispatch, ratingId, rating) {
    emit('chatBotRated', {
        ratingId,
        rating,
    });
}
