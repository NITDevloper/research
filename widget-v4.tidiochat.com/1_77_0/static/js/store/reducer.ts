import {
    ADD_MESSAGE,
    ADD_EMOJI_TO_NEW_MESSAGE,
    TOGGLE_EMOJI_PANEL,
    MERGE_VISITOR_DATA_FROM_IDENTIFY,
    SET_WIDGET_MOUNT_STATE,
    OPERATOR_IS_TYPING_STATUS,
    SAVE_TIDIO_IDENTIFY_DATA,
    SEND_MESSAGE_FROM_VISITOR,
    UPLOAD_FILE,
    SET_CHAT_OPENED_STATE,
    SET_NOTIFICATION_STATUS,
    SET_OPTION_DROPDOWN_VISIBILITY,
    SET_PROJECT_STATUS,
    VISITOR_MESSAGE_DELIVERY_STATUS,
    VISITOR_REGISTER_IMPORT_DATA,
    SET_MESSAGE_DISABLED_STATE,
    SET_FLAG_SEND_MESSAGE_FROM_VISITOR,
    INITIALIZE_VISITOR_DATA,
    PERSISTED_STATE_LOADED,
    SET_NEW_MESSAGE_TEXTAREA_DISABLED_STATE,
    SEND_FILLED_PRECHAT,
    SET_BLOCKED_MESSAGE,
    MERGE_VISITOR,
    SEND_RATE_CONVERSATION_COMMENT,
    UPDATE_ATTACHMENT,
    UPDATE_ATTACHMENT_LOADED_STATE,
    SHOW_ALERT,
    HIDE_ALERT,
    REMOVE_MESSAGE,
    SET_IFRAME_VIEW,
    SEND_FILLED_ALWAYS_ONLINE_MESSAGE,
    REPLACE_STATE_WITH_SAVED,
    MERGE_FETCHED_MESSAGES,
    SET_WIDGET_COLOR,
    VISITOR_UPDATE_DATA,
    DATA_IMPORTED_FROM_OLD_WIDGET,
    OPERATOR_OPENED_CONVERSATION,
    OPERATOR_LEFT_CONVERSATION,
    OPERATOR_TRANSFERRED_CONVERSATION,
    OPERATOR_CHANGED_STATUS,
    SET_PREVIEW_DATA,
    SET_BOT_STATUS,
    HIDE_HEADER,
    DISABLE_BOT_ANIMATION,
    SET_VIEW,
    SET_FEATURES_FROM_API,
    SHOW_OLDER_MESSAGES,
    SET_DRAG_AND_DROP_STATUS,
    SHOW_USER_DATA_MODAL,
    SET_PAGE_VISIBLITY_STATUS,
    VISITOR_MARK_MESSAGES_AS_READ,
    SET_AWESOME_IFRAME,
    OPEN_IMAGE_POPUP,
    CLOSE_IMAGE_POPUP,
    SET_MESSAGE_FOR_FLY,
    RATE_CHAT_BOT,
    ActionTypes,
} from './actions';
import {
    cloneDeep,
    defaultTidioIdentifyKeys,
    extractPublickeyFromScriptTag,
    filterTidioIdentifyData,
    inferWidgetColor,
    isInPreviewMode,
    isInSandboxMode,
    isMobile,
    platforms,
    truthy,
} from '../helpers';
import { generateVisitorMetadata } from '../visitor';
import { getMessageIndexByType, isLastMessage24hOld } from './selectors';
import { getIsChatOnSite } from './selectorsTS';
import { allowedPreChatFieldTypes, parseMessageFromSockets } from '../connection/parsers';
import { setCurrentTranslations } from '../helpers/translations';
import { changeOperatorIdToFirstOperator, generateMessagesForOpenView } from './previewHelper';
import filterAndTransformAvailableBots from './helper';
import { views } from '../helpers/views';
import {
    DefaultRootState,
    View,
    IframeViews,
    MobileButtonSize,
    Platform,
    PartialBy,
    SidebarStyles,
    MessageType,
    Message,
    PrechatUpdateData,
} from './typings';

export const defaultState: DefaultRootState = {
    version: 48, // increment this to rebuild state in savedState
    previewMode: false,
    isMounted: false,
    isMobile: false,
    isProjectOnline: false,
    view: View.CLOSED,
    showOptionsDropdown: false,
    notificationSnoozed: false,
    messages: [],
    blockedMessage: null,
    unreadMessages: 0,
    preChat: {
        isFilled: false,
        data: null,
    },
    operators: [],
    bots: [],
    getStartedActive: false,
    isBotActive: false,
    assignedOperators: [],
    operatorIsTyping: false, // false | operatorId: Number
    chatIframeStyles: {
        widgetPosition: 'right',
        iframeView: IframeViews.ONLY_BUBBLE,
    },
    sidebarIframeStyles: false,
    hideWhenOffline: false,
    publicKey: extractPublickeyFromScriptTag(),
    tidioIdentifyData: false,
    tidioIdentifyChanged: false,
    visitor: {},
    widgetColor: ['#2a27da', '#00ccff', '#fff', '#004dff'],
    bannerImage: '',
    newMessageEmoji: null,
    isEmojiPanelVisible: false,
    sendVisitorMessageFlag: false,
    newMessageDisabled: false,
    alert: {
        content: '',
        isVisible: false,
    },
    showBranding: true,
    hideHeader: false,
    mobileButtonSize: MobileButtonSize.LARGE,
    disableBotsButtonAnimation: false,
    widgetLabelStatus: false,
    mobileHash: true,
    showOldMessages: false,
    showMessagesButtonClickedTimestamp: null,
    isDragAndDropActive: false,
    showUserDataModal: false, // modalType {String} | false {Boolean} // modalType = prechat|alwaysOnline
    platform: Platform.OTHERS,
    isSoundEnabled: true,
    isPageVisible: true,
    isAwesomeIframe: false,
    popupImageSrc: '',
    messageForFly: null,
    importedOldWidgetData: false,
};

export default function reducer(state = defaultState, action: ActionTypes): DefaultRootState {
    switch (action.type) {
        case INITIALIZE_VISITOR_DATA: {
            return {
                ...state,
                visitor: { ...action.visitorData },
            };
        }
        case PERSISTED_STATE_LOADED: {
            return {
                ...state,
                visitor: {
                    ...state.visitor,
                    ...generateVisitorMetadata(),
                },
            };
        }
        case REPLACE_STATE_WITH_SAVED: {
            // isPageVisible is ignored because this prop is associated only with current widget instance (in card/window) - DM;
            return {
                ...action.state,
                isPageVisible: state.isPageVisible,
                visitor: {
                    ...action.state.visitor,
                    is_chat_on_site: state.visitor.is_chat_on_site,
                },
            };
        }
        case MERGE_VISITOR: {
            return {
                ...state,
                visitor: {
                    ...state.visitor,
                    id: action.visitorId,
                },
            };
        }
        case SAVE_TIDIO_IDENTIFY_DATA: {
            const { identifyData } = action;
            const filteredIdentifyData = filterTidioIdentifyData(identifyData);
            if (!filteredIdentifyData) {
                return state;
            }
            return {
                ...state,
                tidioIdentifyData: { ...state.tidioIdentifyData, ...filteredIdentifyData },
                tidioIdentifyChanged: true,
            };
        }
        case MERGE_VISITOR_DATA_FROM_IDENTIFY: {
            const { dataToMerge } = action;
            const { identifyData } = dataToMerge;
            const filteredIdentify = filterTidioIdentifyData(identifyData);
            const defaultsWithoutTags: PartialBy<
                typeof defaultTidioIdentifyKeys,
                'tags'
            > = cloneDeep(defaultTidioIdentifyKeys);
            delete defaultsWithoutTags.tags;

            const withDefaults = { ...defaultsWithoutTags, ...filteredIdentify };
            return {
                ...state,
                visitor: {
                    ...state.visitor,
                    id: dataToMerge.id,
                    ...withDefaults,
                },
            };
        }
        case VISITOR_REGISTER_IMPORT_DATA: {
            const {
                popup: { position: desktopPosition, color_bg: colorBg } = {
                    position: 'right',
                    color_bg: ['#21dbdb'],
                },
                preform: prechatImportedData = false,
                integrations = [],
                translations: importedTranslations,
                hide_when_offline: hideWhenOffline = false,
                sidebar = false,
                banner_image: bannerImage = '',
                showBranding = true,
                bots: availableBots = [],
                get_started_active: getStartedActive,
                widget_label_status: widgetLabelStatus,
                platform: platformTracked = '',
                widget_sound_enabled: isSoundEnabled,
                is_awesome_iframe: isAwesomeIframe = false,
            } = action.data.widget_data;

            const { position: mobilePosition, size: mobileWidgetSize } = action.data.widget_data
                .mobile
                ? action.data.widget_data.mobile
                : <const>{
                      position: 'right',
                      size: 125,
                  };
            const {
                unread_messages: unreadMessages,
                assigned_operators: assignedOperators = [],
                is_bot_active: isBotActive,
            } = action.data;
            setCurrentTranslations(importedTranslations, state.visitor.lang || '');
            const mobile = isMobile();
            let widgetPosition: 'left' | 'right' = 'right';
            if (mobile) {
                widgetPosition = mobilePosition;
            } else {
                const desktopPositionValue =
                    desktopPosition.indexOf('-') > -1
                        ? desktopPosition.split('-')[1]
                        : desktopPosition;
                if (desktopPositionValue === 'left' || desktopPositionValue === 'right') {
                    widgetPosition = desktopPositionValue;
                }
            }

            let sidebarIframeStyles: false | SidebarStyles = false;
            if (!mobile && sidebar && sidebar.visible) {
                sidebarIframeStyles = {
                    position: sidebar.position,
                    color: sidebar.color,
                };
            }
            const widgetColor = inferWidgetColor(colorBg);
            const isProjectOnline = action.data.project_status === 'online';
            const { operators = [] } = action.data;
            const mapedOperators = operators.map(operator => ({
                id: operator.id,
                isOnline: operator.is_online,
                name: operator.name,
                avatarSrc: operator.image,
            }));
            let { messages } = state;
            let preChatData = null;
            if (prechatImportedData) {
                if (
                    !prechatImportedData.display ||
                    (prechatImportedData.fields && prechatImportedData.fields.length === 0)
                ) {
                    preChatData = null;
                    try {
                        // check if preChat disabled in panel but message already added to conversation
                        const preChatMessageIndex = getMessageIndexByType(state, 'preChat');
                        const preChatNotFilledAndMessageExists =
                            !state.preChat.isFilled && preChatMessageIndex > -1;
                        if (preChatNotFilledAndMessageExists) {
                            // remove preChat message from conversation
                            messages = cloneDeep(state.messages);
                            messages.splice(preChatMessageIndex, 1);
                        }
                    } catch (e) {
                        //
                    }
                } else {
                    preChatData = {
                        fields: prechatImportedData.fields,
                    };
                    const integrationsFields = integrations.filter(
                        integration => integration.platform === 'mailchimp',
                    );
                    if (integrationsFields.length > 0) {
                        preChatData.fields.push({
                            type: 'signUpNewsletter',
                            value: integrationsFields.reduce<string[]>(
                                (acc, next) => [...acc, next.platform],
                                [],
                            ),
                        });
                    }
                }
            }
            let mobileButtonSize: MobileButtonSize;
            switch (mobileWidgetSize) {
                case 100:
                    mobileButtonSize = MobileButtonSize.MEDIUM;
                    break;
                case 75:
                    mobileButtonSize = MobileButtonSize.SMALL;
                    break;
                default:
                    mobileButtonSize = MobileButtonSize.LARGE;
                    break;
            }
            let platform;
            switch (platformTracked) {
                case platforms.shopify:
                    platform = Platform.SHOPIFY;
                    break;
                case platforms.wordpress:
                    platform = Platform.WORDPRESS;
                    break;
                default:
                    platform = Platform.OTHERS;
                    break;
            }

            const bots = isInSandboxMode() ? [] : filterAndTransformAvailableBots(availableBots);
            return {
                ...state,
                chatIframeStyles: {
                    ...state.chatIframeStyles,
                    widgetPosition,
                },
                sidebarIframeStyles,
                hideWhenOffline,
                unreadMessages,
                operators: mapedOperators,
                bots,
                getStartedActive,
                isBotActive,
                assignedOperators,
                widgetColor,
                bannerImage,
                isProjectOnline,
                messages,
                preChat: {
                    ...state.preChat,
                    data: preChatData,
                },
                showBranding,
                mobileButtonSize,
                widgetLabelStatus,
                platform,
                isSoundEnabled,
                isAwesomeIframe,
                isMobile: mobile,
            };
        }
        case MERGE_FETCHED_MESSAGES: {
            const { lastMessageId, messagesToMerge } = action;
            let newMessages = cloneDeep(state.messages);
            if (lastMessageId) {
                const index = newMessages.findIndex(
                    message => message.idFromServer === lastMessageId,
                );
                if (index === -1) {
                    // there is no message in log from which we took id
                    const messagesToAdd = cloneDeep(messagesToMerge)
                        .map(messageFromSocket =>
                            parseMessageFromSockets({
                                data: messageFromSocket,
                            }),
                        )
                        .filter(truthy);
                    newMessages = newMessages.concat(messagesToAdd);
                } else {
                    // message in log, but might not be the last
                    const messagesToAdd = cloneDeep(messagesToMerge)
                        .slice(1)
                        .map(messageFromSocket =>
                            parseMessageFromSockets({ data: messageFromSocket }),
                        )
                        .filter(truthy);
                    newMessages = [...newMessages.slice(0, index + 1), ...messagesToAdd];
                }
            } else {
                newMessages = cloneDeep(messagesToMerge)
                    .map(messageFromSocket => parseMessageFromSockets({ data: messageFromSocket }))
                    .filter(truthy);
            }

            return {
                ...state,
                unreadMessages:
                    state.view !== views.closed && state.view !== views.fly
                        ? 0
                        : state.unreadMessages,
                messages: newMessages,
            };
        }
        case SET_PROJECT_STATUS: {
            const isProjectOnline = action.status === 'online';
            return {
                ...state,
                isProjectOnline,
            };
        }
        case SET_WIDGET_MOUNT_STATE: {
            const isMounted = action.status;
            const mobile = isMobile();
            let iframeView;
            const isChatOnSite = getIsChatOnSite(state);
            const hasMessages = state.messages.length > 0;
            const lastMessage24hOld = isLastMessage24hOld(state);
            let currentView = state.view;
            if (isChatOnSite && (currentView === views.closed || currentView === views.fly)) {
                currentView = View.WELCOME;
            }
            if (currentView === views.welcome && ((hasMessages && !lastMessage24hOld) || mobile)) {
                currentView = View.CHAT;
            }
            if (currentView === views.chat && (!hasMessages || lastMessage24hOld) && !mobile) {
                currentView = View.WELCOME;
            }
            if (mobile && currentView === views.chat) {
                currentView = View.CLOSED;
            }

            if (currentView !== views.closed || isChatOnSite) {
                iframeView = IframeViews.CHAT_SIZE_1;
            } else if (state.sidebarIframeStyles) {
                iframeView = IframeViews.ONLY_SIDEBAR;
            } else {
                iframeView = IframeViews.ONLY_BUBBLE;
            }

            if (mobile) {
                if (currentView === views.welcome || currentView === views.chat) {
                    iframeView = IframeViews.MOBILE;
                    currentView = View.CHAT;
                } else if (currentView === views.fly) {
                    iframeView = IframeViews.DYNAMIC;
                } else if (state.sidebarIframeStyles) {
                    iframeView = IframeViews.ONLY_SIDEBAR;
                } else {
                    iframeView = IframeViews.ONLY_BUBBLE;
                    if (state.mobileButtonSize === 'small') {
                        iframeView = IframeViews.ONLY_BUBBLE_SMALL;
                    } else if (state.mobileButtonSize === 'medium') {
                        iframeView = IframeViews.ONLY_BUBBLE_MEDIUM;
                    }
                }
            }

            return {
                ...state,
                isMounted,
                isMobile: mobile,
                chatIframeStyles: {
                    ...state.chatIframeStyles,
                    iframeView,
                },
                view: currentView,
            };
        }
        case SET_IFRAME_VIEW: {
            return {
                ...state,
                chatIframeStyles: {
                    ...state.chatIframeStyles,
                    iframeView: action.iframeView,
                },
            };
        }
        case SET_WIDGET_COLOR: {
            return {
                ...state,
                widgetColor: action.color,
            };
        }
        case SET_CHAT_OPENED_STATE: {
            /** @var shouldOpen Boolean */
            const shouldOpen = action.open;
            const lastMessage24hOld = isLastMessage24hOld(state);
            if (!shouldOpen) {
                return {
                    ...state,
                    view: View.CLOSED,
                };
            }

            let view = View.CHAT;
            if (
                !state.isMobile &&
                (state.messages.length === 0 || (lastMessage24hOld && state.unreadMessages === 0))
            ) {
                view = View.WELCOME;
            }

            return {
                ...state,
                view,
                unreadMessages: 0,
            };
        }
        case SET_OPTION_DROPDOWN_VISIBILITY: {
            return {
                ...state,
                showOptionsDropdown: action.visible,
            };
        }
        case SET_FLAG_SEND_MESSAGE_FROM_VISITOR: {
            return {
                ...state,
                sendVisitorMessageFlag: action.shouldSend,
            };
        }
        case SET_NOTIFICATION_STATUS: {
            return {
                ...state,
                notificationSnoozed: action.status,
            };
        }
        case OPERATOR_IS_TYPING_STATUS: {
            const { operatorIdOrStatus } = action;
            return {
                ...state,
                operatorIsTyping: operatorIdOrStatus,
            };
        }
        case ADD_MESSAGE: {
            const { view, isPageVisible } = state;

            return {
                ...state,
                messages: state.messages.concat(action.message),
                unreadMessages:
                    isPageVisible && (view === views.welcome || view === views.chat)
                        ? 0
                        : state.unreadMessages + 1,
                operatorIsTyping: false,
            };
        }
        case OPERATOR_OPENED_CONVERSATION: {
            const { operatorId } = action;
            return {
                ...state,
                assignedOperators: state.assignedOperators.concat(operatorId),
            };
        }
        case OPERATOR_LEFT_CONVERSATION: {
            const { operatorId } = action;
            const index = state.assignedOperators.indexOf(operatorId);
            const assignedOperators = cloneDeep(state.assignedOperators);
            assignedOperators.splice(index, 1);
            return {
                ...state,
                assignedOperators,
            };
        }
        case OPERATOR_TRANSFERRED_CONVERSATION: {
            const { sourceOperatorId, targetOperatorId } = action;
            const sourceIndex = state.assignedOperators.indexOf(sourceOperatorId);
            let assignedOperators = cloneDeep(state.assignedOperators);
            assignedOperators.splice(sourceIndex, 1);
            const targetIndex = state.assignedOperators.indexOf(targetOperatorId);
            if (targetIndex < 0) {
                assignedOperators = assignedOperators.concat(targetOperatorId);
            }
            return {
                ...state,
                assignedOperators,
            };
        }
        case OPERATOR_CHANGED_STATUS: {
            const { operatorId, isOnline } = action;
            const operators = cloneDeep(state.operators).map(operator => {
                if (operator.id === operatorId) {
                    return {
                        ...operator,
                        isOnline,
                    };
                }
                return operator;
            });
            return {
                ...state,
                operators,
            };
        }
        case SHOW_USER_DATA_MODAL: {
            const { modal } = action;
            const shouldDisableNewMessage = modal !== false;
            return {
                ...state,
                showUserDataModal: modal,
                newMessageDisabled: shouldDisableNewMessage,
            };
        }
        case SEND_FILLED_PRECHAT: {
            let visitorFieldsToUpdate: Partial<PrechatUpdateData> = {};
            allowedPreChatFieldTypes.forEach(field => {
                const updateDataValue = action.updateData[field];
                if (typeof updateDataValue !== 'undefined') {
                    visitorFieldsToUpdate = {
                        [field]: updateDataValue,
                        ...visitorFieldsToUpdate,
                    };
                }
            });
            return {
                ...state,
                preChat: {
                    ...state.preChat,
                    isFilled: true,
                },
                visitor: {
                    ...state.visitor,
                    ...visitorFieldsToUpdate,
                },
                showUserDataModal: false,
                newMessageDisabled: false,
            };
        }
        case SEND_FILLED_ALWAYS_ONLINE_MESSAGE: {
            const { email } = action;
            return {
                ...state,
                visitor: {
                    ...state.visitor,
                    email,
                },
                showUserDataModal: false,
                newMessageDisabled: false,
            };
        }
        case ADD_EMOJI_TO_NEW_MESSAGE: {
            return {
                ...state,
                newMessageEmoji: action.emoji,
                isEmojiPanelVisible: false,
            };
        }
        case TOGGLE_EMOJI_PANEL: {
            return {
                ...state,
                isEmojiPanelVisible: action.status,
            };
        }
        case SEND_MESSAGE_FROM_VISITOR: {
            // TODO: should have proper types after typing parsers.js
            // TODO tag as not delivered when adding to store but do not display it to user [DZIK-120]
            // TODO when we refresh page we would still have messages marked as not delivered and we could retry sending them
            const { payload } = action;
            payload.isDelivered = true;
            return {
                ...state,
                messages: state.messages.concat(payload),
                blockedMessage: null,
            };
        }
        case UPLOAD_FILE: {
            // TODO: should have proper types after typing parsers.js
            const { payload } = action;
            if (!payload.file) {
                return { ...state };
            }
            payload.isDelivered = true;
            return {
                ...state,
                messages: state.messages.concat(payload),
            };
        }
        case SET_BLOCKED_MESSAGE: {
            return {
                ...state,
                blockedMessage: action.message,
            };
        }
        case VISITOR_MESSAGE_DELIVERY_STATUS: {
            const newMessages = cloneDeep(state.messages);
            const index = newMessages.findIndex(message => message.id === action.messageId);
            if (index === -1) {
                return state;
            }
            newMessages[index].isDelivered = action.status;
            newMessages[index].idFromServer = action.idFromServer;
            return {
                ...state,
                messages: newMessages,
            };
        }
        case UPDATE_ATTACHMENT: {
            const newMessages = cloneDeep(state.messages);
            const message = newMessages.find(msg => msg.id === action.messageId);
            if (!message) {
                return state;
            }
            message.type = MessageType.UPLOADED_FILE;
            message.attachmentType = action.attachmentType;
            message.name = action.name;
            message.extension = action.extension;
            message.content = action.url;
            message.thumb = action.thumb;
            message.file = '';
            message.imageLoaded = action.imageLoaded;

            return {
                ...state,
                messages: newMessages,
            };
        }
        case UPDATE_ATTACHMENT_LOADED_STATE: {
            const newMessages = cloneDeep(state.messages);
            const message = newMessages.find(msg => msg.id === action.messageId);
            if (!message) {
                return state;
            }
            message.imageLoaded = true;

            return {
                ...state,
                messages: newMessages,
            };
        }
        case SET_NEW_MESSAGE_TEXTAREA_DISABLED_STATE: {
            return {
                ...state,
                newMessageDisabled: action.shouldDisable,
            };
        }
        case SET_MESSAGE_DISABLED_STATE: {
            // rateConversation, rateConversationComment, alwaysOnlineMessage, messages with buttons
            const newMessages = cloneDeep(state.messages);
            let messageIds = action.messageIdOrArrayOfIds;
            if (!Array.isArray(messageIds)) {
                messageIds = [messageIds];
            }
            const allMessagesAvailable = (
                messages: Message[],
                indexes: Message['id'][],
            ): boolean => {
                for (let i = 0; i < indexes.length; i += 1) {
                    const index = messages.findIndex(message => message.id === indexes[i]);
                    if (index === -1) {
                        return false;
                    }
                }
                return true;
            };
            if (!allMessagesAvailable(newMessages, messageIds)) {
                return state;
            }
            messageIds.forEach(messageId => {
                const index = newMessages.findIndex(message => message.id === messageId);
                newMessages[index].disabled = true;
            });
            return {
                ...state,
                messages: newMessages,
            };
        }
        case SET_BOT_STATUS: {
            const { isActive } = action;
            return {
                ...state,
                isBotActive: isActive,
            };
        }
        case SEND_RATE_CONVERSATION_COMMENT: {
            const newMessages = cloneDeep(state.messages);
            const index = newMessages.findIndex(message => message.id === action.messageId);
            if (index === -1) {
                return state;
            }
            newMessages[index].disabled = true;
            newMessages[index].content = action.comment;
            return {
                ...state,
                messages: newMessages,
            };
        }
        case SET_VIEW: {
            const { view } = action;
            if (!Object.values(views).includes(view)) {
                return state;
            }
            return {
                ...state,
                view,
                unreadMessages: action.view === views.chat ? 0 : state.unreadMessages,
            };
        }
        case VISITOR_UPDATE_DATA: {
            // keys filtered using filterTidioIdentifyData in sideEffectsMiddleware
            return {
                ...state,
                visitor: {
                    ...state.visitor,
                    ...action.updateData,
                },
            };
        }
        case SHOW_ALERT: {
            return {
                ...state,
                alert: {
                    isVisible: true,
                    content: action.message,
                },
            };
        }
        case HIDE_ALERT: {
            return {
                ...state,
                alert: {
                    ...state.alert,
                    isVisible: false,
                },
            };
        }
        case REMOVE_MESSAGE: {
            const newMessages = cloneDeep(state.messages);
            const index = newMessages.findIndex(message => message.id === action.messageId);
            if (index === -1) {
                return state;
            }
            newMessages.splice(index, 1);
            return {
                ...state,
                messages: newMessages,
            };
        }
        // TODO delete after migration from old widget
        case DATA_IMPORTED_FROM_OLD_WIDGET: {
            return {
                ...state,
                importedOldWidgetData: true,
            };
        }
        /* eslint-disable @typescript-eslint/ban-ts-comment */
        case SET_PREVIEW_DATA: {
            // TODO: provide typings for preview data payload
            // Decided to not do it right now, it is only used for our preview purposes so nothing critical; -DM
            if (!isInPreviewMode()) {
                return state;
            }
            const { prop, payload } = action;
            if (prop === 'previewModeEnabled') {
                return {
                    ...state,
                    // @ts-ignore
                    previewMode: payload,
                };
            }
            if (prop === 'color') {
                return {
                    ...state,
                    // @ts-ignore
                    widgetColor: inferWidgetColor(payload),
                };
            }
            if (prop === 'position') {
                return {
                    ...state,
                    chatIframeStyles: {
                        ...state.chatIframeStyles,
                        // @ts-ignore
                        widgetPosition: payload.indexOf('-') > -1 ? payload.split('-')[1] : payload,
                    },
                };
            }
            if (prop === 'operators') {
                return {
                    ...state,
                    // @ts-ignore
                    operators: payload,
                };
            }
            if (prop === 'translations') {
                // @ts-ignore
                setCurrentTranslations(payload, 'en');
                return state;
            }
            if (prop === 'bannerImage') {
                return {
                    ...state,
                    // @ts-ignore
                    bannerImage: payload,
                };
            }
            if (prop === 'hideWhenOffline') {
                return {
                    ...state,
                    // @ts-ignore
                    hideWhenOffline: payload,
                };
            }
            if (prop === 'widgetLabelStatus') {
                return {
                    ...state,
                    // @ts-ignore
                    widgetLabelStatus: payload,
                };
            }
            if (prop === 'widgetSoundStatus') {
                return {
                    ...state,
                    // @ts-ignore
                    isSoundEnabled: payload,
                };
            }
            if (prop === 'chatOnSite') {
                return {
                    ...state,
                    visitor: {
                        ...state.visitor,
                        // @ts-ignore
                        is_chat_on_site: payload,
                    },
                };
            }
            if (prop === 'sidebar') {
                let isMounted = true;
                let sidebarIframeStyles = false;
                const sidebar = action.payload;
                // @ts-ignore
                if (sidebar?.visible) {
                    // @ts-ignore
                    sidebarIframeStyles = {
                        // @ts-ignore
                        position: sidebar.position,
                        // @ts-ignore
                        color: sidebar.color,
                    };
                } else {
                    isMounted = false;
                }
                return {
                    ...state,
                    // @ts-ignore
                    sidebarIframeStyles,
                    isMounted,
                };
            }
            if (prop === 'messages') {
                return {
                    ...state,
                    // @ts-ignore
                    messages: payload === 'clear' ? [] : payload,
                };
            }
            if (prop === 'preChatData') {
                // @ts-ignore
                if (!payload.status) {
                    return {
                        ...state,
                        preChat: {
                            ...state.preChat,
                            isFilled: false,
                            data: null,
                        },
                        showUserDataModal: false,
                    };
                }

                return {
                    ...state,
                    visitor: {
                        ...state.visitor,
                        name: '',
                        email: '',
                        phone: '',
                    },
                    preChat: {
                        ...state.preChat,
                        isFilled: false,
                        data: {
                            // @ts-ignore
                            fields: payload.fields,
                        },
                    },
                };
            }
            if (prop === 'previewView') {
                const view = payload;
                let isProjectOnline = true;
                let { messages } = state;
                let widgetView = views.chat;
                let { visitor } = state;
                if (view === 'gettingStarted') {
                    messages = [];
                    widgetView = views.welcome;
                } else if (view === 'preform') {
                    visitor = {
                        ...state.visitor,
                        name: '',
                        email: '',
                        phone: '',
                    };
                } else if (view === 'closed') {
                    widgetView = views.closed;
                } else if (view === 'fly') {
                    widgetView = views.fly;
                } else {
                    messages = changeOperatorIdToFirstOperator(
                        generateMessagesForOpenView(),
                        state.operators[0].id,
                    );
                }
                let assignedOperators = [state.operators[0].id];
                if (view === 'operatorsOffline') {
                    isProjectOnline = false;
                    assignedOperators = [];
                }

                return {
                    ...state,
                    isProjectOnline,
                    messages,
                    blockedMessage: null,
                    newMessageDisabled: false,
                    assignedOperators,
                    visitor,
                    // @ts-ignore
                    view: widgetView,
                    showUserDataModal: false,
                };
            }
            if (prop === 'messageForFly') {
                return {
                    ...state,
                    // @ts-ignore
                    messageForFly: payload,
                };
            }
            return state;
        }
        /* eslint-enable @typescript-eslint/ban-ts-comment */
        case HIDE_HEADER: {
            return {
                ...state,
                hideHeader: action.status,
            };
        }
        case DISABLE_BOT_ANIMATION: {
            return {
                ...state,
                disableBotsButtonAnimation: action.status,
            };
        }
        case SET_FEATURES_FROM_API: {
            // keys filtered using filterApiFeatures in sideEffectsMiddleware
            return {
                ...state,
                ...action.features,
            };
        }
        case SHOW_OLDER_MESSAGES: {
            return {
                ...state,
                showOldMessages: action.status,
                showMessagesButtonClickedTimestamp: Math.floor(Date.now() / 1000),
            };
        }
        case SET_DRAG_AND_DROP_STATUS: {
            return {
                ...state,
                isDragAndDropActive: action.status,
            };
        }
        case SET_PAGE_VISIBLITY_STATUS: {
            return {
                ...state,
                isPageVisible: action.status,
            };
        }
        case VISITOR_MARK_MESSAGES_AS_READ: {
            return {
                ...state,
                unreadMessages: 0,
            };
        }
        case SET_AWESOME_IFRAME: {
            return {
                ...state,
                isAwesomeIframe: action.status,
            };
        }
        case OPEN_IMAGE_POPUP: {
            return {
                ...state,
                popupImageSrc: action.image,
            };
        }
        case CLOSE_IMAGE_POPUP: {
            return {
                ...state,
                popupImageSrc: '',
            };
        }
        case SET_MESSAGE_FOR_FLY: {
            return {
                ...state,
                messageForFly: action.message,
            };
        }
        case RATE_CHAT_BOT: {
            const newMessages = cloneDeep(state.messages);
            const index = newMessages.findIndex(message => message.id === action.messageId);
            if (index === -1) {
                return state;
            }
            newMessages[index].rating = action.rating;
            return {
                ...state,
                messages: newMessages,
            };
        }
        default: {
            return state;
        }
    }
}
