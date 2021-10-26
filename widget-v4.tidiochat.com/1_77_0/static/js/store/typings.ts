import { CSSProperties } from 'react';
import { trackingEvents } from './activityTrackingHelpers';

export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export interface DefaultRootState {
    version: number;
    previewMode: boolean;
    isMounted: boolean;
    isMobile: boolean;
    isProjectOnline: boolean;
    view: View;
    showOptionsDropdown: boolean;
    notificationSnoozed: boolean;
    messages: Message[];
    blockedMessage: string | null;
    unreadMessages: number;
    preChat: PrechatData;
    operators: Operator[];
    bots: Bot[];
    getStartedActive: boolean;
    isBotActive: boolean;
    assignedOperators: number[];
    operatorIsTyping: Operator['id'] | boolean;
    chatIframeStyles: {
        widgetPosition: 'left' | 'right';
        iframeView: IframeViews;
    };
    sidebarIframeStyles: false | SidebarStyles;
    hideWhenOffline: boolean;
    publicKey: string | false;
    tidioIdentifyData: false | TidioIdentify;
    tidioIdentifyChanged: boolean;
    visitor: Visitor | Partial<Visitor>;
    widgetColor: WidgetColor;
    bannerImage: string;
    newMessageEmoji: null | string;
    isEmojiPanelVisible: boolean;
    sendVisitorMessageFlag: boolean;
    newMessageDisabled: boolean;
    alert: { content: string; isVisible: boolean };
    showBranding: boolean;
    hideHeader: boolean;
    mobileButtonSize: MobileButtonSize;
    disableBotsButtonAnimation: boolean;
    widgetLabelStatus: boolean;
    mobileHash: boolean;
    showOldMessages: boolean;
    showMessagesButtonClickedTimestamp: number | null;
    isDragAndDropActive: boolean;
    showUserDataModal: ModalType | false;
    platform: Platform;
    isSoundEnabled: boolean;
    isPageVisible: boolean;
    isAwesomeIframe: boolean;
    popupImageSrc: string;
    messageForFly: Message | null;
    importedOldWidgetData: boolean;
}

export enum Platform {
    SHOPIFY = 'shopify',
    WORDPRESS = 'wordpress',
    OTHERS = 'others',
}
export type ModalType = 'prechat' | 'alwaysOnline';

export enum MobileButtonSize {
    SMALL = 'small',
    MEDIUM = 'medium',
    LARGE = 'large',
}

export type Visitor = {
    id: string;
    originalVisitorId: string;
    distinct_id: null | string | number;
    country: null | string;
    name: string;
    city: null | string;
    browser_session_id: string;
    created: number;
    email: string;
    project_public_key: string | false;
    phone: string;
} & VisitorMetadata &
    Partial<Pick<PrechatUpdateData, 'emailConsent' | 'gdprConsent'>>;

export type TidioIdentify = {
    distinct_id?: string | number;
    name?: string;
    email?: string;
    phone?: string;
    tags?: string[];
};

export interface SidebarStyles {
    position: 'left' | 'right';
    color: string;
}

export enum IframeViews {
    ONLY_BUBBLE = 'onlyBubble',
    ONLY_BUBBLE_SMALL = 'onlyBubbleSmall',
    ONLY_BUBBLE_MEDIUM = 'onlyBubbleMedium',
    ONLY_BUBBLE_LARGE = 'onlyBubbleLarge',
    ONLY_SIDEBAR = 'onlySidebar',
    BUBBLE_WITH_LABEL = 'bubbleWithLabel',
    CHAT_SIZE_1 = 'chatSize1',
    CHAT_SIZE_2 = 'chatSize2',
    CHAT_SIZE_3 = 'chatSize3',
    MOBILE = 'mobile',
    DYNAMIC = 'dynamic',
}

interface Bot {
    triggerId: number;
    displayName: string;
    offlineDisabled: boolean;
    botAppIds: number[];
}

export interface Operator {
    id: number;
    name: string;
    avatarSrc: string;
    isOnline: boolean;
}

export enum View {
    CLOSED = 'closed',
    FLY = 'fly',
    WELCOME = 'welcome',
    CHAT = 'chat',
}

interface ImageMessage {
    imageLoaded: boolean;
    thumb: string;
    file: File | string;
    extension: string;
    attachmentType: 'image' | 'file';
    name: string;
}

interface CardButton {
    type: 'action';
    payload: string;
    title: string;
    chatBotId: number;
    url?: string;
}
export interface Card {
    id: number;
    title: string;
    proxyUrl: null | string;
    position: number;
    imageUrl?: string;
    subtitle?: string;
    butttons: CardButton[];
    url?: string;
}

interface MessageButton {
    chatBotId: 0;
    payload: string;
    title: string;
    type: string;
}

interface PrechatData {
    isFilled: boolean;
    data: null | { fields: PrechatField[] };
}

export type PrechatField =
    | { type: 'email' | 'name' | 'phone' | 'gdprConsent' | 'firstmsg'; value: string }
    | { type: 'emailConsent'; value: boolean }
    | { type: 'signUpNewsletter'; value: string[] };

export interface PrechatUpdateData {
    email: string;
    name: string;
    phone: string;
    gdprConsent: string;
    signUpNewsletter: boolean;
    emailConsent: {
        value: 'subscribed' | 'unsubscribed';
        date: number;
        setBy: 'user' | 'operator';
    };
    firstmsg: string;
}
export interface PrechatMessage {
    preChatFields: (
        | {
              type: 'email' | 'name' | 'phone' | 'gdprConsent';
              value?: string;
              placeholder: string;
          }
        | { type: 'emailConsent'; value?: PrechatUpdateData['emailConsent']; placeholder: string }
    )[];
}

export type PrechatModalField =
    | { type: 'phone' | 'email' | 'name'; placeholder: string; value?: string }
    | { type: 'gdprConsent' | 'emailConsent'; placeholder: string; value?: boolean };

export type Message = {
    id: string;
    type: MessageType;
    content: string;
    sender: MessageSender;
    time_sent: number;
    ratingId?: string | null;
    rating?: 'yes' | 'no';
    disabled?: boolean;
    quickReplies?: QuickReply[];
    idFromServer?: number | null;
    isDelivered?: boolean;
    operator_id?: number | null;
    isWaitingForAnswer?: boolean;
    cards?: Card[];
    buttons?: MessageButton[];
    url?: string;
} & Partial<ImageMessage> &
    Partial<PrechatMessage>;

export type UploadMessage = Message & {
    attachmentType: AttachmentType;
    name: string;
    extension: string;
    content: string;
    thumb: string;
    file: File;
    imageLoaded: boolean;
};

export type AttachmentType = 'image' | 'file';

export enum MessageType {
    TEXT = 'text',
    PRECHAT = 'preChat',
    RATE_CONVERSATION = 'rateConversation',
    ALWAYS_ONLINE = 'alwaysOnline',
    RATE_COMMENT_GOOD = 'rateConversationCommentRateWasGood',
    RATE_COMMENT_BAD = 'rateConversationCommentRateWasBad',
    UPLOADING_FILE = 'uploadingFile',
    UPLOADED_FILE = 'uploadedFile',
    CARD_GALLERY = 'cardGallery',
    BUTTONS = 'buttons',
    SYSTEM = 'system',
}

export enum MessageSender {
    OPERATOR = 'operator',
    VISITOR = 'visitor',
    BOT = 'bot',
    SYSTEM = 'system',
    LOG = 'log',
}

export interface QuickReply {
    type: QuickReplyType;
    title: string;
    payload: string;
    chatBotId: number;
}

type QuickReplyType = 'text' | 'bot';
type TrackingEventKeys = keyof typeof trackingEvents;

export type TrackingEvent = typeof trackingEvents[TrackingEventKeys];

export interface VisitorWidgetPositionParams {
    initialX: number;
    initialY: number;
}

export interface ShopifyOrderCreatedParams {
    customerId: number;
    orderId: number;
    lastActivity: number;
}

interface AllowedApiFeatures {
    mobileHash: boolean;
    widgetLabelStatus: boolean;
}
export type ApiFeatures = Partial<AllowedApiFeatures>;

export type VisitorDataUpdate = Omit<TidioIdentify, 'distinct_id'> & {
    properties?: Record<string, string | number | boolean>;
};

export interface SocketMessagePayload {
    id: string;
    type: 'text' | 'bot';
    sender: MessageSender;
    isDelivered: boolean;
    url: string;
}

export interface VisitorMetadata {
    ip: null | string;
    lang: string;
    browser: Browser['name'];
    browser_version: Browser['version'];
    url: string;
    refer: Window['document']['referrer'];
    os_name: string;
    os_version: string;
    screen_width: Window['screen']['width'];
    screen_height: Window['screen']['height'];
    user_agent: Window['navigator']['userAgent'];
    timezone: string;
    mobile: boolean;
    is_chat_on_site: boolean;
}

export interface VisitorRegisterImportData {
    unread_messages: DefaultRootState['unreadMessages'];
    assigned_operators: DefaultRootState['assignedOperators'];
    is_bot_active: DefaultRootState['isBotActive'];
    project_status: 'online' | 'offline';
    widget_data: {
        popup: { position: string; color_bg: string[] };
        mobile: { position: 'left' | 'right'; size: number } | null;
        preform: false | { display: boolean; fields: PrechatField[] };
        integrations: { id: number; platform: string }[];
        translations: { lang: string; data: Record<string, string> }[];
        hide_when_offline: DefaultRootState['hideWhenOffline'];
        sidebar: false | { visible: boolean; position: 'left' | 'right'; color: string };
        banner_image: DefaultRootState['bannerImage'];
        showBranding: DefaultRootState['showBranding'];
        bots: {
            type: string;
            trigger_id: number;
            payload?: {
                disabled?: boolean;
                position?: number;
                offline_disabled: boolean;
                display_name: string;
                bot_app_ids: string[];
            };
        };
        get_started_active: DefaultRootState['getStartedActive'];
        widget_label_status: DefaultRootState['widgetLabelStatus'];
        platform: string;
        widget_sound_enabled: DefaultRootState['isSoundEnabled'];
        is_awesome_iframe: DefaultRootState['isAwesomeIframe'];
    };
    operators: {
        id: Operator['id'];
        is_online: Operator['isOnline'];
        name: Operator['name'];
        image: Operator['avatarSrc'];
    }[];
}

export enum Os {
    UNKNOWN = 'unknown',
    WINDOWS = 'Windows',
    ANDROID = 'Android',
    IOS = 'iOS',
    OSX = 'OS X',
    UNIX = 'Unix',
    LINUX = 'Linux',
}

export interface GetOsReturnData {
    name: Os;
    version: '';
}

type SingleWidgetColor = CSSProperties['color'];

export type WidgetColor = [
    SingleWidgetColor,
    SingleWidgetColor,
    SingleWidgetColor,
    SingleWidgetColor,
];

export type Browser = {
    name: string;
    version: number;
};

export type ParsedUrl = {
    protocol: string;
    host: string;
    pathname: string;
    search: string;
    hash: string;
} | null;

export interface CustomDocument extends Document {
    tidioLocationURL?: string;
    tidioChatTestingMode?: boolean;
    tidioChatPreviewMode?: boolean;
    tidioSandbox?: { automationId: number };
    tidioChatPreviewModeData?: { isInTour: boolean };
    tidioChatOnSite?: boolean;
    tidioChatLang?: string;
    tidioIdentify?: Record<string, string>;
}

export interface ParentWindow extends Window {
    document: CustomDocument;
}

export interface CustomWindow extends Window {
    parent: ParentWindow;
    document: CustomDocument;
    tidioChatApi?: {
        open: () => void;
        track: (event: string) => void;
        on: (event: 'ready' | 'open', callback: () => void) => void;
        display: (shouldBeVisible: boolean) => void;
    };
}

export interface MessageFromSockets {
    id: number;
    project_public_key: string;
    channel: 'chat';
    type: MessageSender;
    visitor_id: string;
    operator_id: number | null;
    auto: '0' | '1';
    time_sent: number;
    is_waiting_for_answer: boolean;
    bot_id: null | string | number;
    message: {
        type: MessageFromSocketType;
        message: string;
        quick_replies: QuickReply[];
        cards?: Card[];
        buttons?: MessageButton[];
    };
    rating_id?: string | null;
}

type MessageFromSocketType = 'text' | 'cards' | 'buttons' | 'uploadedFile';

export type Truthy<T> = T extends false | '' | 0 | null | undefined ? never : T;
