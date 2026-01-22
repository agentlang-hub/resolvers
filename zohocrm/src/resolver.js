import { getLocalEnv } from "agentlang/out/runtime/auth/defs.js";
import { makeInstance } from "agentlang/out/runtime/module.js";

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_LIST_SIZE = 100;

let accessToken = null;
let tokenExpiry = null;
const DEFAULT_POLL_MINUTES = 10;

const trimTrailingSlash = (val) => val?.replace(/\/+$/, "") || val;

const getApiBaseUrl = () =>
    trimTrailingSlash(getLocalEnv("ZOHO_CRM_BASE_URL") || process.env.ZOHO_CRM_BASE_URL || "https://www.zohoapis.com/crm/v2");

const getAccountsBaseUrl = () =>
    trimTrailingSlash(getLocalEnv("ZOHO_CRM_ACCOUNTS_URL") || process.env.ZOHO_CRM_ACCOUNTS_URL || "https://accounts.zoho.com");

const getOrgId = () => getLocalEnv("ZOHO_CRM_ORG_ID") || process.env.ZOHO_CRM_ORG_ID;
const getPollIntervalMs = () => {
    const val = getLocalEnv("ZOHO_CRM_POLL_INTERVAL_MINUTES") || process.env.ZOHO_CRM_POLL_INTERVAL_MINUTES;
    const num = Number(val);
    return Number.isFinite(num) && num > 0 ? num * 60 * 1000 : DEFAULT_POLL_MINUTES * 60 * 1000;
};

const getResponseBody = async (response) => {
    try {
        try {
            return await response.json();
        } catch (err) {
            return await response.text();
        }
    } catch (error) {
        console.error("ZOHO CRM RESOLVER: Error reading response body:", error);
        return {};
    }
};

async function exchangeToken(params) {
    const tokenUrl = `${getAccountsBaseUrl()}/oauth/v2/token`;
    console.log(`ZOHO CRM RESOLVER: requesting token from ${tokenUrl} with grant_type=${params.get("grant_type")}`);

    const response = await fetch(tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params
    });

    const body = await getResponseBody(response);
    if (!response.ok) {
        throw new Error(`Zoho token request failed ${response.status}: ${JSON.stringify(body)}`);
    }

    if (!body.access_token) {
        throw new Error(`Zoho token response missing access_token: ${JSON.stringify(body)}`);
    }

    accessToken = body.access_token;
    if (body.expires_in) {
        tokenExpiry = Date.now() + (Number(body.expires_in) - 60) * 1000;
    }

    if (body.refresh_token && !(getLocalEnv("ZOHO_CRM_REFRESH_TOKEN") || process.env.ZOHO_CRM_REFRESH_TOKEN)) {
        console.log("ZOHO CRM RESOLVER: received refresh_token; set ZOHO_CRM_REFRESH_TOKEN to reuse");
    }

    return accessToken;
}

async function getAccessToken() {
    if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
        return accessToken;
    }

    const direct = getLocalEnv("ZOHO_CRM_ACCESS_TOKEN") || process.env.ZOHO_CRM_ACCESS_TOKEN;
    if (direct) {
        accessToken = direct;
        tokenExpiry = null;
        return accessToken;
    }

    const clientId = getLocalEnv("ZOHO_CRM_CLIENT_ID") || process.env.ZOHO_CRM_CLIENT_ID;
    const clientSecret = getLocalEnv("ZOHO_CRM_CLIENT_SECRET") || process.env.ZOHO_CRM_CLIENT_SECRET;
    const authCode = getLocalEnv("ZOHO_CRM_AUTH_CODE") || process.env.ZOHO_CRM_AUTH_CODE;
    const refreshToken = getLocalEnv("ZOHO_CRM_REFRESH_TOKEN") || process.env.ZOHO_CRM_REFRESH_TOKEN;
    const redirectUri = getLocalEnv("ZOHO_CRM_REDIRECT_URL") || process.env.ZOHO_CRM_REDIRECT_URL;

    if (clientId && clientSecret && refreshToken) {
        const params = new URLSearchParams({
            refresh_token: refreshToken,
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: "refresh_token"
        });
        return await exchangeToken(params);
    }

    if (clientId && clientSecret && authCode && redirectUri) {
        const params = new URLSearchParams({
            code: authCode,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: "authorization_code"
        });
        return await exchangeToken(params);
    }

    throw new Error(
        "Zoho CRM authentication required: set ZOHO_CRM_ACCESS_TOKEN or OAuth2 vars (client id/secret + auth code + redirect, or client id/secret + refresh token)."
    );
}

async function makeRequest(method, path, payload, params = {}) {
    const baseUrl = getApiBaseUrl();
    const token = await getAccessToken();
    const orgId = getOrgId();
    const url = new URL(`${baseUrl}${path}`);
    Object.entries(params || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            url.searchParams.set(key, value);
        }
    });

    console.log(`ZOHO CRM RESOLVER: ${method} ${url.toString()}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
        const response = await fetch(url.toString(), {
            method,
            headers: {
                "Authorization": `Zoho-oauthtoken ${token}`,
                "Content-Type": "application/json",
                ...(orgId ? { "X-ZOHO-ORGID": orgId } : {})
            },
            body: payload ? JSON.stringify(payload) : undefined,
            signal: controller.signal
        });

        const body = await getResponseBody(response);
        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error(`ZOHO CRM RESOLVER: Error ${response.status}`, body);
            throw new Error(`Zoho CRM API error ${response.status}: ${JSON.stringify(body)}`);
        }

        return body;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === "AbortError") {
            console.error(`ZOHO CRM RESOLVER: Request timed out ${url.toString()}`);
        } else {
            console.error(`ZOHO CRM RESOLVER: Request failed ${url.toString()}`, error);
        }
        throw error;
    }
}

function asInstance(entity, entityType) {
    return makeInstance("zoho", entityType, new Map(Object.entries(entity)));
}

const toLookupId = (value) => (value && typeof value === "object" ? value.id : value);
const toOwnerField = (value) => {
    if (!value) return undefined;
    if (typeof value === "object" && value.id) return { id: value.id };
    return { id: value };
};
const toLookupField = (value) => {
    if (!value) return undefined;
    if (typeof value === "object" && value.id) return { id: value.id };
    return { id: value };
};

const leadFieldDefs = {
    first_name: "First_Name",
    last_name: "Last_Name",
    email: "Email",
    company: "Company",
    phone: "Phone",
    mobile: "Mobile",
    lead_source: "Lead_Source",
    lead_status: "Lead_Status",
    owner: { field: "Owner", convert: toOwnerField },
    description: "Description"
};

const contactFieldDefs = {
    first_name: "First_Name",
    last_name: "Last_Name",
    email: "Email",
    phone: "Phone",
    mobile: "Mobile",
    account_id: { field: "Account_Name", convert: toLookupField },
    title: "Title",
    department: "Department",
    owner: { field: "Owner", convert: toOwnerField }
};

const accountFieldDefs = {
    account_name: "Account_Name",
    website: "Website",
    phone: "Phone",
    industry: "Industry",
    billing_city: "Billing_City",
    billing_state: "Billing_State",
    billing_country: "Billing_Country",
    owner: { field: "Owner", convert: toOwnerField },
    description: "Description"
};

const dealFieldDefs = {
    deal_name: "Deal_Name",
    stage: "Stage",
    amount: "Amount",
    closing_date: "Closing_Date",
    pipeline: "Pipeline",
    account_id: { field: "Account_Name", convert: toLookupField },
    contact_id: { field: "Contact_Name", convert: toLookupField },
    probability: "Probability",
    description: "Description",
    owner: { field: "Owner", convert: toOwnerField }
};

const taskFieldDefs = {
    subject: "Subject",
    status: "Status",
    priority: "Priority",
    due_date: "Due_Date",
    what_id: { field: "What_Id", convert: toLookupField },
    who_id: { field: "Who_Id", convert: toLookupField },
    owner: { field: "Owner", convert: toOwnerField },
    description: "Description"
};

const noteFieldDefs = {
    note_title: "Note_Title",
    note_content: "Note_Content",
    parent_id: { field: "Parent_Id", convert: toLookupField },
    owner: { field: "Owner", convert: toOwnerField }
};

function buildRecord(attributes, fieldDefs) {
    const record = {};
    for (const [key, def] of Object.entries(fieldDefs)) {
        const value = attributes.get(key);
        if (value === undefined) continue;

        if (typeof def === "string") {
            record[def] = value;
        } else {
            const { field, convert } = def;
            record[field] = convert ? convert(value) : value;
        }
    }
    return record;
}

const toLead = (record) => ({
    id: record.id,
    first_name: record.First_Name,
    last_name: record.Last_Name,
    email: record.Email,
    company: record.Company,
    phone: record.Phone,
    mobile: record.Mobile,
    lead_source: record.Lead_Source,
    lead_status: record.Lead_Status,
    owner: toLookupId(record.Owner),
    description: record.Description,
    created_time: record.Created_Time,
    modified_time: record.Modified_Time
});

const toContact = (record) => ({
    id: record.id,
    first_name: record.First_Name,
    last_name: record.Last_Name,
    email: record.Email,
    phone: record.Phone,
    mobile: record.Mobile,
    account_id: toLookupId(record.Account_Name),
    title: record.Title,
    department: record.Department,
    owner: toLookupId(record.Owner),
    created_time: record.Created_Time,
    modified_time: record.Modified_Time
});

const toAccount = (record) => ({
    id: record.id,
    account_name: record.Account_Name,
    website: record.Website,
    phone: record.Phone,
    industry: record.Industry,
    billing_city: record.Billing_City,
    billing_state: record.Billing_State,
    billing_country: record.Billing_Country,
    owner: toLookupId(record.Owner),
    description: record.Description,
    created_time: record.Created_Time,
    modified_time: record.Modified_Time
});

const toDeal = (record) => ({
    id: record.id,
    deal_name: record.Deal_Name,
    stage: record.Stage,
    amount: record.Amount,
    closing_date: record.Closing_Date,
    pipeline: record.Pipeline,
    account_id: toLookupId(record.Account_Name),
    contact_id: toLookupId(record.Contact_Name),
    probability: record.Probability,
    description: record.Description,
    owner: toLookupId(record.Owner),
    created_time: record.Created_Time,
    modified_time: record.Modified_Time
});

const toTask = (record) => ({
    id: record.id,
    subject: record.Subject,
    status: record.Status,
    priority: record.Priority,
    due_date: record.Due_Date,
    what_id: toLookupId(record.What_Id),
    who_id: toLookupId(record.Who_Id),
    owner: toLookupId(record.Owner),
    description: record.Description,
    created_time: record.Created_Time,
    modified_time: record.Modified_Time
});

const toNote = (record) => ({
    id: record.id,
    note_title: record.Note_Title,
    note_content: record.Note_Content,
    parent_id: toLookupId(record.Parent_Id),
    owner: toLookupId(record.Owner),
    created_time: record.Created_Time,
    modified_time: record.Modified_Time
});

async function createEntity(moduleName, fieldDefs, mapper, attributes, entityType) {
    try {
        const record = buildRecord(attributes.attributes, fieldDefs);
        const payload = { data: [record] };
        const result = await makeRequest("POST", `/${moduleName}`, payload);
        if (!result.data || result.data.length === 0) {
            return { result: "error", message: "No data returned from Zoho CRM" };
        }
        else if (result.data[0].status === "error") {
            const res = result.data[0]
            return { code: res.code, result: "error", message: res.message, details: res.details };
        }
        const created = result.data?.[0]?.details || result.data?.[0] || record;
        return asInstance(mapper({ ...record, ...created }), entityType);
    } catch (error) {
        console.error(`ZOHO CRM RESOLVER: Failed to create in ${moduleName}`, error);
        return { result: "error", message: error.message };
    }
}

async function queryEntity(moduleName, mapper, entityType, attrs) {
    const id = attrs.queryAttributeValues?.get("__path__")?.split("/")?.pop() ?? null;
    try {
        if (id) {
            const result = await makeRequest("GET", `/${moduleName}/${id}`);
            const record = result.data?.[0] || result.data || {};
            return [asInstance(mapper(record), entityType)];
        }
        const result = await makeRequest("GET", `/${moduleName}`, undefined, { per_page: DEFAULT_LIST_SIZE });
        const records = result.data || [];
        return records.map((record) => asInstance(mapper(record), entityType));
    } catch (error) {
        console.error(`ZOHO CRM RESOLVER: Failed to query ${moduleName}`, error);
        return { result: "error", message: error.message };
    }
}

async function updateEntity(moduleName, fieldDefs, mapper, attributes, newAttrs, entityType) {
    const id = attributes.attributes.get("id");
    if (!id) {
        return { result: "error", message: `${entityType} ID is required for update` };
    }

    const updates = buildRecord(newAttrs, fieldDefs);
    if (Object.keys(updates).length === 0) {
        return attributes;
    }

    try {
        const payload = { data: [{ id, ...updates }] };
        const result = await makeRequest("PUT", `/${moduleName}/${id}`, payload);
        if (!result.data || result.data.length === 0) {
            return { result: "error", message: "No data returned from Zoho CRM" };
        }
        else if (result.data[0].status === "error") {
            const res = result.data[0]
            return { code: res.code, result: "error", message: res.message, details: res.details };
        }
        const record = result.data?.[0]?.details || { ...attributes, id, ...updates };
        return asInstance(mapper({ ...record, id }), entityType);
    } catch (error) {
        console.error(`ZOHO CRM RESOLVER: Failed to update ${moduleName}`, error);
        return { result: "error", message: error.message };
    }
}

async function deleteEntity(moduleName, entityType, attributes) {
    const id = attributes.attributes.get("id");
    if (!id) {
        return { result: "error", message: `${entityType} ID is required for deletion` };
    }

    try {
        await makeRequest("DELETE", `/${moduleName}/${id}`);
        return { result: "success" };
    } catch (error) {
        console.error(`ZOHO CRM RESOLVER: Failed to delete ${moduleName}`, error);
        return { result: "error", message: error.message };
    }
}

export const createLead = (env, attrs) => createEntity("Leads", leadFieldDefs, toLead, attrs, "Lead");
export const queryLead = (env, attrs) => queryEntity("Leads", toLead, "Lead", attrs);
export const updateLead = (env, attributes, newAttrs) => updateEntity("Leads", leadFieldDefs, toLead, attributes, newAttrs, "Lead");
export const deleteLead = (env, attributes) => deleteEntity("Leads", "Lead", attributes);

export const createContact = (env, attrs) => createEntity("Contacts", contactFieldDefs, toContact, attrs, "Contact");
export const queryContact = (env, attrs) => queryEntity("Contacts", toContact, "Contact", attrs);
export const updateContact = (env, attributes, newAttrs) => updateEntity("Contacts", contactFieldDefs, toContact, attributes, newAttrs, "Contact");
export const deleteContact = (env, attributes) => deleteEntity("Contacts", "Contact", attributes);

export const createAccount = (env, attrs) => createEntity("Accounts", accountFieldDefs, toAccount, attrs, "Account");
export const queryAccount = (env, attrs) => queryEntity("Accounts", toAccount, "Account", attrs);
export const updateAccount = (env, attributes, newAttrs) => updateEntity("Accounts", accountFieldDefs, toAccount, attributes, newAttrs, "Account");
export const deleteAccount = (env, attributes) => deleteEntity("Accounts", "Account", attributes);

export const createDeal = (env, attrs) => createEntity("Deals", dealFieldDefs, toDeal, attrs, "Deal");
export const queryDeal = (env, attrs) => queryEntity("Deals", toDeal, "Deal", attrs);
export const updateDeal = (env, attributes, newAttrs) => updateEntity("Deals", dealFieldDefs, toDeal, attributes, newAttrs, "Deal");
export const deleteDeal = (env, attributes) => deleteEntity("Deals", "Deal", attributes);

export const createTask = (env, attrs) => createEntity("Tasks", taskFieldDefs, toTask, attrs, "Task");
export const queryTask = (env, attrs) => queryEntity("Tasks", toTask, "Task", attrs);
export const updateTask = (env, attributes, newAttrs) => updateEntity("Tasks", taskFieldDefs, toTask, attributes, newAttrs, "Task");
export const deleteTask = (env, attributes) => deleteEntity("Tasks", "Task", attributes);

export const createNote = (env, attrs) => createEntity("Notes", noteFieldDefs, toNote, attrs, "Note");
export const queryNote = (env, attrs) => queryEntity("Notes", toNote, "Note", attrs);
export const updateNote = (env, attributes, newAttrs) => updateEntity("Notes", noteFieldDefs, toNote, attributes, newAttrs, "Note");
export const deleteNote = (env, attributes) => deleteEntity("Notes", "Note", attributes);

async function pollAndEmit(moduleName, mapper, entityType, resolver, seenIds) {
    try {
        const result = await makeRequest("GET", `/${moduleName}`, undefined, { per_page: DEFAULT_LIST_SIZE });
        const records = result.data || [];
        for (const record of records) {
            const id = record.id;
            if (id && seenIds.has(id)) continue;
            if (id) seenIds.add(id);
            await resolver.onSubscription(asInstance(mapper(record), entityType), true);
        }
    } catch (error) {
        console.error(`ZOHO CRM RESOLVER: Subscription polling failed for ${moduleName}`, error);
    }
}

function buildSubscriber(moduleName, mapper, entityType) {
    return async function subscribe(resolver) {
        const seenIds = new Set();
        await pollAndEmit(moduleName, mapper, entityType, resolver, seenIds);
        const intervalMs = getPollIntervalMs();
        console.log(`ZOHO CRM RESOLVER: Polling ${moduleName} every ${intervalMs / 60000} minute(s)`);
        setInterval(async () => {
            await pollAndEmit(moduleName, mapper, entityType, resolver, seenIds);
        }, intervalMs);
    };
}

export const subsLead = buildSubscriber("Leads", toLead, "Lead");
export const subsContact = buildSubscriber("Contacts", toContact, "Contact");
export const subsAccount = buildSubscriber("Accounts", toAccount, "Account");
export const subsDeal = buildSubscriber("Deals", toDeal, "Deal");
export const subsTask = buildSubscriber("Tasks", toTask, "Task");
export const subsNote = buildSubscriber("Notes", toNote, "Note");
