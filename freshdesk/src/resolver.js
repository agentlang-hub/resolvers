import { getLocalEnv } from "agentlang/out/runtime/auth/defs.js";
import { makeInstance } from "agentlang/out/runtime/module.js";

// Mapper functions for Freshdesk API responses to Agentlang entities
function toTicket(ticket, baseUrl) {
    return {
        id: String(ticket.id),
        created_at: ticket.created_at || '',
        updated_at: ticket.updated_at || '',
        subject: ticket.subject || '',
        description: ticket.description_text || ticket.description || '',
        status: String(ticket.status) || '',
        priority: String(ticket.priority) || '',
        type: ticket.type || '',
        source: String(ticket.source) || '',
        requester_id: ticket.requester_id ? String(ticket.requester_id) : '',
        responder_id: ticket.responder_id ? String(ticket.responder_id) : '',
        group_id: ticket.group_id ? String(ticket.group_id) : '',
        company_id: ticket.company_id ? String(ticket.company_id) : '',
        tags: ticket.tags ? ticket.tags.join(',') : '',
        url: ticket.url || '',
        web_url: ticket.web_url || `${baseUrl}/a/tickets/${ticket.id}`
    };
}

function toContact(contact) {
    return {
        id: String(contact.id),
        created_at: contact.created_at || '',
        updated_at: contact.updated_at || '',
        name: contact.name || '',
        email: contact.email || '',
        phone: contact.phone || '',
        mobile: contact.mobile || '',
        company_id: contact.company_id ? String(contact.company_id) : '',
        job_title: contact.job_title || '',
        active: contact.active || false,
        address: contact.address || ''
    };
}

function toAgent(agent) {
    return {
        id: String(agent.id),
        created_at: agent.created_at || '',
        updated_at: agent.updated_at || '',
        email: agent.email || '',
        name: agent.name || '',
        active: agent.active || false,
        job_title: agent.job_title || '',
        phone: agent.phone || '',
        mobile: agent.mobile || '',
        time_zone: agent.time_zone || '',
        role: agent.role || ''
    };
}

function toCompany(company) {
    return {
        id: String(company.id),
        created_at: company.created_at || '',
        updated_at: company.updated_at || '',
        name: company.name || '',
        description: company.description || '',
        note: company.note || '',
        domains: company.domains ? company.domains.join(',') : '',
        industry: company.industry || '',
        custom_fields: company.custom_fields || {}
    };
}

function toGroup(group) {
    return {
        id: String(group.id),
        created_at: group.created_at || '',
        updated_at: group.updated_at || '',
        name: group.name || '',
        description: group.description || '',
        agent_ids: group.agent_ids ? group.agent_ids.map(id => String(id)).join(',') : ''
    };
}

function asInstance(entity, entityType) {
    const instanceMap = new Map(Object.entries(entity));
    return makeInstance('freshdesk', entityType, instanceMap);
}

const getResponseBody = async (response) => {
    try {
        try {
            return await response.json();
        } catch (e) {
            return await response.text();
        }
    } catch (error) {
        console.error("FRESHDESK RESOLVER: Error reading response body:", error);
        return {};
    }
}

// Freshdesk API configuration and authentication
let domain = null;
let baseUrl = null;
let apiKey = null;

async function getDomain() {
    if (domain && baseUrl) {
        return { domain, baseUrl };
    }

    domain = getLocalEnv("FRESHDESK_DOMAIN");
    baseUrl = getLocalEnv("FRESHDESK_BASE_URL");

    if (!domain) {
        throw new Error('Freshdesk configuration is required: FRESHDESK_DOMAIN');
    }

    if (!baseUrl) {
        baseUrl = `https://${domain}.freshdesk.com`;
    }

    console.log(`FRESHDESK RESOLVER: Using domain: ${domain}, base URL: ${baseUrl}`);
    return { domain, baseUrl };
}

async function getApiKey() {
    if (apiKey) {
        return apiKey;
    }

    apiKey = getLocalEnv("FRESHDESK_API_KEY");

    if (!apiKey) {
        throw new Error('Freshdesk API key is required: FRESHDESK_API_KEY');
    }

    console.log('FRESHDESK RESOLVER: Using API key');
    return apiKey;
}

// Generic HTTP functions
const makeRequest = async (endpoint, options = {}) => {
    const { domain, baseUrl } = await getDomain();
    const token = await getApiKey();
    
    if (!token) {
        throw new Error('Freshdesk API key is required');
    }

    const url = `${baseUrl}/api/v2${endpoint}`;
    
    // Freshdesk uses Basic auth with API key as password (username can be anything or empty)
    const authHeader = `Basic ${Buffer.from(`${token}:X`).toString('base64')}`;
    
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader,
            'Accept': 'application/json'
        }
    };

    console.log(`FRESHDESK RESOLVER: making http request ${options.method || 'GET'} ${url} with options ${JSON.stringify(options)}`);

    const config = { ...defaultOptions, ...options };
    
    // Remove Content-Type header for GET requests without body
    if (config.method === 'GET' && !config.body) {
        delete config.headers['Content-Type'];
    }

    const timeoutMs = 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        console.error(`FRESHDESK RESOLVER: Request timeout after ${timeoutMs}ms - ${url} - ${JSON.stringify(options)}`);
        controller.abort();
    }, timeoutMs);

    try {
        const response = await fetch(url, {
            ...config,
            signal: controller.signal
        });

        const body = await getResponseBody(response);
        console.log(`FRESHDESK RESOLVER: response ${response.status} ${response.ok}`, body);
    
        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error(`FRESHDESK RESOLVER: HTTP Error ${response.status} - ${url} - ${JSON.stringify(options)}`);
            throw new Error(`HTTP Error: ${response.status} - ${JSON.stringify(body)}`);
        }

        return body;

    } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
            console.error(`FRESHDESK RESOLVER: Request timeout - ${url} - ${JSON.stringify(options)}`);
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'EHOSTUNREACH') {
            console.error(`FRESHDESK RESOLVER: Network unreachable (${error.code}) - ${url} - ${JSON.stringify(options)}`);
        } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
            console.error(`FRESHDESK RESOLVER: Connection error (${error.code}) - ${url} - ${JSON.stringify(options)}`);
        } else {
            console.error(`FRESHDESK RESOLVER: Request failed (${error.name}) - ${url} - ${JSON.stringify(options)}`);
        }
        
        throw error;
    }
};

const makeGetRequest = async (endpoint) => {
    console.log(`FRESHDESK RESOLVER: Querying Freshdesk: ${endpoint}\n`);    
    return await makeRequest(endpoint, { method: 'GET' });
};

const makePostRequest = async (endpoint, body) => {
    console.log(`FRESHDESK RESOLVER: Creating in Freshdesk: ${endpoint}\n`);
    return await makeRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(body)
    });
};

const makePutRequest = async (endpoint, body) => {
    console.log(`FRESHDESK RESOLVER: Updating in Freshdesk: ${endpoint}\n`);
    return await makeRequest(endpoint, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
};

const makeDeleteRequest = async (endpoint) => {
    console.log(`FRESHDESK RESOLVER: Deleting from Freshdesk: ${endpoint}\n`);
    return await makeRequest(endpoint, { method: 'DELETE' });
};

// Ticket functions
export const createTicket = async (env, attributes) => {
    const subject = attributes.attributes.get('subject');
    const description = attributes.attributes.get('description');
    const email = attributes.attributes.get('email');
    const priority = attributes.attributes.get('priority');
    const status = attributes.attributes.get('status');
    const type = attributes.attributes.get('type');
    const tags = attributes.attributes.get('tags');
    const groupId = attributes.attributes.get('group_id');
    const responderId = attributes.attributes.get('responder_id');
    const companyId = attributes.attributes.get('company_id');

    if (!subject || !email) {
        return {"result": "error", "message": "Subject and email are required"};
    }

    const { baseUrl } = await getDomain();
    
    const data = {
        subject,
        email,
        description: description || ''
    };

    if (priority) {
        data.priority = parseInt(priority) || 1;
    }
    if (status) {
        data.status = parseInt(status) || 2;
    }
    if (type) {
        data.type = type;
    }
    if (tags) {
        data.tags = tags.split(',').map(tag => tag.trim());
    }
    if (groupId) {
        data.group_id = parseInt(groupId);
    }
    if (responderId) {
        data.responder_id = parseInt(responderId);
    }
    if (companyId) {
        data.company_id = parseInt(companyId);
    }

    try {
        const result = await makePostRequest('/tickets', data);
        return asInstance(toTicket(result, baseUrl), 'Ticket');
    } catch (error) {
        console.error(`FRESHDESK RESOLVER: Failed to create ticket: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const queryTicket = async (env, attrs) => {
    const id = attrs.queryAttributeValues?.get('__path__')?.split('/')?.pop() ?? null;

    console.log(`FRESHDESK RESOLVER: Querying Freshdesk ticket: ${id}\n`);
    try {
        const { baseUrl } = await getDomain();
        
        if (id) {
            const ticket = await makeGetRequest(`/tickets/${id}`);
            return [asInstance(toTicket(ticket, baseUrl), 'Ticket')];
        } else {
            // Get all tickets (limited to 100)
            const tickets = await makeGetRequest('/tickets?per_page=100');
            return tickets.map(ticket => {
                const mappedData = toTicket(ticket, baseUrl);
                return asInstance(mappedData, 'Ticket');
            });
        }
    } catch (error) {
        console.error(`FRESHDESK RESOLVER: Failed to query tickets: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const updateTicket = async (env, attributes, newAttrs) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "Ticket ID is required"};
    }

    const { baseUrl } = await getDomain();
    
    const data = {};
    if (newAttrs.get('subject')) {
        data.subject = newAttrs.get('subject');
    }
    if (newAttrs.get('description')) {
        data.description = newAttrs.get('description');
    }
    if (newAttrs.get('priority')) {
        data.priority = parseInt(newAttrs.get('priority'));
    }
    if (newAttrs.get('status')) {
        data.status = parseInt(newAttrs.get('status'));
    }
    if (newAttrs.get('type')) {
        data.type = newAttrs.get('type');
    }
    if (newAttrs.get('tags')) {
        data.tags = newAttrs.get('tags').split(',').map(tag => tag.trim());
    }
    if (newAttrs.get('group_id')) {
        data.group_id = parseInt(newAttrs.get('group_id'));
    }
    if (newAttrs.get('responder_id')) {
        data.responder_id = parseInt(newAttrs.get('responder_id'));
    }
    if (newAttrs.get('company_id')) {
        data.company_id = parseInt(newAttrs.get('company_id'));
    }

    try {
        const result = await makePutRequest(`/tickets/${id}`, data);
        return asInstance(toTicket(result, baseUrl), 'Ticket');
    } catch (error) {
        console.error(`FRESHDESK RESOLVER: Failed to update ticket: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const deleteTicket = async (env, attributes) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "Ticket ID is required"};
    }

    try {
        await makeDeleteRequest(`/tickets/${id}`);
        return {"result": "success"};
    } catch (error) {
        console.error(`FRESHDESK RESOLVER: Failed to delete ticket: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// Contact functions
export const createContact = async (env, attributes) => {
    const name = attributes.attributes.get('name');
    const email = attributes.attributes.get('email');
    const phone = attributes.attributes.get('phone');
    const mobile = attributes.attributes.get('mobile');
    const companyId = attributes.attributes.get('company_id');
    const jobTitle = attributes.attributes.get('job_title');
    const address = attributes.attributes.get('address');

    if (!name || !email) {
        return {"result": "error", "message": "Name and email are required"};
    }
    
    const data = {
        name,
        email
    };

    if (phone) {
        data.phone = phone;
    }
    if (mobile) {
        data.mobile = mobile;
    }
    if (companyId) {
        data.company_id = parseInt(companyId);
    }
    if (jobTitle) {
        data.job_title = jobTitle;
    }
    if (address) {
        data.address = address;
    }

    try {
        const result = await makePostRequest('/contacts', data);
        return asInstance(toContact(result), 'Contact');
    } catch (error) {
        console.error(`FRESHDESK RESOLVER: Failed to create contact: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const queryContact = async (env, attrs) => {
    const id = attrs.queryAttributeValues?.get('__path__')?.split('/')?.pop() ?? null;

    console.log(`FRESHDESK RESOLVER: Querying Freshdesk contact: ${id}\n`);
    try {
        if (id) {
            const contact = await makeGetRequest(`/contacts/${id}`);
            return [asInstance(toContact(contact), 'Contact')];
        } else {
            // Get all contacts (limited to 100)
            const contacts = await makeGetRequest('/contacts?per_page=100');
            return contacts.map(contact => asInstance(toContact(contact), 'Contact'));
        }
    } catch (error) {
        console.error(`FRESHDESK RESOLVER: Failed to query contacts: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const updateContact = async (env, attributes, newAttrs) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "Contact ID is required"};
    }
    
    const data = {};
    if (newAttrs.get('name')) {
        data.name = newAttrs.get('name');
    }
    if (newAttrs.get('email')) {
        data.email = newAttrs.get('email');
    }
    if (newAttrs.get('phone')) {
        data.phone = newAttrs.get('phone');
    }
    if (newAttrs.get('mobile')) {
        data.mobile = newAttrs.get('mobile');
    }
    if (newAttrs.get('company_id')) {
        data.company_id = parseInt(newAttrs.get('company_id'));
    }
    if (newAttrs.get('job_title')) {
        data.job_title = newAttrs.get('job_title');
    }
    if (newAttrs.get('address')) {
        data.address = newAttrs.get('address');
    }

    try {
        const result = await makePutRequest(`/contacts/${id}`, data);
        return asInstance(toContact(result), 'Contact');
    } catch (error) {
        console.error(`FRESHDESK RESOLVER: Failed to update contact: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const deleteContact = async (env, attributes) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "Contact ID is required"};
    }

    try {
        await makeDeleteRequest(`/contacts/${id}`);
        return {"result": "success"};
    } catch (error) {
        console.error(`FRESHDESK RESOLVER: Failed to delete contact: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// Agent functions
export const queryAgent = async (env, attrs) => {
    const id = attrs.queryAttributeValues?.get('__path__')?.split('/')?.pop() ?? null;

    console.log(`FRESHDESK RESOLVER: Querying Freshdesk agent: ${id}\n`);
    try {
        if (id) {
            const agent = await makeGetRequest(`/agents/${id}`);
            return [asInstance(toAgent(agent), 'Agent')];
        } else {
            // Get all agents (limited to 100)
            const agents = await makeGetRequest('/agents?per_page=100');
            return agents.map(agent => asInstance(toAgent(agent), 'Agent'));
        }
    } catch (error) {
        console.error(`FRESHDESK RESOLVER: Failed to query agents: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// Company functions
export const createCompany = async (env, attributes) => {
    const name = attributes.attributes.get('name');
    const description = attributes.attributes.get('description');
    const note = attributes.attributes.get('note');
    const domains = attributes.attributes.get('domains');
    const industry = attributes.attributes.get('industry');

    if (!name) {
        return {"result": "error", "message": "Company name is required"};
    }
    
    const data = {
        name
    };

    if (description) {
        data.description = description;
    }
    if (note) {
        data.note = note;
    }
    if (domains) {
        data.domains = domains.split(',').map(domain => domain.trim());
    }
    if (industry) {
        data.industry = industry;
    }

    try {
        const result = await makePostRequest('/companies', data);
        return asInstance(toCompany(result), 'Company');
    } catch (error) {
        console.error(`FRESHDESK RESOLVER: Failed to create company: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const queryCompany = async (env, attrs) => {
    const id = attrs.queryAttributeValues?.get('__path__')?.split('/')?.pop() ?? null;

    console.log(`FRESHDESK RESOLVER: Querying Freshdesk company: ${id}\n`);
    try {
        if (id) {
            const company = await makeGetRequest(`/companies/${id}`);
            return [asInstance(toCompany(company), 'Company')];
        } else {
            // Get all companies (limited to 100)
            const companies = await makeGetRequest('/companies?per_page=100');
            return companies.map(company => asInstance(toCompany(company), 'Company'));
        }
    } catch (error) {
        console.error(`FRESHDESK RESOLVER: Failed to query companies: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const updateCompany = async (env, attributes, newAttrs) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "Company ID is required"};
    }
    
    const data = {};
    if (newAttrs.get('name')) {
        data.name = newAttrs.get('name');
    }
    if (newAttrs.get('description')) {
        data.description = newAttrs.get('description');
    }
    if (newAttrs.get('note')) {
        data.note = newAttrs.get('note');
    }
    if (newAttrs.get('domains')) {
        data.domains = newAttrs.get('domains').split(',').map(domain => domain.trim());
    }
    if (newAttrs.get('industry')) {
        data.industry = newAttrs.get('industry');
    }

    try {
        const result = await makePutRequest(`/companies/${id}`, data);
        return asInstance(toCompany(result), 'Company');
    } catch (error) {
        console.error(`FRESHDESK RESOLVER: Failed to update company: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const deleteCompany = async (env, attributes) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "Company ID is required"};
    }

    try {
        await makeDeleteRequest(`/companies/${id}`);
        return {"result": "success"};
    } catch (error) {
        console.error(`FRESHDESK RESOLVER: Failed to delete company: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// Group functions
export const queryGroup = async (env, attrs) => {
    const id = attrs.queryAttributeValues?.get('__path__')?.split('/')?.pop() ?? null;

    console.log(`FRESHDESK RESOLVER: Querying Freshdesk group: ${id}\n`);
    try {
        if (id) {
            const group = await makeGetRequest(`/groups/${id}`);
            return [asInstance(toGroup(group), 'Group')];
        } else {
            // Get all groups (limited to 100)
            const groups = await makeGetRequest('/groups?per_page=100');
            return groups.map(group => asInstance(toGroup(group), 'Group'));
        }
    } catch (error) {
        console.error(`FRESHDESK RESOLVER: Failed to query groups: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// Create Ticket Action
export const createTicketAction = async (env, attributes) => {
    const subject = attributes.attributes.get('subject');
    const description = attributes.attributes.get('description');
    const email = attributes.attributes.get('email');
    const priority = attributes.attributes.get('priority');
    const status = attributes.attributes.get('status');
    const type = attributes.attributes.get('type');
    const tags = attributes.attributes.get('tags');
    const groupId = attributes.attributes.get('group_id');
    const responderId = attributes.attributes.get('responder_id');
    const companyId = attributes.attributes.get('company_id');

    if (!subject || !email) {
        return {"result": "error", "message": "Subject and email are required"};
    }

    const { baseUrl } = await getDomain();
    
    const data = {
        subject,
        email,
        description: description || ''
    };

    if (priority) {
        data.priority = parseInt(priority) || 1;
    }
    if (status) {
        data.status = parseInt(status) || 2;
    }
    if (type) {
        data.type = type;
    }
    if (tags) {
        data.tags = tags.split(',').map(tag => tag.trim());
    }
    if (groupId) {
        data.group_id = parseInt(groupId);
    }
    if (responderId) {
        data.responder_id = parseInt(responderId);
    }
    if (companyId) {
        data.company_id = parseInt(companyId);
    }

    try {
        const result = await makePostRequest('/tickets', data);
        return asInstance({
            id: String(result.id),
            subject: result.subject || '',
            status: String(result.status) || '',
            url: result.url || ''
        }, 'CreateTicketOutput');
    } catch (error) {
        console.error(`FRESHDESK RESOLVER: Failed to create ticket: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const queryCreateTicket = async (env, attrs) => {
    const id = attrs.queryAttributeValues?.get('__path__')?.split('/')?.pop() ?? null;

    if (!id) {
        return {"result": "error", "message": "Ticket ID is required"};
    }

    try {
        const { baseUrl } = await getDomain();
        const ticket = await makeGetRequest(`/tickets/${id}`);
        return [asInstance({
            id: String(ticket.id),
            subject: ticket.subject || '',
            status: String(ticket.status) || '',
            url: ticket.url || ''
        }, 'CreateTicketOutput')];
    } catch (error) {
        console.error(`FRESHDESK RESOLVER: Failed to query create ticket: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// Create Contact Action
export const createContactAction = async (env, attributes) => {
    const name = attributes.attributes.get('name');
    const email = attributes.attributes.get('email');
    const phone = attributes.attributes.get('phone');
    const mobile = attributes.attributes.get('mobile');
    const companyId = attributes.attributes.get('company_id');
    const jobTitle = attributes.attributes.get('job_title');
    const address = attributes.attributes.get('address');

    if (!name || !email) {
        return {"result": "error", "message": "Name and email are required"};
    }
    
    const data = {
        name,
        email
    };

    if (phone) {
        data.phone = phone;
    }
    if (mobile) {
        data.mobile = mobile;
    }
    if (companyId) {
        data.company_id = parseInt(companyId);
    }
    if (jobTitle) {
        data.job_title = jobTitle;
    }
    if (address) {
        data.address = address;
    }

    try {
        const result = await makePostRequest('/contacts', data);
        return asInstance({
            id: String(result.id),
            name: result.name || '',
            email: result.email || '',
            url: result.url || ''
        }, 'CreateContactOutput');
    } catch (error) {
        console.error(`FRESHDESK RESOLVER: Failed to create contact: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const queryCreateContact = async (env, attrs) => {
    const id = attrs.queryAttributeValues?.get('__path__')?.split('/')?.pop() ?? null;

    if (!id) {
        return {"result": "error", "message": "Contact ID is required"};
    }

    try {
        const contact = await makeGetRequest(`/contacts/${id}`);
        return [asInstance({
            id: String(contact.id),
            name: contact.name || '',
            email: contact.email || '',
            url: contact.url || ''
        }, 'CreateContactOutput')];
    } catch (error) {
        console.error(`FRESHDESK RESOLVER: Failed to query create contact: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// Subscription functions for real-time updates
async function getAndProcessRecords(resolver, entityType) {
    try {
        const { baseUrl } = await getDomain();
        let endpoint;
        
        switch (entityType) {
            case 'tickets':
                endpoint = '/tickets?per_page=100';
                break;
            case 'contacts':
                endpoint = '/contacts?per_page=100';
                break;
            case 'agents':
                endpoint = '/agents?per_page=100';
                break;
            case 'companies':
                endpoint = '/companies?per_page=100';
                break;
            case 'groups':
                endpoint = '/groups?per_page=100';
                break;
            default:
                console.error(`FRESHDESK RESOLVER: Unknown entity type: ${entityType}`);
                return;
        }

        const result = await makeGetRequest(endpoint);
        
        if (entityType === 'tickets' && Array.isArray(result)) {
            for (const ticket of result) {
                console.log(`FRESHDESK RESOLVER: Processing ticket ${ticket.id}`);
                const mappedData = toTicket(ticket, baseUrl);
                const entityInstance = asInstance(mappedData, 'Ticket');
                await resolver.onSubscription(entityInstance, true);
            }
        } else if (entityType === 'contacts' && Array.isArray(result)) {
            for (const contact of result) {
                console.log(`FRESHDESK RESOLVER: Processing contact ${contact.id}`);
                const mappedData = toContact(contact);
                const entityInstance = asInstance(mappedData, 'Contact');
                await resolver.onSubscription(entityInstance, true);
            }
        } else if (entityType === 'agents' && Array.isArray(result)) {
            for (const agent of result) {
                console.log(`FRESHDESK RESOLVER: Processing agent ${agent.id}`);
                const mappedData = toAgent(agent);
                const entityInstance = asInstance(mappedData, 'Agent');
                await resolver.onSubscription(entityInstance, true);
            }
        } else if (entityType === 'companies' && Array.isArray(result)) {
            for (const company of result) {
                console.log(`FRESHDESK RESOLVER: Processing company ${company.id}`);
                const mappedData = toCompany(company);
                const entityInstance = asInstance(mappedData, 'Company');
                await resolver.onSubscription(entityInstance, true);
            }
        } else if (entityType === 'groups' && Array.isArray(result)) {
            for (const group of result) {
                console.log(`FRESHDESK RESOLVER: Processing group ${group.id}`);
                const mappedData = toGroup(group);
                const entityInstance = asInstance(mappedData, 'Group');
                await resolver.onSubscription(entityInstance, true);
            }
        }
    } catch (error) {
        console.error(`FRESHDESK RESOLVER: Failed to process ${entityType} records: ${error}`);
    }
}

async function handleSubsTickets(resolver) {
    console.log('FRESHDESK RESOLVER: Fetching tickets for subscription...');
    await getAndProcessRecords(resolver, 'tickets');
}

async function handleSubsContacts(resolver) {
    console.log('FRESHDESK RESOLVER: Fetching contacts for subscription...');
    await getAndProcessRecords(resolver, 'contacts');
}

async function handleSubsAgents(resolver) {
    console.log('FRESHDESK RESOLVER: Fetching agents for subscription...');
    await getAndProcessRecords(resolver, 'agents');
}

async function handleSubsCompanies(resolver) {
    console.log('FRESHDESK RESOLVER: Fetching companies for subscription...');
    await getAndProcessRecords(resolver, 'companies');
}

async function handleSubsGroups(resolver) {
    console.log('FRESHDESK RESOLVER: Fetching groups for subscription...');
    await getAndProcessRecords(resolver, 'groups');
}

export async function subsTickets(resolver) {
    await handleSubsTickets(resolver);
    const intervalMinutes = parseInt(getLocalEnv("FRESHDESK_POLL_INTERVAL_MINUTES")) || 5;
    const intervalMs = intervalMinutes * 60 * 1000;
    console.log(`FRESHDESK RESOLVER: Setting tickets polling interval to ${intervalMinutes} minutes`);
    setInterval(async () => {
        await handleSubsTickets(resolver);
    }, intervalMs);
}

export async function subsContacts(resolver) {
    await handleSubsContacts(resolver);
    const intervalMinutes = parseInt(getLocalEnv("FRESHDESK_POLL_INTERVAL_MINUTES")) || 5;
    const intervalMs = intervalMinutes * 60 * 1000;
    console.log(`FRESHDESK RESOLVER: Setting contacts polling interval to ${intervalMinutes} minutes`);
    setInterval(async () => {
        await handleSubsContacts(resolver);
    }, intervalMs);
}

export async function subsAgents(resolver) {
    await handleSubsAgents(resolver);
    const intervalMinutes = parseInt(getLocalEnv("FRESHDESK_POLL_INTERVAL_MINUTES")) || 5;
    const intervalMs = intervalMinutes * 60 * 1000;
    console.log(`FRESHDESK RESOLVER: Setting agents polling interval to ${intervalMinutes} minutes`);
    setInterval(async () => {
        await handleSubsAgents(resolver);
    }, intervalMs);
}

export async function subsCompanies(resolver) {
    await handleSubsCompanies(resolver);
    const intervalMinutes = parseInt(getLocalEnv("FRESHDESK_POLL_INTERVAL_MINUTES")) || 5;
    const intervalMs = intervalMinutes * 60 * 1000;
    console.log(`FRESHDESK RESOLVER: Setting companies polling interval to ${intervalMinutes} minutes`);
    setInterval(async () => {
        await handleSubsCompanies(resolver);
    }, intervalMs);
}

export async function subsGroups(resolver) {
    await handleSubsGroups(resolver);
    const intervalMinutes = parseInt(getLocalEnv("FRESHDESK_POLL_INTERVAL_MINUTES")) || 5;
    const intervalMs = intervalMinutes * 60 * 1000;
    console.log(`FRESHDESK RESOLVER: Setting groups polling interval to ${intervalMinutes} minutes`);
    setInterval(async () => {
        await handleSubsGroups(resolver);
    }, intervalMs);
}

