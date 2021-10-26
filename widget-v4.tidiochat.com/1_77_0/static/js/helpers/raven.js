import Raven from 'raven-js';

// copy from ./index.js because i do not think that it is worth creating another helpers file to omit deps cycle
const IS_LOCAL_PROD_BUILD =
    // eslint-disable-next-line no-undef
    typeof PRODUCTION_DEVELOPMENT_BUILD === 'boolean' && PRODUCTION_DEVELOPMENT_BUILD === true;

export const ravenCaptureException = (message, extra = {}) => {
    if (process.env.NODE_ENV === 'development' || IS_LOCAL_PROD_BUILD) {
        // eslint-disable-next-line no-console
        console.log('raven exception', message, extra);
    } else {
        Raven.captureException(message, {
            extra,
            level: 'warning',
        });
    }
};

export const ravenCaptureInfo = (message, extra = {}) => {
    if (process.env.NODE_ENV === 'development' || IS_LOCAL_PROD_BUILD) {
        // eslint-disable-next-line no-console
        console.log('raven info', message, extra);
    } else {
        Raven.captureMessage(message, {
            level: 'info',
            extra,
        });
    }
};
