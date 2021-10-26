import { DefaultRootState } from './typings';

// eslint-disable-next-line import/prefer-default-export
export const getIsChatOnSite = (state: DefaultRootState): boolean => {
    if (!state?.visitor?.is_chat_on_site) {
        return false;
    }
    return state.visitor.is_chat_on_site;
};
