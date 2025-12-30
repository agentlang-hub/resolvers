import { getLocalEnv } from "agentlang/out/runtime/auth/defs.js";
import { makeInstance } from "agentlang/out/runtime/module.js";

// Mapper functions for Airtable API responses to Agentlang entities
function toBase(base) {
    return {
        id: base.id,
        name: base.name || '',
        permission_level: base.permissionLevel || ''
    };
}

function toTable(table, baseId) {
    return {
        id: table.id,
        name: table.name || '',
        description: table.description || '',
        base_id: baseId || ''
    };
}

function toField(field, tableId) {
    return {
        id: field.id,
        name: field.name || '',
        type: field.type || '',
        description: field.description || '',
        table_id: tableId || ''
    };
}

function toRecord(record, tableId, baseId) {
    return {
        id: record.id,
        created_time: record.createdTime || '',
        fields: record.fields || {},
        table_id: tableId || '',
        base_id: baseId || ''
    };
}

function asInstance(entity, entityType) {
    const instanceMap = new Map(Object.entries(entity));
    return makeInstance('airtable', entityType, instanceMap);
}

const getResponseBody = async (response) => {
    try {
        try {
            return await response.json();
        } catch (e) {
            return await response.text();
        }
    } catch (error) {
        console.error("AIRTABLE RESOLVER: Error reading response body:", error);
        return {};
    }
}

// Airtable API configuration and authentication
let apiKey = null;
let baseUrl = 'https://api.airtable.com/v0';

async function getApiKey() {
    if (apiKey) {
        return apiKey;
    }

    apiKey = getLocalEnv("AIRTABLE_API_KEY");

    if (!apiKey) {
        throw new Error('Airtable configuration is required: AIRTABLE_API_KEY');
    }

    console.log(`AIRTABLE RESOLVER: Using API key`);
    return apiKey;
}

// Generic HTTP functions
const makeRequest = async (endpoint, options = {}) => {
    const token = await getApiKey();
    
    if (!token) {
        throw new Error('Airtable API key is required');
    }

    const url = `${baseUrl}${endpoint}`;
    
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
        }
    };

    console.log(`AIRTABLE RESOLVER: making http request ${options.method || 'GET'} ${url} with options ${JSON.stringify(options)}`);

    const config = { ...defaultOptions, ...options };
    
    // Remove Content-Type header for GET requests without body
    if (config.method === 'GET' && !config.body) {
        delete config.headers['Content-Type'];
    }

    const timeoutMs = 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        console.error(`AIRTABLE RESOLVER: Request timeout after ${timeoutMs}ms - ${url} - ${JSON.stringify(options)}`);
        controller.abort();
    }, timeoutMs);

    try {
        const response = await fetch(url, {
            ...config,
            signal: controller.signal
        });

        const body = await getResponseBody(response);
        console.log(`AIRTABLE RESOLVER: response ${response.status} ${response.ok}`, body);
    
        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error(`AIRTABLE RESOLVER: HTTP Error ${response.status} - ${url} - ${JSON.stringify(options)}`);
            throw new Error(`HTTP Error: ${response.status} - ${JSON.stringify(body)}`);
        }

        return body;

    } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
            console.error(`AIRTABLE RESOLVER: Request timeout - ${url} - ${JSON.stringify(options)}`);
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'EHOSTUNREACH') {
            console.error(`AIRTABLE RESOLVER: Network unreachable (${error.code}) - ${url} - ${JSON.stringify(options)}`);
        } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
            console.error(`AIRTABLE RESOLVER: Connection error (${error.code}) - ${url} - ${JSON.stringify(options)}`);
        } else {
            console.error(`AIRTABLE RESOLVER: Request failed (${error.name}) - ${url} - ${JSON.stringify(options)}`);
        }
        
        throw error;
    }
};

const makeGetRequest = async (endpoint) => {
    console.log(`AIRTABLE RESOLVER: Querying Airtable: ${endpoint}\n`);    
    return await makeRequest(endpoint, { method: 'GET' });
};

const makePostRequest = async (endpoint, body) => {
    console.log(`AIRTABLE RESOLVER: Creating in Airtable: ${endpoint}\n`);
    return await makeRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(body)
    });
};

const makePatchRequest = async (endpoint, body) => {
    console.log(`AIRTABLE RESOLVER: Updating in Airtable: ${endpoint}\n`);
    return await makeRequest(endpoint, {
        method: 'PATCH',
        body: JSON.stringify(body)
    });
};

const makeDeleteRequest = async (endpoint) => {
    console.log(`AIRTABLE RESOLVER: Deleting from Airtable: ${endpoint}\n`);
    return await makeRequest(endpoint, { method: 'DELETE' });
};

// Base functions
export const queryBase = async (env, attrs) => {
    const baseId = attrs.queryAttributeValues?.get('__path__')?.split('/')?.pop() ?? null;

    console.log(`AIRTABLE RESOLVER: Querying Airtable base: ${baseId}\n`);
    try {
        if (baseId) {
            // Get specific base metadata - Airtable doesn't have a direct base endpoint
            // We'll use the base ID from environment or return a minimal base object
            const baseIds = getLocalEnv("AIRTABLE_BASE_IDS") || '';
            const baseIdList = baseIds.split(',').map(id => id.trim()).filter(id => id);
            
            if (baseIdList.includes(baseId)) {
                // Return base info (we can't get full metadata without querying tables)
                return [asInstance({
                    id: baseId,
                    name: baseId,
                    permission_level: ''
                }, 'Base')];
            } else {
                // Try to get tables to verify base exists
                try {
                    await makeGetRequest(`/meta/bases/${baseId}/tables`);
                    return [asInstance({
                        id: baseId,
                        name: baseId,
                        permission_level: ''
                    }, 'Base')];
                } catch (e) {
                    return {"result": "error", "message": "Base not found"};
                }
            }
        } else {
            // Get all bases from environment variable
            const baseIds = getLocalEnv("AIRTABLE_BASE_IDS") || '';
            const baseIdList = baseIds.split(',').map(id => id.trim()).filter(id => id);
            
            if (baseIdList.length === 0) {
                return {"result": "error", "message": "No base IDs configured. Set AIRTABLE_BASE_IDS environment variable."};
            }
            
            return baseIdList.map(id => asInstance({
                id: id,
                name: id,
                permission_level: ''
            }, 'Base'));
        }
    } catch (error) {
        console.error(`AIRTABLE RESOLVER: Failed to query bases: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// Table functions
export const queryTable = async (env, attrs) => {
    const baseId = (attrs.queryAttributeValues?.get('base_id')) || attrs.queryAttributeValues?.get('__path__')?.split('/')?.pop() || null;
    const tableId = attrs.queryAttributeValues?.get('__path__')?.split('/')?.pop() ?? null;

    console.log(`AIRTABLE RESOLVER: Querying Airtable table: ${baseId} / ${tableId}\n`);
    try {
        if (!baseId) {
            return {"result": "error", "message": "Base ID is required"};
        }

        if (tableId) {
            // Get specific table metadata
            const tables = await makeGetRequest(`/meta/bases/${baseId}/tables`);
            const table = tables.tables.find(t => t.id === tableId);
            if (table) {
                return [asInstance(toTable(table, baseId), 'Table')];
            }
            return [];
        } else {
            // Get all tables in base
            const tables = await makeGetRequest(`/meta/bases/${baseId}/tables`);
            return tables.tables.map(table => asInstance(toTable(table, baseId), 'Table'));
        }
    } catch (error) {
        console.error(`AIRTABLE RESOLVER: Failed to query tables: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// Field functions
export const queryField = async (env, attrs) => {
    const baseId = attrs.queryAttributeValues?.get('base_id');
    const tableId = attrs.queryAttributeValues?.get('table_id') || attrs.queryAttributeValues?.get('__path__')?.split('/')?.pop() || null;

    console.log(`AIRTABLE RESOLVER: Querying Airtable field: ${baseId} / ${tableId}\n`);
    try {
        if (!baseId || !tableId) {
            return {"result": "error", "message": "Base ID and Table ID are required"};
        }

        const tables = await makeGetRequest(`/meta/bases/${baseId}/tables`);
        const table = tables.tables.find(t => t.id === tableId);
        
        if (!table) {
            return {"result": "error", "message": "Table not found"};
        }

        return table.fields.map(field => asInstance(toField(field, tableId), 'Field'));
    } catch (error) {
        console.error(`AIRTABLE RESOLVER: Failed to query fields: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// Record functions
export const createRecord = async (env, attributes) => {
    const fields = attributes.attributes.get('fields');
    const tableId = attributes.attributes.get('table_id');
    const baseId = attributes.attributes.get('base_id');

    if (!fields || !tableId || !baseId) {
        return {"result": "error", "message": "Fields, table_id, and base_id are required"};
    }

    try {
        // Parse fields if it's a string
        let fieldsObj = fields;
        if (typeof fields === 'string') {
            fieldsObj = JSON.parse(fields);
        }

        const data = {
            fields: fieldsObj
        };

        const result = await makePostRequest(`/${baseId}/${tableId}`, data);
        // Airtable returns { records: [...] } for batch, or single record for single create
        const record = result.records ? result.records[0] : result;
        return asInstance(toRecord(record, tableId, baseId), 'Record');
    } catch (error) {
        console.error(`AIRTABLE RESOLVER: Failed to create record: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const queryRecord = async (env, attrs) => {
    const baseId = attrs.queryAttributeValues?.get('base_id');
    const tableId = attrs.queryAttributeValues?.get('table_id');
    const recordId = attrs.queryAttributeValues?.get('__path__')?.split('/')?.pop() ?? null;

    console.log(`AIRTABLE RESOLVER: Querying Airtable record: ${baseId} / ${tableId} / ${recordId}\n`);
    try {
        if (!baseId || !tableId) {
            return {"result": "error", "message": "Base ID and Table ID are required"};
        }

        if (recordId) {
            const record = await makeGetRequest(`/${baseId}/${tableId}/${recordId}`);
            return [asInstance(toRecord(record, tableId, baseId), 'Record')];
        } else {
            // Get all records in table
            const records = await makeGetRequest(`/${baseId}/${tableId}?maxRecords=100`);
            return records.records.map(record => asInstance(toRecord(record, tableId, baseId), 'Record'));
        }
    } catch (error) {
        console.error(`AIRTABLE RESOLVER: Failed to query records: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const updateRecord = async (env, attributes, newAttrs) => {
    const id = attributes.attributes.get('id');
    const tableId = attributes.attributes.get('table_id');
    const baseId = attributes.attributes.get('base_id');

    if (!id || !tableId || !baseId) {
        return {"result": "error", "message": "Record ID, table_id, and base_id are required"};
    }

    const fields = newAttrs.get('fields');
    if (!fields) {
        return {"result": "error", "message": "Fields are required for update"};
    }

    try {
        // Parse fields if it's a string
        let fieldsObj = fields;
        if (typeof fields === 'string') {
            fieldsObj = JSON.parse(fields);
        }

        const data = {
            fields: fieldsObj
        };

        const result = await makePatchRequest(`/${baseId}/${tableId}/${id}`, data);
        return asInstance(toRecord(result, tableId, baseId), 'Record');
    } catch (error) {
        console.error(`AIRTABLE RESOLVER: Failed to update record: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const deleteRecord = async (env, attributes) => {
    const id = attributes.attributes.get('id');
    const tableId = attributes.attributes.get('table_id');
    const baseId = attributes.attributes.get('base_id');

    if (!id || !tableId || !baseId) {
        return {"result": "error", "message": "Record ID, table_id, and base_id are required"};
    }

    try {
        await makeDeleteRequest(`/${baseId}/${tableId}/${id}`);
        return {"result": "success"};
    } catch (error) {
        console.error(`AIRTABLE RESOLVER: Failed to delete record: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// Create Record Action
export const createRecordAction = async (env, attributes) => {
    const fields = attributes.attributes.get('fields');
    const tableId = attributes.attributes.get('table_id');
    const baseId = attributes.attributes.get('base_id');

    if (!fields || !tableId || !baseId) {
        return {"result": "error", "message": "Fields, table_id, and base_id are required"};
    }

    try {
        // Parse fields if it's a string
        let fieldsObj = fields;
        if (typeof fields === 'string') {
            fieldsObj = JSON.parse(fields);
        }

        const data = {
            fields: fieldsObj
        };

        const result = await makePostRequest(`/${baseId}/${tableId}`, data);
        // Airtable returns { records: [...] } for batch, or single record for single create
        const record = result.records ? result.records[0] : result;
        return asInstance({
            id: record.id,
            created_time: record.createdTime || '',
            fields: record.fields || {}
        }, 'CreateRecordOutput');
    } catch (error) {
        console.error(`AIRTABLE RESOLVER: Failed to create record: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const queryCreateRecord = async (env, attrs) => {
    const id = attrs.queryAttributeValues?.get('__path__')?.split('/')?.pop() ?? null;

    if (!id) {
        return {"result": "error", "message": "Record ID is required"};
    }

    try {
        // We need base_id and table_id to query, but they might not be in the path
        // This is a limitation - we'd need to store them or require them as query params
        return {"result": "error", "message": "Base ID and Table ID are required to query record"};
    } catch (error) {
        console.error(`AIRTABLE RESOLVER: Failed to query create record: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// Update Record Action
export const updateRecordAction = async (env, attributes, newAttrs) => {
    const id = attributes.attributes.get('id');
    const tableId = attributes.attributes.get('table_id');
    const baseId = attributes.attributes.get('base_id');

    if (!id || !tableId || !baseId) {
        return {"result": "error", "message": "Record ID, table_id, and base_id are required"};
    }

    const fields = newAttrs.get('fields');
    if (!fields) {
        return {"result": "error", "message": "Fields are required for update"};
    }

    try {
        // Parse fields if it's a string
        let fieldsObj = fields;
        if (typeof fields === 'string') {
            fieldsObj = JSON.parse(fields);
        }

        const data = {
            fields: fieldsObj
        };

        const result = await makePatchRequest(`/${baseId}/${tableId}/${id}`, data);
        // Airtable returns { records: [...] } for batch, or single record for single update
        const record = result.records ? result.records[0] : result;
        return asInstance(toRecord(record, tableId, baseId), 'Record');
    } catch (error) {
        console.error(`AIRTABLE RESOLVER: Failed to update record: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// Subscription functions for real-time updates
async function getAndProcessRecords(resolver, entityType, baseId, tableId) {
    try {
        let endpoint;
        
        switch (entityType) {
            case 'bases':
                // Airtable doesn't have a bases list endpoint, so we'll skip this
                console.log(`AIRTABLE RESOLVER: Bases subscription - using configured base IDs`);
                const baseIds = getLocalEnv("AIRTABLE_BASE_IDS") || '';
                const baseIdList = baseIds.split(',').map(id => id.trim()).filter(id => id);
                for (const bid of baseIdList) {
                    const mappedData = toBase({ id: bid, name: bid });
                    const entityInstance = asInstance(mappedData, 'Base');
                    await resolver.onSubscription(entityInstance, true);
                }
                return;
            case 'tables':
                if (!baseId) {
                    console.error(`AIRTABLE RESOLVER: Base ID required for tables subscription`);
                    return;
                }
                endpoint = `/meta/bases/${baseId}/tables`;
                break;
            case 'fields':
                if (!baseId || !tableId) {
                    console.error(`AIRTABLE RESOLVER: Base ID and Table ID required for fields subscription`);
                    return;
                }
                endpoint = `/meta/bases/${baseId}/tables`;
                break;
            case 'records':
                if (!baseId || !tableId) {
                    console.error(`AIRTABLE RESOLVER: Base ID and Table ID required for records subscription`);
                    return;
                }
                endpoint = `/${baseId}/${tableId}?maxRecords=100`;
                break;
            default:
                console.error(`AIRTABLE RESOLVER: Unknown entity type: ${entityType}`);
                return;
        }

        const result = await makeGetRequest(endpoint);
        
        if (entityType === 'tables' && result.tables) {
            for (const table of result.tables) {
                console.log(`AIRTABLE RESOLVER: Processing table ${table.id}`);
                const mappedData = toTable(table, baseId);
                const entityInstance = asInstance(mappedData, 'Table');
                await resolver.onSubscription(entityInstance, true);
            }
        } else if (entityType === 'fields' && result.tables) {
            const table = result.tables.find(t => t.id === tableId);
            if (table) {
                for (const field of table.fields) {
                    console.log(`AIRTABLE RESOLVER: Processing field ${field.id}`);
                    const mappedData = toField(field, tableId);
                    const entityInstance = asInstance(mappedData, 'Field');
                    await resolver.onSubscription(entityInstance, true);
                }
            }
        } else if (entityType === 'records' && result.records) {
            for (const record of result.records) {
                console.log(`AIRTABLE RESOLVER: Processing record ${record.id}`);
                const mappedData = toRecord(record, tableId, baseId);
                const entityInstance = asInstance(mappedData, 'Record');
                await resolver.onSubscription(entityInstance, true);
            }
        }
    } catch (error) {
        console.error(`AIRTABLE RESOLVER: Failed to process ${entityType} records: ${error}`);
    }
}

async function handleSubsBases(resolver) {
    console.log('AIRTABLE RESOLVER: Fetching bases for subscription...');
    await getAndProcessRecords(resolver, 'bases');
}

async function handleSubsTables(resolver) {
    console.log('AIRTABLE RESOLVER: Fetching tables for subscription...');
    const baseIds = getLocalEnv("AIRTABLE_BASE_IDS") || '';
    const baseIdList = baseIds.split(',').map(id => id.trim()).filter(id => id);
    
    if (baseIdList.length === 0) {
        console.error('AIRTABLE RESOLVER: AIRTABLE_BASE_IDS environment variable is required for tables subscription');
        return;
    }

    for (const baseId of baseIdList) {
        await getAndProcessRecords(resolver, 'tables', baseId);
    }
}

async function handleSubsFields(resolver) {
    console.log('AIRTABLE RESOLVER: Fetching fields for subscription...');
    const baseIds = getLocalEnv("AIRTABLE_BASE_IDS") || '';
    const tableIds = getLocalEnv("AIRTABLE_TABLE_IDS") || '';
    const baseIdList = baseIds.split(',').map(id => id.trim()).filter(id => id);
    const tableIdList = tableIds.split(',').map(id => id.trim()).filter(id => id);
    
    if (baseIdList.length === 0 || tableIdList.length === 0) {
        console.error('AIRTABLE RESOLVER: AIRTABLE_BASE_IDS and AIRTABLE_TABLE_IDS environment variables are required for fields subscription');
        return;
    }

    // Match base IDs with table IDs (assuming they're in the same order or we need to query)
    for (let i = 0; i < Math.min(baseIdList.length, tableIdList.length); i++) {
        await getAndProcessRecords(resolver, 'fields', baseIdList[i], tableIdList[i]);
    }
}

async function handleSubsRecords(resolver) {
    console.log('AIRTABLE RESOLVER: Fetching records for subscription...');
    const baseIds = getLocalEnv("AIRTABLE_BASE_IDS") || '';
    const tableIds = getLocalEnv("AIRTABLE_TABLE_IDS") || '';
    const baseIdList = baseIds.split(',').map(id => id.trim()).filter(id => id);
    const tableIdList = tableIds.split(',').map(id => id.trim()).filter(id => id);
    
    if (baseIdList.length === 0 || tableIdList.length === 0) {
        console.error('AIRTABLE RESOLVER: AIRTABLE_BASE_IDS and AIRTABLE_TABLE_IDS environment variables are required for records subscription');
        return;
    }

    // Match base IDs with table IDs
    for (let i = 0; i < Math.min(baseIdList.length, tableIdList.length); i++) {
        await getAndProcessRecords(resolver, 'records', baseIdList[i], tableIdList[i]);
    }
}

export async function subsBases(resolver) {
    await handleSubsBases(resolver);
    const intervalMinutes = parseInt(getLocalEnv("AIRTABLE_POLL_INTERVAL_MINUTES")) || 5;
    const intervalMs = intervalMinutes * 60 * 1000;
    console.log(`AIRTABLE RESOLVER: Setting bases polling interval to ${intervalMinutes} minutes`);
    setInterval(async () => {
        await handleSubsBases(resolver);
    }, intervalMs);
}

export async function subsTables(resolver) {
    await handleSubsTables(resolver);
    const intervalMinutes = parseInt(getLocalEnv("AIRTABLE_POLL_INTERVAL_MINUTES")) || 5;
    const intervalMs = intervalMinutes * 60 * 1000;
    console.log(`AIRTABLE RESOLVER: Setting tables polling interval to ${intervalMinutes} minutes`);
    setInterval(async () => {
        await handleSubsTables(resolver);
    }, intervalMs);
}

export async function subsFields(resolver) {
    await handleSubsFields(resolver);
    const intervalMinutes = parseInt(getLocalEnv("AIRTABLE_POLL_INTERVAL_MINUTES")) || 5;
    const intervalMs = intervalMinutes * 60 * 1000;
    console.log(`AIRTABLE RESOLVER: Setting fields polling interval to ${intervalMinutes} minutes`);
    setInterval(async () => {
        await handleSubsFields(resolver);
    }, intervalMs);
}

export async function subsRecords(resolver) {
    await handleSubsRecords(resolver);
    const intervalMinutes = parseInt(getLocalEnv("AIRTABLE_POLL_INTERVAL_MINUTES")) || 5;
    const intervalMs = intervalMinutes * 60 * 1000;
    console.log(`AIRTABLE RESOLVER: Setting records polling interval to ${intervalMinutes} minutes`);
    setInterval(async () => {
        await handleSubsRecords(resolver);
    }, intervalMs);
}

