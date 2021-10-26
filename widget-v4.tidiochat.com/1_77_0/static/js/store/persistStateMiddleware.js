import debounce from 'lodash.debounce';
import { loadState, persistedStateRev, saveState } from './savedState';
import {
    REPLACE_STATE_WITH_SAVED,
    VISITOR_IS_TYPING,
    showAlert,
    replaceStateWithSaved,
    TRIGGER_REPLACE_STATE_WITH_SAVED,
    SET_DRAG_AND_DROP_STATUS,
    SHOW_USER_DATA_MODAL,
} from './actions';
import { trans } from '../helpers/translations';

const debouncedSaveState = debounce(saveState, 200);
let localStorageAvailable = null;
let alertDisplayed = false;

const persistStateMiddleware = ({ getState, dispatch }) => next => action => {
    switch (action.type) {
        case VISITOR_IS_TYPING:
        case SET_DRAG_AND_DROP_STATUS:
        case SHOW_USER_DATA_MODAL:
        case REPLACE_STATE_WITH_SAVED: {
            return next(action);
        }
        case TRIGGER_REPLACE_STATE_WITH_SAVED: {
            const savedState = loadState(false);
            if (savedState && persistedStateRev.get() !== savedState.persistedStateRev) {
                dispatch(replaceStateWithSaved(savedState));
                persistedStateRev.set(savedState.persistedStateRev);
            }
            return next(action);
        }
        default: {
            const retVal = next(action);
            if (localStorageAvailable === false) {
                if (!alertDisplayed) {
                    alertDisplayed = true;
                    dispatch(
                        showAlert(
                            trans(
                                'localStorageNotAvailable',
                                null,
                                "You're viewing this page in Private/Incognito mode and your messages aren't saved when you go to other pages. Alternatively, you can enable localStorage if it's blocked in your browser.",
                            ),
                        ),
                    );
                }
                return retVal;
            }
            // we need to run plain saveState to check for localStorage availability - debounced function do not return value
            localStorageAvailable =
                localStorageAvailable === null
                    ? saveState(getState())
                    : debouncedSaveState(getState());
            return retVal;
        }
    }
};

export default persistStateMiddleware;
