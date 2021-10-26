import { ravenCaptureException } from './raven';

let documentRef = null;
let windowRef = null;

export function setDocumentAndWindowForFocusManager(doc, win) {
    documentRef = doc;
    windowRef = win;
}

export const getIframeRef = () => (windowRef ? windowRef.frameElement : null);
export const getWindowRef = () => windowRef;
export const getDocumentRef = () => documentRef;

export function focusNewMessageTextarea() {
    if (!documentRef) {
        return false;
    }
    const ref = documentRef.getElementById('new-message-textarea');
    if (ref) {
        ref.focus();
    }
    return true;
}

export function focusLastActiveInput() {
    if (!documentRef) {
        return false;
    }
    try {
        const inputs = documentRef.querySelectorAll(
            '.always-online input:not(.disabled), .pre-chat input:not(.disabled)',
        );
        if (inputs.length > 0) {
            const lastInput = inputs[inputs.length - 1];
            lastInput.focus();
            const lastInputParent = lastInput.parentNode.parentNode;
            const handleAnimationEnd = () => {
                lastInputParent.removeEventListener('animationend', handleAnimationEnd);
                lastInputParent.classList.remove('shake');
            };
            lastInputParent.classList.add('shake');
            lastInputParent.addEventListener('animationend', handleAnimationEnd);
        }
        return true;
    } catch (e) {
        ravenCaptureException(e);
        return false;
    }
}

export function scrollConversationToRateMessageButtons() {
    if (!documentRef) {
        return false;
    }
    try {
        const buttons = documentRef.querySelector('.message-with-buttons:not(.buttons-hidden)');
        if (buttons) {
            if (buttons.scrollIntoView) {
                try {
                    buttons.scrollIntoView({ behavior: 'smooth' });
                } catch (e) {
                    buttons.scrollIntoView();
                }
            }
        }
        return true;
    } catch (e) {
        ravenCaptureException(e);
        return false;
    }
}
