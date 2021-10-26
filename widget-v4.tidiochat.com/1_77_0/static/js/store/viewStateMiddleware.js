import { ADD_MESSAGE, SEND_MESSAGE_FROM_VISITOR, setView, setMessageForFly } from './actions';
import { views } from '../helpers/views';

const viewStateMiddleware = ({ getState, dispatch }) => next => action => {
    switch (action.type) {
        case ADD_MESSAGE: {
            const state = getState();
            if (state.isSoundEnabled && state.notificationSnoozed) {
                return next(action);
            }
            const { type: messageType } = action.message;
            if (state.view === views.closed) {
                const shouldOpenChatView =
                    state.newMessageDisabled || messageType === 'rateConversation';
                const view = shouldOpenChatView ? views.chat : views.fly;
                setTimeout(() => {
                    dispatch(setMessageForFly(action.message));
                    dispatch(setView(view));
                }, 0);
            } else if (state.view === views.fly) {
                const shouldOpenChatView = messageType === 'rateConversation';
                if (shouldOpenChatView) {
                    setTimeout(() => {
                        dispatch(setView(views.chat));
                    }, 0);
                }
            }
            return next(action);
        }
        case SEND_MESSAGE_FROM_VISITOR: {
            const state = getState();
            if (state.view !== views.chat) {
                dispatch(setView(views.chat));
            }
            return next(action);
        }
        default: {
            return next(action);
        }
    }
};

export default viewStateMiddleware;
