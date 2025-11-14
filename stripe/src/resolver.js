const al_module = await import(`${process.cwd()}/node_modules/agentlang/out/runtime/module.js`);

const makeInstance = al_module.makeInstance;

function asInstance(entity, entityType) {
    if (!entity || typeof entity !== 'object') {
        return makeInstance('stripe', entityType, new Map());
    }
    const instanceMap = new Map(Object.entries(entity));
    return makeInstance('stripe', entityType, instanceMap);
}

const getResponseBody = async (response) => {
    try {
        try {
            return await response.json();
        } catch (e) {
            return await response.text();
        }
    } catch (error) {
        console.error('STRIPE RESOLVER: Error reading response body:', error);
        return {};
    }
};

const STRIPE_BASE_URL = process.env.STRIPE_BASE_URL || 'https://api.stripe.com';
const STRIPE_API_VERSION = process.env.STRIPE_API_VERSION;

function mapToPlainObject(value) {
    if (value instanceof Map) {
        const obj = {};
        for (const [key, val] of value.entries()) {
            obj[key] = mapToPlainObject(val);
        }
        return obj;
    }
    if (Array.isArray(value)) {
        return value.map((item) => mapToPlainObject(item));
    }
    return value;
}

function convertAttributeMap(attributeMap) {
    if (!(attributeMap instanceof Map)) {
        return {};
    }
    const obj = {};
    for (const [key, value] of attributeMap.entries()) {
        const converted = mapToPlainObject(value);
        if (converted !== undefined) {
            obj[key] = converted;
        }
    }
    return obj;
}

function cleanObject(obj) {
    if (!obj || typeof obj !== 'object') {
        return {};
    }
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value === undefined || value === null) {
            continue;
        }
        if (Array.isArray(value)) {
            const arrayValue = value
                .map((item) => (typeof item === 'object' && item !== null ? cleanObject(item) : item))
                .filter((item) => item !== undefined && item !== null);
            if (arrayValue.length > 0) {
                cleaned[key] = arrayValue;
            }
        } else if (value instanceof Date) {
            cleaned[key] = Math.floor(value.getTime() / 1000);
        } else if (typeof value === 'object') {
            const nested = cleanObject(value);
            if (Object.keys(nested).length > 0) {
                cleaned[key] = nested;
            }
        } else {
            cleaned[key] = value;
        }
    }
    return cleaned;
}

function buildStripeBody(data) {
    if (!data || Object.keys(data).length === 0) {
        return undefined;
    }

    const params = new URLSearchParams();

    const appendFormValue = (prefix, value) => {
        if (value === undefined || value === null) {
            return;
        }
        if (Array.isArray(value)) {
            value.forEach((item, index) => {
                appendFormValue(`${prefix}[${index}]`, item);
            });
            return;
        }
        if (value instanceof Date) {
            params.append(prefix, Math.floor(value.getTime() / 1000).toString());
            return;
        }
        if (typeof value === 'object') {
            for (const [key, val] of Object.entries(value)) {
                appendFormValue(`${prefix}[${key}]`, val);
            }
            return;
        }
        params.append(prefix, String(value));
    };

    for (const [key, value] of Object.entries(data)) {
        appendFormValue(key, value);
    }

    const bodyString = params.toString();
    return bodyString.length > 0 ? bodyString : undefined;
}

function buildQueryString(params) {
    if (!params || Object.keys(params).length === 0) {
        return '';
    }
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null) {
            continue;
        }
        if (Array.isArray(value)) {
            value.forEach((item) => {
                if (item !== undefined && item !== null) {
                    query.append(key, String(item));
                }
            });
        } else {
            query.append(key, String(value));
        }
    }
    const stringified = query.toString();
    return stringified ? `?${stringified}` : '';
}

const makeRequest = async (endpoint, options = {}) => {
    const apiKey = process.env.STRIPE_API_KEY;

    if (!apiKey) {
        throw new Error('Stripe API key is required');
    }

    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${STRIPE_BASE_URL}${normalizedEndpoint}`;

    const defaultHeaders = {
        Authorization: `Bearer ${apiKey}`
    };

    if (options.body) {
        defaultHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
    }

    if (STRIPE_API_VERSION) {
        defaultHeaders['Stripe-Version'] = STRIPE_API_VERSION;
    }

    const headers = {
        ...defaultHeaders,
        ...(options.headers || {})
    };

    if ((!options.body || options.body.length === 0) && (options.method === 'GET' || options.method === 'DELETE')) {
        delete headers['Content-Type'];
    }

    const config = {
        ...options,
        headers
    };

    const timeoutMs = 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        console.error(`STRIPE RESOLVER: Request timeout after ${timeoutMs}ms - ${config.method} ${url}`);
        controller.abort();
    }, timeoutMs);

    console.log(
        `STRIPE RESOLVER: making http request ${config.method} ${url} with options ${JSON.stringify({
            ...config,
            body: config.body ? '[REDACTED]' : undefined
        })}`
    );

    try {
        const response = await fetch(url, {
            ...config,
            signal: controller.signal
        });

        const body = await getResponseBody(response);
        console.log(`STRIPE RESOLVER: response ${response.status} ${response.ok}`, body);

        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error(`STRIPE RESOLVER: HTTP Error ${response.status} - ${url}`);
            throw new Error(`HTTP Error: ${response.status} - ${JSON.stringify(body)}`);
        }

        return body;
    } catch (error) {
        clearTimeout(timeoutId);

        if (error.name === 'AbortError') {
            console.error(`STRIPE RESOLVER: Request timeout - ${config.method} ${url}`);
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'EHOSTUNREACH') {
            console.error(`STRIPE RESOLVER: Network unreachable (${error.code}) - ${config.method} ${url}`);
        } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
            console.error(`STRIPE RESOLVER: Connection error (${error.code}) - ${config.method} ${url}`);
        } else {
            console.error(`STRIPE RESOLVER: Request failed (${error.name}) - ${config.method} ${url}`);
        }

        throw error;
    }
};

const makeGetRequest = async (endpoint, params) => {
    const query = buildQueryString(params);
    console.log(`STRIPE RESOLVER: Querying Stripe: ${endpoint}${query}`);
    return await makeRequest(`${endpoint}${query}`, { method: 'GET' });
};

const makePostRequest = async (endpoint, data) => {
    const payload = cleanObject(data || {});
    const body = buildStripeBody(payload);
    console.log(`STRIPE RESOLVER: Posting to Stripe: ${endpoint}`);
    return await makeRequest(endpoint, {
        method: 'POST',
        body
    });
};

const makeDeleteRequest = async (endpoint, data) => {
    const payload = cleanObject(data || {});
    const body = buildStripeBody(payload);
    console.log(`STRIPE RESOLVER: Deleting in Stripe: ${endpoint}`);
    return await makeRequest(endpoint, {
        method: 'DELETE',
        body
    });
};

function ensureId(attributes, resourceName) {
    const id = attributes?.attributes?.get('id');
    if (!id) {
        return {
            error: { result: 'error', message: `${resourceName} ID is required` }
        };
    }
    return { id };
}

function extractIdFromQuery(attrs) {
    const path = attrs?.queryAttributeValues?.get('__path__');
    if (!path || typeof path !== 'string') {
        return null;
    }
    const segments = path.split('/').filter(Boolean);
    return segments.length > 0 ? segments[segments.length - 1] : null;
}

function listToInstances(list, entityType) {
    if (!Array.isArray(list)) {
        return [];
    }
    return list.map((item) => asInstance(item, entityType));
}

// Customer functions
export const createCustomer = async (env, attributes) => {
    const data = convertAttributeMap(attributes?.attributes);
    try {
        const result = await makePostRequest('/v1/customers', data);
        return { result: 'success', id: result.id };
    } catch (error) {
        console.error(`STRIPE RESOLVER: Failed to create customer: ${error}`);
        return { result: 'error', message: error.message };
    }
};

export const queryCustomer = async (env, attrs) => {
    const id = extractIdFromQuery(attrs);
    try {
        if (id) {
            const result = await makeGetRequest(`/v1/customers/${id}`);
            return [asInstance(result, 'Customer')];
        }
        const result = await makeGetRequest('/v1/customers', { limit: 100 });
        const data = Array.isArray(result?.data) ? result.data : [];
        return listToInstances(data, 'Customer');
    } catch (error) {
        console.error(`STRIPE RESOLVER: Failed to query customers: ${error}`);
        return { result: 'error', message: error.message };
    }
};

export const updateCustomer = async (env, attributes, newAttrs) => {
    const { id, error } = ensureId(attributes, 'Customer');
    if (error) {
        return error;
    }
    const data = convertAttributeMap(newAttrs);
    try {
        const result = await makePostRequest(`/v1/customers/${id}`, data);
        return asInstance(result, 'Customer');
    } catch (err) {
        console.error(`STRIPE RESOLVER: Failed to update customer: ${err}`);
        return { result: 'error', message: err.message };
    }
};

export const deleteCustomer = async (env, attributes) => {
    const { id, error } = ensureId(attributes, 'Customer');
    if (error) {
        return error;
    }
    try {
        await makeDeleteRequest(`/v1/customers/${id}`);
        return { result: 'success' };
    } catch (err) {
        console.error(`STRIPE RESOLVER: Failed to delete customer: ${err}`);
        return { result: 'error', message: err.message };
    }
};

// Product functions
export const createProduct = async (env, attributes) => {
    const data = convertAttributeMap(attributes?.attributes);
    try {
        const result = await makePostRequest('/v1/products', data);
        return { result: 'success', id: result.id };
    } catch (error) {
        console.error(`STRIPE RESOLVER: Failed to create product: ${error}`);
        return { result: 'error', message: error.message };
    }
};

export const queryProduct = async (env, attrs) => {
    const id = extractIdFromQuery(attrs);
    try {
        if (id) {
            const result = await makeGetRequest(`/v1/products/${id}`);
            return [asInstance(result, 'Product')];
        }
        const result = await makeGetRequest('/v1/products', { limit: 100 });
        const data = Array.isArray(result?.data) ? result.data : [];
        return listToInstances(data, 'Product');
    } catch (error) {
        console.error(`STRIPE RESOLVER: Failed to query products: ${error}`);
        return { result: 'error', message: error.message };
    }
};

export const updateProduct = async (env, attributes, newAttrs) => {
    const { id, error } = ensureId(attributes, 'Product');
    if (error) {
        return error;
    }
    const data = convertAttributeMap(newAttrs);
    try {
        const result = await makePostRequest(`/v1/products/${id}`, data);
        return asInstance(result, 'Product');
    } catch (err) {
        console.error(`STRIPE RESOLVER: Failed to update product: ${err}`);
        return { result: 'error', message: err.message };
    }
};

export const deleteProduct = async (env, attributes) => {
    const { id, error } = ensureId(attributes, 'Product');
    if (error) {
        return error;
    }
    try {
        await makeDeleteRequest(`/v1/products/${id}`);
        return { result: 'success' };
    } catch (err) {
        console.error(`STRIPE RESOLVER: Failed to delete product: ${err}`);
        return { result: 'error', message: err.message };
    }
};

// Price functions
export const createPrice = async (env, attributes) => {
    const data = convertAttributeMap(attributes?.attributes);
    try {
        const result = await makePostRequest('/v1/prices', data);
        return { result: 'success', id: result.id };
    } catch (error) {
        console.error(`STRIPE RESOLVER: Failed to create price: ${error}`);
        return { result: 'error', message: error.message };
    }
};

export const queryPrice = async (env, attrs) => {
    const id = extractIdFromQuery(attrs);
    try {
        if (id) {
            const result = await makeGetRequest(`/v1/prices/${id}`);
            return [asInstance(result, 'Price')];
        }
        const result = await makeGetRequest('/v1/prices', { limit: 100 });
        const data = Array.isArray(result?.data) ? result.data : [];
        return listToInstances(data, 'Price');
    } catch (error) {
        console.error(`STRIPE RESOLVER: Failed to query prices: ${error}`);
        return { result: 'error', message: error.message };
    }
};

export const updatePrice = async (env, attributes, newAttrs) => {
    const { id, error } = ensureId(attributes, 'Price');
    if (error) {
        return error;
    }
    const data = convertAttributeMap(newAttrs);
    try {
        const result = await makePostRequest(`/v1/prices/${id}`, data);
        return asInstance(result, 'Price');
    } catch (err) {
        console.error(`STRIPE RESOLVER: Failed to update price: ${err}`);
        return { result: 'error', message: err.message };
    }
};

export const deletePrice = async (env, attributes) => {
    const { id, error } = ensureId(attributes, 'Price');
    if (error) {
        return error;
    }
    try {
        await makePostRequest(`/v1/prices/${id}`, { active: false });
        return { result: 'success', message: 'Price deactivated (Stripe does not support deletion).' };
    } catch (err) {
        console.error(`STRIPE RESOLVER: Failed to deactivate price: ${err}`);
        return { result: 'error', message: err.message };
    }
};

// Subscription functions
export const createSubscription = async (env, attributes) => {
    const data = convertAttributeMap(attributes?.attributes);
    try {
        const result = await makePostRequest('/v1/subscriptions', data);
        return { result: 'success', id: result.id };
    } catch (error) {
        console.error(`STRIPE RESOLVER: Failed to create subscription: ${error}`);
        return { result: 'error', message: error.message };
    }
};

export const querySubscription = async (env, attrs) => {
    const id = extractIdFromQuery(attrs);
    try {
        if (id) {
            const result = await makeGetRequest(`/v1/subscriptions/${id}`);
            return [asInstance(result, 'Subscription')];
        }
        const result = await makeGetRequest('/v1/subscriptions', { limit: 100 });
        const data = Array.isArray(result?.data) ? result.data : [];
        return listToInstances(data, 'Subscription');
    } catch (error) {
        console.error(`STRIPE RESOLVER: Failed to query subscriptions: ${error}`);
        return { result: 'error', message: error.message };
    }
};

export const updateSubscription = async (env, attributes, newAttrs) => {
    const { id, error } = ensureId(attributes, 'Subscription');
    if (error) {
        return error;
    }
    const data = convertAttributeMap(newAttrs);
    try {
        const result = await makePostRequest(`/v1/subscriptions/${id}`, data);
        return asInstance(result, 'Subscription');
    } catch (err) {
        console.error(`STRIPE RESOLVER: Failed to update subscription: ${err}`);
        return { result: 'error', message: err.message };
    }
};

export const deleteSubscription = async (env, attributes) => {
    const { id, error } = ensureId(attributes, 'Subscription');
    if (error) {
        return error;
    }
    try {
        await makeDeleteRequest(`/v1/subscriptions/${id}`);
        return { result: 'success' };
    } catch (err) {
        console.error(`STRIPE RESOLVER: Failed to cancel subscription: ${err}`);
        return { result: 'error', message: err.message };
    }
};

// Invoice functions
export const createInvoice = async (env, attributes) => {
    const data = convertAttributeMap(attributes?.attributes);
    try {
        const result = await makePostRequest('/v1/invoices', data);
        return { result: 'success', id: result.id };
    } catch (error) {
        console.error(`STRIPE RESOLVER: Failed to create invoice: ${error}`);
        return { result: 'error', message: error.message };
    }
};

export const queryInvoice = async (env, attrs) => {
    const id = extractIdFromQuery(attrs);
    try {
        if (id) {
            const result = await makeGetRequest(`/v1/invoices/${id}`);
            return [asInstance(result, 'Invoice')];
        }
        const result = await makeGetRequest('/v1/invoices', { limit: 100 });
        const data = Array.isArray(result?.data) ? result.data : [];
        return listToInstances(data, 'Invoice');
    } catch (error) {
        console.error(`STRIPE RESOLVER: Failed to query invoices: ${error}`);
        return { result: 'error', message: error.message };
    }
};

export const updateInvoice = async (env, attributes, newAttrs) => {
    const { id, error } = ensureId(attributes, 'Invoice');
    if (error) {
        return error;
    }
    const data = convertAttributeMap(newAttrs);
    try {
        const result = await makePostRequest(`/v1/invoices/${id}`, data);
        return asInstance(result, 'Invoice');
    } catch (err) {
        console.error(`STRIPE RESOLVER: Failed to update invoice: ${err}`);
        return { result: 'error', message: err.message };
    }
};

export const deleteInvoice = async (env, attributes) => {
    const { id, error } = ensureId(attributes, 'Invoice');
    if (error) {
        return error;
    }
    try {
        await makeDeleteRequest(`/v1/invoices/${id}`);
        return { result: 'success' };
    } catch (err) {
        console.error(`STRIPE RESOLVER: Failed to delete invoice: ${err}`);
        return { result: 'error', message: err.message };
    }
};

export const finalizeInvoice = async (invoice_id) => {
    if (!invoice_id) {
        return { result: 'error', message: 'Invoice ID is required' };
    }
    try {
        const result = await makePostRequest(`/v1/invoices/${invoice_id}/finalize`, {});
        return asInstance(result, 'Invoice');
    } catch (err) {
        console.error(`STRIPE RESOLVER: Failed to finalize invoice: ${err}`);
        return { result: 'error', message: err.message };
    }
};

export const sendInvoice = async (invoice_id) => {
    if (!invoice_id) {
        return { result: 'error', message: 'Invoice ID is required' };
    }
    try {
        const result = await makePostRequest(`/v1/invoices/${invoice_id}/send`, {});
        return asInstance(result, 'Invoice');
    } catch (err) {
        console.error(`STRIPE RESOLVER: Failed to send invoice: ${err}`);
        return { result: 'error', message: err.message };
    }
};

// InvoiceItem functions
export const createInvoiceItem = async (env, attributes) => {
    const data = convertAttributeMap(attributes?.attributes);
    try {
        const result = await makePostRequest('/v1/invoiceitems', data);
        return { result: 'success', id: result.id };
    } catch (error) {
        console.error(`STRIPE RESOLVER: Failed to create invoice item: ${error}`);
        return { result: 'error', message: error.message };
    }
};

export const queryInvoiceItem = async (env, attrs) => {
    const id = extractIdFromQuery(attrs);
    try {
        if (id) {
            const result = await makeGetRequest(`/v1/invoiceitems/${id}`);
            return [asInstance(result, 'InvoiceItem')];
        }
        const result = await makeGetRequest('/v1/invoiceitems', { limit: 100 });
        const data = Array.isArray(result?.data) ? result.data : [];
        return listToInstances(data, 'InvoiceItem');
    } catch (error) {
        console.error(`STRIPE RESOLVER: Failed to query invoice items: ${error}`);
        return { result: 'error', message: error.message };
    }
};

export const updateInvoiceItem = async (env, attributes, newAttrs) => {
    const { id, error } = ensureId(attributes, 'InvoiceItem');
    if (error) {
        return error;
    }
    const data = convertAttributeMap(newAttrs);
    try {
        const result = await makePostRequest(`/v1/invoiceitems/${id}`, data);
        return asInstance(result, 'InvoiceItem');
    } catch (err) {
        console.error(`STRIPE RESOLVER: Failed to update invoice item: ${err}`);
        return { result: 'error', message: err.message };
    }
};

export const deleteInvoiceItem = async (env, attributes) => {
    const { id, error } = ensureId(attributes, 'InvoiceItem');
    if (error) {
        return error;
    }
    try {
        await makeDeleteRequest(`/v1/invoiceitems/${id}`);
        return { result: 'success' };
    } catch (err) {
        console.error(`STRIPE RESOLVER: Failed to delete invoice item: ${err}`);
        return { result: 'error', message: err.message };
    }
};

// PaymentIntent functions
export const createPaymentIntent = async (env, attributes) => {
    const data = convertAttributeMap(attributes?.attributes);
    try {
        const result = await makePostRequest('/v1/payment_intents', data);
        return { result: 'success', id: result.id };
    } catch (error) {
        console.error(`STRIPE RESOLVER: Failed to create payment intent: ${error}`);
        return { result: 'error', message: error.message };
    }
};

export const queryPaymentIntent = async (env, attrs) => {
    const id = extractIdFromQuery(attrs);
    try {
        if (id) {
            const result = await makeGetRequest(`/v1/payment_intents/${id}`);
            return [asInstance(result, 'PaymentIntent')];
        }
        const result = await makeGetRequest('/v1/payment_intents', { limit: 100 });
        const data = Array.isArray(result?.data) ? result.data : [];
        return listToInstances(data, 'PaymentIntent');
    } catch (error) {
        console.error(`STRIPE RESOLVER: Failed to query payment intents: ${error}`);
        return { result: 'error', message: error.message };
    }
};

export const updatePaymentIntent = async (env, attributes, newAttrs) => {
    const { id, error } = ensureId(attributes, 'PaymentIntent');
    if (error) {
        return error;
    }
    const data = convertAttributeMap(newAttrs);
    try {
        const result = await makePostRequest(`/v1/payment_intents/${id}`, data);
        return asInstance(result, 'PaymentIntent');
    } catch (err) {
        console.error(`STRIPE RESOLVER: Failed to update payment intent: ${err}`);
        return { result: 'error', message: err.message };
    }
};

export const deletePaymentIntent = async (env, attributes) => {
    const { id, error } = ensureId(attributes, 'PaymentIntent');
    if (error) {
        return error;
    }
    try {
        await makePostRequest(`/v1/payment_intents/${id}/cancel`, {});
        return { result: 'success' };
    } catch (err) {
        console.error(`STRIPE RESOLVER: Failed to cancel payment intent: ${err}`);
        return { result: 'error', message: err.message };
    }
};

// Charge functions
export const createCharge = async (env, attributes) => {
    const data = convertAttributeMap(attributes?.attributes);
    try {
        const result = await makePostRequest('/v1/charges', data);
        return { result: 'success', id: result.id };
    } catch (error) {
        console.error(`STRIPE RESOLVER: Failed to create charge: ${error}`);
        return { result: 'error', message: error.message };
    }
};

export const queryCharge = async (env, attrs) => {
    const id = extractIdFromQuery(attrs);
    try {
        if (id) {
            const result = await makeGetRequest(`/v1/charges/${id}`);
            return [asInstance(result, 'Charge')];
        }
        const result = await makeGetRequest('/v1/charges', { limit: 100 });
        const data = Array.isArray(result?.data) ? result.data : [];
        return listToInstances(data, 'Charge');
    } catch (error) {
        console.error(`STRIPE RESOLVER: Failed to query charges: ${error}`);
        return { result: 'error', message: error.message };
    }
};

export const updateCharge = async (env, attributes, newAttrs) => {
    const { id, error } = ensureId(attributes, 'Charge');
    if (error) {
        return error;
    }
    const data = convertAttributeMap(newAttrs);
    try {
        const result = await makePostRequest(`/v1/charges/${id}`, data);
        return asInstance(result, 'Charge');
    } catch (err) {
        console.error(`STRIPE RESOLVER: Failed to update charge: ${err}`);
        return { result: 'error', message: err.message };
    }
};

export const deleteCharge = async (env, attributes) => {
    const { id, error } = ensureId(attributes, 'Charge');
    if (error) {
        return error;
    }
    console.warn('STRIPE RESOLVER: Charges cannot be deleted via the Stripe API. Issue a refund instead.');
    return { result: 'error', message: 'Charges cannot be deleted via the Stripe API. Consider issuing a refund.' };
};

// Refund functions
export const createRefund = async (env, attributes) => {
    const data = convertAttributeMap(attributes?.attributes);
    try {
        const result = await makePostRequest('/v1/refunds', data);
        return { result: 'success', id: result.id };
    } catch (error) {
        console.error(`STRIPE RESOLVER: Failed to create refund: ${error}`);
        return { result: 'error', message: error.message };
    }
};

export const queryRefund = async (env, attrs) => {
    const id = extractIdFromQuery(attrs);
    try {
        if (id) {
            const result = await makeGetRequest(`/v1/refunds/${id}`);
            return [asInstance(result, 'Refund')];
        }
        const result = await makeGetRequest('/v1/refunds', { limit: 100 });
        const data = Array.isArray(result?.data) ? result.data : [];
        return listToInstances(data, 'Refund');
    } catch (error) {
        console.error(`STRIPE RESOLVER: Failed to query refunds: ${error}`);
        return { result: 'error', message: error.message };
    }
};

export const updateRefund = async (env, attributes, newAttrs) => {
    const { id, error } = ensureId(attributes, 'Refund');
    if (error) {
        return error;
    }
    const data = convertAttributeMap(newAttrs);
    try {
        const result = await makePostRequest(`/v1/refunds/${id}`, data);
        return asInstance(result, 'Refund');
    } catch (err) {
        console.error(`STRIPE RESOLVER: Failed to update refund: ${err}`);
        return { result: 'error', message: err.message };
    }
};

export const deleteRefund = async (env, attributes) => {
    const { id, error } = ensureId(attributes, 'Refund');
    if (error) {
        return error;
    }
    console.warn('STRIPE RESOLVER: Refunds cannot be deleted via the Stripe API.');
    return { result: 'error', message: 'Refunds cannot be deleted via the Stripe API.' };
};

// Payout functions
export const createPayout = async (env, attributes) => {
    const data = convertAttributeMap(attributes?.attributes);
    try {
        const result = await makePostRequest('/v1/payouts', data);
        return { result: 'success', id: result.id };
    } catch (error) {
        console.error(`STRIPE RESOLVER: Failed to create payout: ${error}`);
        return { result: 'error', message: error.message };
    }
};

export const queryPayout = async (env, attrs) => {
    const id = extractIdFromQuery(attrs);
    try {
        if (id) {
            const result = await makeGetRequest(`/v1/payouts/${id}`);
            return [asInstance(result, 'Payout')];
        }
        const result = await makeGetRequest('/v1/payouts', { limit: 100 });
        const data = Array.isArray(result?.data) ? result.data : [];
        return listToInstances(data, 'Payout');
    } catch (error) {
        console.error(`STRIPE RESOLVER: Failed to query payouts: ${error}`);
        return { result: 'error', message: error.message };
    }
};

export const updatePayout = async (env, attributes, newAttrs) => {
    const { id, error } = ensureId(attributes, 'Payout');
    if (error) {
        return error;
    }
    const data = convertAttributeMap(newAttrs);
    try {
        const result = await makePostRequest(`/v1/payouts/${id}`, data);
        return asInstance(result, 'Payout');
    } catch (err) {
        console.error(`STRIPE RESOLVER: Failed to update payout: ${err}`);
        return { result: 'error', message: err.message };
    }
};

export const deletePayout = async (env, attributes) => {
    const { id, error } = ensureId(attributes, 'Payout');
    if (error) {
        return error;
    }
    try {
        const result = await makePostRequest(`/v1/payouts/${id}/cancel`, {});
        return { result: 'success', message: 'Payout cancellation requested.', id: result?.id };
    } catch (err) {
        console.error(`STRIPE RESOLVER: Failed to cancel payout: ${err}`);
        return { result: 'error', message: err.message };
    }
};

// Subscription helpers for polling
const STRIPE_DEFAULT_POLL_INTERVAL_MINUTES = parseInt(process.env.STRIPE_POLL_INTERVAL_MINUTES || '15', 10);

function getPollingIntervalMs() {
    const minutes = Number.isNaN(STRIPE_DEFAULT_POLL_INTERVAL_MINUTES)
        ? 15
        : Math.max(1, STRIPE_DEFAULT_POLL_INTERVAL_MINUTES);
    return minutes * 60 * 1000;
}

async function getAndProcessStripeRecords(resolver, entityKey, endpoint) {
    try {
        const result = await makeGetRequest(endpoint, { limit: 100 });
        const records = Array.isArray(result?.data) ? result.data : Array.isArray(result) ? result : [];
        for (const record of records) {
            console.log(`STRIPE RESOLVER: Processing ${entityKey} ${record.id}`);
            await resolver.onSubscription(
                {
                    id: record.id,
                    type: entityKey,
                    data: record,
                    timestamp: new Date().toISOString()
                },
                true
            );
        }
    } catch (error) {
        console.error(`STRIPE RESOLVER: Failed to process ${entityKey} records: ${error}`);
    }
}

async function handleSubsCustomers(resolver) {
    await getAndProcessStripeRecords(resolver, 'customers', '/v1/customers');
}

async function handleSubsProducts(resolver) {
    await getAndProcessStripeRecords(resolver, 'products', '/v1/products');
}

async function handleSubsPrices(resolver) {
    await getAndProcessStripeRecords(resolver, 'prices', '/v1/prices');
}

async function handleSubsSubscriptions(resolver) {
    await getAndProcessStripeRecords(resolver, 'subscriptions', '/v1/subscriptions');
}

async function handleSubsInvoices(resolver) {
    await getAndProcessStripeRecords(resolver, 'invoices', '/v1/invoices');
}

async function handleSubsPaymentIntents(resolver) {
    await getAndProcessStripeRecords(resolver, 'payment_intents', '/v1/payment_intents');
}

async function handleSubsCharges(resolver) {
    await getAndProcessStripeRecords(resolver, 'charges', '/v1/charges');
}

async function handleSubsRefunds(resolver) {
    await getAndProcessStripeRecords(resolver, 'refunds', '/v1/refunds');
}

async function handleSubsPayouts(resolver) {
    await getAndProcessStripeRecords(resolver, 'payouts', '/v1/payouts');
}

export async function subsCustomers(resolver) {
    await handleSubsCustomers(resolver);
    const intervalMs = getPollingIntervalMs();
    console.log(`STRIPE RESOLVER: Setting customers polling interval to ${intervalMs / 60000} minutes`);
    setInterval(async () => {
        await handleSubsCustomers(resolver);
    }, intervalMs);
}

export async function subsProducts(resolver) {
    await handleSubsProducts(resolver);
    const intervalMs = getPollingIntervalMs();
    console.log(`STRIPE RESOLVER: Setting products polling interval to ${intervalMs / 60000} minutes`);
    setInterval(async () => {
        await handleSubsProducts(resolver);
    }, intervalMs);
}

export async function subsPrices(resolver) {
    await handleSubsPrices(resolver);
    const intervalMs = getPollingIntervalMs();
    console.log(`STRIPE RESOLVER: Setting prices polling interval to ${intervalMs / 60000} minutes`);
    setInterval(async () => {
        await handleSubsPrices(resolver);
    }, intervalMs);
}

export async function subsSubscriptions(resolver) {
    await handleSubsSubscriptions(resolver);
    const intervalMs = getPollingIntervalMs();
    console.log(`STRIPE RESOLVER: Setting subscriptions polling interval to ${intervalMs / 60000} minutes`);
    setInterval(async () => {
        await handleSubsSubscriptions(resolver);
    }, intervalMs);
}

export async function subsInvoices(resolver) {
    await handleSubsInvoices(resolver);
    const intervalMs = getPollingIntervalMs();
    console.log(`STRIPE RESOLVER: Setting invoices polling interval to ${intervalMs / 60000} minutes`);
    setInterval(async () => {
        await handleSubsInvoices(resolver);
    }, intervalMs);
}

export async function subsPaymentIntents(resolver) {
    await handleSubsPaymentIntents(resolver);
    const intervalMs = getPollingIntervalMs();
    console.log(`STRIPE RESOLVER: Setting payment intents polling interval to ${intervalMs / 60000} minutes`);
    setInterval(async () => {
        await handleSubsPaymentIntents(resolver);
    }, intervalMs);
}

export async function subsCharges(resolver) {
    await handleSubsCharges(resolver);
    const intervalMs = getPollingIntervalMs();
    console.log(`STRIPE RESOLVER: Setting charges polling interval to ${intervalMs / 60000} minutes`);
    setInterval(async () => {
        await handleSubsCharges(resolver);
    }, intervalMs);
}

export async function subsRefunds(resolver) {
    await handleSubsRefunds(resolver);
    const intervalMs = getPollingIntervalMs();
    console.log(`STRIPE RESOLVER: Setting refunds polling interval to ${intervalMs / 60000} minutes`);
    setInterval(async () => {
        await handleSubsRefunds(resolver);
    }, intervalMs);
}

export async function subsPayouts(resolver) {
    await handleSubsPayouts(resolver);
    const intervalMs = getPollingIntervalMs();
    console.log(`STRIPE RESOLVER: Setting payouts polling interval to ${intervalMs / 60000} minutes`);
    setInterval(async () => {
        await handleSubsPayouts(resolver);
    }, intervalMs);
}

