import qs from 'qs';

export const apiData = (requestUrl, bodyData = {}, method = 'GET') => {
    const apiUrl = process.env.NEW_WIDGET_URL_API;
    // Only use of apiData already provides publickKey
    let url = apiUrl + requestUrl;
    const fetchOptions = {
        method,
    };
    if (method === 'GET') {
        url = `${url}?${qs.stringify(bodyData)}`;
    } else {
        fetchOptions.body = JSON.stringify(bodyData);
        fetchOptions.headers = {
            'Content-Type': 'application/json',
        };
    }
    return fetch(url, fetchOptions)
        .then(data => Promise.all([data.json(), data]))
        .then(response => {
            const [data, httpResponse] = response;
            if (httpResponse.status === 401) {
                throw new Error(httpResponse.status);
            }
            if (!httpResponse.ok || !data || !data.status) {
                if (data) {
                    if (
                        typeof data.value === 'object' &&
                        data.value !== null &&
                        data.value.reason
                    ) {
                        throw new Error(`${data.value.reason}`);
                    }
                    if (typeof data.value === 'object' && data.value !== null && data.value.error) {
                        throw new Error(`${data.value.error}`);
                    }
                    throw new Error(`${data.value}`);
                }
                throw new Error(`Error code - ${httpResponse.status}`);
            }
            if (httpResponse.ok) {
                return data;
            }
            throw new Error(`Error code - ${httpResponse.status}`);
        })
        .then(data => data.value);
};

export const shopifyCartRequest = () =>
    fetch('/cart.js', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
    })
        .then(data => Promise.all([data.json(), data]))
        .then(response => {
            const [data, httpResponse] = response;
            if (httpResponse.status === 401) {
                throw new Error(httpResponse.status);
            }
            if (!httpResponse.ok || !data) {
                throw new Error(`Error code - ${httpResponse.status}`);
            }
            return data;
        });
