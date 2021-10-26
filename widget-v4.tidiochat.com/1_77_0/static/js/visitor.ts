import jstz from 'jstz';

import {
    extractPublickeyFromScriptTag,
    generateHash,
    getCurrentTime,
    getOs,
    isMobile,
    getUserLanguage,
    isChatOnSite,
    getBrowser,
    getCurrentUrl,
} from './helpers';

import { Visitor, VisitorMetadata } from './store/typings';

function getVisitorId(): string {
    return generateHash();
}

export function generateVisitorMetadata(): VisitorMetadata {
    const browser = getBrowser();
    const os = getOs();
    let timezone = '';
    try {
        timezone = jstz.determine().name();
    } catch (error) {
        //
    }
    return {
        ip: null,
        lang: getUserLanguage(),
        browser: browser.name,
        browser_version: browser.version,
        url: getCurrentUrl(),
        refer: window.parent.document.referrer,
        os_name: os.name,
        os_version: os.version,
        screen_width: window.screen.width,
        screen_height: window.screen.height,
        user_agent: window.navigator.userAgent,
        timezone,
        mobile: isMobile(),
        is_chat_on_site: isChatOnSite(),
    };
}

export function initializeVisitor(): Visitor & VisitorMetadata {
    const originalVisitorId = getVisitorId();
    return {
        id: originalVisitorId,
        originalVisitorId,
        distinct_id: null,
        country: null,
        name: '',
        city: null,
        browser_session_id: '', // Visitor.getBrowserSessionId(),
        created: getCurrentTime(),
        email: '',
        project_public_key: extractPublickeyFromScriptTag(), // TODO link to store.publicKey
        phone: '',
        // tags: null, ??
        ...generateVisitorMetadata(),
    };
}
