import { isRTL } from './translations';

export const newMessageLineHeight = 24;
const chatHeight = 647;

export const iframeViews = {
    onlyBubble: 'onlyBubble',
    onlyBubbleSmall: 'onlyBubbleSmall',
    onlyBubbleMedium: 'onlyBubbleMedium',
    onlyBubbleLarge: 'onlyBubbleLarge',
    onlySidebar: 'onlySidebar',
    bubbleWithLabel: 'bubbleWithLabel',
    chatSize1: 'chatSize1',
    chatSize2: 'chatSize2',
    chatSize3: 'chatSize3',
    mobile: 'mobile',
    dynamic: 'dynamic',
};

export const awesomeIframeStyles = {
    [iframeViews.onlyBubble]: {
        width: '94px',
        height: '94px',
        bottom: '35px',
        right: '9px',
        left: '9px',
    },
    [iframeViews.onlyBubbleSmall]: {
        width: '60px',
        height: '60px',
        bottom: '20px',
        right: '10px',
        left: '10px',
    },
    [iframeViews.onlyBubbleMedium]: {
        width: '80px',
        height: '80px',
        bottom: '10px',
    },
    [iframeViews.onlyBubbleLarge]: {
        width: '94px',
        height: '94px',
        bottom: '15px',
        right: '-7px',
        left: '-7px',
    },
    [iframeViews.bubbleWithLabel]: {
        bottom: '35px',
        right: '9px',
        left: '9px',
    },
    [iframeViews.onlySidebar]: {
        bottom: '50%',
    },
};

export const awesomeIframeRadius = isRTL() ? '30px 47px 47px 47px' : '47px 30px 47px 47px';

export const iframeSizes = {
    [iframeViews.onlyBubble]: {
        width: '112px',
        height: '140px',
    },
    [iframeViews.onlyBubbleSmall]: {
        width: '70px',
        height: '75px',
    },
    [iframeViews.onlyBubbleMedium]: {
        width: '80px',
        height: '85px',
    },
    [iframeViews.onlySidebar]: {
        width: '60px',
        height: '350px',
        bottom: '50%',
        transform: 'translateY(50%)',
    },
    [iframeViews.chatSize1]: {
        width: '450px',
        height: `${chatHeight}px`,
        maxHeight: '100%',
    },
    [iframeViews.chatSize2]: {
        width: '450px',
        height: `${chatHeight + newMessageLineHeight}px`,
        maxHeight: '100%',
    },
    [iframeViews.chatSize3]: {
        width: '450px',
        height: `${chatHeight + 2 * newMessageLineHeight}px`,
        maxHeight: '100%',
    },
    [iframeViews.mobile]: {
        width: '100%',
        height: '100%',
    },
    // use chatSize1 styles
    dynamic: {
        width: '450px',
        height: `${chatHeight}px`,
        maxHeight: '100%',
    },
};

export const getIframeSizes = iframeView =>
    iframeSizes[iframeView] || iframeSizes[iframeViews.dynamic];

export const dynamic = (width, height) => {
    let parsedWidth = width;
    if (typeof width === 'string') {
        if (!width.includes('px') && !width.includes('%')) {
            parsedWidth = `${width}px`;
        }
    }
    let parsedHeight = height;
    if (typeof height === 'string') {
        if (!height.includes('px') && !height.includes('%')) {
            parsedHeight = `${height}px`;
        }
    }
    iframeSizes.dynamic = {
        width: typeof parsedWidth === 'string' ? parsedWidth : `${parsedWidth}px`,
        height: typeof parsedHeight === 'string' ? parsedHeight : `${parsedHeight}px`,
    };
};
