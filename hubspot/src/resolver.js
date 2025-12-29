// Import agentlang modules
import { getLocalEnv } from "agentlang/out/runtime/auth/defs.js";
import { makeInstance } from "agentlang/out/runtime/module.js";

function asInstance(entity, entityType) {
  const instanceMap = new Map(Object.entries(entity));
  return makeInstance("hubspot", entityType, instanceMap);
}

const getResponseBody = async (response) => {
    try {
        try {
            return await response.json()
        } catch (e) {
            return await response.text();
        }
    } catch (error) {
        console.error("HUBSPOT RESOLVER: Error reading response body:", error);
        return {};
    }
}

// Generic HTTP functions
const makeRequest = async (endpoint, options = {}) => {
    const baseUrl =  getLocalEnv("HUBSPOT_BASE_URL") || 'https://api.hubapi.com'
    const accessToken =  getLocalEnv("HUBSPOT_ACCESS_TOKEN")
    
    if (!accessToken) {
        throw new Error('HubSpot access token is required');
    }
    
    const url = `${baseUrl}${endpoint}`;
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        }
    };

    console.log(`HUBSPOT RESOLVER: making http request ${options.method} ${url} with options ${JSON.stringify(options)}`)

    const config = { ...defaultOptions, ...options };
    
    // Remove Content-Type header for GET requests without body
    if (config.method === 'GET') {
        delete config.headers['Content-Type'];
    }

    const timeoutMs = 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        console.error(`HUBSPOT RESOLVER: Request timeout after ${timeoutMs}ms - ${url} - ${JSON.stringify(options)}`);
        controller.abort();
    }, timeoutMs);

    try {
        const response = await fetch(url, {
            ...config,
            signal: controller.signal
        });

        const body = await getResponseBody(response);
        console.log(`HUBSPOT RESOLVER: response ${response.status} ${response.ok}`, body)
    
        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error(`HUBSPOT RESOLVER: HTTP Error ${response.status} - ${url} - ${JSON.stringify(options)}`);
            throw new Error(`HTTP Error: ${response.status} - ${JSON.stringify(body)}`);
        }

        return body;

    } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
            console.error(`HUBSPOT RESOLVER: Request timeout - ${url} - ${JSON.stringify(options)}`);
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'EHOSTUNREACH') {
            console.error(`HUBSPOT RESOLVER: Network unreachable (${error.code}) - ${url} - ${JSON.stringify(options)}`);
        } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
            console.error(`HUBSPOT RESOLVER: Connection error (${error.code}) - ${url} - ${JSON.stringify(options)}`);
        } else {
            console.error(`HUBSPOT RESOLVER: Request failed (${error.name}) - ${url} - ${JSON.stringify(options)}`);
        }
        
        throw error;
    }
};

const makeGetRequest = async (endpoint) => {
    console.log(`HUBSPOT RESOLVER: Querying HubSpot: ${endpoint}\n`);    
    return await makeRequest(endpoint, { method: 'GET' });
};

const makePostRequest = async (endpoint, body) => {
    console.log(`HUBSPOT RESOLVER: Creating in HubSpot: ${endpoint}\n`);
    return await makeRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(body)
    });
};

const makePatchRequest = async (endpoint, body) => {
    console.log(`HUBSPOT RESOLVER: Updating in HubSpot: ${endpoint}\n`);
    return await makeRequest(endpoint, {
        method: 'PATCH',
        body: JSON.stringify(body)
    });
};

const makeDeleteRequest = async (endpoint) => {
    console.log(`HUBSPOT RESOLVER: Deleting from HubSpot: ${endpoint}\n`);
    return await makeRequest(endpoint, { method: 'DELETE' });
};

// Contact functions
export const createContact = async (env, attributes) => {
    const data = {
        properties: {
            firstname: attributes.attributes.get('first_name'),
            lastname: attributes.attributes.get('last_name'),
            email: attributes.attributes.get('email'),
            jobtitle: attributes.attributes.get('job_title'),
            lastcontacted: attributes.attributes.get('last_contacted'),
            lastactivitydate: attributes.attributes.get('last_activity_date'),
            hs_lead_status: attributes.attributes.get('lead_status'),
            lifecyclestage: attributes.attributes.get('lifecycle_stage'),
            salutation: attributes.attributes.get('salutation'),
            mobilephone: attributes.attributes.get('mobile_phone_number'),
            website: attributes.attributes.get('website_url'),
            hubspot_owner_id: attributes.attributes.get('owner')
        }
    };

    try {
        const result = await makePostRequest('/crm/v3/objects/contacts', data);
        return {"result": "success", "id": result.id};
    } catch (error) {
        console.error(`HUBSPOT RESOLVER: Failed to create contact: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const queryContact = async (env, attrs) => {
    const id = attrs.queryAttributeValues?.get('__path__')?.split('/')?.pop() ?? null;

    console.log(`HUBSPOT RESOLVER: Querying HubSpot: ${id}\n`);
    try {
        let inst
        if (id) {
            inst = await makeGetRequest(`/crm/v3/objects/contacts/${id}`);
        } else {
            inst = await makeGetRequest('/crm/v3/objects/contacts');
            inst = inst.results
        }
        if (!(inst instanceof Array)) {
            inst = [inst]
        }
        return inst.map((data) => { return asInstance(data, 'Contact') })
    } catch (error) {
        console.error(`HUBSPOT RESOLVER: Failed to query contacts: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const updateContact = async (env, attributes, newAttrs) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "Contact ID is required for update"};
    }

    const data = {
        properties: {
            firstname: newAttrs.get('first_name'),
            lastname: newAttrs.get('last_name'),
            email: newAttrs.get('email'),
            jobtitle: newAttrs.get('job_title'),
            lastcontacted: newAttrs.get('last_contacted'),
            lastactivitydate: newAttrs.get('last_activity_date'),
            hs_lead_status: newAttrs.get('lead_status'),
            lifecyclestage: newAttrs.get('lifecycle_stage'),
            salutation: newAttrs.get('salutation'),
            mobilephone: newAttrs.get('mobile_phone_number'),
            website: newAttrs.get('website_url'),
            hubspot_owner_id: newAttrs.get('owner')
        }
    };

    try {
        const result = await makePatchRequest(`/crm/v3/objects/contacts/${id}`, data);
        return asInstance(result, 'Contact')
    } catch (error) {
        console.error(`HUBSPOT RESOLVER: Failed to update contact: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const deleteContact = async (env, attributes) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "Contact ID is required for deletion"};
    }

    try {
        await makeDeleteRequest(`/crm/v3/objects/contacts/${id}`);
        return {"result": "success"};
    } catch (error) {
        console.error(`HUBSPOT RESOLVER: Failed to delete contact: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// Company functions
export const createCompany = async (env, attributes) => {
    const data = {
        properties: {
            name: attributes.attributes.get('name'),
            industry: attributes.attributes.get('industry'),
            description: attributes.attributes.get('description'),
            country: attributes.attributes.get('country'),
            city: attributes.attributes.get('city'),
            hs_lead_status: attributes.attributes.get('lead_status'),
            lifecyclestage: attributes.attributes.get('lifecycle_stage'),
            hubspot_owner_id: attributes.attributes.get('owner'),
            founded_year: attributes.attributes.get('year_founded'),
            website: attributes.attributes.get('website_url')
        }
    };

    try {
        const result = await makePostRequest('/crm/v3/objects/companies', data);
        return {"result": "success", "id": result.id};
    } catch (error) {
        console.error(`HUBSPOT RESOLVER: Failed to create company: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const queryCompany = async (env, attrs) => {
    const id = attrs.queryAttributeValues?.get('__path__')?.split('/')?.pop() ?? null;

    console.log(`HUBSPOT RESOLVER: Querying HubSpot: ${id}\n`);
    try {
        let inst
        if (id) {
            inst = await makeGetRequest(`/crm/v3/objects/companies/${id}`);
        } else {
            inst = await makeGetRequest('/crm/v3/objects/companies');
            inst = inst.results
        }
        if (!(inst instanceof Array)) {
            inst = [inst]
        }
        return inst.map((data) => { return asInstance(data, 'Company') })
    } catch (error) {
        console.error(`HUBSPOT RESOLVER: Failed to query companies: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const updateCompany = async (env, attributes, newAttrs) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "Company ID is required for update"};
    }

    const data = {
        properties: {
            name: newAttrs.get('name'),
            industry: newAttrs.get('industry'),
            description: newAttrs.get('description'),
            country: newAttrs.get('country'),
            city: newAttrs.get('city'),
            hs_lead_status: newAttrs.get('lead_status'),
            lifecyclestage: newAttrs.get('lifecycle_stage'),
            hubspot_owner_id: newAttrs.get('owner'),
            founded_year: newAttrs.get('year_founded'),
            website: newAttrs.get('website_url')
        }
    };

    try {
        const result = await makePatchRequest(`/crm/v3/objects/companies/${id}`, data);
        return asInstance(result, 'Company')
    } catch (error) {
        console.error(`HUBSPOT RESOLVER: Failed to update company: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const deleteCompany = async (env, attributes) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "Company ID is required for deletion"};
    }

    try {
        await makeDeleteRequest(`/crm/v3/objects/companies/${id}`);
        return {"result": "success"};
    } catch (error) {
        console.error(`HUBSPOT RESOLVER: Failed to delete company: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// Deal functions
export const createDeal = async (env, attributes) => {
    const data = {
        properties: {
            dealname: attributes.attributes.get('deal_name'),
            dealstage: attributes.attributes.get('deal_stage'),
            amount: attributes.attributes.get('amount'),
            closedate: attributes.attributes.get('close_date'),
            dealtype: attributes.attributes.get('deal_type'),
            description: attributes.attributes.get('description'),
            hubspot_owner_id: attributes.attributes.get('owner'),
            pipeline: attributes.attributes.get('pipeline'),
            priority: attributes.attributes.get('priority')
        }
    };

    try {
        const result = await makePostRequest('/crm/v3/objects/deals', data);
        return {"result": "success", "id": result.id};
    } catch (error) {
        console.error(`HUBSPOT RESOLVER: Failed to create deal: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const queryDeal = async (env, attrs) => {
    const id = attrs.queryAttributeValues?.get('__path__')?.split('/')?.pop() ?? null;

    console.log(`HUBSPOT RESOLVER: Querying HubSpot: ${id}\n`);
    try {
        let inst
        if (id) {
            inst = await makeGetRequest(`/crm/v3/objects/deals/${id}`);
        } else {
            inst = await makeGetRequest('/crm/v3/objects/deals');
            inst = inst.results
        }
        if (!(inst instanceof Array)) {
            inst = [inst]
        }
        return inst.map((data) => { return asInstance(data, 'Deal') })
    } catch (error) {
        console.error(`HUBSPOT RESOLVER: Failed to query deals: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const updateDeal = async (env, attributes, newAttrs) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "Deal ID is required for update"};
    }

    const data = {
        properties: {
            dealname: newAttrs.get('deal_name'),
            dealstage: newAttrs.get('deal_stage'),
            amount: newAttrs.get('amount'),
            closedate: newAttrs.get('close_date'),
            dealtype: newAttrs.get('deal_type'),
            description: newAttrs.get('description'),
            hubspot_owner_id: newAttrs.get('owner'),
            pipeline: newAttrs.get('pipeline'),
            priority: newAttrs.get('priority')
        }
    };

    try {
        const result = await makePatchRequest(`/crm/v3/objects/deals/${id}`, data);
        return asInstance(result, 'Deal')
    } catch (error) {
        console.error(`HUBSPOT RESOLVER: Failed to update deal: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const deleteDeal = async (env, attributes) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "Deal ID is required for deletion"};
    }

    try {
        await makeDeleteRequest(`/crm/v3/objects/deals/${id}`);
        return {"result": "success"};
    } catch (error) {
        console.error(`HUBSPOT RESOLVER: Failed to delete deal: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// Owner functions
export const createOwner = async (env, attributes) => {
    const data = {
        email: attributes.attributes.get('email'),
        firstName: attributes.attributes.get('first_name'),
        lastName: attributes.attributes.get('last_name')
    };

    try {
        const result = await makePostRequest('/crm/v3/owners', data);
        return {"result": "success", "id": result.id};
    } catch (error) {
        console.error(`HUBSPOT RESOLVER: Failed to create owner: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const queryOwner = async (env, attrs) => {
    const id = attrs.queryAttributeValues?.get('__path__')?.split('/')?.pop() ?? null;

    console.log(`HUBSPOT RESOLVER: Querying HubSpot: ${id}\n`);
    try {
        let inst
        if (id) {
            inst = await makeGetRequest(`/crm/v3/owners/${id}`);
        } else {
            inst = await makeGetRequest('/crm/v3/owners');
            inst = inst.results
        }
        if (!(inst instanceof Array)) {
            inst = [inst]
        }
        return inst.map((data) => { return asInstance(data, 'Owner') })
    } catch (error) {
        console.error(`HUBSPOT RESOLVER: Failed to query owners: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const updateOwner = async (env, attributes, newAttrs) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "Owner ID is required for update"};
    }

    const data = {
        email: newAttrs.get('email'),
        firstName: newAttrs.get('first_name'),
        lastName: newAttrs.get('last_name')
    };

    try {
        const result = await makePatchRequest(`/crm/v3/owners/${id}`, data);
        return asInstance(result, 'Owner')
    } catch (error) {
        console.error(`HUBSPOT RESOLVER: Failed to update owner: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const deleteOwner = async (env, attributes) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "Owner ID is required for deletion"};
    }

    try {
        await makeDeleteRequest(`/crm/v3/owners/${id}`);
        return {"result": "success"};
    } catch (error) {
        console.error(`HUBSPOT RESOLVER: Failed to delete owner: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// Task functions
export const createTask = async (env, attributes) => {
    const data = {
        properties: {
            hs_task_type: attributes.attributes.get('task_type'),
            hs_task_subject: attributes.attributes.get('title'),
            hs_task_priority: attributes.attributes.get('priority'),
            hs_task_assigned_to: attributes.attributes.get('assigned_to'),
            hs_task_due_date: attributes.attributes.get('due_date'),
            hs_task_status: attributes.attributes.get('status'),
            hs_task_body: attributes.attributes.get('description'),
            hubspot_owner_id: attributes.attributes.get('owner')
        }
    };

    try {
        const result = await makePostRequest('/crm/v3/objects/tasks', data);
        return {"result": "success", "id": result.id};
    } catch (error) {
        console.error(`HUBSPOT RESOLVER: Failed to create task: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const queryTask = async (env, attrs) => {
    const id = attrs.queryAttributeValues?.get('__path__')?.split('/')?.pop() ?? null;

    console.log(`HUBSPOT RESOLVER: Querying HubSpot: ${id}\n`);
    try {
        let inst
        if (id) {
            inst = await makeGetRequest(`/crm/v3/objects/tasks/${id}`);
        } else {
            inst = await makeGetRequest('/crm/v3/objects/tasks');
            inst = inst.results
        }
        if (!(inst instanceof Array)) {
            inst = [inst]
        }
        return inst.map((data) => { return asInstance(data, 'Task') })
    } catch (error) {
        console.error(`HUBSPOT RESOLVER: Failed to query tasks: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const updateTask = async (env, attributes, newAttrs) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "Task ID is required for update"};
    }

    const data = {
        properties: {
            hs_task_type: newAttrs.get('task_type'),
            hs_task_subject: newAttrs.get('title'),
            hs_task_priority: newAttrs.get('priority'),
            hs_task_assigned_to: newAttrs.get('assigned_to'),
            hs_task_due_date: newAttrs.get('due_date'),
            hs_task_status: newAttrs.get('status'),
            hs_task_body: newAttrs.get('description'),
            hubspot_owner_id: newAttrs.get('owner')
        }
    };

    try {
        const result = await makePatchRequest(`/crm/v3/objects/tasks/${id}`, data);
        return asInstance(result, 'Task')
    } catch (error) {
        console.error(`HUBSPOT RESOLVER: Failed to update task: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const deleteTask = async (env, attributes) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "Task ID is required for deletion"};
    }

    try {
        await makeDeleteRequest(`/crm/v3/objects/tasks/${id}`);
        return {"result": "success"};
    } catch (error) {
        console.error(`HUBSPOT RESOLVER: Failed to delete task: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// Subscription functions for real-time updates
async function getAndProcessRecords(resolver, entityType) {
    try {
        let endpoint;
        switch (entityType) {
            case 'contacts':
                endpoint = '/crm/v3/objects/contacts';
                break;
            case 'companies':
                endpoint = '/crm/v3/objects/companies';
                break;
            case 'deals':
                endpoint = '/crm/v3/objects/deals';
                break;
            case 'owners':
                endpoint = '/crm/v3/owners';
                break;
            case 'tasks':
                endpoint = '/crm/v3/objects/tasks';
                break;
            default:
                console.error(`HUBSPOT RESOLVER: Unknown entity type: ${entityType}`);
                return;
        }

        const result = await makeGetRequest(endpoint);
        
        if (result && result.results && Array.isArray(result.results)) {
            for (let i = 0; i < result.results.length; ++i) {
                const record = result.results[i];
                console.log(`HUBSPOT RESOLVER: Processing ${entityType} ${record.id}`);
                
                // Create instance for subscription
                const inst = {
                    id: record.id,
                    type: entityType,
                    data: record,
                    timestamp: new Date().toISOString()
                };
                
                await resolver.onSubscription(inst, true);
            }
        }
    } catch (error) {
        console.error(`HUBSPOT RESOLVER: Failed to process ${entityType} records: ${error}`);
    }
}

async function handleSubsContacts(resolver) {
    console.log('HUBSPOT RESOLVER: Fetching contacts for subscription...');
    await getAndProcessRecords(resolver, 'contacts');
}

async function handleSubsCompanies(resolver) {
    console.log('HUBSPOT RESOLVER: Fetching companies for subscription...');
    await getAndProcessRecords(resolver, 'companies');
}

async function handleSubsDeals(resolver) {
    console.log('HUBSPOT RESOLVER: Fetching deals for subscription...');
    await getAndProcessRecords(resolver, 'deals');
}

async function handleSubsOwners(resolver) {
    console.log('HUBSPOT RESOLVER: Fetching owners for subscription...');
    await getAndProcessRecords(resolver, 'owners');
}

async function handleSubsTasks(resolver) {
    console.log('HUBSPOT RESOLVER: Fetching tasks for subscription...');
    await getAndProcessRecords(resolver, 'tasks');
}

export async function subsContacts(resolver) {
    await handleSubsContacts(resolver);
    const intervalMinutes = parseInt(getLocalEnv("HUBSPOT_POLL_INTERVAL_MINUTES")) || 15;
    const intervalMs = intervalMinutes * 60 * 1000;
    console.log(`HUBSPOT RESOLVER: Setting contacts polling interval to ${intervalMinutes} minutes`);
    setInterval(async () => {
        await handleSubsContacts(resolver);
    }, intervalMs);
}

export async function subsCompanies(resolver) {
    await handleSubsCompanies(resolver);
    const intervalMinutes = parseInt(getLocalEnv("HUBSPOT_POLL_INTERVAL_MINUTES")) || 15;
    const intervalMs = intervalMinutes * 60 * 1000;
    console.log(`HUBSPOT RESOLVER: Setting companies polling interval to ${intervalMinutes} minutes`);
    setInterval(async () => {
        await handleSubsCompanies(resolver);
    }, intervalMs);
}

export async function subsDeals(resolver) {
    await handleSubsDeals(resolver);
    const intervalMinutes = parseInt(getLocalEnv("HUBSPOT_POLL_INTERVAL_MINUTES")) || 15;
    const intervalMs = intervalMinutes * 60 * 1000;
    console.log(`HUBSPOT RESOLVER: Setting deals polling interval to ${intervalMinutes} minutes`);
    setInterval(async () => {
        await handleSubsDeals(resolver);
    }, intervalMs);
}

export async function subsOwners(resolver) {
    await handleSubsOwners(resolver);
    const intervalMinutes = parseInt(getLocalEnv("HUBSPOT_POLL_INTERVAL_MINUTES")) || 15;
    const intervalMs = intervalMinutes * 60 * 1000;
    console.log(`HUBSPOT RESOLVER: Setting owners polling interval to ${intervalMinutes} minutes`);
    setInterval(async () => {
        await handleSubsOwners(resolver);
    }, intervalMs);
}

export async function subsTasks(resolver) {
    await handleSubsTasks(resolver);
    const intervalMinutes = parseInt(getLocalEnv("HUBSPOT_POLL_INTERVAL_MINUTES")) || 15;
    const intervalMs = intervalMinutes * 60 * 1000;
    console.log(`HUBSPOT RESOLVER: Setting tasks polling interval to ${intervalMinutes} minutes`);
    setInterval(async () => {
        await handleSubsTasks(resolver);
    }, intervalMs);
}
