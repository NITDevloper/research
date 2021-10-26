import { ravenCaptureException } from './raven';
import { WIDGET_URL } from './index';

const notificationSound = new Audio();
notificationSound.src = `${WIDGET_URL}/tururu.mp3`;
notificationSound.volume = 0.7;

export function tryToPlayNotificationSound(browserName) {
    try {
        notificationSound.volume = 0;
        const promise = notificationSound.play();
        if (browserName !== 'firefox') {
            notificationSound.pause();
            if (notificationSound.load) {
                notificationSound.load();
            }
        }
        if (typeof promise !== 'undefined') {
            promise.catch(() => {
                // ravenCaptureInfo('autoplay permissions cannot be granted');
            });
        }
    } catch (e) {
        ravenCaptureException(e);
    }
}

export function playNotificationSound() {
    try {
        notificationSound.volume = 0.7;
        const promise = notificationSound.play();
        if (typeof promise !== 'undefined') {
            promise.catch(() => {
                // ravenCaptureInfo(
                //     'autoplay permissions not granted yet, notification occurred before user clicked the widget',
                // );
            });
        }
    } catch (e) {
        ravenCaptureException(e);
    }
}
