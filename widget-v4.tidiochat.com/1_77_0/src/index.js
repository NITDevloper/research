// eslint-disable-next-line import/no-unresolved
const io = require('socket.io-client');
// eslint-disable-next-line import/no-unresolved
const cloneDeep = require('lodash.clonedeep');

module.exports = function socketConnectionManager(
    socketsUrlParam,
    debugModeParam = false,
    additionalParametersToSet = {},
) {
    const socketsUrl = socketsUrlParam;
    const debugMode = debugModeParam;
    const additionalParameters = additionalParametersToSet;

    let listeners = [];
    let listenersCallbacks = [];
    let socket = null;
    let emitQueue = null;
    let toEmit = [];
    let runAsFirstEmitOnConnect = [];
    let beforeConnectStarts = () => {};
    const managerEventsActions = {};
    let setEmitQueueConstantParameters = () => {};
    let socketEmitWrapper = (emitName, newArgs, newAck, callback) => {
        callback(emitName, newArgs, newAck);
    };

    function isDebugMode() {
        return debugMode;
    }

    function closeConnection(closeCallback) {
        if (socket && socket.io) {
            socket.io.autoConnect = false;
        }
        if (socket && typeof socket.close === 'function') {
            socket.close();
        }
        listenersCallbacks.forEach(callback => callback());
        listenersCallbacks = [];
        if (isDebugMode()) {
            // eslint-disable-next-line no-console
            console.debug('closed!!');
        }
        if (typeof closeCallback === 'function') {
            closeCallback();
        }
    }

    function runFirstEmitFromQueue() {
        // TODO implement better queue listening on socket status or acks?
        if (socket && toEmit.length > 0) {
            const [emitName, newArgs, ack] = toEmit.shift();
            let newAck = null;
            if (ack) {
                newAck = (...ackArgs) => {
                    if (isDebugMode()) {
                        // eslint-disable-next-line no-console
                        console.debug(`ack - ${emitName}`);
                    }
                    ack(...ackArgs);
                };
            }
            socketEmitWrapper(
                emitName,
                newArgs,
                newAck,
                (emitNameCallback, newArgsCallback, newAckCallback) => {
                    socket.emit(emitNameCallback, newArgsCallback, newAckCallback);
                },
            );
            runFirstEmitFromQueue();
        }
    }
    function runAsFirstEmit(store, history, callback) {
        const toEmitQueue = emitQueue(store.getState, store.dispatch);
        const previousToEmit = cloneDeep(toEmit);
        toEmit = [];
        const data = callback(store.getState, store.dispatch);
        toEmitQueue(data.emit, ...data.args);
        toEmit = [...toEmit, ...previousToEmit];
    }

    function addToEmitQueueWithStore(currentState) {
        return function addToEmitQueue(emitName, args = {}, ack) {
            const newArgs = cloneDeep(args);
            setEmitQueueConstantParameters(newArgs, emitName, currentState);
            toEmit.push([emitName, newArgs, ack]);
            runFirstEmitFromQueue();
        };
    }

    const EmitQueue = () => (getState, dispatch) => (fn, ...args) => {
        const currentState = getState();
        return fn.apply(null, [
            addToEmitQueueWithStore(currentState),
            currentState,
            dispatch,
            ...args,
        ]);
    };

    function ListenWithStore({ getState, dispatch }, history) {
        return function listen(fn, ...args) {
            return fn.call(null, socket, getState, dispatch, history, ...args);
        };
    }

    function bindManagerHandlers(store) {
        const manager = socket.io;
        const toEmitQueue = emitQueue(store.getState, store.dispatch);
        manager.on('connect_error', error => {
            if (isDebugMode()) {
                // eslint-disable-next-line no-console
                console.debug('manager connect_error', error);
            }
            if (typeof managerEventsActions.connect_error === 'function') {
                managerEventsActions.connect_error(store, toEmitQueue, error);
            }
        });
        manager.on('connect_timeout', () => {
            if (isDebugMode()) {
                // eslint-disable-next-line no-console
                console.debug('manager connect_timeout');
            }
            if (typeof managerEventsActions.connect_timeout === 'function') {
                managerEventsActions.connect_timeout(store, toEmitQueue);
            }
        });
        manager.on('reconnect', number => {
            if (isDebugMode()) {
                // eslint-disable-next-line no-console
                console.debug('manager reconnect', number);
            }
            if (typeof managerEventsActions.reconnect === 'function') {
                managerEventsActions.reconnect(store, toEmitQueue);
            }
        });
        manager.on('reconnect_attempt', () => {
            if (isDebugMode()) {
                // eslint-disable-next-line no-console
                console.debug('manager reconnect_attempt');
            }
            if (typeof managerEventsActions.reconnect_attempt === 'function') {
                managerEventsActions.reconnect_attempt(store, toEmitQueue);
            }
        });
        manager.on('reconnecting', number => {
            if (isDebugMode()) {
                // eslint-disable-next-line no-console
                console.debug('manager reconnecting', number);
            }
            if (typeof managerEventsActions.reconnecting === 'function') {
                managerEventsActions.reconnecting(store, toEmitQueue);
            }
        });
        manager.on('reconnect_error', error => {
            if (isDebugMode()) {
                // eslint-disable-next-line no-console
                console.debug('manager reconnect_error', error);
            }
            if (typeof managerEventsActions.reconnect_error === 'function') {
                managerEventsActions.reconnect_error(store, toEmitQueue);
            }
        });
        manager.on('reconnect_failed', () => {
            if (isDebugMode()) {
                // eslint-disable-next-line no-console
                console.debug('manager reconnect_failed');
            }
            if (typeof managerEventsActions.reconnect_failed === 'function') {
                managerEventsActions.reconnect_failed(store, toEmitQueue);
            }
        });
    }

    function connectToSockets(
        store,
        history,
        connectCallback = () => {},
        disconnectCallback = () => {},
        additionalParametersAddedOnConnect = {},
    ) {
        const defaultParameters = {
            reconnection: true,
            transports: ['websocket'],
        };
        socket = io(
            socketsUrl,
            Object.assign(
                {},
                defaultParameters,
                additionalParameters,
                additionalParametersAddedOnConnect,
            ),
        );
        if (typeof beforeConnectStarts === 'function') {
            beforeConnectStarts(store.dispatch, store);
        }
        const listenWithStore = ListenWithStore(store, history);
        socket.on('connect', () => {
            if (isDebugMode()) {
                // eslint-disable-next-line no-console
                console.debug('connected to sockets');
            }

            if (runAsFirstEmitOnConnect.length > 0) {
                runAsFirstEmitOnConnect.forEach(callback =>
                    runAsFirstEmit(store, history, callback),
                );
            }
            runFirstEmitFromQueue();
            if (typeof managerEventsActions.connect === 'function') {
                const toEmitQueue = emitQueue(store.getState, store.dispatch);
                managerEventsActions.connect(
                    store,
                    toEmitQueue,
                    history,
                    connectCallback,
                    disconnectCallback,
                );
            }
        });
        socket.on('disconnect', () => {
            if (isDebugMode()) {
                // eslint-disable-next-line no-console
                console.debug('sockets disconnect');
            }
            if (typeof managerEventsActions.disconnect === 'function') {
                managerEventsActions.disconnect(store);
            }
        });

        listeners.forEach(listener => {
            const callback = listenWithStore(listener);
            if (typeof callback === 'function') {
                listenersCallbacks.push(callback);
            }
        });
        bindManagerHandlers(store);
    }

    this.setListeners = function setListeners(listenersParam) {
        listeners = listenersParam;
    };
    this.setFirstEmits = function setFirstEmits(emits) {
        runAsFirstEmitOnConnect = emits;
    };
    this.setBeforeConnectStarts = function setBeforeConnectStarts(callback) {
        beforeConnectStarts = callback;
    };
    this.closeConnection = closeConnection;

    this.setManagerEventsActions = function setManagerEventsActions(event, action) {
        managerEventsActions[event] = action;
    };

    this.emitQueue = emitQueue;

    this.setEmitQueueConstantParametersFunction = function setEmitQueueConstantParametersFunction(
        setEmitQueueConstantParametersParameter,
    ) {
        setEmitQueueConstantParameters = setEmitQueueConstantParametersParameter;
    };

    this.setSocketEmitWrapper = function setSocketEmitWrapper(socketEmitWrapperParam) {
        socketEmitWrapper = socketEmitWrapperParam;
    };

    this.connectionManager = () => {
        emitQueue = EmitQueue();

        return {
            emitQueue,
            closeConnection,
            connectToSockets,
        };
    };
};
