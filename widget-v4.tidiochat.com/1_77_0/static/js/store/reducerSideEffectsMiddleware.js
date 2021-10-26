import {
    COMPARE_TIDIO_IDENTIFY_DATA,
    OPERATOR_IS_TYPING_STATUS,
    saveTidioIdentifyData,
    setOperatorIsTypingStatus,
    ADD_MESSAGE,
    addMessage,
    disableNewMessageTextarea,
    SEND_MESSAGE_FROM_VISITOR,
    setBlockedMessage,
    VISITOR_SET_RATING,
    SET_CHAT_OPENED_STATE,
    setIframeView,
    SEND_FILLED_ALWAYS_ONLINE_MESSAGE,
    SET_WIDGET_MOUNT_STATE,
    VISITOR_UPDATE_DATA,
    SET_PROJECT_STATUS,
    SEND_FILLED_PRECHAT,
    SET_IFRAME_VIEW,
    OPERATOR_LEFT_CONVERSATION,
    SET_PREVIEW_DATA,
    setChatOpenedState,
    OPERATOR_OPENED_CONVERSATION,
    BOTS_GET_STARTED,
    SET_FLAG_SEND_MESSAGE_FROM_VISITOR,
    setFlagForSendingMessageFromVisitor,
    setView,
    SET_VIEW,
    SET_FEATURES_FROM_API,
    VISITOR_REGISTER_IMPORT_DATA,
    setFeaturesFromApi,
    showUserDataModal,
} from './actions';
import {
    filterApiFeatures,
    filterTidioIdentifyData,
    filterVisitorUpdateData,
    shallowIsObjectEqual,
    getCurrentTime,
} from '../helpers';
import {
    transformToAlwaysOnlineMessageFormat,
    transformToSystemMessageFormat,
    transformToPreChatMessageFormat,
    transformToRateCommentMessageFormat,
    senders,
    getPreChatFields,
    messageTypes,
} from '../connection/parsers';
import {
    alwaysOnlineMessagesExist,
    getAllMessagesByType,
    getPreChatMessage,
    hasLatestAlwaysOnlineMessageExpired,
    getLastMessage,
    getWidgetLabelStatus,
} from './selectors';
import { dynamic, getIframeSizes, iframeSizes, iframeViews } from '../helpers/iframe';
import { trans } from '../helpers/translations';
import { ravenCaptureException } from '../helpers/raven';
import {
    focusNewMessageTextarea,
    getDocumentRef,
    getIframeRef,
    scrollConversationToRateMessageButtons,
} from '../helpers/focusManager';
import { playNotificationSound } from '../helpers/sounds';
import { views } from '../helpers/views';
import { getKeyFromStorage, saveKeyToStorage } from './savedState';

let operatorIsTypingClearId = null;
const operatorIsTypingTimeout = 3000;
let changeIframeViewClearId = null;
let changeIframeViewTimeoutIn = 270;
const changeIframeViewTimeoutOut = 300;
let isWaitingForAnswer = false;

let onNextVisitorMessageSend = null;

let featuresOverridesFromApi = {};
const oneDay = 60 * 60 * 24;

function shouldFocusNewMessageTextarea(state, docRef) {
    if (state.isMobile) {
        // do not focus newMessageTextarea if on mobile
        return false;
    }
    if (!docRef || !docRef.activeElement) {
        return false;
    }
    if (state.previewMode) {
        return false;
    }
    if (docRef.activeElement.tagName !== 'INPUT') {
        const lastMessage = getLastMessage(state);
        if (!lastMessage) {
            return true;
        }
        if (
            lastMessage.type === messageTypes.cards ||
            (lastMessage.quickReplies && lastMessage.quickReplies.length > 0)
        ) {
            // do not focus newMessageTextarea if there are quick replies or card gallery
            return false;
        }
        return true;
    }
    return false;
}

const reducerSideEffectsMiddleware = ({ getState, dispatch }) => next => action => {
    switch (action.type) {
        case SET_FLAG_SEND_MESSAGE_FROM_VISITOR: {
            const { shouldSend } = action;
            if (shouldSend) {
                setTimeout(() => {
                    dispatch(setFlagForSendingMessageFromVisitor(false));
                }, 0);
            }
            return next(action);
        }
        case COMPARE_TIDIO_IDENTIFY_DATA: {
            const state = getState();
            const { identifyData: newIdentifyData } = action;
            let emptyIdentifyInStore = true;
            try {
                emptyIdentifyInStore =
                    state.tidioIdentifyData === false ||
                    Object.keys(state.tidioIdentifyData).length === 0;
            } catch (e) {
                ravenCaptureException(e);
                return next(action);
            }
            if (!newIdentifyData && emptyIdentifyInStore) {
                return next(action);
            }
            const filteredIdentifyData = filterTidioIdentifyData(newIdentifyData);
            if (!filteredIdentifyData) {
                return next(action);
            }
            const areEqual = shallowIsObjectEqual(state.tidioIdentifyData, filteredIdentifyData);
            if (!areEqual) {
                const result = next(action);
                dispatch(saveTidioIdentifyData(filteredIdentifyData));
                return result;
            }
            return next(action);
        }
        case SET_WIDGET_MOUNT_STATE: {
            const shouldMount = action.status;
            if (shouldMount) {
                const state = getState();
                if (state.isMounted) {
                    return false;
                }
                // check if we should disable textarea
                const lastMessage = getLastMessage(state);
                if (lastMessage?.isWaitingForAnswer) {
                    isWaitingForAnswer = true;
                }
                const retVal = next(action);
                const { width, height } = getIframeSizes(
                    state.chatIframeStyles.iframeView,
                    state.isAwesomeIframe,
                );
                window.tidioChatApi.trigger('resize', {
                    width,
                    height,
                    iframe: getIframeRef(),
                });
                return retVal;
            }
            window.tidioChatApi.trigger('resize', {
                width: 0,
                height: 0,
                iframe: null,
            });
            return next(action);
        }
        case SET_CHAT_OPENED_STATE: {
            const shouldOpen = action.open;
            const state = getState();
            const sidebarEnabled = state.sidebarIframeStyles !== false;
            const widgetPositionLeft = state.chatIframeStyles.widgetPosition === 'left';
            const enableIframeTimeout = widgetPositionLeft || sidebarEnabled;
            if (state.previewMode && sidebarEnabled && shouldOpen) {
                return false;
            }
            let iframeView;
            if (shouldOpen) {
                saveKeyToStorage('lastActivity', getCurrentTime());

                iframeView = iframeViews.chatSize1;
            } else if (sidebarEnabled) {
                iframeView = iframeViews.onlySidebar;
            } else {
                iframeView = iframeViews.onlyBubble;
            }

            if (state.isMobile) {
                if (shouldOpen) {
                    iframeView = iframeViews.mobile;
                } else if (sidebarEnabled) {
                    iframeView = iframeViews.onlySidebar;
                } else {
                    iframeView = iframeViews.onlyBubble;
                    if (state.mobileButtonSize === 'small') {
                        iframeView = iframeViews.onlyBubbleSmall;
                    } else if (state.mobileButtonSize === 'medium') {
                        iframeView = iframeViews.onlyBubbleMedium;
                    }
                }
            }
            if (changeIframeViewClearId) {
                clearTimeout(changeIframeViewClearId);
                changeIframeViewClearId = null;
            }

            changeIframeViewTimeoutIn = enableIframeTimeout ? 270 : 50;
            if (shouldOpen) {
                if (!enableIframeTimeout) {
                    dispatch(setIframeView(iframeView));
                }
                changeIframeViewClearId = setTimeout(() => {
                    if (enableIframeTimeout) {
                        dispatch(setIframeView(iframeView));
                    }
                    setTimeout(() => {
                        const docRef = getDocumentRef();
                        if (shouldFocusNewMessageTextarea(state, docRef)) {
                            focusNewMessageTextarea();
                        }
                    }, 0);
                    window.tidioChatApi.trigger('open');
                    window.tidioChatApi.trigger('popUpShow'); // deprecated
                }, changeIframeViewTimeoutIn);
                return next(action);
            }
            changeIframeViewClearId = setTimeout(() => {
                window.tidioChatApi.trigger('close');
                window.tidioChatApi.trigger('popUpHide'); // deprecated
                /*
                Condition bellow is made to prevent faulty iframe resizng when widgetLabel is enabled
                Both resize events are fired almost simultaneously and sometimes onlyBubble view overrides dynamic resizing
                */
                const currenState = getState();
                const isWidgetLabelActive = getWidgetLabelStatus(currenState);
                const isTryingToClose =
                    iframeView === iframeViews.onlyBubble ||
                    iframeView === iframeViews.onlyBubbleMedium ||
                    iframeView === iframeViews.onlyBubbleSmall ||
                    iframeView === iframeViews.onlySidebar;
                if (
                    (isTryingToClose && currenState.view !== views.closed) ||
                    (isWidgetLabelActive && isTryingToClose)
                ) {
                    return false;
                }
                dispatch(setIframeView(iframeView));
                return true;
            }, changeIframeViewTimeoutOut);
            return next(action);
        }
        case SET_VIEW: {
            setTimeout(() => {
                const state = getState();
                const docRef = getDocumentRef();
                if (shouldFocusNewMessageTextarea(state, docRef)) {
                    focusNewMessageTextarea();
                }
            }, 0);
            if (action.view === views.chat) {
                window.tidioChatApi.trigger('open');
            }
            return next(action);
        }
        case OPERATOR_IS_TYPING_STATUS: {
            if (action.operatorIdOrStatus !== false) {
                clearTimeout(operatorIsTypingClearId);
                operatorIsTypingClearId = setTimeout(
                    () => dispatch(setOperatorIsTypingStatus(false)),
                    operatorIsTypingTimeout,
                );
            }
            return next(action);
        }
        case SEND_MESSAGE_FROM_VISITOR: {
            const state = getState();

            saveKeyToStorage('lastActivity', getCurrentTime());

            if (state.isBotActive) {
                window.tidioChatApi.trigger('messageFromVisitor', {
                    message: action.message,
                    fromBot: true,
                });
                return next(action);
            }
            if (isWaitingForAnswer) {
                isWaitingForAnswer = false;
                window.tidioChatApi.trigger('messageFromVisitor', {
                    message: action.message,
                    fromBot: true,
                });
                return next(action);
            }

            const { payload: messageData } = action;
            // Move to next middleware if there is bot payload in message
            if (messageData.payload) {
                window.tidioChatApi.trigger('messageFromVisitor', {
                    message: action.message,
                    fromBot: true,
                });
                return next(action);
            }
            const preChatFields = getPreChatFields(state.preChat.data, state.visitor);
            if (!state.preChat.isFilled && state.preChat.data && preChatFields.length !== 0) {
                // preChat
                const preChatAlreadyAdded = getPreChatMessage(state);
                if (!preChatAlreadyAdded) {
                    dispatch(disableNewMessageTextarea());
                    dispatch(setBlockedMessage(action.message));
                    dispatch(showUserDataModal('prechat'));
                    return false;
                }
            } else if (
                !state.isProjectOnline &&
                (!alwaysOnlineMessagesExist(state) || hasLatestAlwaysOnlineMessageExpired(state))
            ) {
                // alwaysOnline
                const alwaysOnlineMessage = transformToAlwaysOnlineMessageFormat();
                if (!alwaysOnlineMessage) {
                    return next(action);
                }
                const visitorEmail = state.visitor.email;
                if (visitorEmail) {
                    // add new alwaysOnline message to log
                    alwaysOnlineMessage.content = visitorEmail;
                    alwaysOnlineMessage.disabled = true;
                    setTimeout(() => {
                        dispatch(addMessage(alwaysOnlineMessage));
                    });
                } else {
                    dispatch(disableNewMessageTextarea());
                    dispatch(setBlockedMessage(action.message));
                    dispatch(showUserDataModal('alwaysOnline'));
                    return false;
                }
            }
            const lastTriggerTimestamp = getKeyFromStorage('lastMessageFromVisitorTimestamp') || 0;
            const now = getCurrentTime();
            if (now - lastTriggerTimestamp > oneDay) {
                window.tidioChatApi.trigger('conversationStart');
            }
            saveKeyToStorage('lastMessageFromVisitorTimestamp', now);

            window.tidioChatApi.trigger('messageFromVisitor', {
                message: action.message,
                fromBot: false,
            });
            if (onNextVisitorMessageSend) {
                // primarily used for bots - see BOT_TRIGGER case
                onNextVisitorMessageSend();
                onNextVisitorMessageSend = null;
                return next({
                    ...action,
                    emit: false,
                });
            }
            return next(action);
        }
        case SEND_FILLED_ALWAYS_ONLINE_MESSAGE: {
            // the order of getState and retVal is important
            // we want to display always online message with visitor email filled
            const alwaysOnlineMessage = transformToAlwaysOnlineMessageFormat();
            const retVal = next(action);
            if (alwaysOnlineMessage) {
                dispatch(addMessage(alwaysOnlineMessage));
            }
            dispatch(setFlagForSendingMessageFromVisitor(true));
            setTimeout(() => {
                dispatch(addMessage(transformToSystemMessageFormat(trans('alwaysOnlineThanks'))));
            }, 0);
            return retVal;
        }

        case ADD_MESSAGE: {
            const state = getState();
            if (action.message.type === 'rateConversation') {
                const rateMessage = getAllMessagesByType(state, 'rateConversation').filter(
                    message => !message.disabled,
                );
                if (rateMessage.length > 0) {
                    scrollConversationToRateMessageButtons();
                    return false;
                }
            }
            // Check isMounted too as widget could be hidden by tidioChatApi
            const isChatHidden =
                state.hideWhenOffline && !state.isProjectOnline && !state.visitor.is_chat_on_site;
            if (
                state.isSoundEnabled &&
                !state.notificationSnoozed &&
                state.isMounted &&
                !isChatHidden
            ) {
                try {
                    playNotificationSound();
                } catch (e) {
                    ravenCaptureException(e);
                }
            }
            window.tidioChatApi.trigger('messageFromOperator', {
                message: action.message.content,
                fromBot: action.message.sender === senders.bot,
            });
            const { isWaitingForAnswer: isLastMessageWaitingForAnswer } = action.message;
            if (isLastMessageWaitingForAnswer) {
                isWaitingForAnswer = true;
            }
            return next(action);
        }
        case OPERATOR_OPENED_CONVERSATION: {
            const { operatorId } = action;
            const index = getState().assignedOperators.indexOf(operatorId);
            if (index > -1) {
                return false;
            }
            return next(action);
        }
        case OPERATOR_LEFT_CONVERSATION: {
            const { operatorId } = action;
            const index = getState().assignedOperators.indexOf(operatorId);
            if (index === -1) {
                ravenCaptureException(`${action.type} - No operatorId found in assignedOperators`, {
                    operatorId,
                });
                return false;
            }
            return next(action);
        }
        case VISITOR_SET_RATING: {
            // TODO trans for commentForGoodRating
            const commentMessage = transformToRateCommentMessageFormat(action.ratingIsGood);
            dispatch(addMessage(commentMessage));
            return next(action);
        }
        case VISITOR_UPDATE_DATA: {
            const filtered = filterVisitorUpdateData(action.updateData);
            if (typeof action.updateData !== 'object' || !filtered) {
                return false;
            }
            return next({
                ...action,
                updateData: filterVisitorUpdateData(action.updateData),
            });
        }
        case SET_PROJECT_STATUS: {
            window.tidioChatApi.trigger('setStatus', action.status);
            return next(action);
        }
        case SEND_FILLED_PRECHAT: {
            if (action.updateData) {
                window.tidioChatApi.trigger('preFormFilled', {
                    form_data: action.updateData,
                });
            }
            // the order of getState and retVal is important
            // we want to display prechat message with fields which were not present on visitor object before
            // filling them with data from action.updateData
            const state = getState();
            const preChatMessage = transformToPreChatMessageFormat(
                state.preChat.data,
                state.visitor,
            );
            const retVal = next(action);
            if (preChatMessage) {
                dispatch(addMessage(preChatMessage));
            }
            dispatch(setFlagForSendingMessageFromVisitor(true));

            return retVal;
        }
        case SET_IFRAME_VIEW: {
            const { iframeView, dimensions } = action;
            let width;
            let height;
            if (dimensions) {
                ({ width, height } = dimensions);
                dynamic(width, height);
            } else {
                ({ width, height } = iframeSizes[iframeView]);
            }
            window.tidioChatApi.trigger('resize', {
                width,
                height,
                iframe: getIframeRef(),
            });
            return next(action);
        }
        case BOTS_GET_STARTED: {
            setTimeout(() => {
                dispatch(setView(views.chat));
            }, 200);
            return next(action);
        }
        case SET_PREVIEW_DATA: {
            const { prop, payload } = action;
            // eslint-disable-next-line no-console
            console.debug(prop, payload);
            if (prop === 'previewView') {
                const view = payload;
                if (view === 'closed') {
                    dispatch(setChatOpenedState(false));
                } else {
                    dispatch(setChatOpenedState(true));

                    if (view === 'operatorsOffline') {
                        setTimeout(() => {
                            dispatch(setView(views.chat));
                            dispatch(showUserDataModal('alwaysOnline'));
                        }, 0);
                    }

                    if (view === 'preform') {
                        setTimeout(() => {
                            dispatch(setView(views.chat));
                            dispatch(showUserDataModal('prechat'));
                        }, 0);
                    }
                }
            }
            return next(action);
        }
        case VISITOR_REGISTER_IMPORT_DATA: {
            const retVal = next(action);
            if (Object.keys(featuresOverridesFromApi).length > 0) {
                dispatch(setFeaturesFromApi(featuresOverridesFromApi));
            }
            return retVal;
        }
        case SET_FEATURES_FROM_API: {
            const filtered = filterApiFeatures(action.features);
            if (typeof action.features !== 'object' || !filtered) {
                return false;
            }
            const modifiedAction = {
                ...action,
                features: filtered,
            };
            featuresOverridesFromApi = {
                ...featuresOverridesFromApi,
                ...filtered,
            };
            return next(modifiedAction);
        }
        default: {
            return next(action);
        }
    }
};

export default reducerSideEffectsMiddleware;
