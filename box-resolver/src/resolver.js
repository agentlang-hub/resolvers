// Import agentlang modules
import { getLocalEnv } from "agentlang/out/runtime/auth/defs.js";
import { makeInstance } from "agentlang/out/runtime/module.js";

// Mapper functions for Box API responses to Agentlang entities
function toFile(file) {
    return {
        id: file.id,
        name: file.name,
        download_url: file.shared_link?.download_url || '',
        modified_at: file.modified_at
    };
}

function toFolder(folder) {
    return {
        id: folder.id,
        name: folder.name,
        modified_at: folder.modified_at,
        url: folder.shared_link?.download_url || null
    };
}

function toUser(user) {
    const [firstName, lastName] = (user.name || '').split(' ');
    return {
        id: user.id,
        email: user.login,
        first_name: firstName || '',
        last_name: lastName || ''
    };
}

function asInstance(entity, entityType) {
  const instanceMap = new Map(Object.entries(entity));
  return makeInstance("box", entityType, instanceMap);
}

const getResponseBody = async (response) => {
    try {
        try {
            return await response.json()
        } catch (e) {
            return await response.text();
        }
    } catch (error) {
        console.error("BOX RESOLVER: Error reading response body:", error);
        return {};
    }
}

const getFileContentBody = async (response) => {
    try {
        // For file content, use blob() to handle binary data
        const blob = await response.blob();
        // Convert blob to base64 string for easier handling
        const arrayBuffer = await blob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        return buffer
    } catch (error) {
        console.error("BOX RESOLVER: Error reading file content body:", error);
        return null;
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

    const directToken = getLocalEnv("BOX_ACCESS_TOKEN");
    const clientId = getLocalEnv("BOX_CLIENT_ID");
    const clientSecret = getLocalEnv("BOX_CLIENT_SECRET");
    const authCode = getLocalEnv("BOX_AUTH_CODE");
    const refreshToken = getLocalEnv("BOX_REFRESH_TOKEN");

    // Method 1: Direct access token
    if (directToken) {
        accessToken = directToken;
        console.log('BOX RESOLVER: Using direct access token');
        return accessToken;
    }

    // Method 2: OAuth2 with authorization code
    if (clientId && clientSecret && authCode) {
        try {
            const tokenUrl = 'https://api.box.com/oauth2/token';
            const params = new URLSearchParams({
                grant_type: 'authorization_code',
                code: authCode,
                client_id: clientId,
                client_secret: clientSecret
            });

            console.log(`BOX RESOLVER: Fetching OAuth2 access token from ${tokenUrl}`);

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
                throw new Error('No access token received from Box OAuth2');
            }

            accessToken = tokenData.access_token;
            // Set expiry time (subtract 5 minutes for safety)
            tokenExpiry = Date.now() + ((tokenData.expires_in || 3600) - 300) * 1000;

            console.log(`BOX RESOLVER: Successfully obtained OAuth2 access token, expires in ${tokenData.expires_in} seconds`);
            return accessToken;

        } catch (error) {
            console.error(`BOX RESOLVER: OAuth2 failed: ${error.message}`);
            throw new Error(`Box OAuth2 authentication failed: ${error.message}`);
        }
    }

    // Method 3: OAuth2 with refresh token
    if (clientId && clientSecret && refreshToken) {
        try {
            const tokenUrl = 'https://api.box.com/oauth2/token';
            const params = new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                client_id: clientId,
                client_secret: clientSecret
            });

            console.log(`BOX RESOLVER: Refreshing OAuth2 access token from ${tokenUrl}`);

            const response = await fetch(tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: params
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OAuth2 refresh request failed: ${response.status} - ${errorText}`);
            }

            const tokenData = await response.json();
            
            if (!tokenData.access_token) {
                throw new Error('No access token received from Box OAuth2 refresh');
            }

            accessToken = tokenData.access_token;
            // Set expiry time (subtract 5 minutes for safety)
            tokenExpiry = Date.now() + ((tokenData.expires_in || 3600) - 300) * 1000;

            console.log(`BOX RESOLVER: Successfully refreshed OAuth2 access token, expires in ${tokenData.expires_in} seconds`);
            return accessToken;

        } catch (error) {
            console.error(`BOX RESOLVER: OAuth2 refresh failed: ${error.message}`);
            throw new Error(`Box OAuth2 refresh failed: ${error.message}`);
        }
    }

    throw new Error('Box authentication is required: BOX_ACCESS_TOKEN or OAuth2 credentials (BOX_CLIENT_ID, BOX_CLIENT_SECRET, and BOX_AUTH_CODE or BOX_REFRESH_TOKEN)');
}

// Generic HTTP functions
const makeRequest = async (endpoint, options = {}) => {
    let token = getLocalEnv("BOX_ACCESS_TOKEN");
    
    // If no direct token provided, try to get one via OAuth2
    if (!token) {
        try {
            token = await getAccessToken();
        } catch (error) {
            throw new Error(`Box authentication failed: ${error.message}`);
        }
    }
    
    if (!token) {
        throw new Error('Box access token is required');
    }
    
    const baseUrl = 'https://api.box.com';
    const url = `${baseUrl}${endpoint}`;
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    };

    console.log(`BOX RESOLVER: making http request ${options.method} ${url} with options ${JSON.stringify(options)}`)

    const config = { ...defaultOptions, ...options };
    
    // Remove Content-Type header for GET requests without body
    if (config.method === 'GET') {
        delete config.headers['Content-Type'];
    }

    const timeoutMs = 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        console.error(`BOX RESOLVER: Request timeout after ${timeoutMs}ms - ${url} - ${JSON.stringify(options)}`);
        controller.abort();
    }, timeoutMs);

    try {
        const response = await fetch(url, {
            ...config,
            signal: controller.signal,
            redirect: 'follow'  // Auto follow redirects like curl -L
        });

        const body = await getResponseBody(response);
        console.log(`BOX RESOLVER: response ${response.status} ${response.ok}`, body)
    
        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error(`BOX RESOLVER: HTTP Error ${response.status} - ${url} - ${JSON.stringify(options)}`);
            throw new Error(`HTTP Error: ${response.status} - ${JSON.stringify(body)}`);
        }

        return body;

    } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
            console.error(`BOX RESOLVER: Request timeout - ${url} - ${JSON.stringify(options)}`);
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'EHOSTUNREACH') {
            console.error(`BOX RESOLVER: Network unreachable (${error.code}) - ${url} - ${JSON.stringify(options)}`);
        } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
            console.error(`BOX RESOLVER: Connection error (${error.code}) - ${url} - ${JSON.stringify(options)}`);
        } else {
            console.error(`BOX RESOLVER: Request failed (${error.name}) - ${url} - ${JSON.stringify(options)}`);
        }
        
        throw error;
    }
};

const makeGetRequest = async (endpoint) => {
    console.log(`BOX RESOLVER: Querying Box: ${endpoint}\n`);    
    return await makeRequest(endpoint, { method: 'GET' });
};

const makePostRequest = async (endpoint, body) => {
    console.log(`BOX RESOLVER: Creating in Box: ${endpoint}\n`);
    return await makeRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(body)
    });
};

const makePutRequest = async (endpoint, body) => {
    console.log(`BOX RESOLVER: Updating in Box: ${endpoint}\n`);
    return await makeRequest(endpoint, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
};

const makeDeleteRequest = async (endpoint, options = {}) => {
    console.log(`BOX RESOLVER: Deleting from Box: ${endpoint}\n`);
    return await makeRequest(endpoint, { method: 'DELETE', ...options });
};

const makeMultipartRequest = async (endpoint, formData, useUploadUrl = false) => {
    console.log(`BOX RESOLVER: Making multipart request to Box: ${endpoint}\n`);
    
    let token = getLocalEnv("BOX_ACCESS_TOKEN");
    
    // If no direct token provided, try to get one via OAuth2
    if (!token) {
        try {
            token = await getAccessToken();
        } catch (error) {
            throw new Error(`Box authentication failed: ${error.message}`);
        }
    }
    
    if (!token) {
        throw new Error('Box access token is required');
    }
    
    const baseUrl = useUploadUrl ? 'https://upload.box.com' : 'https://api.box.com';
    const url = `${baseUrl}${endpoint}`;
    const defaultOptions = {
        headers: {
            'Authorization': `Bearer ${token}`
            // Don't set Content-Type, let FormData set it with boundary
        }
    };

    console.log(`BOX RESOLVER: making multipart request POST ${url}`)

    const timeoutMs = 120000; // 2 minutes for file fs
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        console.error(`BOX RESOLVER: Multipart request timeout after ${timeoutMs}ms - ${url}`);
        controller.abort();
    }, timeoutMs);

    try {
        const response = await fetch(url, {
            ...defaultOptions,
            method: 'POST',
            body: formData,
            signal: controller.signal
        });

        const body = await getResponseBody(response);
        console.log(`BOX RESOLVER: multipart response ${response.status} ${response.ok}`, body)
    
        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error(`BOX RESOLVER: HTTP Error ${response.status} - ${url}`);
            throw new Error(`HTTP Error: ${response.status} - ${JSON.stringify(body)}`);
        }

        return body;

    } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
            console.error(`BOX RESOLVER: Multipart request timeout - ${url}`);
        } else {
            console.error(`BOX RESOLVER: Multipart request failed - ${url}: ${error}`);
        }
        
        throw error;
    }
};

const makeFileContentRequest = async (endpoint) => {
    console.log(`BOX RESOLVER: Downloading file content from Box: ${endpoint}\n`);
    
    let token = getLocalEnv("BOX_ACCESS_TOKEN");
    
    // If no direct token provided, try to get one via OAuth2
    if (!token) {
        try {
            token = await getAccessToken();
        } catch (error) {
            throw new Error(`Box authentication failed: ${error.message}`);
        }
    }
    
    if (!token) {
        throw new Error('Box access token is required');
    }
    
    const baseUrl = 'https://api.box.com';
    const url = `${baseUrl}${endpoint}`;
    const defaultOptions = {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    };

    console.log(`BOX RESOLVER: making file content request GET ${url}`)

    const timeoutMs = 60000; // 60 seconds for file downloads
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        console.error(`BOX RESOLVER: File content request timeout after ${timeoutMs}ms - ${url}`);
        controller.abort();
    }, timeoutMs);

    try {
        const response = await fetch(url, {
            ...defaultOptions,
            method: 'GET',
            signal: controller.signal,
            redirect: 'follow'  // Auto follow redirects like curl -L
        });

        console.log(`BOX RESOLVER: file content response ${response.status} ${response.ok}`)
    
        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error(`BOX RESOLVER: HTTP Error ${response.status} - ${url}`);
            throw new Error(`HTTP Error: ${response.status}`);
        }

        const body = await getFileContentBody(response);
        return body;

    } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
            console.error(`BOX RESOLVER: File content request timeout - ${url}`);
        } else {
            console.error(`BOX RESOLVER: File content request failed - ${url}: ${error}`);
        }
        
        throw error;
    }
};

// File functions
export const queryFile = async (env, attrs) => {
    const id = attrs.queryAttributeValues?.get('__path__')?.split('/')?.pop() ?? null;

    console.log(`BOX RESOLVER: Querying Box: ${id}\n`);
    try {
        if (id) {
            const file = await makeGetRequest(`/2.0/files/${id}?fields=id,name,modified_at,shared_link`);
            return [asInstance(toFile(file), 'File')];
        } else {
            // Get all files from root folder
            const result = await makeGetRequest('/2.0/folders/0/items?fields=id,name,modified_at,shared_link&limit=100');
            const files = result.entries.filter(item => item.type === 'file');
            return files.map(file => asInstance(toFile(file), 'File'));
        }
    } catch (error) {
        console.error(`BOX RESOLVER: Failed to query files: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const updateFile = async (env, attributes, newAttrs) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "File ID is required"};
    }

    const data = {};
    if (newAttrs.get('name')) {
        data.name = newAttrs.get('name');
    }
    if (newAttrs.get('description')) {
        data.description = newAttrs.get('description');
    }

    try {
        const result = await makePutRequest(`/2.0/files/${id}`, data);
        return asInstance(toFile(result), 'File');
    } catch (error) {
        console.error(`BOX RESOLVER: Failed to update file: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const deleteFile = async (env, attributes) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "File ID is required"};
    }

    try {
        await makeDeleteRequest(`/2.0/files/${id}`);
        return {"result": "success"};
    } catch (error) {
        console.error(`BOX RESOLVER: Failed to delete file: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// Folder functions
export const createFolder = async (env, attributes) => {
    const name = attributes.attributes.get('name');
    const parentId = attributes.attributes.get('parent_id') || '0';

    if (!name) {
        return {"result": "error", "message": "Folder name is required"};
    }

    const data = {
        name,
        parent: { id: parentId }
    };

    try {
        const result = await makePostRequest('/2.0/folders', data);
        return asInstance(toFolder(result), 'Folder');
    } catch (error) {
        console.error(`BOX RESOLVER: Failed to create folder: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const queryFolder = async (env, attrs) => {
    const id = attrs.queryAttributeValues?.get('__path__')?.split('/')?.pop() ?? null;

    console.log(`BOX RESOLVER: Querying Box: ${id}\n`);
    try {
        if (id) {
            const folder = await makeGetRequest(`/2.0/folders/${id}?fields=id,name,modified_at,shared_link`);
            return [asInstance(toFolder(folder), 'Folder')];
        } else {
            // Get all folders from root
            const result = await makeGetRequest('/2.0/folders/0/items?fields=id,name,modified_at,shared_link&limit=100');
            const folders = result.entries.filter(item => item.type === 'folder');
            return folders.map(folder => asInstance(toFolder(folder), 'Folder'));
        }
    } catch (error) {
        console.error(`BOX RESOLVER: Failed to query folders: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const updateFolder = async (env, attributes, newAttrs) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "Folder ID is required"};
    }

    const data = {};
    if (newAttrs.get('name')) {
        data.name = newAttrs.get('name');
    }
    if (newAttrs.get('description')) {
        data.description = newAttrs.get('description');
    }

    try {
        const result = await makePutRequest(`/2.0/folders/${id}`, data);
        return asInstance(toFolder(result), 'Folder');
    } catch (error) {
        console.error(`BOX RESOLVER: Failed to update folder: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const deleteFolder = async (env, attributes) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "Folder ID is required"};
    }

    const recursive = attributes.attributes.get('recursive') === 'true';

    try {
        await makeDeleteRequest(`/2.0/folders/${id}?recursive=${recursive}`);
        return {"result": "success"};
    } catch (error) {
        console.error(`BOX RESOLVER: Failed to delete folder: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// User functions
export const createUser = async (env, attributes) => {
    const firstName = attributes.attributes.get('first_name');
    const lastName = attributes.attributes.get('last_name');
    const email = attributes.attributes.get('email');

    if (!firstName || !lastName || !email) {
        return {"result": "error", "message": "First name, last name, and email are required"};
    }

    const data = {
        name: `${firstName} ${lastName}`,
        login: email
    };

    try {
        const result = await makePostRequest('/2.0/users', data);
        return asInstance(toUser(result), 'User');
    } catch (error) {
        console.error(`BOX RESOLVER: Failed to create user: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const queryUser = async (env, attrs) => {
    const id = attrs.queryAttributeValues?.get('__path__')?.split('/')?.pop() ?? null;

    console.log(`BOX RESOLVER: Querying Box: ${id}\n`);
    try {
        if (id) {
            const user = await makeGetRequest(`/2.0/users/${id}`);
            return [asInstance(toUser(user), 'User')];
        } else {
            // Get all users (requires enterprise account)
            const result = await makeGetRequest('/2.0/users?limit=100');
            return result.entries.map(user => asInstance(toUser(user), 'User'));
        }
    } catch (error) {
        console.error(`BOX RESOLVER: Failed to query users: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const updateUser = async (env, attributes, newAttrs) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "User ID is required"};
    }

    const data = {};
    const firstName = newAttrs.get('first_name');
    const lastName = newAttrs.get('last_name');
    
    if (firstName || lastName) {
        const currentFirstName = firstName || attributes.attributes.get('first_name') || '';
        const currentLastName = lastName || attributes.attributes.get('last_name') || '';
        data.name = `${currentFirstName} ${currentLastName}`.trim();
    }
    
    if (newAttrs.get('email')) {
        data.login = newAttrs.get('email');
    }

    try {
        const result = await makePutRequest(`/2.0/users/${id}`, data);
        return asInstance(toUser(result), 'User');
    } catch (error) {
        console.error(`BOX RESOLVER: Failed to update user: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const deleteUser = async (env, attributes) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "User ID is required"};
    }

    const force = attributes.attributes.get('force') === 'true';
    const notify = attributes.attributes.get('notify') === 'true';

    try {
        await makeDeleteRequest(`/2.0/users/${id}?force=${force}&notify=${notify}`);
        return {"result": "success"};
    } catch (error) {
        console.error(`BOX RESOLVER: Failed to delete user: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// Action functions
export const createUserAction = async (env, attributes) => {
    const firstName = attributes.attributes.get('first_name');
    const lastName = attributes.attributes.get('last_name');
    const email = attributes.attributes.get('email');

    if (!firstName || !lastName || !email) {
        return {"result": "error", "message": "First name, last name, and email are required"};
    }

    const data = {
        name: `${firstName} ${lastName}`,
        login: email
    };

    try {
        const result = await makePostRequest('/2.0/users', data);
        return asInstance(toUser(result), 'User');
    } catch (error) {
        console.error(`BOX RESOLVER: Failed to create user: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const deleteUserAction = async (env, attributes) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "User ID is required"};
    }

    const force = attributes.attributes.get('force') === 'true';
    const notify = attributes.attributes.get('notify') === 'true';

    try {
        await makeDeleteRequest(`/2.0/users/${id}?force=${force}&notify=${notify}`);
        return {"result": "success"};
    } catch (error) {
        console.error(`BOX RESOLVER: Failed to delete user: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// Folder content functions
export const queryFolderContent = async (env, attrs) => {
    const id = attrs.queryAttributeValues?.get('id') || '0';
    const marker = attrs.queryAttributeValues?.get('marker');

    try {
        let endpoint = `/2.0/folders/${id}/items?fields=id,name,modified_at,shared_link&limit=100`;
        if (marker) {
            endpoint += `&marker=${marker}`;
        }

        const result = await makeGetRequest(endpoint);
        
        const files = result.entries.filter(item => item.type === 'file');
        const folders = result.entries.filter(item => item.type === 'folder');

        return [asInstance({
            files: files.map(file => toFile(file)),
            folders: folders.map(folder => toFolder(folder)),
            next_marker: result.next_marker || null
        }, 'FolderContent')];
    } catch (error) {
        console.error(`BOX RESOLVER: Failed to query folder content: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const getFolderContent = async (env, attrs) => {
    const id = attrs.queryAttributeValues?.get('__path__')?.split('/')?.pop() || '0';

    try {
        const result = await makeGetRequest(`/2.0/folders/${id}/items?fields=id,name,modified_at,shared_link&limit=100`);
        
        const files = result.entries.filter(item => item.type === 'file');
        const folders = result.entries.filter(item => item.type === 'folder');

        return [asInstance({
            files: files.map(file => toFile(file)),
            folders: folders.map(folder => toFolder(folder)),
            next_marker: result.next_marker || null
        }, 'FolderContent')];
    } catch (error) {
        console.error(`BOX RESOLVER: Failed to get folder content: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// Subscription functions for real-time updates
async function getAndProcessRecords(resolver, entityType) {
    try {
        let endpoint;
        switch (entityType) {
            case 'files':
                endpoint = '/2.0/folders/0/items?fields=id,name,modified_at,shared_link&limit=100';
                break;
            case 'folders':
                endpoint = '/2.0/folders/0/items?fields=id,name,modified_at,shared_link&limit=100';
                break;
            case 'users':
                endpoint = '/2.0/users?limit=100';
                break;
            default:
                console.error(`BOX RESOLVER: Unknown entity type: ${entityType}`);
                return;
        }

        const result = await makeGetRequest(endpoint);
        
        if ((entityType === 'files' || entityType === 'folders') && result.entries) {
            for (const item of result.entries) {
                if (entityType === 'files' && item.type === 'file') {
                    console.log(`BOX RESOLVER: Processing file ${item.id}`);
                    
                    const mappedData = toFile(item);
                    const inst = {
                        id: mappedData.id,
                        type: entityType,
                        data: mappedData,
                        timestamp: new Date().toISOString()
                    };
                    
                    await resolver.onSubscription(inst, true);
                } else if (entityType === 'folders' && item.type === 'folder') {
                    console.log(`BOX RESOLVER: Processing folder ${item.id}`);
                    
                    const mappedData = toFolder(item);
                    const inst = {
                        id: mappedData.id,
                        type: entityType,
                        data: mappedData,
                        timestamp: new Date().toISOString()
                    };
                    
                    await resolver.onSubscription(inst, true);
                }
            }
        } else if (entityType === 'users' && result.entries) {
            for (const user of result.entries) {
                console.log(`BOX RESOLVER: Processing user ${user.id}`);
                
                const mappedData = toUser(user);
                const inst = {
                    id: mappedData.id,
                    type: entityType,
                    data: mappedData,
                    timestamp: new Date().toISOString()
                };
                
                await resolver.onSubscription(inst, true);
            }
        }
    } catch (error) {
        console.error(`BOX RESOLVER: Failed to process ${entityType} records: ${error}`);
    }
}

async function handleSubsFiles(resolver) {
    console.log('BOX RESOLVER: Fetching files for subscription...');
    await getAndProcessRecords(resolver, 'files');
}

async function handleSubsFolders(resolver) {
    console.log('BOX RESOLVER: Fetching folders for subscription...');
    await getAndProcessRecords(resolver, 'folders');
}

async function handleSubsUsers(resolver) {
    console.log('BOX RESOLVER: Fetching users for subscription...');
    await getAndProcessRecords(resolver, 'users');
}

export async function subsFiles(resolver) {
    await handleSubsFiles(resolver);
    const intervalMinutes = parseInt(getLocalEnv("BOX_POLL_INTERVAL_MINUTES")) || 60;
    const intervalMs = intervalMinutes * 60 * 1000;
    console.log(`BOX RESOLVER: Setting files polling interval to ${intervalMinutes} minutes`);
    setInterval(async () => {
        await handleSubsFiles(resolver);
    }, intervalMs);
}

export async function subsFolders(resolver) {
    await handleSubsFolders(resolver);
    const intervalMinutes = parseInt(getLocalEnv("BOX_POLL_INTERVAL_MINUTES")) || 60;
    const intervalMs = intervalMinutes * 60 * 1000;
    console.log(`BOX RESOLVER: Setting folders polling interval to ${intervalMinutes} minutes`);
    setInterval(async () => {
        await handleSubsFolders(resolver);
    }, intervalMs);
}

export async function subsUsers(resolver) {
    await handleSubsUsers(resolver);
    const intervalMinutes = parseInt(getLocalEnv("BOX_POLL_INTERVAL_MINUTES")) || 60;
    const intervalMs = intervalMinutes * 60 * 1000;
    console.log(`BOX RESOLVER: Setting users polling interval to ${intervalMinutes} minutes`);
    setInterval(async () => {
        await handleSubsUsers(resolver);
    }, intervalMs);
}

// File content functions
export const queryFileContent = async (env, attrs) => {
    const id = attrs.queryAttributeValues?.get('__path__')?.split('/')?.pop() ?? null;

    if (!id) {
        return {"result": "error", "message": "File ID is required"};
    }

    console.log(`BOX RESOLVER: Querying Box file content: ${id}\n`);
    try {
        // First get file metadata
        const fileMetadata = await makeGetRequest(`/2.0/files/${id}?fields=id,name,size,modified_at`);
        
        // Then get file content using the specialized file content request
        const fileContent = await makeFileContentRequest(`/2.0/files/${id}/content`);
        return fileContent;
    } catch (error) {
        console.error(`BOX RESOLVER: Failed to query file content: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const uploadFile = async (fileName, uploadName) => {
    const fs = await import('fs');
    const path = await import('path');
    const { FormData, Blob } = await import('formdata-node');
    
    const parentId = '0';
    const localFilePath = path.join(process.cwd(), '/fs', fileName);
    console.log(`BOX RESOLVER: Uploading file from ${localFilePath} to Box\n`);
    
    try {
        // Read file from local filesystem
        const fileBuffer = fs.readFileSync(localFilePath);
        const finalFileName = fileName || path.basename(localFilePath);
        
        // Create FormData for multipart upload
        const formData = new FormData();
        
        // Add attributes FIRST (Box requires this order)
        formData.append('attributes', JSON.stringify({
            name: uploadName || finalFileName,
            parent: { id: parentId }
        }));
        
        // Add file content SECOND
        const blob = new Blob([fileBuffer]);
        formData.append('file', blob, uploadName || finalFileName);
        
        console.log(`BOX RESOLVER: Uploading file: ${finalFileName}, name: ${uploadName || finalFileName}, parent: ${parentId}`);
        
        // Use the standard multipart request function
        const result = await makeMultipartRequest('/api/2.0/files/content', formData, true);
        
        console.log(`BOX RESOLVER: Successfully uploaded file ${finalFileName}, name: ${uploadName || finalFileName}`, result);
        
        // Return the uploaded file entry
        const uploadedFile = result.entries?.[0] || result;
        return asInstance({
            id: uploadedFile.id,
            name: uploadName || uploadedFile.name,
            download_url: uploadedFile.shared_link?.download_url || '',
            modified_at: uploadedFile.modified_at
        }, 'File');
        
    } catch (error) {
        console.error(`BOX RESOLVER: Failed to upload file: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const syncRemoteFile = async (fileId, fileName) => {
    const fs = await import('fs');
    const path = await import('path');
    
    console.log(`BOX RESOLVER: Syncing remote file to local filesystem: ${fileId}\n`);
    try {
        const fileMetadata = await makeGetRequest(`/2.0/files/${fileId}?fields=id,name,size,modified_at`);
        
        const fileContentBuffer = await makeFileContentRequest(`/2.0/files/${fileId}/content`);
        
        const fname = fileName || fileMetadata.id + fileMetadata.name;
        const localFilePath = path.join(process.cwd(), '/fs', fname);
        
        const fsDir = path.join(process.cwd(), '/fs');
        if (!fs.existsSync(fsDir)) {
            fs.mkdirSync(fsDir, { recursive: true });
        }
        
        fs.writeFileSync(localFilePath, fileContentBuffer);
        
        console.log(`BOX RESOLVER: Successfully saved file to ${localFilePath}, size: ${fileContentBuffer.length} bytes`);
        
        return asInstance({
            id: fileMetadata.id,
            name: fileMetadata.name,
            download_url: localFilePath,
            modified_at: fileMetadata.modified_at
        }, 'File');
        
    } catch (error) {
        console.error(`BOX RESOLVER: Failed to sync remote file to local filesystem: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export function getFileUniqueName (fileName, fileId, fileOriginalName) {
    return fileName || fileId + fileOriginalName;
}