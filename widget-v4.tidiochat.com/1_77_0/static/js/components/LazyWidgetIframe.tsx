import React, { Suspense } from 'react';
import { useSelector } from 'react-redux';
import { DefaultRootState } from '../store/typings';
import { getIsChatOnSite } from '../store/selectorsTS';

const WidgetIframe = React.lazy(() =>
    import(/* webpackChunkName: "WidgetIframe" */ './WidgetIframe'),
);

function LazyWidgetIframe(): null | React.ReactElement {
    const isMounted = useSelector((store: DefaultRootState) => store.isMounted);
    const hideWhenOffline = useSelector((store: DefaultRootState) => store.hideWhenOffline);
    const isProjectOnline = useSelector((store: DefaultRootState) => store.isProjectOnline);
    const isChatOnSite = useSelector(getIsChatOnSite);

    const shouldHideWhenOffline = hideWhenOffline && !isProjectOnline && !isChatOnSite;
    if (!isMounted || shouldHideWhenOffline) {
        return null;
    }

    return (
        <Suspense fallback={null}>
            <WidgetIframe />
        </Suspense>
    );
}

export default LazyWidgetIframe;
