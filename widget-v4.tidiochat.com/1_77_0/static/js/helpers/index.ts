import lodashCloneDeep from 'lodash.clonedeep';
import uuid from 'uuid/v4';
import {
    DefaultRootState,
    GetOsReturnData,
    Os,
    TidioIdentify,
    CustomDocument,
    CustomWindow,
    Browser,
    ParsedUrl,
    Truthy,
} from '../store/typings';
import { ravenCaptureException } from './raven';

declare let window: CustomWindow;

function extractPublicKeyFromDocumentVariable(
    selector: Document & { tidioChatCode?: string },
): string | false {
    try {
        if (selector.tidioChatCode) {
            return selector.tidioChatCode;
        }
    } catch (e) {
        return false;
    }
    return false;
}

export function extractPublickeyFromScriptTag(selector = window.parent.document): string | false {
    try {
        let scriptTag: HTMLScriptElement | null = selector.querySelector(
            'script[src*="code.tidio.co"]',
        );
        if (!scriptTag) {
            scriptTag = selector.querySelector(
                'script[src*="code.tidio"],script[src*="code"][src*="tidio"],script[src*="uploads/redirect"][src*="tidio"]',
            );
        }
        if (scriptTag === null) {
            const projectKeyFromDocumentVar = extractPublicKeyFromDocumentVariable(selector);
            if (projectKeyFromDocumentVar) {
                return projectKeyFromDocumentVar;
            }
            return false;
        }
        const regex = /([a-z0-9]+)(\.js|$)/g;
        const matches = regex.exec(scriptTag.src);
        if (!matches || matches.length === 0 || matches[1].length !== 32) {
            return false;
        }
        return matches[1];
    } catch (e) {
        ravenCaptureException(e);
        return false;
    }
}

let isPreviewMode: boolean | null = null;
export function isInPreviewMode(): boolean {
    if (isPreviewMode === null) {
        try {
            isPreviewMode = window.parent.document.tidioChatPreviewMode === true;
        } catch (e) {
            ravenCaptureException(e);
            isPreviewMode = false;
        }
    }
    return isPreviewMode;
}

let isTestingMode: boolean | null = null;
export function isInTestingMode(): boolean {
    if (isTestingMode === null) {
        try {
            isTestingMode = window.parent.document.tidioChatTestingMode === true;
        } catch (e) {
            ravenCaptureException(e);
            isTestingMode = false;
        }
    }
    return isTestingMode;
}

let isSandboxMode: boolean | null = null;
export function isInSandboxMode(): boolean {
    try {
        const userDocument = window.parent.document;
        if (isSandboxMode === null) {
            isSandboxMode = Boolean(
                userDocument.tidioSandbox && Object.keys(userDocument.tidioSandbox).length > 0,
            );
        }
    } catch (e) {
        isSandboxMode = false;
    }
    return isSandboxMode;
}

let isTour: boolean | null = null;
export function isInTour(): boolean {
    try {
        if (isTour === null) {
            isTour = Boolean(window.parent.document.tidioChatPreviewModeData?.isInTour);
        }
    } catch (e) {
        ravenCaptureException(e);
        isTour = false;
    }
    return isTour;
}

export function getSandboxParams(): CustomDocument['tidioSandbox'] | Record<string, never> {
    return window.parent.document.tidioSandbox || {};
}

export function isChatOnSite(): boolean {
    try {
        return window.parent.document.tidioChatOnSite === true;
    } catch (e) {
        ravenCaptureException(e);
        return false;
    }
}

export function generateHash(): string {
    return uuid().replace(/-/g, '');
}

export function getCurrentTime(): number {
    return Math.floor(new Date().getTime() / 1000);
}

export function isMobile(): boolean {
    try {
        return Boolean(
            navigator.userAgent &&
                /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
                    navigator.userAgent,
                ),
        );
    } catch (e) {
        // eslint-disable-next-line no-console
        console.debug('isMobile error', e);
        return false;
    }
}

export function isiPad(): boolean {
    try {
        return navigator.appVersion.indexOf('iPad') !== -1;
    } catch (error) {
        return false;
    }
}

export function getOs(): GetOsReturnData {
    let osCode = Os.UNKNOWN;
    if (navigator.appVersion.indexOf('Win') !== -1) {
        osCode = Os.WINDOWS;
    } else if (navigator.appVersion.indexOf('Android') !== -1) {
        osCode = Os.ANDROID;
    } else if (
        navigator.appVersion.indexOf('iPad') !== -1 ||
        navigator.appVersion.indexOf('iPhone') !== -1
    ) {
        osCode = Os.IOS;
    } else if (navigator.appVersion.indexOf('Mac') !== -1) {
        osCode = Os.OSX;
    } else if (navigator.appVersion.indexOf('X11') !== -1) {
        osCode = Os.UNIX;
    } else if (navigator.appVersion.indexOf('Linux') !== -1) {
        osCode = Os.LINUX;
    }
    return {
        name: osCode,
        version: '',
    };
}

export function cloneDeep<T>(toClone: T): T {
    return lodashCloneDeep(toClone);
}

export function shallowIsObjectEqual(
    a: Record<string, unknown>,
    b: Record<string, unknown>,
): boolean {
    if (typeof a !== typeof b) {
        return false;
    }
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) {
        return false;
    }
    // eslint-disable-next-line no-restricted-syntax
    for (const prop in a) {
        if (Object.prototype.hasOwnProperty.call(a, prop)) {
            if (a[prop] !== b[prop]) {
                return false;
            }
        }
    }
    return true;
}

export function getTidioIdentifyData(): Record<string, string> | false | null {
    try {
        let currentWindow = window;
        let identifyData = null;
        const maxChecks = 3;
        let i = 0;
        while (!identifyData && i < maxChecks) {
            identifyData = currentWindow.document.tidioIdentify;
            if (currentWindow === window.top) {
                break;
            }
            if (!identifyData) {
                currentWindow = window.parent;
            }
            i += 1;
        }

        return identifyData || false;
    } catch (e) {
        ravenCaptureException(e);
        return null;
    }
}

export const defaultTidioIdentifyKeys = {
    distinct_id: null,
    email: '',
    name: '',
    phone: '',
    tags: null,
};

const allowedVisitorUpdateDataKeys = {
    properties: {},
    emailConsent: true,
};

function getFilteredObject(
    toFilter: Record<string, unknown>,
    filteredKeys: string[],
): Record<string, unknown> | false {
    const filtered = filteredKeys.reduce(
        (obj, key) => ({
            ...obj,
            [key]: toFilter[key],
        }),
        {},
    );
    if (Object.keys(filtered).length === 0) {
        return false;
    }
    return filtered;
}

export function filterTidioIdentifyData(
    toFilter: Record<string, unknown> = {},
): TidioIdentify | false {
    if (!toFilter) {
        return false;
    }
    return getFilteredObject(
        toFilter,
        Object.keys(toFilter).filter(
            updateDataKey =>
                Object.keys(defaultTidioIdentifyKeys).includes(updateDataKey) &&
                Boolean(toFilter[updateDataKey]),
        ),
    );
}

export function filterVisitorUpdateData(
    toFilter = {},
): false | ReturnType<typeof getFilteredObject> {
    if (!toFilter) {
        return false;
    }
    return getFilteredObject(
        toFilter,
        Object.keys(toFilter).filter(updateDataKey =>
            [
                ...Object.keys(defaultTidioIdentifyKeys),
                ...Object.keys(allowedVisitorUpdateDataKeys),
            ].includes(updateDataKey),
        ),
    );
}

export function filterApiFeatures(toFilter = {}): false | ReturnType<typeof getFilteredObject> {
    if (!toFilter) {
        return false;
    }
    const allowedKeys = { widgetLabelStatus: false, mobileHash: false };
    return getFilteredObject(
        toFilter,
        Object.keys(toFilter).filter(updateDataKey =>
            [...Object.keys(allowedKeys)].includes(updateDataKey),
        ),
    );
}

export function isValidEmail(testString: string): boolean {
    // First step (quicker)
    if (testString.indexOf('@') === -1 || testString.indexOf('.') === -1) {
        return false;
    }
    // Second step (slowest)
    // eslint-disable-next-line no-useless-escape
    const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(testString);
}

export const isValidMobilePhone = (number: string): boolean =>
    /^(\+?\d+[ -]?)?(\(\d+\))?( ?\/ ?)?([\s-.]?\d{1,5}){5,}.*\d$/.test(number || '');

export const getUserLanguage = (): string => {
    try {
        const userDocument = window.parent.document;
        if (userDocument.tidioChatLang) {
            const lang = userDocument.tidioChatLang;
            if (typeof lang === 'string') {
                return lang.toLowerCase();
            }
        }
        if (navigator.language && typeof navigator.language === 'string') {
            return navigator.language.toLowerCase();
        }
        if (
            navigator.languages &&
            Array.isArray(navigator.languages) &&
            navigator.languages.length > 0
        ) {
            return navigator.languages[0].toLowerCase();
        }
        return 'en';
    } catch (e) {
        // TODO think how to send to sentry but without sideeffects - this function is called from reducer
        ravenCaptureException(e);
        return 'en';
    }
};

export function inferWidgetColor(colorArray: string[]): DefaultRootState['widgetColor'] {
    if (colorArray[0] === colorArray[1] || colorArray.length !== 4) {
        return [colorArray[0], colorArray[0], colorArray[2] || '#fff', '#020610'];
    }

    const widgetColorPresets: DefaultRootState['widgetColor'][] = [
        ['#0a0e88', '#00b1ce', '#fff', '#020610'],
        ['#19025c', '#6e28bf', '#fff', '#020610'],
        ['#31003e', '#c3286e', '#fff', '#020610'],
        ['#98033a', '#f74f28', '#fff', '#020610'],
        ['#047c8d', '#2ff289', '#fff', '#020610'],
    ];

    switch (colorArray[0]) {
        case '#0048ea': {
            return widgetColorPresets[0];
        }
        case '#7d2dff': {
            return widgetColorPresets[1];
        }
        case '#b22cd4': {
            return widgetColorPresets[2];
        }
        case '#f72749': {
            return widgetColorPresets[3];
        }
        case '#00b6bf': {
            return widgetColorPresets[4];
        }
        default: {
            return colorArray as DefaultRootState['widgetColor'];
        }
    }
}

export function adjustOldGradientsColors(
    colors: DefaultRootState['widgetColor'],
): DefaultRootState['widgetColor'] {
    if (colors[0] === colors[1]) {
        return colors;
    }
    const oldGradients = [
        ['#0048ea', '#1ce2ff'],
        ['#7d2dff', '#1f6eff'],
        ['#b22cd4', '#f0397a'],
        ['#f72749', '#f78320'],
        ['#00b6bf', '#9be68d'],
    ];
    const newGradients = ['#0a0e88', '#19025c', '#31003e', '#98033a', '#047c8d'];
    let adjusted;
    /* eslint-disable prefer-destructuring */
    switch (colors[0]) {
        case newGradients[0]:
            adjusted = oldGradients[0];
            break;
        case newGradients[1]:
            adjusted = oldGradients[1];
            break;
        case newGradients[2]:
            adjusted = oldGradients[2];
            break;
        case newGradients[3]:
            adjusted = oldGradients[3];
            break;
        case newGradients[4]:
            adjusted = oldGradients[4];
            break;

        default:
            adjusted = [colors[0], colors[1]];
            break;
        /* eslint-enable prefer-destructuring */
    }
    return [adjusted[0], adjusted[1], colors[2], colors[3]];
}

export function hexToRgba(hexParam: string, opacity: number): string {
    let hex = hexParam;
    try {
        const result = `rgba(${(hex = hex.replace('#', ''))
            .match(new RegExp(`(.{${hex.length / 3}})`, 'g'))
            ?.map(color => parseInt(hex.length % 2 ? color + color : color, 16))
            .concat(opacity || 1)
            .join(',')})`;
        return result || hexParam;
    } catch (e) {
        ravenCaptureException(e);
        return hex;
    }
}
export function colorLuminance(hex: string, lum: number): string {
    try {
        // validate hex string
        let hexString = String(hex).replace(/[^0-9a-f]/gi, '');
        if (hexString.length < 6) {
            hexString =
                hexString[0] +
                hexString[0] +
                hexString[1] +
                hexString[1] +
                hexString[2] +
                hexString[2];
        }
        const lumNumber = lum || 0;

        // convert to decimal and change luminosity
        let rgb = '#';
        let c;
        let i = 0;
        for (i = 0; i < 3; i += 1) {
            c = parseInt(hexString.substr(i * 2, 2), 16);
            c = Math.round(Math.min(Math.max(0, c + c * lumNumber), 255)).toString(16);
            rgb += `00${c}`.substr(c.length);
        }

        return rgb;
    } catch (e) {
        ravenCaptureException(e);
        return hex;
    }
}
export const addSPAAction = (callback: () => void): void => {
    try {
        if (window.parent) {
            if (typeof window.parent.onpopstate === 'function') {
                // onpopstate runs when hash changes
                const onPopState = window.parent.onpopstate;
                window.parent.onpopstate = (...args): void => {
                    callback();
                    if (typeof onPopState === 'function') {
                        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                        // @ts-ignore
                        onPopState(args);
                    }
                };
            } else {
                const onHashChange = window.parent.onhashchange;
                window.parent.onhashchange = (...args): void => {
                    callback();
                    if (typeof onHashChange === 'function') {
                        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                        // @ts-ignore
                        onHashChange(args);
                    }
                };
            }
        }
        // lets add it to widget window
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const onPushState = window.onpushstate;
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        window.onpushstate = (...args): void => {
            callback();
            if (typeof onPushState === 'function') {
                onPushState(args);
            }
        };
    } catch (e) {
        // in case we dont have permissions to access parent history
        ravenCaptureException("Can't access window.parent when trying to add SPA actions", {
            e,
        });
    }
};

export const platforms = {
    wordpress: 'wordpress',
    shopify: 'shopify',
    others: 'others',
};

export const platformProptypeOneOf = Object.values(platforms);

export const IS_LOCAL_PROD_BUILD =
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    // eslint-disable-next-line no-undef
    typeof PRODUCTION_DEVELOPMENT_BUILD === 'boolean' && PRODUCTION_DEVELOPMENT_BUILD === true;

export const WIDGET_URL = IS_LOCAL_PROD_BUILD
    ? `${process.env.NEW_WIDGET_URL_WIDGET}/dist/`
    : process.env.NEW_WIDGET_URL_WIDGET;

export const getCurrentUrl = (): string => {
    try {
        if (window.parent.document.tidioLocationURL) {
            return window.parent.document.tidioLocationURL;
        }
        return window.parent.location.href;
    } catch (e) {
        return '';
    }
};

export const getCurrentHostname = (): string => {
    try {
        if (window.parent.document.tidioLocationURL) {
            const parser = document.createElement('a');
            parser.href = window.parent.document.tidioLocationURL;
            return parser.hostname;
        }
        const parent = window.parent.location;
        return `${parent.hostname}`;
    } catch (e) {
        return '';
    }
};

export const getBrowser = (): Browser => {
    const { appName, userAgent } = navigator;

    let Match = userAgent.match(
        /(crios|opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i,
    );
    let temporary;

    try {
        if (Match && /trident/i.test(userAgent)) {
            temporary = /\brv[ :]+(\d+)/g.exec(userAgent) || [];
            Match[1] = 'IE';
            Match[2] = temporary[1] || '';
        }

        if (Match && Match[1] === 'Chrome') {
            temporary = userAgent.match(/\b(OPR|Edge)\/(\d+)/);
            if (temporary !== null) {
                temporary[1] = temporary[1].replace('OPR', 'Opera');
                Match = temporary;
            }
        }

        // For Chrome on iPhone
        if (Match && Match[1] === 'CriOS') {
            Match[1] = 'Chrome';
        }

        temporary = userAgent.match(/version\/([.\d]+)/i);
        if (Match && temporary !== null) {
            // eslint-disable-next-line prefer-destructuring
            Match[2] = temporary[1];
        }

        if (Match) {
            Match = [Match[1], Match[2]];
        } else {
            Match = [`${appName}-?`, navigator.appVersion];
        }
        return {
            name: Match[0],
            version: parseFloat(Match[1]),
        };
    } catch (e) {
        return {
            name: '',
            version: 0,
        };
    }
};

export const parseUrl = (url: string): ParsedUrl | null => {
    if (!url) {
        return null;
    }
    try {
        if (!url.includes('http://') && !url.includes('https://') && !url.startsWith('//')) {
            return parseUrl(`https://${url}`);
        }
        const anchor = document.createElement('a');
        anchor.href = url;
        const { protocol, host, pathname, search, hash } = anchor;
        return { protocol, host, pathname, search, hash };
    } catch (e) {
        return null;
    }
};

export const getFullParsedUrl = (url: string): string => {
    const parsedUrl = parseUrl(url);
    return parsedUrl
        ? `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`
        : '';
};

export const isSameHost = (firstUrl: string, secondUrl: string): boolean => {
    if (!firstUrl || !secondUrl) {
        return false;
    }
    try {
        const firstParsed = parseUrl(firstUrl);
        const secondParsed = parseUrl(secondUrl);
        return firstParsed?.host === secondParsed?.host;
    } catch (e) {
        return false;
    }
};

export function isLaunchedFromWebdriver(): boolean {
    function isTidioDomain(): boolean {
        let domain = '';
        try {
            domain = getCurrentHostname();
        } catch {
            return false;
        }
        const tidiochat = domain.match(/tidiochat\.com/);
        if (tidiochat) {
            return true;
        }
        const dev = domain.match(/tidio\.dev/);
        if (dev) {
            return true;
        }
        const tidio = domain.match(/tidio\.com/);
        if (tidio) {
            return true;
        }
        return false;
    }
    if (isTidioDomain()) {
        return false;
    }

    return Boolean(navigator.webdriver);
}

export const openLink = (url: string): void => {
    const urlOnSameHost = isSameHost(getCurrentUrl(), url);

    try {
        if (urlOnSameHost) {
            window.top.location.replace(url);
        } else {
            window.open(url);
        }
    } catch (e) {
        window.open(url);
    }
};

export function truthy<T>(value: T): value is Truthy<T> {
    return Boolean(value);
}

export function isSupportProject(publicKey: DefaultRootState['publicKey']): boolean {
    return process.env.NEW_WIDGET_SUPPORT_PUBLIC_KEY === publicKey;
}
