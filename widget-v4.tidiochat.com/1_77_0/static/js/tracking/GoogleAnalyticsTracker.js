/* eslint-disable no-underscore-dangle,  class-methods-use-this */
import { getKeyFromStorage, saveKeyToStorage } from '../store/savedState';
import { ravenCaptureInfo } from '../helpers/raven';

export default class GoogleAnalyticsTracker {
    constructor() {
        // eslint-disable-next-line no-console
        console.debug('GoogleAnalyticsTracker initialized');
    }

    trackEventOnce(eventName) {
        const eventId = `trackEvent_${eventName}`;
        if (getKeyFromStorage(eventId)) {
            return false;
        }
        saveKeyToStorage(eventId, 1);
        // eslint-disable-next-line no-console
        console.debug('GoogleAnalyticsTracker - trackEventOnce', eventName);
        this.trackEvent(eventName);
        return true;
    }

    trackEventOnceInInterval(eventName, interval = 24 * 60 * 60) {
        const currentTimestamp = Math.round(Date.now() / 1000);
        const eventId = `trackEvent_${eventName}`;
        try {
            const eventTimestamp = parseInt(getKeyFromStorage(eventId), 10);
            if (eventTimestamp > 1 && currentTimestamp < eventTimestamp) {
                return false;
            }
            saveKeyToStorage(eventId, currentTimestamp + interval);
        } catch (e) {
            return false;
        }
        return this.trackEvent(eventName);
    }

    trackEvent(eventName) {
        // Check support or one of 3 trackers.
        // eslint-disable-next-line no-console
        console.debug('GoogleAnalyticsTracker - trackEvent', eventName);
        try {
            if (typeof window.parent.gtag !== 'undefined') {
                window.parent.gtag('event', eventName, {
                    event_category: 'Tidio Chat',
                    non_interaction: true,
                });
            }
            if (typeof window.parent.ga !== 'undefined') {
                window.parent.ga('send', 'event', 'Tidio Chat', eventName, {
                    nonInteraction: true,
                });
            } else if (typeof window.parent._gaq !== 'undefined') {
                window.parent._gaq.push(['_trackEvent', 'Tidio Chat', eventName]);
            } else if (typeof window.parent.__gaTracker !== 'undefined') {
                window.parent.__gaTracker('send', 'event', 'Tidio Chat', eventName);
            } else if (
                typeof window.parent.dataLayer !== 'undefined' &&
                typeof window.parent.dataLayer.push !== 'undefined'
            ) {
                window.parent.dataLayer.push({ event: `Tidio Chat: ${eventName}` });
            }
        } catch (e) {
            ravenCaptureInfo(e);
        }

        return true;
    }
}
/* eslint-enable no-underscore-dangle,  class-methods-use-this */
