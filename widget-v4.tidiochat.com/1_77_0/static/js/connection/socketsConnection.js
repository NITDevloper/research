import SocketConnectionManager from 'tidio-chat-connection-manager';
import {
    projectStatusUpdateListener,
    newMessageFromSocketsListener,
    operatorIsTypingListener,
    botIsTypingListener,
    visitorAskForRatingListener,
    visitorIsBannedListener,
    visitorMergedListener,
    operatorOpenConversationListener,
    operatorLeaveConversationListener,
    operatorTransferConversationListener,
    botAppStartedListener,
    botAppStoppedListener,
    botAppTransferredListener,
    botAppSuccessListener,
    botAppFailedListener,
    visitorUpdateDataListener,
    operatorStatusHasBeenChangedListener,
    visitorDeleted,
    visitorMarkMessagesAsRead,
    updateCart,
} from './listeners';
import { visitorIdentify, visitorRegister, visitorLastSeenUpdate } from './emits';
import { ravenCaptureException } from '../helpers/raven';

let visitorLastSeenUpdateClearId = null;
let waitingForPrechatAck = false;
const preChatAckEmitsQueue = [];

// do we want to set debug flag in more smart way?
const socketsConnection = new SocketConnectionManager(process.env.NEW_WIDGET_URL_SOCKET, false, {
    reconnectionDelay: 0.5 * 1000,
    reconnectionDelayMax: 15 * 1000,
    randomizationFactor: 0.8,
    reconnectionAttempts: 100,
    transports: ['websocket'],
});

socketsConnection.setEmitQueueConstantParametersFunction((newArgs, emitName, currentState) => {
    const argsRef = newArgs;
    if (
        emitName !== 'visitorRegister' &&
        emitName !== 'visitorIdentify' &&
        emitName !== 'visitorLastSeenUpdate'
    ) {
        if (!argsRef.visitorId) {
            argsRef.visitorId = currentState.visitor.id;
        }
        if (!argsRef.projectPublicKey) {
            argsRef.projectPublicKey = currentState.publicKey;
        }
        if (!argsRef.device) {
            argsRef.device = currentState.isMobile ? 'mobile' : 'desktop';
        }
    }
});

socketsConnection.setListeners([
    projectStatusUpdateListener,
    newMessageFromSocketsListener,
    operatorIsTypingListener,
    botIsTypingListener,
    visitorAskForRatingListener,
    visitorIsBannedListener,
    visitorMergedListener,
    operatorOpenConversationListener,
    operatorLeaveConversationListener,
    operatorTransferConversationListener,
    botAppStartedListener,
    botAppStoppedListener,
    botAppTransferredListener,
    botAppSuccessListener,
    botAppFailedListener,
    visitorUpdateDataListener,
    operatorStatusHasBeenChangedListener,
    visitorDeleted,
    visitorMarkMessagesAsRead,
    updateCart,
]);

function onPreChatAck(preChatAckArgs, callback) {
    try {
        waitingForPrechatAck = false;
        const [, value] = preChatAckArgs;
        const { visitor_id: visitorId } = value;
        while (preChatAckEmitsQueue.length !== 0) {
            const [emitName, newArgs, newAck] = preChatAckEmitsQueue.shift();
            const argsWithModifiedVisitorId = {
                ...newArgs,
                visitorId,
            };
            callback(emitName, argsWithModifiedVisitorId, newAck);
        }
    } catch (e) {
        ravenCaptureException(e);
    }
}

socketsConnection.setManagerEventsActions('connect', (store, toEmitQueue) => {
    const { tidioIdentifyChanged } = store.getState();
    if (tidioIdentifyChanged) {
        toEmitQueue(visitorIdentify, () => {
            toEmitQueue(visitorRegister, socketsConnection.closeConnection);
        });
    } else {
        toEmitQueue(visitorRegister, socketsConnection.closeConnection);
    }
    if (visitorLastSeenUpdateClearId) {
        clearInterval(visitorLastSeenUpdateClearId);
        visitorLastSeenUpdateClearId = null;
    }
    visitorLastSeenUpdateClearId = setInterval(() => {
        toEmitQueue(visitorLastSeenUpdate);
    }, 30 * 1000);
});

socketsConnection.setSocketEmitWrapper((emitName, newArgs, ack, callback) => {
    let newAck = ack;
    if (emitName === 'visitorPreForm') {
        waitingForPrechatAck = true;
        newAck = (...ackArgs) => {
            ack(...ackArgs);
            onPreChatAck(ackArgs, callback);
        };
    }
    if (waitingForPrechatAck && emitName === 'visitorNewMessage') {
        preChatAckEmitsQueue.push([emitName, newArgs, newAck]);
    } else {
        callback(emitName, newArgs, newAck);
    }
});

const connectionManager = socketsConnection.connectionManager();

export default connectionManager;
