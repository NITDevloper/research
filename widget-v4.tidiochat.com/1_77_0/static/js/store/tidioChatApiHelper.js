import {
    addMessage,
    addVisitorTags,
    sendMessageFromVisitor,
    setContactProperties,
    setChatOpenedState,
    setFeaturesFromApi,
    setWidgetColor,
    setWidgetMountState,
    tidioChatApiFunctionCall,
    tidioChatApiTrack,
    updateVisitorData,
} from './actions';
import { inferWidgetColor } from '../helpers';
import { transformToSystemMessageFormat } from '../connection/parsers';
// import { ravenCaptureInfo } from '../helpers/raven';

const bindFunctions = dispatch => ({
    open: () => dispatch(setChatOpenedState(true)),
    close: () => dispatch(setChatOpenedState(false)),
    display: (shouldDisplay = true) => dispatch(setWidgetMountState(shouldDisplay)),
    show: () => dispatch(setWidgetMountState(true)),
    hide: () => dispatch(setWidgetMountState(false)),
    setColorPalette: color => dispatch(setWidgetColor(inferWidgetColor([color]))),
    track: (eventName, eventData, successCallback) =>
        dispatch(tidioChatApiTrack(eventName, eventData, successCallback)),
    messageFromVisitor: message => dispatch(sendMessageFromVisitor(message)),
    messageFromOperator: message => dispatch(addMessage(transformToSystemMessageFormat(message))),
    setVisitorData: updateData => dispatch(updateVisitorData(updateData)),
    addVisitorTags: updateData => dispatch(addVisitorTags(updateData)),
    setContactProperties: properties => dispatch(setContactProperties(properties)),
    setFeatures: features => dispatch(setFeaturesFromApi(features)),
});

const depreciatedFunctions = {
    popUpOpen: 'open',
    popUpHide: 'close',
    chatDisplay: 'display',
    setColorPallete: 'setColorPalette',
};

const wrapApiFunctionCall = (functionName, boundFunction, dispatch) =>
    function apiFunctionCall(args) {
        dispatch(tidioChatApiFunctionCall(functionName, args));
        boundFunction.call(null, args);
        // ravenCaptureInfo(`tidioChatApi function call - ${functionName}`, {
        //     args,
        // });
    };

function bindTidioChatApiMethods({ dispatch }) {
    const boundFunctions = bindFunctions(dispatch);
    Object.keys(boundFunctions).forEach(functionName => {
        const boundFunction = boundFunctions[functionName];
        window.tidioChatApi[functionName] = wrapApiFunctionCall(
            functionName,
            boundFunction,
            dispatch,
        );
    });
    // Depreciated methods
    // Bind the methods again as they were assigned to var, not reference
    Object.keys(depreciatedFunctions).forEach(functionName => {
        const boundFunction = boundFunctions[depreciatedFunctions[functionName]];
        window.tidioChatApi[functionName] = wrapApiFunctionCall(
            functionName,
            boundFunction,
            dispatch,
        );
    });

    // window.tidioChatApi.open = bindMethod('open', dispatch); //open(dispatch);
    // window.tidioChatApi.close = close(dispatch);
    // window.tidioChatApi.display = display(dispatch);
    // window.tidioChatApi.show = show(dispatch);
    // window.tidioChatApi.hide = hide(dispatch);
    // window.tidioChatApi.setColorPalette = setColorPalette(dispatch);
    // window.tidioChatApi.track = track(dispatch);
    // window.tidioChatApi.messageFromVisitor = messageFromVisitor(dispatch);
    // window.tidioChatApi.messageFromOperator = messageFromOperator(dispatch);
    // window.tidioChatApi.setVisitorData = setVisitorData(dispatch);
    //
    // // Depreciated methods
    // // Bind the methods again as they were assigned to var, not reference
    // window.tidioChatApi.popUpOpen = window.tidioChatApi.open;
    // window.tidioChatApi.popUpHide = window.tidioChatApi.hide;
    // window.tidioChatApi.chatDisplay = window.tidioChatApi.display;
    // window.tidioChatApi.setColorPallete = window.tidioChatApi.setColorPalette;
}

export default bindTidioChatApiMethods;
