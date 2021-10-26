import React from 'react';
import { render, unmountComponentAtNode } from 'react-dom';
import { Provider } from 'react-redux';
import LazyWidgetIframe from './components/LazyWidgetIframe';
import { getIsChatOnSite } from './store/selectorsTS';
import { isInPreviewMode } from './helpers';

const renderWidget = store =>
    render(
        <Provider store={store}>
            <LazyWidgetIframe />
        </Provider>,
        window.parent.document.getElementById('tidio-chat'),
    );

window.requestIdleCallback =
    window.requestIdleCallback ||
    function(cb) {
        // eslint-disable-next-line no-var
        var start = Date.now();
        // eslint-disable-next-line prefer-arrow-callback
        return setTimeout(function() {
            cb({
                didTimeout: false,
                // eslint-disable-next-line object-shorthand
                timeRemaining: function() {
                    return Math.max(0, 50 - (Date.now() - start));
                },
            });
        }, 1);
    };

window.cancelIdleCallback =
    window.cancelIdleCallback ||
    function(id) {
        clearTimeout(id);
    };

// setTimeout here is to split initial script execution into smaller chunks
window.requestIdleCallback(
    () => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires,global-require
        const initializeStore = require('./store').default;
        window.requestIdleCallback(
            () => {
                const store = initializeStore();
                window.requestIdleCallback(
                    () => {
                        if (store) {
                            const state = store.getState();
                            const isChatOnSite = getIsChatOnSite(state);
                            const isInPreview = isInPreviewMode();
                            const { document } = window.parent;
                            const div = document.createElement('div');
                            div.id = 'tidio-chat';
                            if (!isChatOnSite || isInPreview) {
                                document.body.appendChild(div);
                                renderWidget(store);
                            } else {
                                const refNode = document.body.querySelector('.right');
                                const centerContainer = document.createElement('section');
                                centerContainer.className = 'center';
                                centerContainer.appendChild(div);
                                refNode.parentNode.insertBefore(centerContainer, refNode);
                                renderWidget(store);
                            }

                            if (process.env.NODE_ENV === 'development' && module.hot) {
                                if (module.hot) {
                                    window.addEventListener('beforeunload', () => {
                                        const node = window.parent.document.getElementById(
                                            'tidio-chat',
                                        );
                                        unmountComponentAtNode(node);
                                        node.remove();
                                    });
                                }
                            }
                        }
                    },
                    { timeout: 50 },
                );
            },
            { timeout: 100 },
        );
    },
    { timeout: 100 },
);
