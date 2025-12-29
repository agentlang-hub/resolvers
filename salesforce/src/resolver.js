import { getLocalEnv } from "agentlang/out/runtime/auth/defs.js";
import { makeInstance } from "agentlang/out/runtime/module.js";


function toContact(contact) {
    return {
        id: contact.Id,
        first_name: contact.FirstName,
        last_name: contact.LastName,
        account_name: contact.Account?.Name || null,
        account_id: contact.AccountId,
        email: contact.Email,
        owner_id: contact.OwnerId,
        owner_name: contact.Owner?.Name || '',
        mobile: contact.MobilePhone,
        phone: contact.Phone,
        salutation: contact.Salutation,
        title: contact.Title,
        last_modified_date: contact.LastModifiedDate
    };
}

function toLead(lead) {
    return {
        id: lead.Id,
        first_name: lead.FirstName,
        last_name: lead.LastName,
        company_name: lead.Company,
        email: lead.Email,
        owner_id: lead.OwnerId,
        owner_name: lead.Owner?.Name || '',
        phone: lead.Phone,
        salutation: lead.Salutation,
        title: lead.Title,
        website: lead.Website,
        industry: lead.Industry,
        last_modified_date: lead.LastModifiedDate
    };
}

function toAccount(account) {
    return {
        id: account.Id,
        name: account.Name,
        description: account.Description,
        website: account.Website,
        industry: account.Industry,
        billing_city: account.BillingCity,
        billing_country: account.BillingCountry,
        owner_id: account.OwnerId,
        owner_name: account.Owner?.Name || '',
        last_modified_date: account.LastModifiedDate
    };
}

function toOpportunity(opportunity) {
    return {
        id: opportunity.Id,
        opportunity_name: opportunity.Name,
        account_name: opportunity.Account?.Name || null,
        account_id: opportunity.AccountId,
        amount: opportunity.Amount,
        description: opportunity.Description,
        close_date: opportunity.CloseDate,
        created_by_id: opportunity.CreatedById,
        created_by: opportunity.CreatedBy?.Name || '',
        owner_id: opportunity.OwnerId,
        owner_name: opportunity.Owner?.Name || '',
        stage: opportunity.StageName,
        probability: opportunity.Probability,
        type: opportunity.Type,
        last_modified_date: opportunity.LastModifiedDate
    };
}

function toTicket(ticket) {
    return {
        id: ticket.Id,
        case_number: ticket.CaseNumber,
        subject: ticket.Subject,
        account_id: ticket.AccountId,
        account_name: ticket.Account?.Name || null,
        contact_id: ticket.ContactId,
        contact_name: ticket.Contact?.Name || null,
        owner_id: ticket.OwnerId,
        owner_name: ticket.Owner?.Name || null,
        priority: ticket.Priority,
        status: ticket.Status,
        description: ticket.Description,
        type: ticket.Type,
        created_date: ticket.CreatedDate,
        closed_date: ticket.ClosedDate,
        origin: ticket.Origin,
        is_closed: ticket.IsClosed,
        is_escalated: ticket.IsEscalated,
        conversation: ticket.CaseComments?.records?.map(comment => ({
            id: comment.Id,
            body: comment.CommentBody,
            created_date: comment.CreatedDate,
            created_by: comment.CreatedBy?.Name || ''
        })) || [],
        last_modified_date: ticket.LastModifiedDate
    };
}

function toArticle(article) {
    return {
        id: article.Id,
        title: article.Title,
        content: article.Body || '',
        last_modified_date: article.LastModifiedDate
    };
}

function asInstance(entity, entityType) {
    const instanceMap = new Map(Object.entries(entity))
    return makeInstance('salesforce', entityType, instanceMap)
}

const getResponseBody = async (response) => {
    try {
        try {
            return await response.json()
        } catch (e) {
            return await response.text();
        }
    } catch (error) {
        console.error("SALESFORCE RESOLVER: Error reading response body:", error);
        return {};
    }
}

// OAuth2 token management
let accessToken = null;
let tokenExpiry = null;

async function getAccessToken() {
    // Return cached token if still valid
    if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
        return accessToken;
    }

    const clientId = getLocalEnv("SALESFORCE_CLIENT_ID");
    const clientSecret = getLocalEnv("SALESFORCE_CLIENT_SECRET");
    const instanceUrl = getLocalEnv("SALESFORCE_BASE_URL") || getLocalEnv("SALESFORCE_INSTANCE_URL");

    if (!clientId || !clientSecret || !instanceUrl) {
        throw new Error('Salesforce OAuth2 configuration is required: SALESFORCE_CLIENT_ID, SALESFORCE_CLIENT_SECRET, and SALESFORCE_INSTANCE_URL');
    }

    try {
        const tokenUrl = `${instanceUrl}/services/oauth2/token`;
        const params = new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret
        });

        console.log(`SALESFORCE RESOLVER: Fetching access token from ${tokenUrl}`);

        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OAuth2 token request failed: ${response.status} - ${errorText}`);
        }

        const tokenData = await response.json();
        
        if (!tokenData.access_token) {
            throw new Error('No access token received from Salesforce OAuth2');
        }

        accessToken = tokenData.access_token;
        // Set expiry time (subtract 5 minutes for safety)
        tokenExpiry = Date.now() + ((tokenData.expires_in || 3600) - 300) * 1000;

        console.log(`SALESFORCE RESOLVER: Successfully obtained access token, expires in ${tokenData.expires_in} seconds`);
        return accessToken;

    } catch (error) {
        console.error(`SALESFORCE RESOLVER: Failed to get access token: ${error}`);
        throw error;
    }
}

// Generic HTTP functions
const makeRequest = async (endpoint, options = {}) => {
    const baseUrl = getLocalEnv("SALESFORCE_BASE_URL") || getLocalEnv("SALESFORCE_INSTANCE_URL")
    let token = getLocalEnv("SALESFORCE_ACCESS_TOKEN");
    
    // If no direct token provided, try to get one via OAuth2
    if (!token) {
        try {
            token = await getAccessToken();
        } catch (error) {
            throw new Error(`Salesforce authentication failed: ${error.message}`);
        }
    }
    
    if (!token) {
        throw new Error('Salesforce access token is required');
    }
    
    const url = `${baseUrl}${endpoint}`;
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        }
    };

    console.log(`SALESFORCE RESOLVER: making http request ${options.method} ${url} with options ${JSON.stringify(options)}`)

    const config = { ...defaultOptions, ...options };
    
    // Remove Content-Type header for GET requests without body
    if (config.method === 'GET') {
        delete config.headers['Content-Type'];
    }

    const timeoutMs = 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        console.error(`SALESFORCE RESOLVER: Request timeout after ${timeoutMs}ms - ${url} - ${JSON.stringify(options)}`);
        controller.abort();
    }, timeoutMs);

    try {
        const response = await fetch(url, {
            ...config,
            signal: controller.signal
        });

        const body = await getResponseBody(response);
        console.log(`SALESFORCE RESOLVER: response ${response.status} ${response.ok}`, body)
    
        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error(`SALESFORCE RESOLVER: HTTP Error ${response.status} - ${url} - ${JSON.stringify(options)}`);
            throw new Error(`HTTP Error: ${response.status} - ${JSON.stringify(body)}`);
        }

        return body;

    } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
            console.error(`SALESFORCE RESOLVER: Request timeout - ${url} - ${JSON.stringify(options)}`);
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'EHOSTUNREACH') {
            console.error(`SALESFORCE RESOLVER: Network unreachable (${error.code}) - ${url} - ${JSON.stringify(options)}`);
        } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
            console.error(`SALESFORCE RESOLVER: Connection error (${error.code}) - ${url} - ${JSON.stringify(options)}`);
        } else {
            console.error(`SALESFORCE RESOLVER: Request failed (${error.name}) - ${url} - ${JSON.stringify(options)}`);
        }
        
        throw error;
    }
};

const makeGetRequest = async (endpoint) => {
    console.log(`SALESFORCE RESOLVER: Querying Salesforce: ${endpoint}\n`);    
    return await makeRequest(endpoint, { method: 'GET' });
};

const makePostRequest = async (endpoint, body) => {
    console.log(`SALESFORCE RESOLVER: Creating in Salesforce: ${endpoint}\n`);
    return await makeRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(body)
    });
};

const makePatchRequest = async (endpoint, body) => {
    console.log(`SALESFORCE RESOLVER: Updating in Salesforce: ${endpoint}\n`);
    return await makeRequest(endpoint, {
        method: 'PATCH',
        body: JSON.stringify(body)
    });
};

const makeDeleteRequest = async (endpoint) => {
    console.log(`SALESFORCE RESOLVER: Deleting from Salesforce: ${endpoint}\n`);
    return await makeRequest(endpoint, { method: 'DELETE' });
};

// Contact functions
export const createContact = async (env, attributes) => {
    const data = {
        FirstName: attributes.attributes.get('first_name'),
        LastName: attributes.attributes.get('last_name'),
        AccountId: attributes.attributes.get('account_id'),
        Email: attributes.attributes.get('email'),
        OwnerId: attributes.attributes.get('owner_id'),
        MobilePhone: attributes.attributes.get('mobile'),
        Phone: attributes.attributes.get('phone'),
        Salutation: attributes.attributes.get('salutation'),
        Title: attributes.attributes.get('title')
    };

    try {
        const result = await makePostRequest('/services/data/v59.0/sobjects/Contact', data);
        return {"result": "success", "id": result.id};
    } catch (error) {
        console.error(`SALESFORCE RESOLVER: Failed to create contact: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const queryContact = async (env, attrs) => {
    const id = attrs.queryAttributeValues?.get('__path__')?.split('/')?.pop() ?? null;

    console.log(`SALESFORCE RESOLVER: Querying Salesforce: ${id}\n`);
    try {
        let inst
        if (id) {
            inst = await makeGetRequest(`/services/data/v59.0/sobjects/Contact/${id}`);
        } else {
            inst = await makeGetRequest('/services/data/v59.0/query/?q=SELECT Id,FirstName,LastName,Account.Name,Email,AccountId,OwnerId,Owner.Name,MobilePhone,Phone,Title,Salutation,LastModifiedDate FROM Contact');
            inst = inst.records
        }
        if (!(inst instanceof Array)) {
            inst = [inst]
        }
        return inst.map((data) => { 
            const mappedData = toContact(data);
            return asInstance(mappedData, 'Contact');
        })
    } catch (error) {
        console.error(`SALESFORCE RESOLVER: Failed to query contacts: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const updateContact = async (env, attributes, newAttrs) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "Contact ID is required for update"};
    }

    const data = {
        FirstName: newAttrs.get('first_name'),
        LastName: newAttrs.get('last_name'),
        AccountId: newAttrs.get('account_id'),
        Email: newAttrs.get('email'),
        OwnerId: newAttrs.get('owner_id'),
        MobilePhone: newAttrs.get('mobile'),
        Phone: newAttrs.get('phone'),
        Salutation: newAttrs.get('salutation'),
        Title: newAttrs.get('title')
    };

    try {
        const result = await makePatchRequest(`/services/data/v59.0/sobjects/Contact/${id}`, data);
        return attributes
    } catch (error) {
        console.error(`SALESFORCE RESOLVER: Failed to update contact: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const deleteContact = async (env, attributes) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "Contact ID is required for deletion"};
    }

    try {
        await makeDeleteRequest(`/services/data/v59.0/sobjects/Contact/${id}`);
        return {"result": "success"};
    } catch (error) {
        console.error(`SALESFORCE RESOLVER: Failed to delete contact: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// Lead functions
export const createLead = async (env, attributes) => {
    const data = {
        FirstName: attributes.attributes.get('first_name'),
        LastName: attributes.attributes.get('last_name'),
        Company: attributes.attributes.get('company_name'),
        Email: attributes.attributes.get('email'),
        OwnerId: attributes.attributes.get('owner_id'),
        Phone: attributes.attributes.get('phone'),
        Salutation: attributes.attributes.get('salutation'),
        Title: attributes.attributes.get('title'),
        Website: attributes.attributes.get('website'),
        Industry: attributes.attributes.get('industry')
    };

    try {
        const result = await makePostRequest('/services/data/v59.0/sobjects/Lead', data);
        return {"result": "success", "id": result.id};
    } catch (error) {
        console.error(`SALESFORCE RESOLVER: Failed to create lead: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const queryLead = async (env, attrs) => {
    const id = attrs.queryAttributeValues?.get('__path__')?.split('/')?.pop() ?? null;

    console.log(`SALESFORCE RESOLVER: Querying Salesforce: ${id}\n`);
    try {
        let inst
        if (id) {
            inst = await makeGetRequest(`/services/data/v59.0/sobjects/Lead/${id}`);
        } else {
            inst = await makeGetRequest('/services/data/v59.0/query/?q=SELECT Id,FirstName,LastName,Company,Email,OwnerId,Owner.Name,Phone,Salutation,Title,Website,Industry,LastModifiedDate FROM Lead');
            inst = inst.records
        }
        if (!(inst instanceof Array)) {
            inst = [inst]
        }
        return inst.map((data) => { 
            const mappedData = toLead(data);
            return asInstance(mappedData, 'Lead');
        })
    } catch (error) {
        console.error(`SALESFORCE RESOLVER: Failed to query leads: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const updateLead = async (env, attributes, newAttrs) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "Lead ID is required for update"};
    }

    const data = {
        FirstName: newAttrs.get('first_name'),
        LastName: newAttrs.get('last_name'),
        Company: newAttrs.get('company_name'),
        Email: newAttrs.get('email'),
        OwnerId: newAttrs.get('owner_id'),
        Phone: newAttrs.get('phone'),
        Salutation: newAttrs.get('salutation'),
        Title: newAttrs.get('title'),
        Website: newAttrs.get('website'),
        Industry: newAttrs.get('industry')
    };

    try {
        const result = await makePatchRequest(`/services/data/v59.0/sobjects/Lead/${id}`, data);
        return attributes
    } catch (error) {
        console.error(`SALESFORCE RESOLVER: Failed to update lead: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const deleteLead = async (env, attributes) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "Lead ID is required for deletion"};
    }

    try {
        await makeDeleteRequest(`/services/data/v59.0/sobjects/Lead/${id}`);
        return {"result": "success"};
    } catch (error) {
        console.error(`SALESFORCE RESOLVER: Failed to delete lead: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// Account functions
export const createAccount = async (env, attributes) => {
    const data = {
        Name: attributes.attributes.get('name'),
        Description: attributes.attributes.get('description'),
        Website: attributes.attributes.get('website'),
        Industry: attributes.attributes.get('industry'),
        BillingCity: attributes.attributes.get('billing_city'),
        BillingCountry: attributes.attributes.get('billing_country'),
        OwnerId: attributes.attributes.get('owner_id')
    };

    try {
        const result = await makePostRequest('/services/data/v59.0/sobjects/Account', data);
        return {"result": "success", "id": result.id};
    } catch (error) {
        console.error(`SALESFORCE RESOLVER: Failed to create account: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const queryAccount = async (env, attrs) => {
    const id = attrs.queryAttributeValues?.get('__path__')?.split('/')?.pop() ?? null;

    console.log(`SALESFORCE RESOLVER: Querying Salesforce: ${id}\n`);
    try {
        let inst
        if (id) {
            inst = await makeGetRequest(`/services/data/v59.0/sobjects/Account/${id}`);
        } else {
            inst = await makeGetRequest('/services/data/v59.0/query/?q=SELECT Id,Name,Description,Website,Industry,BillingCity,BillingCountry,OwnerId,Owner.Name,LastModifiedDate FROM Account');
            inst = inst.records
        }
        if (!(inst instanceof Array)) {
            inst = [inst]
        }
        return inst.map((data) => { 
            const mappedData = toAccount(data);
            return asInstance(mappedData, 'Account');
        })
    } catch (error) {
        console.error(`SALESFORCE RESOLVER: Failed to query accounts: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const updateAccount = async (env, attributes, newAttrs) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "Account ID is required for update"};
    }

    const data = {
        Name: newAttrs.get('name'),
        Description: newAttrs.get('description'),
        Website: newAttrs.get('website'),
        Industry: newAttrs.get('industry'),
        BillingCity: newAttrs.get('billing_city'),
        BillingCountry: newAttrs.get('billing_country'),
        OwnerId: newAttrs.get('owner_id')
    };

    try {
        const result = await makePatchRequest(`/services/data/v59.0/sobjects/Account/${id}`, data);
        return attributes
    } catch (error) {
        console.error(`SALESFORCE RESOLVER: Failed to update account: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const deleteAccount = async (env, attributes) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "Account ID is required for deletion"};
    }

    try {
        await makeDeleteRequest(`/services/data/v59.0/sobjects/Account/${id}`);
        return {"result": "success"};
    } catch (error) {
        console.error(`SALESFORCE RESOLVER: Failed to delete account: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// Opportunity functions
export const createOpportunity = async (env, attributes) => {
    const data = {
        Name: attributes.attributes.get('opportunity_name'),
        AccountId: attributes.attributes.get('account_id'),
        Amount: attributes.attributes.get('amount'),
        Description: attributes.attributes.get('description'),
        CloseDate: attributes.attributes.get('close_date'),
        CreatedById: attributes.attributes.get('created_by_id'),
        OwnerId: attributes.attributes.get('owner_id'),
        StageName: attributes.attributes.get('stage'),
        Probability: attributes.attributes.get('probability'),
        Type: attributes.attributes.get('type')
    };

    try {
        const result = await makePostRequest('/services/data/v59.0/sobjects/Opportunity', data);
        return {"result": "success", "id": result.id};
    } catch (error) {
        console.error(`SALESFORCE RESOLVER: Failed to create opportunity: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const queryOpportunity = async (env, attrs) => {
    const id = attrs.queryAttributeValues?.get('__path__')?.split('/')?.pop() ?? null;

    console.log(`SALESFORCE RESOLVER: Querying Salesforce: ${id}\n`);
    try {
        let inst
        if (id) {
            inst = await makeGetRequest(`/services/data/v59.0/sobjects/Opportunity/${id}`);
        } else {
            inst = await makeGetRequest('/services/data/v59.0/query/?q=SELECT Id,Name,Account.Name,AccountId,Amount,Description,CloseDate,CreatedById,CreatedBy.Name,OwnerId,Owner.Name,StageName,Probability,Type,LastModifiedDate FROM Opportunity');
            inst = inst.records
        }
        if (!(inst instanceof Array)) {
            inst = [inst]
        }
        return inst.map((data) => { 
            const mappedData = toOpportunity(data);
            return asInstance(mappedData, 'Opportunity');
        })
    } catch (error) {
        console.error(`SALESFORCE RESOLVER: Failed to query opportunities: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const updateOpportunity = async (env, attributes, newAttrs) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "Opportunity ID is required for update"};
    }

    const data = {
        Name: newAttrs.get('opportunity_name'),
        AccountId: newAttrs.get('account_id'),
        Amount: newAttrs.get('amount'),
        Description: newAttrs.get('description'),
        CloseDate: newAttrs.get('close_date'),
        CreatedById: newAttrs.get('created_by_id'),
        OwnerId: newAttrs.get('owner_id'),
        StageName: newAttrs.get('stage'),
        Probability: newAttrs.get('probability'),
        Type: newAttrs.get('type')
    };

    try {
        const result = await makePatchRequest(`/services/data/v59.0/sobjects/Opportunity/${id}`, data);
        return attributes
    } catch (error) {
        console.error(`SALESFORCE RESOLVER: Failed to update opportunity: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const deleteOpportunity = async (env, attributes) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "Opportunity ID is required for deletion"};
    }

    try {
        await makeDeleteRequest(`/services/data/v59.0/sobjects/Opportunity/${id}`);
        return {"result": "success"};
    } catch (error) {
        console.error(`SALESFORCE RESOLVER: Failed to delete opportunity: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// Ticket (Case) functions
export const createTicket = async (env, attributes) => {
    const data = {
        Subject: attributes.attributes.get('subject'),
        AccountId: attributes.attributes.get('account_id'),
        ContactId: attributes.attributes.get('contact_id'),
        OwnerId: attributes.attributes.get('owner_id'),
        Priority: attributes.attributes.get('priority'),
        Status: attributes.attributes.get('status'),
        Description: attributes.attributes.get('description'),
        Type: attributes.attributes.get('type'),
        Origin: attributes.attributes.get('origin')
    };

    try {
        const result = await makePostRequest('/services/data/v59.0/sobjects/Case', data);
        return {"result": "success", "id": result.id};
    } catch (error) {
        console.error(`SALESFORCE RESOLVER: Failed to create ticket: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const queryTicket = async (env, attrs) => {
    const id = attrs.queryAttributeValues?.get('__path__')?.split('/')?.pop() ?? null;

    console.log(`SALESFORCE RESOLVER: Querying Salesforce: ${id}\n`);
    try {
        let inst
        if (id) {
            inst = await makeGetRequest(`/services/data/v59.0/sobjects/Case/${id}`);
        } else {
            inst = await makeGetRequest('/services/data/v59.0/query/?q=SELECT Id,CaseNumber,Subject,AccountId,Account.Name,ContactId,Contact.Name,OwnerId,Owner.Name,Priority,Status,Description,Type,CreatedDate,ClosedDate,Origin,IsClosed,IsEscalated,LastModifiedDate FROM Case');
            inst = inst.records
        }
        if (!(inst instanceof Array)) {
            inst = [inst]
        }
        return inst.map((data) => { 
            const mappedData = toTicket(data);
            return asInstance(mappedData, 'Ticket');
        })
    } catch (error) {
        console.error(`SALESFORCE RESOLVER: Failed to query tickets: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const updateTicket = async (env, attributes, newAttrs) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "Ticket ID is required for update"};
    }

    const data = {
        Subject: newAttrs.get('subject'),
        AccountId: newAttrs.get('account_id'),
        ContactId: newAttrs.get('contact_id'),
        OwnerId: newAttrs.get('owner_id'),
        Priority: newAttrs.get('priority'),
        Status: newAttrs.get('status'),
        Description: newAttrs.get('description'),
        Type: newAttrs.get('type'),
        Origin: newAttrs.get('origin')
    };

    try {
        const result = await makePatchRequest(`/services/data/v59.0/sobjects/Case/${id}`, data);
        return attributes
    } catch (error) {
        console.error(`SALESFORCE RESOLVER: Failed to update ticket: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const deleteTicket = async (env, attributes) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "Ticket ID is required for deletion"};
    }

    try {
        await makeDeleteRequest(`/services/data/v59.0/sobjects/Case/${id}`);
        return {"result": "success"};
    } catch (error) {
        console.error(`SALESFORCE RESOLVER: Failed to delete ticket: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// Article functions
export const createArticle = async (env, attributes) => {
    const data = {
        Title: attributes.attributes.get('title'),
        Body: attributes.attributes.get('content')
    };

    try {
        const result = await makePostRequest('/services/data/v59.0/sobjects/Knowledge__kav', data);
        return {"result": "success", "id": result.id};
    } catch (error) {
        console.error(`SALESFORCE RESOLVER: Failed to create article: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const queryArticle = async (env, attrs) => {
    const id = attrs.queryAttributeValues?.get('__path__')?.split('/')?.pop() ?? null;

    console.log(`SALESFORCE RESOLVER: Querying Salesforce: ${id}\n`);
    try {
        let inst
        if (id) {
            inst = await makeGetRequest(`/services/data/v59.0/sobjects/Knowledge__kav/${id}`);
        } else {
            inst = await makeGetRequest('/services/data/v59.0/query/?q=SELECT Id,Title,Body,LastModifiedDate FROM Knowledge__kav');
            inst = inst.records
        }
        if (!(inst instanceof Array)) {
            inst = [inst]
        }
        return inst.map((data) => { 
            const mappedData = toArticle(data);
            return asInstance(mappedData, 'Article');
        })
    } catch (error) {
        console.error(`SALESFORCE RESOLVER: Failed to query articles: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const updateArticle = async (env, attributes, newAttrs) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "Article ID is required for update"};
    }

    const data = {
        Title: newAttrs.get('title'),
        Body: newAttrs.get('content')
    };

    try {
        const result = await makePatchRequest(`/services/data/v59.0/sobjects/Knowledge__kav/${id}`, data);
        return attributes
    } catch (error) {
        console.error(`SALESFORCE RESOLVER: Failed to update article: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const deleteArticle = async (env, attributes) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "Article ID is required for deletion"};
    }

    try {
        await makeDeleteRequest(`/services/data/v59.0/sobjects/Knowledge__kav/${id}`);
        return {"result": "success"};
    } catch (error) {
        console.error(`SALESFORCE RESOLVER: Failed to delete article: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// Subscription functions for real-time updates
async function getAndProcessRecords(resolver, entityType) {
    try {
        let endpoint;
        let query;
        switch (entityType) {
            case 'contacts':
                query = 'SELECT Id,FirstName,LastName,Account.Name,Email,AccountId,OwnerId,Owner.Name,MobilePhone,Phone,Title,Salutation,LastModifiedDate FROM Contact';
                break;
            case 'leads':
                query = 'SELECT Id,FirstName,LastName,Company,Email,OwnerId,Owner.Name,Phone,Salutation,Title,Website,Industry,LastModifiedDate FROM Lead';
                break;
            case 'accounts':
                query = 'SELECT Id,Name,Description,Website,Industry,BillingCity,BillingCountry,OwnerId,Owner.Name,LastModifiedDate FROM Account';
                break;
            case 'opportunities':
                query = 'SELECT Id,Name,Account.Name,AccountId,Amount,Description,CloseDate,CreatedById,CreatedBy.Name,OwnerId,Owner.Name,StageName,Probability,Type,LastModifiedDate FROM Opportunity';
                break;
            case 'tickets':
                query = 'SELECT Id,CaseNumber,Subject,AccountId,Account.Name,ContactId,Contact.Name,OwnerId,Owner.Name,Priority,Status,Description,Type,CreatedDate,ClosedDate,Origin,IsClosed,IsEscalated,LastModifiedDate FROM Case';
                break;
            case 'articles':
                query = 'SELECT Id,Title,Body,LastModifiedDate FROM Knowledge__kav';
                break;
            default:
                console.error(`SALESFORCE RESOLVER: Unknown entity type: ${entityType}`);
                return;
        }

        const result = await makeGetRequest(`/services/data/v59.0/query/?q=${encodeURIComponent(query)}`);
        
        if (result && result.records && Array.isArray(result.records)) {
            for (let i = 0; i < result.records.length; ++i) {
                const record = result.records[i];
                console.log(`SALESFORCE RESOLVER: Processing ${entityType} ${record.Id}`);
                
                // Create instance for subscription
                const inst = {
                    id: record.Id,
                    type: entityType,
                    data: record,
                    timestamp: new Date().toISOString()
                };
                
                await resolver.onSubscription(inst, true);
            }
        }
    } catch (error) {
        console.error(`SALESFORCE RESOLVER: Failed to process ${entityType} records: ${error}`);
    }
}

async function handleSubsContacts(resolver) {
    console.log('SALESFORCE RESOLVER: Fetching contacts for subscription...');
    await getAndProcessRecords(resolver, 'contacts');
}

async function handleSubsLeads(resolver) {
    console.log('SALESFORCE RESOLVER: Fetching leads for subscription...');
    await getAndProcessRecords(resolver, 'leads');
}

async function handleSubsAccounts(resolver) {
    console.log('SALESFORCE RESOLVER: Fetching accounts for subscription...');
    await getAndProcessRecords(resolver, 'accounts');
}

async function handleSubsOpportunities(resolver) {
    console.log('SALESFORCE RESOLVER: Fetching opportunities for subscription...');
    await getAndProcessRecords(resolver, 'opportunities');
}

async function handleSubsTickets(resolver) {
    console.log('SALESFORCE RESOLVER: Fetching tickets for subscription...');
    await getAndProcessRecords(resolver, 'tickets');
}

async function handleSubsArticles(resolver) {
    console.log('SALESFORCE RESOLVER: Fetching articles for subscription...');
    await getAndProcessRecords(resolver, 'articles');
}

export async function subsContacts(resolver) {
    await handleSubsContacts(resolver);
    const intervalMinutes = parseInt(getLocalEnv("SALESFORCE_POLL_INTERVAL_MINUTES")) || 15;
    const intervalMs = intervalMinutes * 60 * 1000;
    console.log(`SALESFORCE RESOLVER: Setting contacts polling interval to ${intervalMinutes} minutes`);
    setInterval(async () => {
        await handleSubsContacts(resolver);
    }, intervalMs);
}

export async function subsLeads(resolver) {
    await handleSubsLeads(resolver);
    const intervalMinutes = parseInt(getLocalEnv("SALESFORCE_POLL_INTERVAL_MINUTES")) || 15;
    const intervalMs = intervalMinutes * 60 * 1000;
    console.log(`SALESFORCE RESOLVER: Setting leads polling interval to ${intervalMinutes} minutes`);
    setInterval(async () => {
        await handleSubsLeads(resolver);
    }, intervalMs);
}

export async function subsAccounts(resolver) {
    await handleSubsAccounts(resolver);
    const intervalMinutes = parseInt(getLocalEnv("SALESFORCE_POLL_INTERVAL_MINUTES")) || 15;
    const intervalMs = intervalMinutes * 60 * 1000;
    console.log(`SALESFORCE RESOLVER: Setting accounts polling interval to ${intervalMinutes} minutes`);
    setInterval(async () => {
        await handleSubsAccounts(resolver);
    }, intervalMs);
}

export async function subsOpportunities(resolver) {
    await handleSubsOpportunities(resolver);
    const intervalMinutes = parseInt(getLocalEnv("SALESFORCE_POLL_INTERVAL_MINUTES")) || 15;
    const intervalMs = intervalMinutes * 60 * 1000;
    console.log(`SALESFORCE RESOLVER: Setting opportunities polling interval to ${intervalMinutes} minutes`);
    setInterval(async () => {
        await handleSubsOpportunities(resolver);
    }, intervalMs);
}

export async function subsTickets(resolver) {
    await handleSubsTickets(resolver);
    const intervalMinutes = parseInt(getLocalEnv("SALESFORCE_POLL_INTERVAL_MINUTES")) || 15;
    const intervalMs = intervalMinutes * 60 * 1000;
    console.log(`SALESFORCE RESOLVER: Setting tickets polling interval to ${intervalMinutes} minutes`);
    setInterval(async () => {
        await handleSubsTickets(resolver);
    }, intervalMs);
}

export async function subsArticles(resolver) {
    await handleSubsArticles(resolver);
    const intervalMinutes = parseInt(getLocalEnv("SALESFORCE_POLL_INTERVAL_MINUTES")) || 15;
    const intervalMs = intervalMinutes * 60 * 1000;
    console.log(`SALESFORCE RESOLVER: Setting articles polling interval to ${intervalMinutes} minutes`);
    setInterval(async () => {
        await handleSubsArticles(resolver);
    }, intervalMs);
}
