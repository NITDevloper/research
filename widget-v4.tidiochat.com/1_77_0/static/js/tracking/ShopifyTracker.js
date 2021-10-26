/* eslint-disable class-methods-use-this */
import { shopifyCartRequest } from '../helpers/apiData';
import { getKeyFromStorage, removeKeyFromStorage, saveKeyToStorage } from '../store/savedState';
import { ravenCaptureException } from '../helpers/raven';

import { shopifyOrderCreated } from '../store/actions';

class ShopifyTracker {
    constructor({ dispatch, mode }) {
        this.dispatch = dispatch;
        this.addToCart = this.addToCart.bind(this);
        this.addToCartAjax = this.addToCartAjax.bind(this);
        this.cartUpdated = this.cartUpdated.bind(this);
        this.abandonedCart = this.abandonedCart.bind(this);
        this.goToCart = this.goToCart.bind(this);
        this.login = this.login.bind(this);
        this.removeFromCart = this.removeFromCart.bind(this);
        this.removeFromCartClick = this.removeFromCartClick.bind(this);
        this.createAccount = this.createAccount.bind(this);
        this.paymentCharged = this.paymentCharged.bind(this);
        this.goToPayment = this.goToPayment.bind(this);
        this.goToCheckout = this.goToCheckout.bind(this);
        this.rebindEvents = this.rebindEvents.bind(this);
        this.initjQuery = this.initjQuery.bind(this);
        this.initWithoutjQuery = this.initWithoutjQuery.bind(this);
        this.addToCardFinished = false;
        this.rebindShopifyEvents = 0;
        this.selectors = [
            {
                selector: "form[action='/cart/add']",
                func: this.addToCart,
                event: 'submit',
            },
            {
                selector: "form[action*='account/login']",
                func: this.login,
                event: 'submit',
            },
            {
                selector: "a[href*='/cart/change'], td a[onclick^='remove_item']",
                func: this.removeFromCartClick,
                event: 'click',
            },
            {
                selector: 'input[name=checkout], button[name=checkout], a.checkout-button',
                func: this.goToCheckout,
                event: 'click',
            },
            {
                selector: "form[action='/checkout']",
                func: this.goToCheckout,
                event: 'submit',
            },
            {
                selector: '#commit-button',
                func: this.goToPayment,
                event: 'click',
            },
        ];
        this.routes = {
            cart: window.parent.location.pathname.indexOf('/cart') > -1,
            thankYou:
                window.parent.location.pathname.indexOf('/thank_you') > -1 &&
                window.parent.location.pathname.split('/').length === 5,
        };
        if (typeof window.parent.Shopify !== 'undefined') {
            this.simpleMode();

            if (mode === 'advanced') {
                // eslint-disable-next-line no-console
                console.debug('ShopifyTracker initialized');
                this.advancedMode();
            }
        }
    }

    advancedMode() {
        if (getKeyFromStorage('addToCart')) {
            removeKeyFromStorage('addToCart');
            this.trackEvent('add_to_cart');
        }

        if (this.routes.cart && !getKeyFromStorage('removeFromCart')) {
            this.goToCart();
        }

        if (getKeyFromStorage('removeFromCart')) {
            this.removeFromCart();
        }

        this.cartAjaxInit();
        this.rebindEvents();

        if (
            window.parent.jQuery &&
            typeof window.parent.jQuery(window.parent.document).ajaxSend === 'function'
        ) {
            // it should always be initialized if jQuery is available. There is no proper equivalent in js.
            window.parent.jQuery(window.parent.document).ajaxSend((event, jqxhr, settings) => {
                if (!settings.data) {
                    return false;
                }
                if (settings.url.indexOf('/cart/add.js') > -1) {
                    this.addToCartAjax();
                }
                return true;
            });
            window.parent.jQuery(window.parent.document).ajaxComplete((event, jqxhr, settings) => {
                if (settings?.url) {
                    if (settings.url.indexOf('/cart/add.js') > -1) {
                        this.addToCardFinished = true;
                    }
                    if (this.addToCardFinished && settings.url.indexOf('/cart') > -1) {
                        this.addToCardFinished = false;
                        // we must use setTimeout here because on ajax complete there is no data in DOM
                        setTimeout(this.rebindEvents, 777);
                    }
                    if (settings.url.indexOf('/cart.js') > -1) {
                        if (jqxhr?.responseJSON) {
                            saveKeyToStorage('cartData', {
                                itemCount: jqxhr.responseJSON.item_count,
                            });
                        }
                    }
                }
                return true;
            });
        }
    }

    simpleMode() {
        if (this.routes.thankYou) {
            this.paymentCharged();
        }
    }

    rebindEvents() {
        clearTimeout(this.rebindShopifyEvents);
        if (window.parent.jQuery?.fn) {
            this.initjQuery();
        } else {
            this.initWithoutjQuery();
        }
    }

    initjQuery() {
        try {
            for (let i = 0; i < this.selectors.length; i += 1) {
                const selectedNode = window.parent.jQuery(this.selectors[i].selector);
                if (selectedNode) {
                    if (typeof selectedNode.on === 'function') {
                        selectedNode.off(this.selectors[i].event, this.selectors[i].func);
                        selectedNode.on(this.selectors[i].event, this.selectors[i].func);
                    } else if (typeof selectedNode.live === 'function') {
                        selectedNode.die(this.selectors[i].event, this.selectors[i].func);
                        selectedNode.live(this.selectors[i].event, this.selectors[i].func);
                    }
                }
            }
            // create account
            const form = window.parent
                .jQuery('input[name=form_type][value=create_customer]')
                .closest('form');
            if (form) {
                if (typeof form.on === 'function') {
                    form.off('submit', this.createAccount);
                    form.on('submit', this.createAccount);
                } else if (typeof form.live === 'function') {
                    form.die('submit', this.createAccount);
                    form.live('submit', this.createAccount);
                }
            }
        } catch (error) {
            this.initWithoutjQuery();
        }
    }

    initWithoutjQuery() {
        /* some global selectors */
        for (let i = 0; i < this.selectors.length; i += 1) {
            const selectedElements = window.parent.document.querySelectorAll(
                this.selectors[i].selector,
            );
            if (selectedElements && selectedElements.length > 0) {
                for (let j = 0; j < selectedElements.length; j += 1) {
                    selectedElements[j].removeEventListener(
                        this.selectors[i].event,
                        this.selectors[i].func,
                    );
                    selectedElements[j].addEventListener(
                        this.selectors[i].event,
                        this.selectors[i].func,
                    );
                }
            }
        }
        // create acc
        const allForms = window.parent.document.querySelectorAll('form');
        for (let i = 0; i < allForms.length; i += 1) {
            const createCustomer = allForms[i].querySelectorAll(
                'input[name=form_type][value=create_customer]',
            );
            if (createCustomer && createCustomer.length > 0) {
                allForms[i].removeEventListener('submit', this.createAccount);
                allForms[i].addEventListener('submit', this.createAccount);
            }
        }
    }

    trackEvent(event, successCallback = () => {}) {
        // eslint-disable-next-line no-console
        console.debug('ShopifyTracker - executing event', `shopify.${event}`);
        window.tidioChatApi.track(`shopify.${event}`, {}, successCallback);
    }

    cartAjaxInit() {
        let cartData = getKeyFromStorage('cartData');
        if (!cartData) {
            saveKeyToStorage('cartData', {
                itemCount: 0,
            });
            cartData = getKeyFromStorage('cartData');
        }
        shopifyCartRequest()
            .then(data => {
                const urlsWhichShouldNotTriggerAbandonedCart = [
                    new RegExp(/\/account\/login(.*?)/, 'i'),
                    new RegExp(/\/account\/register(.*?)/, 'i'),
                    new RegExp(/\/challenge(.*?)/, 'i'),
                ];
                const shouldAbandonedCartBeTriggered =
                    urlsWhichShouldNotTriggerAbandonedCart
                        .map(pattern => pattern.test(window.parent.location.href))
                        .filter(regexpResult => regexpResult).length === 0;
                if (getKeyFromStorage('goToCheckout') && shouldAbandonedCartBeTriggered) {
                    removeKeyFromStorage('goToCheckout');
                    if (data.item_count) {
                        this.abandonedCart();
                    }
                    saveKeyToStorage('cartData', {
                        itemCount: 0,
                    });
                }
                // if (+cartData.itemCount > +data.item_count && +data.item_count > 0) {
                //     this.removeFromCart();
                // }
                if (+cartData.itemCount !== +data.item_count) {
                    // if (!getKeyFromStorage('removeFromCart')) { //this should be reworked if we want to have that
                    //     // this.cartUpdated();
                    // }
                    // removeKeyFromStorage('removeFromCart');
                    saveKeyToStorage('cartData', {
                        itemCount: data.item_count,
                    });
                }
                return true;
            })
            .catch(er => {
                // eslint-disable-next-line no-console
                console.debug('ShopifyTracker', er);
            });
    }

    addToCartAjax() {
        this.trackEvent('add_to_cart');
    }

    addToCart() {
        saveKeyToStorage('addToCart', true);
        clearTimeout(this.rebindShopifyEvents);
        if (!window.parent.jQuery) {
            this.rebindShopifyEvents = setTimeout(this.rebindEvents, 1500);
        }
    }

    cartUpdated() {
        this.trackEvent('cart_updated');
    }

    abandonedCart() {
        this.trackEvent('abandoned_cart');
    }

    goToCart() {
        this.trackEvent('go_to_cart');
    }

    login() {
        this.trackEvent('login');
    }

    removeFromCartClick() {
        saveKeyToStorage('removeFromCart', true);
    }

    removeFromCart() {
        removeKeyFromStorage('removeFromCart');
        this.trackEvent('remove_from_cart');
    }

    createAccount() {
        this.trackEvent('create_account');
    }

    paymentCharged() {
        this.trackEvent('payment_charged');

        try {
            const { customer_id: customerId, order_id: orderId } = window.parent.Shopify.checkout;
            const lastActivity = getKeyFromStorage('lastActivity') || null;

            this.dispatch(
                shopifyOrderCreated({
                    customerId,
                    orderId,
                    lastActivity,
                }),
            );
        } catch (e) {
            ravenCaptureException(e);
        }
    }

    goToPayment() {
        this.trackEvent('go_to_payment');
    }

    goToCheckout() {
        saveKeyToStorage('goToCheckout', true);
        this.trackEvent('go_to_checkout');
    }
}

export default ShopifyTracker;
/* eslint-enable class-methods-use-this */
