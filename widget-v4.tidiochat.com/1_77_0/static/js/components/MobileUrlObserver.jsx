import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { views, viewProptypeOneOf } from '../helpers/views';
import { setChatOpenedState } from '../store/actions';
import { addSPAAction } from '../helpers';

const parentWindowIsTop = (function isParentWindowTop() {
    try {
        return window.parent === window.top;
    } catch (e) {
        return false;
    }
})();

export const mobileWidgetHash = '#mobile-widget';

let preservedHash = null;
const preserveHashIfItExists = href => {
    if (href.includes('#') && !href.includes(mobileWidgetHash)) {
        preservedHash = href;
    }
};

const restoreHash = () => {
    let toRestore = null;
    if (preservedHash) {
        toRestore = preservedHash;
        preservedHash = null;
    }
    return toRestore;
};

let watchingUrlChange = false;

class UrlObserver extends React.Component {
    componentDidMount() {
        this.addMobileHashToCurrentLocation();
    }

    componentWillUnmount() {
        setTimeout(() => {
            try {
                const { href } = window.parent.location;
                if (href.includes(mobileWidgetHash)) {
                    const urlWithoutMobileWidgetHash =
                        restoreHash() || href.replace(mobileWidgetHash, '');
                    window.parent.history.pushState(null, '', urlWithoutMobileWidgetHash);
                }
            } catch (e) {
                //
            }
        }, 0);
    }

    addMobileHashToCurrentLocation = () => {
        try {
            if (!window.parent || !window.parent.history) {
                return false;
            }
            const { href } = window.parent.location;
            preserveHashIfItExists(href);
            if (!href.includes(mobileWidgetHash)) {
                window.parent.history.pushState(null, 'mobile-widget', mobileWidgetHash);
            }
            if (!watchingUrlChange) {
                this.watchUrlChange();
                watchingUrlChange = true;
            }
            return true;
        } catch (e) {
            return false;
        }
    };

    watchUrlChange = () => {
        addSPAAction(() => {
            setTimeout(() => {
                try {
                    const { href } = window.parent.location;
                    if (!href.includes(mobileWidgetHash)) {
                        this.props.dispatch(setChatOpenedState(false));
                    } else {
                        this.props.dispatch(setChatOpenedState(true));
                    }
                } catch (e) {
                    //
                }
            }, 0);
        });
    };

    render() {
        return null;
    }
}
UrlObserver.propTypes = {
    dispatch: PropTypes.func.isRequired,
};

const MobileUrlObserverWrapper = props =>
    parentWindowIsTop &&
    props.isMobile &&
    props.view !== views.closed &&
    props.view !== views.fly &&
    props.mobileHash && <UrlObserver dispatch={props.dispatch} />;

export default connect(store => ({
    isMobile: store.isMobile,
    view: store.view,
    mobileHash: store.mobileHash,
}))(MobileUrlObserverWrapper);

MobileUrlObserverWrapper.propTypes = {
    isMobile: PropTypes.bool.isRequired,
    view: PropTypes.oneOf(viewProptypeOneOf).isRequired,
    mobileHash: PropTypes.bool.isRequired,
    dispatch: PropTypes.func.isRequired,
};
