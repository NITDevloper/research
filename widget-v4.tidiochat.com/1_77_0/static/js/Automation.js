import { getKeyFromStorage, saveKeyToStorage } from './store/savedState';

let botTrigger;

export default class Automation {
    constructor(
        automations = [],
        visitorId,
        botTriggerDispatch,
        projectOnline,
        hideWhenOffline,
        isChatOnSite,
    ) {
        this.automations = automations;
        this.visitorId = visitorId;
        this.projectOnline = projectOnline;
        this.hideWhenOffline = hideWhenOffline;
        this.isChatOnSite = isChatOnSite;
        this.inputChanged = this.inputChanged.bind(this);
        botTrigger = botTriggerDispatch;
        // eslint-disable-next-line no-console
        console.debug('Automation - initialized with params', this.automations, this.visitorId);
        this.initAutomations(this.automations);
    }

    setVisitorId(visitorId) {
        if (this.visitorId !== visitorId) {
            // eslint-disable-next-line no-console
            console.debug(`Automation - visitorId changed from ${this.visitorId} to ${visitorId}`);
            this.visitorId = visitorId;
        }
    }

    getAutomationData = triggerId =>
        this.automations.find(automation => automation.trigger_id === triggerId);

    filterOfflineAutomations = automationIds =>
        automationIds.filter(automationId => {
            const automation = this.getAutomationData(automationId);
            if (!automation) {
                return false;
            }
            return !automation.payload.offline_disabled;
        });

    initAutomations(data) {
        const leaveWindow = [];
        const leaveForm = [];

        // Parse socket automations to objects
        for (let i = 0; i < data.length; i += 1) {
            switch (data[i].type) {
                case 'onAbandonedForm':
                    leaveForm.push(data[i].trigger_id);
                    break;
                case 'onPointerLeftWindow':
                    leaveWindow.push(data[i].trigger_id);
                    break;
                default:
                    break;
            }
        }

        /* leaveWindow */
        // TODO: check if this shouldn't reinitiate on status change
        this.runLeaveWindow(leaveWindow);

        this.runLeaveForm(leaveForm);
    }

    // eslint-disable-next-line class-methods-use-this
    inputChanged() {
        // eslint-disable-next-line no-console
        console.debug('Automation - inputChanged');
        saveKeyToStorage('automation_formLeft', 1);
    }

    /**
     * @param {Number[]} leaveFormIds
     * @returns {boolean}
     */
    runLeaveForm(leaveFormIds) {
        let ids = leaveFormIds;
        if (!this.projectOnline) {
            ids = this.filterOfflineAutomations(leaveFormIds);
        }
        if (getKeyFromStorage('automation_formLeft') === 1 && ids.length > 0) {
            saveKeyToStorage('automation_formLeft', 0);
            this.execute(ids);
        } else {
            const forms = window.parent.document.querySelectorAll('form');

            for (let i = 0; i < forms.length; i += 1) {
                forms[i].addEventListener('submit', () =>
                    saveKeyToStorage('automation_formLeft', 0),
                );
                const notInputs = forms[i].querySelectorAll('textarea, select');
                for (let j = 0; j < notInputs.length; j += 1) {
                    notInputs[j].addEventListener('change', () => this.inputChanged());
                }
                const inputs = forms[i].querySelectorAll('input');
                for (let j = 0; j < inputs.length; j += 1) {
                    switch (inputs[j].type) {
                        case 'password':
                        case 'file':
                            // dont store its value in the future
                            inputs[j].addEventListener('change', () => this.inputChanged());
                            break;
                        case 'hidden':
                            break;
                        default:
                            inputs[j].addEventListener('change', () => this.inputChanged());
                            break;
                    }
                }
            }
        }
        return true;
    }

    /**
     * @param {Number[]} leaveWindowIds
     * @returns {boolean}
     */
    runLeaveWindow(leaveWindowIds) {
        let ids = leaveWindowIds;
        if (!this.projectOnline) {
            ids = this.filterOfflineAutomations(leaveWindowIds);
        }
        let documentBody = null;
        if (document?.body) {
            documentBody = document.body;
        }
        if (window.parent?.document?.body) {
            documentBody = window.parent.document.body;
        }
        if (documentBody) {
            documentBody.addEventListener('mouseenter', () => {
                clearTimeout(this.windowLeft);
            });
            documentBody.addEventListener('mouseout', event => {
                const from = event.relatedTarget || event.toElement;
                if (!from || from.nodeName === 'HTML') {
                    if (ids.length > 0) {
                        clearTimeout(this.windowLeft);
                        this.windowLeft = setTimeout(() => {
                            this.execute(ids);
                        }, 5000);
                    }
                }
            });
        }
        return true;
    }

    // execute hook
    execute(ids) {
        // stop executing botTrigger when project is offline and widget is hidden
        const shouldTrigger = !(this.hideWhenOffline && !this.projectOnline) || this.isChatOnSite;
        if (shouldTrigger) {
            // eslint-disable-next-line no-console
            console.debug('Automation - execute', ids);
            botTrigger(ids);
        }
    }
}
