import uuid from 'uuid/v4';
import { getCurrentTime, getCurrentUrl } from '../helpers';
import { ravenCaptureException } from '../helpers/raven';
import {
    AttachmentType,
    Message,
    MessageFromSockets,
    MessageType,
    Card,
    MessageSender,
    PrechatField,
    Visitor,
    DefaultRootState,
    PrechatMessage,
} from '../store/typings';
import { PRECHAT_FIELD_TYPE_EMAIL_CONSENT } from './prechatFieldTypes';

export const senders = {
    operator: 'operator',
    visitor: 'visitor',
    system: 'system',
    bot: 'bot',
};
export const acceptedExtensions = [
    'pdf',
    'doc',
    'docx',
    'xls',
    'xlsx',
    'csv',
    'txt',
    'rtf',
    'mp3',
    'wma',
    'mpg',
    'mp4',
    'flv',
    'avi',
    'jpg',
    'jpeg',
    'png',
    'gif',
];

export const messageTypes = {
    text: 'text',
    cards: 'cardGallery',
    buttons: 'buttons',
    uploadedFile: 'uploadedFile',
} as const;

const uploadedFileRegex = RegExp(
    // eslint-disable-next-line no-useless-escape
    `^(https?:[/|.|\\w|\\s|-]*\/(.*))\\.(${acceptedExtensions.join('|')})$`,
);

const awsRegex = RegExp(
    '(?!.*-medium$)https:\\/\\/s3.*.amazonaws.com\\/(tidio-files|tidio-files-dev)',
);

export const getAttachmentType = (type: string): AttachmentType => {
    const imageExtension = ['jpg', 'jpeg', 'png', 'gif'];
    if (imageExtension.indexOf(type) !== -1) {
        return 'image';
    }
    return 'file';
};

function isMediaUpload(message: { content: string }): boolean {
    return uploadedFileRegex.test(message.content);
}

function transformToUploadedMessage(message: Message): Message {
    const transformed = { ...message };
    transformed.type = MessageType.UPLOADED_FILE;
    const regExpMatchArray = transformed.content.match(uploadedFileRegex);
    if (!regExpMatchArray) {
        return message;
    }
    const [, urlWithoutExtension, filename, extension] = regExpMatchArray;
    transformed.name = filename;
    transformed.extension = extension;
    transformed.attachmentType = getAttachmentType(extension);
    transformed.imageLoaded = false;
    if (transformed.attachmentType === 'image') {
        transformed.thumb =
            extension === 'gif'
                ? `${urlWithoutExtension}.${extension}`
                : `${urlWithoutExtension}${
                      awsRegex.test(urlWithoutExtension) ? '-medium' : ''
                  }.${extension}`;
    } else {
        transformed.thumb = '';
    }

    return transformed;
}

function transformToCardGalleryMessage(
    parsedMessage: Message,
    rawMessageData: MessageFromSockets['message'],
): Message | undefined {
    const cardGalleryMessage = { ...parsedMessage };
    try {
        if (!rawMessageData.cards) {
            return undefined;
        }
        cardGalleryMessage.cards = rawMessageData.cards;
        const firstCardImageUrl = cardGalleryMessage.cards[0].imageUrl;
        const shouldRemoveImageUrlFromCards =
            typeof firstCardImageUrl !== 'string' || firstCardImageUrl.length === 0;
        // we don't want any image urls if the first card doesn't have it
        if (shouldRemoveImageUrlFromCards) {
            cardGalleryMessage.cards = cardGalleryMessage.cards.map(card => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { imageUrl, ...rest } = card;
                return { ...rest };
            });
        }
        cardGalleryMessage.cards = cardGalleryMessage.cards.map(card => {
            // we don't want imageUrl, url or subtitle if it's not string or it's empty string
            const { url, subtitle, imageUrl, ...rest } = card;
            const shouldHaveImageUrl =
                typeof card.imageUrl === 'string' && card.imageUrl.length > 0;
            const shouldHaveUrl = typeof url === 'string' && url.length > 0;
            const shouldHaveSubtitle = typeof subtitle === 'string' && subtitle.length > 0;
            const newCard: Card = { ...rest };
            if (shouldHaveImageUrl) {
                newCard.imageUrl = imageUrl;
            }
            if (shouldHaveUrl) {
                newCard.url = url;
            }
            if (shouldHaveSubtitle) {
                newCard.subtitle = subtitle;
            }
            return newCard;
        });

        return cardGalleryMessage;
    } catch (e) {
        return undefined;
    }
}

function transformToButtonsMessage(
    parsedMessage: Message,
    rawMessageData: MessageFromSockets['message'],
): Message {
    return { ...parsedMessage, buttons: rawMessageData.buttons || [] };
}

export function transformToVisitorMessageFormat(
    message: MessageFromSockets | Message['content'],
): Message {
    const msgData = {
        id: uuid(),
        type: MessageType.TEXT,
        sender: MessageSender.VISITOR,
        isDelivered: true,
        url: getCurrentUrl(),
    };
    if (typeof message === 'string') {
        let parsed: Message = {
            ...msgData,
            idFromServer: null,
            content: message,
            time_sent: getCurrentTime(),
        };
        if (isMediaUpload(parsed)) {
            parsed = transformToUploadedMessage(parsed);
        }
        return parsed;
    }
    const idFromServer = message.id;
    const content = message.message.message;
    const timeSent = message.time_sent;
    let parsed: Message = {
        ...msgData,
        idFromServer,
        content,
        time_sent: timeSent,
    };
    if (isMediaUpload(parsed)) {
        parsed = transformToUploadedMessage(parsed);
    }
    return parsed;
}

export function transformToSystemMessageFormat(message: Message['content']): Message {
    return {
        id: uuid(),
        type: MessageType.SYSTEM,
        content: message,
        sender: MessageSender.OPERATOR,
        time_sent: getCurrentTime(),
    };
}

export function transformToRateMessageFormat(): Message {
    return {
        id: uuid(),
        type: MessageType.RATE_CONVERSATION,
        content: '',
        sender: MessageSender.OPERATOR,
        time_sent: getCurrentTime(),
        disabled: false,
    };
}

export function transformToRateCommentMessageFormat(isRatingGood: boolean): Message {
    return {
        id: uuid(),
        type: isRatingGood ? MessageType.RATE_COMMENT_GOOD : MessageType.RATE_COMMENT_BAD,
        content: '',
        sender: MessageSender.OPERATOR,
        time_sent: getCurrentTime(),
        disabled: false,
    };
}

export function transformToUploadMessage(file: File): Message {
    return {
        id: uuid(),
        type: MessageType.UPLOADING_FILE,
        content: '',
        sender: MessageSender.VISITOR,
        time_sent: getCurrentTime(),
        file,
    };
}

export function transformToAlwaysOnlineMessageFormat(): Message {
    return {
        id: uuid(),
        type: MessageType.ALWAYS_ONLINE,
        content: '',
        sender: MessageSender.OPERATOR,
        time_sent: getCurrentTime(),
        disabled: false,
    };
}

export const allowedPreChatFieldTypes = [
    'email',
    'name',
    'phone',
    'gdprConsent',
    'signUpNewsletter',
    PRECHAT_FIELD_TYPE_EMAIL_CONSENT,
] as const;

/**
 * @typedef PrechatFieldData
 * @property {string} type
 * @property value
 */

/**
 * @typedef PrechatFieldWithPlaceholder
 * @property {string} type
 * @property {string} placeholder
 */

/**
 * @param {PrechatFieldData[]} prechatFields
 */
function filterInvalidPrechatFieldsData(prechatFields: PrechatField[] = []): PrechatField[] {
    const emailConsent = prechatFields.find(
        field => field.type === PRECHAT_FIELD_TYPE_EMAIL_CONSENT,
    );
    if (!emailConsent) {
        return prechatFields;
    }
    // emailConsent field exists
    const email = prechatFields.find(field => field.type === 'email');
    if (!email) {
        // we do not allow displaying emailConsent and signUpNewsletter field without email field
        return prechatFields.filter(
            field =>
                field.type !== PRECHAT_FIELD_TYPE_EMAIL_CONSENT &&
                field.type !== 'signUpNewsletter',
        );
    }
    // we have email and emailConsent, validate emailConsent value
    if (emailConsent.value !== true) {
        // we do not allow displaying emailConsent field with different value than true
        return prechatFields.filter(field => field.type !== PRECHAT_FIELD_TYPE_EMAIL_CONSENT);
    }

    return prechatFields;
}

/**
 * @param {PrechatFieldWithPlaceholder[]} prechatFields
 */
function mergeSameFields(prechatFields: PrechatField[]): PrechatField[] {
    let mergedFields = prechatFields;
    const hasEmailConsentAndNewsletterField =
        mergedFields.find(field => field.type === PRECHAT_FIELD_TYPE_EMAIL_CONSENT) &&
        mergedFields.find(field => field.type === 'signUpNewsletter');
    if (hasEmailConsentAndNewsletterField) {
        mergedFields = mergedFields.filter(field => field.type !== 'signUpNewsletter');
    }
    return mergedFields;
}

/**
 * @param {PrechatFieldWithPlaceholder[]} prechatFields
 */
function reorderPrechatFields(
    prechatFields: PrechatMessage['preChatFields'],
): PrechatMessage['preChatFields'] {
    const emailConsentField = prechatFields.find(
        field => field.type === PRECHAT_FIELD_TYPE_EMAIL_CONSENT,
    );
    if (!emailConsentField) {
        return prechatFields;
    }
    return prechatFields
        .filter(field => field.type !== PRECHAT_FIELD_TYPE_EMAIL_CONSENT)
        .concat(emailConsentField);
}

export function checkFieldType(
    possibleType: string,
): possibleType is PrechatMessage['preChatFields'][0]['type'] {
    const approvedTypes = [
        'email',
        'name',
        'phone',
        'gdprConsent',
        'emailConsent',
        'signUpNewsletter',
    ];
    if (approvedTypes.indexOf(possibleType) !== -1) {
        return true;
    }
    return false;
}

export function getPreChatFields(
    preChatData: DefaultRootState['preChat']['data'],
    visitorData: Visitor,
): PrechatMessage['preChatFields'] {
    const preChatFields: PrechatMessage['preChatFields'] = [];
    let allFieldsFilled = true;
    try {
        if (!preChatData) {
            return [];
        }
        mergeSameFields(filterInvalidPrechatFieldsData(preChatData.fields)).forEach(field => {
            const fieldType = field.type;
            if (
                allowedPreChatFieldTypes.find(elem => elem === fieldType) &&
                checkFieldType(fieldType)
            ) {
                // if visitor data has already filled prechat field, do not include it in message
                if (visitorData[fieldType] && fieldType === 'emailConsent') {
                    preChatFields.push({
                        type: fieldType,
                        placeholder: `preformInput_${fieldType}`,
                        value: visitorData[fieldType],
                    });
                } else if (visitorData[fieldType] && fieldType !== 'emailConsent') {
                    preChatFields.push({
                        type: fieldType,
                        placeholder: `preformInput_${fieldType}`,
                        value: visitorData[fieldType],
                    });
                } else {
                    allFieldsFilled = false;
                    preChatFields.push({
                        type: fieldType,
                        placeholder: `preformInput_${fieldType}`,
                    });
                }
            } else if (fieldType !== 'firstmsg') {
                ravenCaptureException(`Unknown preChat field type - ${fieldType}`);
            }
        });
    } catch (e) {
        ravenCaptureException(e);
    }
    if (allFieldsFilled) {
        return [];
    }

    return reorderPrechatFields(preChatFields);
}

export function transformToPreChatMessageFormat(
    preChatData: DefaultRootState['preChat']['data'],
    visitorData: Visitor,
): Message | null {
    const preChatFields = getPreChatFields(preChatData, visitorData);
    if (preChatFields.length === 0) {
        // Do not display preChat if there are no fields
        return null;
    }
    return {
        id: uuid(),
        type: MessageType.PRECHAT,
        content: 'preChat',
        sender: MessageSender.OPERATOR,
        time_sent: getCurrentTime(),
        disabled: false,
        preChatFields,
    };
}

function checkMessageType(possibleType: string): possibleType is MessageType {
    switch (possibleType) {
        case messageTypes.cards:
            return messageTypes.cards === MessageType.CARD_GALLERY;
        case messageTypes.buttons:
            return messageTypes.buttons === MessageType.BUTTONS;
        case messageTypes.uploadedFile:
            return messageTypes.uploadedFile === MessageType.UPLOADED_FILE;
        default:
            return false;
    }
}

export function parseMessageFromSockets({
    data,
}: {
    data: MessageFromSockets;
}): undefined | Message {
    let sender = data.type;
    if (data.auto === '1') {
        sender = MessageSender.BOT;
    }
    if (Object.values(senders).indexOf(sender) === -1) {
        return undefined;
    }
    let parsed: Message | undefined;
    if (sender === senders.visitor) {
        // when merging fetched messages from visitorGetConversationHistory
        parsed = transformToVisitorMessageFormat(data);
    } else {
        const messageType = data.message?.type;
        const typeChecked = messageTypes[messageType];
        const type = checkMessageType(typeChecked) ? typeChecked : MessageType.TEXT;
        let content = data.message.message;
        if (typeof content === 'string') {
            content = content.trim();
        }
        const operatorId = data.operator_id;
        const timeSent = data.time_sent;
        const idFromServer = data.id;
        const isWaitingForAnswer = data.is_waiting_for_answer;
        let quickReplies;
        if (sender === senders.bot) {
            const hasQuickReplies =
                data.message?.quick_replies &&
                Array.isArray(data.message.quick_replies) &&
                data.message.quick_replies.length > 0;
            if (hasQuickReplies) {
                quickReplies = data.message.quick_replies;
            }
        }
        parsed = {
            id: uuid(),
            idFromServer,
            isWaitingForAnswer,
            ratingId: data.rating_id || null,
            type,
            content,
            sender,
            quickReplies,
            operator_id: operatorId,
            time_sent: timeSent,
        };
    }
    if (!parsed) {
        return undefined;
    }

    if (parsed.type === messageTypes.cards) {
        parsed = transformToCardGalleryMessage(parsed, data.message);
    } else if (parsed.type === messageTypes.buttons) {
        parsed = transformToButtonsMessage(parsed, data.message);
    } else if (isMediaUpload(parsed)) {
        parsed = transformToUploadedMessage(parsed);
    }

    return parsed;
}
