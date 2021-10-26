/* eslint-disable class-methods-use-this */

import { getCurrentUrl } from '../helpers/index';
import { getKeyFromStorage, removeKeyFromStorage, saveKeyToStorage } from '../store/savedState';

function isLoginForm(form) {
    const loginInput = form.querySelectorAll("input[type='text'], input[type='email']");
    const passwordInput = form.querySelectorAll("input[type='password']");
    if (
        form.querySelectorAll("input[type='hidden'][name='form_type'][value='customer_login']")
            .length === 1
    ) {
        return true;
    }
    if (form.id === 'customer_login' || form.id === 'login') {
        return true;
    }
    if (loginInput && loginInput.length === 1 && passwordInput && passwordInput.length === 1) {
        return true;
    }
    return false;
}
function isRegisterForm(form) {
    const loginInput = form.querySelectorAll("input[type='text'], input[type='email']");
    const passwordInput = form.querySelectorAll("input[type='password']");
    if (
        form.querySelectorAll("input[type='hidden'][name='form_type'][value='create_customer']")
            .length === 1
    ) {
        return true;
    }
    if (form.id === 'create_customer' || form.id === 'register') {
        return true;
    }
    if (loginInput && loginInput.length >= 1 && passwordInput && passwordInput.length === 2) {
        return true;
    }
    if (form.action && typeof form.action === 'string' && form.action.indexOf('register') > -1) {
        return true;
    }
    return false;
}

function isForgotPasswordForm(form) {
    // const loginInput = form.querySelectorAll("input[type='text'], input[type='email']");
    // const passwordInput = form.querySelectorAll("input[type='password']");
    if (
        form.querySelectorAll(
            "input[type='hidden'][name='form_type'][value='recover_customer_password']",
        ).length === 1
    ) {
        return true;
    }
    if (form.id === 'forgot_password') {
        return true;
        // } else if (loginInput && loginInput.length == 1 && passwordInput && passwordInput.length === 0) { // this is probably too wide
        //     return true;
    }
    if (
        form.action &&
        typeof form.action === 'string' &&
        (form.action.indexOf('forgot_password') > -1 || form.action.indexOf('forgot-password') > -1)
    ) {
        return true;
    }
    return false;
}

class GenericTracker {
    constructor(genericEvents) {
        const availableEvents = {
            contact_visited: {
                eventName: 'generic.contact_visited',
                func: this.contactVisited,
            },
            liked_on_facebook: {
                eventName: 'generic.liked_on_facebook',
                func: this.likedOnFacebook,
            },
            unliked_on_facebook: {
                eventName: 'generic.unliked_on_facebook',
                func: this.unLikedOnFacebook,
            },
            logged_in: {
                eventName: 'generic.logged_in',
                func: this.loggedIn,
            },
            registered: {
                eventName: 'generic.registered',
                func: this.registered,
            },
            forgot_password: {
                eventName: 'generic.forgot_password',
                func: this.forgotPassword,
            },
            email_filled: {
                eventName: 'generic.email_filled',
                func: this.emailFilled,
            },
        };
        // eslint-disable-next-line no-console
        console.debug('GenericTracker initialized with events', genericEvents);
        this.initGenericEvents(genericEvents, availableEvents);
    }

    initGenericEvents(genericEvents, availableEvents) {
        Object.keys(availableEvents).forEach(availableEvent => {
            if (genericEvents[availableEvents[availableEvent].eventName]) {
                // eslint-disable-next-line no-param-reassign
                availableEvents[availableEvent].func = availableEvents[availableEvent].func.bind(
                    this,
                );
                availableEvents[availableEvent].func(availableEvents[availableEvent].eventName);
            }
        });
    }

    /* generic.contact_visited */
    contactVisited(eventName) {
        let isContactPage = false;
        // // checking if page contains contact form
        // const allContactForms = window.parent.document.querySelectorAll('form#contact_form, form#contact-form');
        // if (!isContactPage && allContactForms && allContactForms.length > 0) {
        //     isContactPage = true;
        // }

        // checking if page url contains certain string
        const url = getCurrentUrl();
        if (
            !isContactPage &&
            url.match(/[^a-zA-Z0-9](contact|contacto|contato|contatto|kontakt)([^a-zA-Z0-9]|$)/)
        ) {
            isContactPage = true;
        }
        if (isContactPage) {
            window.tidioChatApi.track(eventName);
        }
    }

    /* generic.liked_on_facebook */
    likedOnFacebook(eventName) {
        if (
            typeof window.parent.FB !== 'undefined' &&
            window.parent.FB.Event &&
            window.parent.FB.Event.subscribe
        ) {
            window.parent.FB.Event.subscribe('edge.create', () => {
                window.tidioChatApi.track(eventName);
            });
        }
    }

    /* generic.unliked_on_facebook */
    unLikedOnFacebook(eventName) {
        if (
            typeof window.parent.FB !== 'undefined' &&
            window.parent.FB.Event &&
            window.parent.FB.Event.subscribe
        ) {
            window.parent.FB.Event.subscribe('edge.remove', () => {
                window.tidioChatApi.track(eventName);
            });
        }
    }

    /* generic.logged_in */
    loggedIn(eventName) {
        // if our track request did not succeed run it here
        if (getKeyFromStorage('automation_loggedInExecute') === 1) {
            window.tidioChatApi.track(eventName);
            removeKeyFromStorage('automation_loggedInExecute');
        }
        let isLoginPage = false;
        // checking if page url contains certain string
        const url = getCurrentUrl();
        if (
            !isLoginPage &&
            url.match(/[^a-zA-Z0-9](login|logowanie|zaloguj|signin)([^a-zA-Z0-9]|$)/)
        ) {
            isLoginPage = true;
        }
        // get all forms on page and search for login forms
        const loginForms = [];
        const loginFormsByFields = window.parent.document.querySelectorAll('form');
        if (loginFormsByFields) {
            for (let i = 0; i < loginFormsByFields.length; i += 1) {
                const form = loginFormsByFields[i];
                if (isLoginForm(form) && !isRegisterForm(form) && !isForgotPasswordForm(form)) {
                    loginForms.push(form);
                }
            }
        }
        if (isLoginPage && loginForms.length === 0) {
            // eslint-disable-next-line no-console
            console.debug('GenericTracker - we are on login page but did not find any proper form');
        }
        if (loginForms.length > 0) {
            loginForms.forEach(form => {
                form.addEventListener('submit', () => {
                    // set flag to execute track event in case track request will fail
                    if (getKeyFromStorage('automation_loggedInExecute') !== 1) {
                        saveKeyToStorage('automation_loggedInExecute', 1);
                        window.tidioChatApi.track(eventName, {}, () => {
                            // clear flag when succeeded
                            removeKeyFromStorage('automation_loggedInExecute');
                        });
                    }
                });
            });
        }
    }

    /* generic.registered */
    registered(eventName) {
        // if our track request did not succeed run it here
        if (getKeyFromStorage('automation_registeredExecute') === 1) {
            window.tidioChatApi.track(eventName);
            removeKeyFromStorage('automation_registeredExecute');
        }
        let isRegisterPage = false;
        // checking if page url contains certain string

        const url = getCurrentUrl();
        if (
            !isRegisterPage &&
            url.match(/[^a-zA-Z0-9](register|rejestracja|zarejestruj|signup)([^a-zA-Z0-9]|$)/)
        ) {
            isRegisterPage = true;
        }
        // get all forms on page and search for login forms
        const registerForms = [];
        const registerFormsByFields = window.parent.document.querySelectorAll('form');
        if (registerFormsByFields) {
            for (let i = 0; i < registerFormsByFields.length; i += 1) {
                const form = registerFormsByFields[i];
                if (!isLoginForm(form) && isRegisterForm(form) && !isForgotPasswordForm(form)) {
                    registerForms.push(form);
                }
            }
        }
        if (isRegisterPage && registerForms.length === 0) {
            // eslint-disable-next-line no-console
            console.debug(
                'GenericTracker - we are on register page but did not find any proper form',
            );
        }
        if (registerForms.length > 0) {
            registerForms.forEach(form => {
                form.addEventListener('submit', () => {
                    // set flag to execute track event in case track request will fail
                    if (getKeyFromStorage('automation_registeredExecute') !== 1) {
                        saveKeyToStorage('automation_registeredExecute', 1);
                        window.tidioChatApi.track(eventName, {}, () => {
                            // clear flag when succeeded
                            removeKeyFromStorage('automation_registeredExecute');
                        });
                    }
                });
            });
        }
    }

    /* generic.forgot_password */
    forgotPassword(eventName) {
        // if our track request did not succeed run it here
        if (getKeyFromStorage('automation_forgotPasswordExecute') === 1) {
            window.tidioChatApi.track(eventName);
            removeKeyFromStorage('automation_forgotPasswordExecute');
        }
        let isForgotPassword = false;
        // checking if page url contains certain string
        const url = getCurrentUrl();
        if (
            !isForgotPassword &&
            url.match(/[^a-zA-Z0-9](forgot-password|forgotten)([^a-zA-Z0-9]|$)/)
        ) {
            isForgotPassword = true;
        }
        // get all forms on page and search for login forms
        const forgotPasswordForms = [];
        const forgotPasswordFormsByFields = window.parent.document.querySelectorAll('form');
        if (forgotPasswordFormsByFields) {
            for (let i = 0; i < forgotPasswordFormsByFields.length; i += 1) {
                const form = forgotPasswordFormsByFields[i];
                if (!isLoginForm(form) && !isRegisterForm(form) && isForgotPasswordForm(form)) {
                    forgotPasswordForms.push(form);
                }
            }
        }
        if (isForgotPassword && forgotPasswordForms.length === 0) {
            // eslint-disable-next-line no-console
            console.debug(
                'GenericTracker - we are on forgot password page but did not find any proper form',
            );
        }
        if (forgotPasswordForms.length > 0) {
            forgotPasswordForms.forEach(form => {
                form.addEventListener('submit', () => {
                    // set flag to execute track event in case track request will fail
                    if (getKeyFromStorage('automation_forgotPasswordExecute') !== 1) {
                        saveKeyToStorage('automation_forgotPasswordExecute', 1);
                        window.tidioChatApi.track(eventName, {}, () => {
                            // clear flag when succeeded
                            removeKeyFromStorage('automation_forgotPasswordExecute');
                        });
                    }
                });
            });
        }
    }

    /* generic.email_filled */
    emailFilled(eventName) {
        const fields = [];
        const emailInputs = window.parent.document.querySelectorAll(
            "input[type='text'], input[type='email']",
        );
        if (emailInputs) {
            for (let i = 0; i < emailInputs.length; i += 1) {
                const field = emailInputs[i];
                if (field.type === 'email') {
                    fields.push(field);
                } else if (field.name.match(/email|mail|e-mail/)) {
                    fields.push(field);
                }
            }
        }
        fields.forEach(field => {
            field.addEventListener('change', ev => {
                // eslint-disable-next-line no-useless-escape
                const re = /^(([^<>()\[\]\.,;:\s@\"]+(\.[^<>()\[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\.,;:\s@\"]+\.)+[^<>()[\]\.,;:\s@\"]{2,})$/i;
                if (ev?.target?.value && re.test(ev.target.value)) {
                    window.tidioChatApi.track(eventName);
                }
            });
        });
    }
}

export default GenericTracker;
/* eslint-enable class-methods-use-this */
