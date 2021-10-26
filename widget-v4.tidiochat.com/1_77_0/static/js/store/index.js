/* global APP_VERSION_WEBPACK */
import { applyMiddleware, compose, createStore } from 'redux';
import Raven from 'raven-js';
import createRavenMiddleware from 'raven-for-redux';
import reducer, { defaultState } from './reducer';
import {
    persistedStateLoaded,
    setWidgetMountState,
    compareTidioIdentifyData,
    initializeVisitorData,
    dataImportedFromOldWidget,
    setPreviewData,
    updateVisitorUrl,
    replaceStateWithSaved,
} from './actions';
import connectionManager from '../connection/socketsConnection';
import { rebuildStateIfVersionsDiffer, loadState } from './savedState';
import socketEmitsMiddleware from './socketEmitsMiddleware';
import reducerSideEffectsMiddleware from './reducerSideEffectsMiddleware';
import viewStateMiddleware from './viewStateMiddleware';
import persistStateMiddleware from './persistStateMiddleware';
import {
    extractPublickeyFromScriptTag,
    getTidioIdentifyData,
    isInPreviewMode,
    isInSandboxMode,
    addSPAAction,
    isInTestingMode,
    IS_LOCAL_PROD_BUILD,
    isMobile,
    getCurrentUrl,
    isLaunchedFromWebdriver,
} from '../helpers';
import { setCurrentTranslations } from '../helpers/translations';
import bindTidioChatApiMethods from './tidioChatApiHelper';
import importOldWidgetData, { getMessagesCountInOldWidget } from './oldWidgetSavedStateAdapter';
import { initializeVisitor } from '../visitor';
import { ravenCaptureException } from '../helpers/raven';
import { mobileWidgetHash } from '../components/MobileUrlObserver';

let composeEnhancers = compose;
if (process.env.NODE_ENV === 'development' || IS_LOCAL_PROD_BUILD) {
    composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
}

function initializeStore() {
    if (process.env.NODE_ENV !== 'development' && !IS_LOCAL_PROD_BUILD) {
        Raven.config(process.env.NEW_WIDGET_RAVEN_WIDGET_DSN_PUBLIC, {
            release: APP_VERSION_WEBPACK,
            ignoreErrors: [],
            ignoreUrls: [/safari-extension/],
        }).install();
    }
    const isPreviewMode = isInPreviewMode();
    const isTestingMode = isInTestingMode();

    const publicKey = extractPublickeyFromScriptTag();
    if (isLaunchedFromWebdriver()) {
        return undefined;
    }
    if (!(isPreviewMode || isTestingMode) && publicKey === false) {
        // we're not in preview mode but publicKey is false, abort
        return undefined;
    }

    const isSandboxMode = isInSandboxMode();

    let persistedState;
    if (!isPreviewMode && !isSandboxMode && !isTestingMode) {
        persistedState = loadState();
    }

    // TODO delete after migration from old widget
    let dataFromOldWidgetImported = false;
    if (!isPreviewMode && !isSandboxMode) {
        if (!persistedState) {
            const importedData = importOldWidgetData();
            if (importedData) {
                dataFromOldWidgetImported = true;
                persistedState = importedData;
            }
        } else {
            const oldMessagesCount = getMessagesCountInOldWidget();
            if (oldMessagesCount !== false) {
                if (
                    typeof oldMessagesCount === 'number' &&
                    (oldMessagesCount > persistedState.importedMessagesCount ||
                        !persistedState.importedMessagesCount)
                ) {
                    // eslint-disable-next-line no-console
                    console.debug('import based on messages count');
                    const importedData = importOldWidgetData();
                    if (importedData) {
                        const { visitor, importedMessagesCount } = importedData;
                        dataFromOldWidgetImported = true;
                        persistedState = {
                            ...persistedState,
                            visitor,
                            importedMessagesCount,
                        };
                    }
                }
            }
        }
    }

    if (persistedState) {
        persistedState = rebuildStateIfVersionsDiffer(persistedState, defaultState);
    }
    const middlewares = [viewStateMiddleware, reducerSideEffectsMiddleware];
    const previewModeData = window.parent.document.tidioChatPreviewModeData;
    if (isPreviewMode && previewModeData) {
        // allow for premiddleware injected from preview mode
        if (typeof previewModeData.preMiddleware === 'function') {
            middlewares.unshift(previewModeData.preMiddleware);
        }
    }

    if (!isPreviewMode && !isTestingMode) {
        middlewares.push(socketEmitsMiddleware(connectionManager));
    }
    if (process.env.NODE_ENV !== 'development') {
        middlewares.push(createRavenMiddleware(Raven));
    }
    if (!isPreviewMode && !isSandboxMode && !isTestingMode) {
        middlewares.push(persistStateMiddleware);
    }

    const store = createStore(
        reducer,
        persistedState,
        composeEnhancers(applyMiddleware(...middlewares)),
    );

    if (isTestingMode) {
        import(/* webpackChunkName: "visualRegresionHelpers" */ './visualRegresionHelpers').then(
            ({ default: loadStateFromPayload }) => {
                const parsed = loadStateFromPayload();
                store.dispatch(replaceStateWithSaved(parsed));
            },
        );
    }

    if (process.env.NODE_ENV !== 'development') {
        const storeState = store.getState();
        Raven.setTagsContext({
            publicKey: storeState.publicKey,
            visitorId: storeState.visitor.id,
            originalVisitorId: storeState.visitor.originalVisitorId,
            url: getCurrentUrl(),
        });
        const visitorEmail = storeState.visitor.email;
        const visitorName = storeState.visitor.name;
        const visitorData = {
            id: storeState.visitor.id,
        };
        if (visitorEmail) {
            visitorData.email = visitorEmail;
        }
        if (visitorName) {
            visitorData.username = visitorName;
        }
        Raven.setUserContext(visitorData);
    }
    if (persistedState) {
        store.dispatch(persistedStateLoaded(persistedState));
    } else {
        store.dispatch(initializeVisitorData(initializeVisitor()));
    }

    const identifyData = getTidioIdentifyData();
    store.dispatch(compareTidioIdentifyData(identifyData));

    // send new url to sockets on some SPA pages
    try {
        if (window.parent?.history) {
            /*
             *
             * We are adding support for window.parent.onpushstate (which is
             * not a native browser function) to native pushState. Later in
             * code we can add function to window.parent.onpushstate and it
             * will be run on every pushState on SPA pages (for example those
             * using react-router). To add a new function to url change action
             * there is a new function - addSPAAction.
             *
             */

            const oldHistory = window.parent.history;
            const { pushState } = window.parent.history;
            window.parent.history.pushState = function pushFunc() {
                try {
                    if (typeof window.onpushstate === 'function') {
                        // eslint-disable-next-line prefer-rest-params
                        window.onpushstate(arguments);
                    }
                } catch (e) {
                    //
                }
                // eslint-disable-next-line prefer-rest-params
                return pushState.apply(oldHistory, arguments);
            };
        }
    } catch (e) {
        // in case we dont have permissions to access parent history
        ravenCaptureException("Can't access window.parent when trying to patch pushState", {
            e,
        });
    }

    const updateUrl = () => {
        setTimeout(() => {
            const url = getCurrentUrl();
            if (!url.includes(mobileWidgetHash)) {
                store.dispatch(updateVisitorUrl(url));
            }
        });
    };

    addSPAAction(updateUrl);

    if (!isPreviewMode) {
        connectionManager.connectToSockets(
            store,
            window.parent.history,
            () => {}, // connect callback
            () => {}, // disconnect callback
            {
                query: {
                    ppk: publicKey,
                    device: isMobile() ? 'mobile' : 'desktop',
                },
            },
        );
    }
    bindTidioChatApiMethods(store);

    if (process.env.NODE_ENV === 'development' && isSandboxMode) {
        // eslint-disable-next-line no-console
        console.debug('%csandbox mode', 'background: pink; color: #fff; font-size:24px');
    }

    if (isPreviewMode) {
        // eslint-disable-next-line no-console
        console.debug(
            'preview mode, go to http://localhost:3000/preview/:publicKey to connect to WS',
        );
        store.dispatch(setPreviewData('previewModeEnabled', true));
        window.parent.addEventListener(
            'message',
            event => {
                if (
                    !(
                        event.origin.includes('tidiochat.com') ||
                        event.origin.includes('tidio.com') ||
                        event.origin.includes('tidio.dev')
                    ) &&
                    event.origin !== 'http://tidio.local'
                ) {
                    return false;
                }
                let { data } = event;
                data = JSON.parse(data);
                // eslint-disable-next-line no-console
                console.debug('setPreviewData', data);
                store.dispatch(setPreviewData(data.prop, data.payload));
                return true;
            },
            false,
        );
        if (previewModeData) {
            if (previewModeData.preformData) {
                store.dispatch(setPreviewData('preChatData', previewModeData.preformData));
            }
            if (previewModeData.operators) {
                store.dispatch(setPreviewData('operators', previewModeData.operators));
            }
            if (previewModeData.color) {
                store.dispatch(setPreviewData('color', previewModeData.color));
            }
            if (previewModeData.bannerImage) {
                store.dispatch(setPreviewData('bannerImage', previewModeData.bannerImage));
            }
            if (previewModeData.translations) {
                setCurrentTranslations(
                    previewModeData.translations,
                    'en', // TODO change for getUserLanguage(),
                );
            }
            if (previewModeData.sidebar !== undefined) {
                store.dispatch(setPreviewData('sidebar', previewModeData.sidebar));
            }
            if (previewModeData.messages) {
                store.dispatch(setPreviewData('messages', previewModeData.messages));
            }
            if (previewModeData.previewView) {
                store.dispatch(setPreviewData('previewView', previewModeData.previewView));
            }
            if (previewModeData.hideWhenOffline) {
                store.dispatch(setPreviewData('hideWhenOffline', previewModeData.hideWhenOffline));
            }
            if (previewModeData.widgetLabelStatus) {
                store.dispatch(
                    setPreviewData('widgetLabelStatus', previewModeData.widgetLabelStatus),
                );
            }
            if (previewModeData.widgetSoundStatus === false) {
                store.dispatch(
                    setPreviewData('widgetSoundStatus', previewModeData.widgetSoundStatus),
                );
            }
            if (previewModeData.chatOnSite) {
                store.dispatch(setPreviewData('chatOnSite', previewModeData.chatOnSite));
            }
            if (previewModeData.messageForFly) {
                store.dispatch(setPreviewData('messageForFly', previewModeData.messageForFly));
            }
        }
        store.dispatch(setWidgetMountState());
    }

    // TODO delete after migration from old widget
    if (dataFromOldWidgetImported) {
        store.dispatch(dataImportedFromOldWidget());
    }

    return store;
}

export default initializeStore;
