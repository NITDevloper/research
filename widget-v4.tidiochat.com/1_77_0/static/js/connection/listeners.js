import {
    addMessage,
    mergeVisitor,
    operatorOpenedConversation,
    operatorLeftConversation,
    setOperatorIsTypingStatus,
    setProjectStatus,
    setWidgetMountState,
    operatorTransferredConversation,
    setBotStatus,
    updateVisitorData,
    operatorChangedStatus,
    closeSocketConnection,
    setVisitorMergedEmitQueue,
    setVisitorMessagesAsRead,
    fetchShopifyCartContent,
} from '../store/actions';
import { parseMessageFromSockets, transformToRateMessageFormat } from './parsers';
import { visitorRegister } from './emits';
import { removeSavedStateFromStorage } from '../store/savedState';

export function projectStatusUpdateListener(socket, getState, dispatch) {
    socket.on('projectDataUpdate', ({ type }) => {
        if (type === 'online' || type === 'offline') {
            dispatch(setProjectStatus(type));
        }
    });
}

export function newMessageFromSocketsListener(socket, getState, dispatch) {
    socket.on('newMessage', payload => {
        const parsedMessage = parseMessageFromSockets(payload);
        if (parsedMessage) {
            dispatch(addMessage(parsedMessage));
        }
    });
}

export function operatorIsTypingListener(socket, getState, dispatch) {
    socket.on('operatorIsTyping', ({ operator_id: operatorId }) => {
        dispatch(setOperatorIsTypingStatus(operatorId));
    });
}

export function botIsTypingListener(socket, getState, dispatch) {
    socket.on('botIsTyping', () => {
        dispatch(setOperatorIsTypingStatus(true));
    });
}

export function visitorIsBannedListener(socket, getState, dispatch) {
    socket.on('visitorIsBanned', () => {
        dispatch(closeSocketConnection());
        dispatch(setWidgetMountState(false));
    });
}

export function visitorAskForRatingListener(socket, getState, dispatch) {
    socket.on('visitorInsideAction', ({ action }) => {
        if (action !== 'visitorAskForRating') {
            return false;
        }
        const askForRating = transformToRateMessageFormat();
        dispatch(addMessage(askForRating));
        return true;
    });
}

export function visitorMergedListener(socket, getState, dispatch) {
    socket.on('visitorMerged', ({ visitor_target_id: newVisitorId }) => {
        if (newVisitorId) {
            dispatch(mergeVisitor(newVisitorId));
            dispatch(setVisitorMergedEmitQueue(visitorRegister));
        }
    });
}

export function operatorOpenConversationListener(socket, getState, dispatch) {
    socket.on('operatorOpenConversation', ({ operator_id: operatorId }) => {
        const { assignedOperators } = getState();
        const operatorAlreadyInConversation = assignedOperators.find(
            assignedOperatorId => assignedOperatorId === operatorId,
        );
        if (!operatorId || operatorAlreadyInConversation) {
            return false;
        }
        dispatch(operatorOpenedConversation(operatorId));
        return true;
    });
}

export function operatorLeaveConversationListener(socket, getState, dispatch) {
    socket.on('operatorLeaveConversation', ({ operator_id: operatorId }) => {
        if (operatorId) {
            dispatch(operatorLeftConversation(operatorId));
        }
    });
}

export function operatorTransferConversationListener(socket, getState, dispatch) {
    socket.on(
        'operatorTransferConversation',
        ({ operator_current_id: sourceOperatorId, operator_target_id: targetOperatorId }) => {
            const { assignedOperators } = getState();
            const operatorAlreadyInConversation = assignedOperators.find(
                assignedOperatorId => assignedOperatorId === targetOperatorId,
            );
            if (operatorAlreadyInConversation) {
                return false;
            }
            dispatch(operatorTransferredConversation(sourceOperatorId, targetOperatorId));
            return true;
        },
    );
}

export function botAppStartedListener(socket, getState, dispatch) {
    socket.on('botAppStarted', () => {
        dispatch(setBotStatus(true));
    });
}
export function botAppStoppedListener(socket, getState, dispatch) {
    socket.on('botAppStopped', () => {
        dispatch(setBotStatus(false));
    });
}
export function botAppTransferredListener(socket, getState, dispatch) {
    socket.on('botAppTransferred', () => {
        dispatch(setBotStatus(false));
    });
}
export function botAppSuccessListener(socket, getState, dispatch) {
    socket.on('botAppSuccess', () => {
        dispatch(setBotStatus(false));
    });
}
export function botAppFailedListener(socket, getState, dispatch) {
    socket.on('botAppFailed', () => {
        dispatch(setBotStatus(false));
    });
}

export function visitorUpdateDataListener(socket, getState, dispatch) {
    socket.on('visitorUpdateData', payload => {
        dispatch(updateVisitorData(payload, false));
    });
}

export function operatorStatusHasBeenChangedListener(socket, getState, dispatch) {
    socket.on(
        'operatorStatusHasBeenChanged',
        ({
            operator_id: operatorId,
            status,
            dnd_forced_status: dndForced,
            dnd_is_in_interval: dndInterval,
        }) => {
            const isOnline = !(Boolean(dndForced) || Boolean(dndInterval) || status === 'offline');
            dispatch(operatorChangedStatus(operatorId, isOnline));
        },
    );
}

export function visitorDeleted(socket, getState, dispatch) {
    socket.on('visitorDeleted', () => {
        dispatch(closeSocketConnection());
        dispatch(setWidgetMountState(false));
        setTimeout(() => {
            removeSavedStateFromStorage();
        }, 1000);
    });
}

export function visitorMarkMessagesAsRead(socket, getState, dispatch) {
    socket.on('markMessagesAsRead', () => {
        dispatch(setVisitorMessagesAsRead());
    });
}

export function updateCart(socket, getState, dispatch) {
    socket.on('updateCart', () => {
        const { platform } = getState();
        if (platform === 'shopify') {
            dispatch(fetchShopifyCartContent());
        }
    });
}
