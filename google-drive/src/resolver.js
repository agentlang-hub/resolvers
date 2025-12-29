// Import agentlang modules
import { getLocalEnv } from "agentlang/out/runtime/auth/defs.js";
import { makeInstance } from "agentlang/out/runtime/module.js";

// Mapper functions for Google Drive API responses to Agentlang entities
function toDocument(file) {
    return {
        id: file.id,
        url: file.webViewLink || '',
        title: file.name,
        mime_type: file.mimeType,
        updated_at: file.modifiedTime
    };
}

function toFolder(file) {
    return {
        id: file.id,
        url: file.webViewLink || '',
        title: file.name,
        mime_type: file.mimeType,
        updated_at: file.modifiedTime
    };
}

function toFile(file) {
    return {
        id: file.id,
        name: file.name,
        mime_type: file.mimeType,
        parents: file.parents ? file.parents.join(',') : null,
        modified_time: file.modifiedTime,
        created_time: file.createdTime,
        web_view_link: file.webViewLink || '',
        kind: file.kind || ''
    };
}

function toDrive(drive) {
    return {
        id: drive.id,
        name: drive.name,
        kind: drive.kind,
        created_time: drive.createdTime,
        hidden: drive.hidden || false
    };
}

function asInstance(entity, entityType) {
  const instanceMap = new Map(Object.entries(entity));
  return makeInstance("googledrive", entityType, instanceMap);
}

const getResponseBody = async (response) => {
    try {
        try {
            return await response.json()
        } catch (e) {
            return await response.text();
        }
    } catch (error) {
        console.error("GOOGLE DRIVE RESOLVER: Error reading response body:", error);
        return {};
    }
}

const getFileContentBody = async (response) => {
    try {
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        return buffer;
    } catch (error) {
        console.error("GOOGLE DRIVE RESOLVER: Error reading file content body:", error);
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

    const directToken = getLocalEnv("GOOGLE_ACCESS_TOKEN");
    const clientId = getLocalEnv("GOOGLE_CLIENT_ID");
    const clientSecret = getLocalEnv("GOOGLE_CLIENT_SECRET");
    const refreshToken = getLocalEnv("GOOGLE_REFRESH_TOKEN");

    // Method 1: Direct access token
    if (directToken) {
        accessToken = directToken;
        console.log('GOOGLE DRIVE RESOLVER: Using direct access token');
        return accessToken;
    }

    // Method 2: OAuth2 with refresh token
    if (clientId && clientSecret && refreshToken) {
        try {
            const tokenUrl = 'https://oauth2.googleapis.com/token';
            const params = new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: refreshToken,
                grant_type: 'refresh_token'
            });

            console.log(`GOOGLE DRIVE RESOLVER: Fetching OAuth2 access token from ${tokenUrl}`);

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
                throw new Error('No access token received from Google OAuth2');
            }

            accessToken = tokenData.access_token;
            // Set expiry time (subtract 5 minutes for safety)
            tokenExpiry = Date.now() + ((tokenData.expires_in || 3600) - 300) * 1000;

            console.log(`GOOGLE DRIVE RESOLVER: Successfully obtained OAuth2 access token, expires in ${tokenData.expires_in} seconds`);
            return accessToken;

        } catch (error) {
            console.error(`GOOGLE DRIVE RESOLVER: OAuth2 failed: ${error.message}`);
            throw new Error(`Google Drive OAuth2 authentication failed: ${error.message}`);
        }
    }

    throw new Error('Google Drive authentication is required: GOOGLE_ACCESS_TOKEN or OAuth2 credentials (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN)');
}

// Generic HTTP functions
const makeRequest = async (endpoint, options = {}) => {
    let token = getLocalEnv("GOOGLE_ACCESS_TOKEN");
    
    // If no direct token provided, try to get one via OAuth2
    if (!token) {
        try {
            token = await getAccessToken();
        } catch (error) {
            throw new Error(`Google Drive authentication failed: ${error.message}`);
        }
    }
    
    if (!token) {
        throw new Error('Google Drive access token is required');
    }
    
    const baseUrl = 'https://www.googleapis.com';
    const url = `${baseUrl}${endpoint}`;
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    };

    console.log(`GOOGLE DRIVE RESOLVER: making http request ${options.method} ${url}`)

    const config = { ...defaultOptions, ...options };
    
    // Remove Content-Type header for GET requests without body
    if (config.method === 'GET') {
        delete config.headers['Content-Type'];
    }

    const timeoutMs = 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        console.error(`GOOGLE DRIVE RESOLVER: Request timeout after ${timeoutMs}ms - ${url}`);
        controller.abort();
    }, timeoutMs);

    try {
        const response = await fetch(url, {
            ...config,
            signal: controller.signal
        });

        const body = await getResponseBody(response);
        console.log(`GOOGLE DRIVE RESOLVER: response ${response.status} ${response.ok}`, body)
    
        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error(`GOOGLE DRIVE RESOLVER: HTTP Error ${response.status} - ${url}`);
            throw new Error(`HTTP Error: ${response.status} - ${JSON.stringify(body)}`);
        }

        return body;

    } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
            console.error(`GOOGLE DRIVE RESOLVER: Request timeout - ${url}`);
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'EHOSTUNREACH') {
            console.error(`GOOGLE DRIVE RESOLVER: Network unreachable (${error.code}) - ${url}`);
        } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
            console.error(`GOOGLE DRIVE RESOLVER: Connection error (${error.code}) - ${url}`);
        } else {
            console.error(`GOOGLE DRIVE RESOLVER: Request failed (${error.name}) - ${url}`);
        }
        
        throw error;
    }
};

const makeGetRequest = async (endpoint) => {
    console.log(`GOOGLE DRIVE RESOLVER: Querying Google Drive: ${endpoint}\n`);    
    return await makeRequest(endpoint, { method: 'GET' });
};

const makePostRequest = async (endpoint, body) => {
    console.log(`GOOGLE DRIVE RESOLVER: Creating in Google Drive: ${endpoint}\n`);
    return await makeRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(body)
    });
};

const makePatchRequest = async (endpoint, body) => {
    console.log(`GOOGLE DRIVE RESOLVER: Updating in Google Drive: ${endpoint}\n`);
    return await makeRequest(endpoint, {
        method: 'PATCH',
        body: JSON.stringify(body)
    });
};

const makeDeleteRequest = async (endpoint) => {
    console.log(`GOOGLE DRIVE RESOLVER: Deleting from Google Drive: ${endpoint}\n`);
    return await makeRequest(endpoint, { method: 'DELETE' });
};

const makeFileContentRequest = async (endpoint) => {
    console.log(`GOOGLE DRIVE RESOLVER: Downloading file content from Google Drive: ${endpoint}\n`);
    
    let token = getLocalEnv("GOOGLE_ACCESS_TOKEN");
    
    if (!token) {
        try {
            token = await getAccessToken();
        } catch (error) {
            throw new Error(`Google Drive authentication failed: ${error.message}`);
        }
    }
    
    if (!token) {
        throw new Error('Google Drive access token is required');
    }
    
    const baseUrl = 'https://www.googleapis.com';
    const url = `${baseUrl}${endpoint}`;
    const defaultOptions = {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    };

    console.log(`GOOGLE DRIVE RESOLVER: making file content request GET ${url}`)

    const timeoutMs = 60000; // 60 seconds for file downloads
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        console.error(`GOOGLE DRIVE RESOLVER: File content request timeout after ${timeoutMs}ms - ${url}`);
        controller.abort();
    }, timeoutMs);

    try {
        const response = await fetch(url, {
            ...defaultOptions,
            method: 'GET',
            signal: controller.signal
        });

        console.log(`GOOGLE DRIVE RESOLVER: file content response ${response.status} ${response.ok}`)
    
        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error(`GOOGLE DRIVE RESOLVER: HTTP Error ${response.status} - ${url}`);
            throw new Error(`HTTP Error: ${response.status}`);
        }

        const body = await getFileContentBody(response);
        return body;

    } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
            console.error(`GOOGLE DRIVE RESOLVER: File content request timeout - ${url}`);
        } else {
            console.error(`GOOGLE DRIVE RESOLVER: File content request failed - ${url}: ${error}`);
        }
        
        throw error;
    }
};

// Document functions
export const queryDocument = async (env, attrs) => {
    const id = attrs.queryAttributeValues?.get('__path__')?.split('/')?.pop() ?? null;

    console.log(`GOOGLE DRIVE RESOLVER: Querying Google Drive: ${id}\n`);
    try {
        if (id) {
            const doc = await makeGetRequest(`/drive/v3/files/${id}?fields=id,name,mimeType,webViewLink,modifiedTime&supportsAllDrives=true`);
            return [asInstance(toDocument(doc), 'Document')];
        } else {
            // Get all documents (non-folders)
            const result = await makeGetRequest('/drive/v3/files?q=mimeType!="application/vnd.google-apps.folder"&fields=files(id,name,mimeType,webViewLink,modifiedTime)&pageSize=100&corpora=allDrives&includeItemsFromAllDrives=true&supportsAllDrives=true');
            return result.files.map(file => asInstance(toDocument(file), 'Document'));
        }
    } catch (error) {
        console.error(`GOOGLE DRIVE RESOLVER: Failed to query documents: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const updateDocument = async (env, attributes, newAttrs) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "Document ID is required"};
    }

    const data = {};
    if (newAttrs.get('title')) {
        data.name = newAttrs.get('title');
    }
    if (newAttrs.get('description')) {
        data.description = newAttrs.get('description');
    }

    try {
        const result = await makePatchRequest(`/drive/v3/files/${id}?supportsAllDrives=true`, data);
        return asInstance(toDocument(result), 'Document');
    } catch (error) {
        console.error(`GOOGLE DRIVE RESOLVER: Failed to update document: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const deleteDocument = async (env, attributes) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "Document ID is required"};
    }

    try {
        await makeDeleteRequest(`/drive/v3/files/${id}?supportsAllDrives=true`);
        return {"result": "success"};
    } catch (error) {
        console.error(`GOOGLE DRIVE RESOLVER: Failed to delete document: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// Folder functions
export const createFolder = async (env, attributes) => {
    const name = attributes.attributes.get('title');
    const parentId = attributes.attributes.get('parent_id');

    if (!name) {
        return {"result": "error", "message": "Folder name is required"};
    }

    const data = {
        name,
        mimeType: 'application/vnd.google-apps.folder'
    };

    if (parentId) {
        data.parents = [parentId];
    }

    try {
        const result = await makePostRequest('/drive/v3/files?supportsAllDrives=true', data);
        return asInstance(toFolder(result), 'Folder');
    } catch (error) {
        console.error(`GOOGLE DRIVE RESOLVER: Failed to create folder: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const queryFolder = async (env, attrs) => {
    const id = attrs.queryAttributeValues?.get('__path__')?.split('/')?.pop() ?? null;

    console.log(`GOOGLE DRIVE RESOLVER: Querying Google Drive: ${id}\n`);
    try {
        if (id) {
            const folder = await makeGetRequest(`/drive/v3/files/${id}?fields=id,name,mimeType,webViewLink,modifiedTime&supportsAllDrives=true`);
            return [asInstance(toFolder(folder), 'Folder')];
        } else {
            // Get all folders
            const result = await makeGetRequest('/drive/v3/files?q=mimeType="application/vnd.google-apps.folder"&fields=files(id,name,mimeType,webViewLink,modifiedTime)&pageSize=100&corpora=allDrives&includeItemsFromAllDrives=true&supportsAllDrives=true');
            return result.files.map(file => asInstance(toFolder(file), 'Folder'));
        }
    } catch (error) {
        console.error(`GOOGLE DRIVE RESOLVER: Failed to query folders: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const updateFolder = async (env, attributes, newAttrs) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "Folder ID is required"};
    }

    const data = {};
    if (newAttrs.get('title')) {
        data.name = newAttrs.get('title');
    }
    if (newAttrs.get('description')) {
        data.description = newAttrs.get('description');
    }

    try {
        const result = await makePatchRequest(`/drive/v3/files/${id}?supportsAllDrives=true`, data);
        return asInstance(toFolder(result), 'Folder');
    } catch (error) {
        console.error(`GOOGLE DRIVE RESOLVER: Failed to update folder: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const deleteFolder = async (env, attributes) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "Folder ID is required"};
    }

    try {
        await makeDeleteRequest(`/drive/v3/files/${id}?supportsAllDrives=true`);
        return {"result": "success"};
    } catch (error) {
        console.error(`GOOGLE DRIVE RESOLVER: Failed to delete folder: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// File functions
export const queryFile = async (env, attrs) => {
    const id = attrs.queryAttributeValues?.get('__path__')?.split('/')?.pop() ?? null;

    console.log(`GOOGLE DRIVE RESOLVER: Querying Google Drive: ${id}\n`);
    try {
        if (id) {
            const file = await makeGetRequest(`/drive/v3/files/${id}?fields=id,name,mimeType,parents,modifiedTime,createdTime,webViewLink,kind&supportsAllDrives=true`);
            return [asInstance(toFile(file), 'File')];
        } else {
            // Get all files
            const result = await makeGetRequest('/drive/v3/files?fields=files(id,name,mimeType,parents,modifiedTime,createdTime,webViewLink,kind)&pageSize=100&corpora=allDrives&includeItemsFromAllDrives=true&supportsAllDrives=true');
            return result.files.map(file => asInstance(toFile(file), 'File'));
        }
    } catch (error) {
        console.error(`GOOGLE DRIVE RESOLVER: Failed to query files: ${error}`);
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
        const result = await makePatchRequest(`/drive/v3/files/${id}?supportsAllDrives=true`, data);
        return asInstance(toFile(result), 'File');
    } catch (error) {
        console.error(`GOOGLE DRIVE RESOLVER: Failed to update file: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const deleteFile = async (env, attributes) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "File ID is required"};
    }

    try {
        await makeDeleteRequest(`/drive/v3/files/${id}?supportsAllDrives=true`);
        return {"result": "success"};
    } catch (error) {
        console.error(`GOOGLE DRIVE RESOLVER: Failed to delete file: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// Drive functions
export const queryDrive = async (env, attrs) => {
    const id = attrs.queryAttributeValues?.get('__path__')?.split('/')?.pop() ?? null;

    console.log(`GOOGLE DRIVE RESOLVER: Querying Google Drive: ${id}\n`);
    try {
        if (id) {
            const drive = await makeGetRequest(`/drive/v3/drives/${id}?fields=id,name,kind,createdTime,hidden`);
            return [asInstance(toDrive(drive), 'Drive')];
        } else {
            // Get all shared drives
            const result = await makeGetRequest('/drive/v3/drives?pageSize=100&fields=drives(id,name,kind,createdTime,hidden)');
            return result.drives.map(drive => asInstance(toDrive(drive), 'Drive'));
        }
    } catch (error) {
        console.error(`GOOGLE DRIVE RESOLVER: Failed to query drives: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// Upload file function
export const uploadFile = async (env, attributes) => {
    const content = attributes.attributes.get('content');
    const name = attributes.attributes.get('name');
    const mimeType = attributes.attributes.get('mime_type') || 'application/octet-stream';
    const folderId = attributes.attributes.get('folder_id');
    const description = attributes.attributes.get('description');
    const isBase64 = attributes.attributes.get('is_base64') === 'true';

    if (!content || !name) {
        return {"result": "error", "message": "Content and name are required"};
    }

    try {
        let token = getLocalEnv("GOOGLE_ACCESS_TOKEN");
        if (!token) {
            token = await getAccessToken();
        }

        // Prepare file content
        const fileContent = isBase64 ? Buffer.from(content, 'base64') : Buffer.from(content);
        
        const fileSizeInBytes = fileContent.length;
        const maxFileSizeInBytes = 5 * 1024 * 1024; // 5 MB

        if (fileSizeInBytes > maxFileSizeInBytes) {
            throw new Error('File size exceeds the 5 MB limit for simple uploads');
        }

        // Upload file using media upload
        const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=media';
        const uploadResponse = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': mimeType,
                'Content-Length': fileContent.length.toString()
            },
            body: fileContent
        });

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            throw new Error(`Upload failed: ${uploadResponse.status} - ${errorText}`);
        }

        const uploadResult = await uploadResponse.json();
        const fileId = uploadResult.id;

        // Update metadata if needed
        if (name || folderId || description) {
            const metadata = { name };
            if (description) {
                metadata.description = description;
            }

            const params = new URLSearchParams({ supportsAllDrives: 'true' });
            if (folderId) {
                params.append('addParents', folderId);
                params.append('removeParents', 'root');
            }

            const updateResult = await makePatchRequest(`/drive/v3/files/${fileId}?${params.toString()}`, metadata);
            return asInstance(toFile(updateResult), 'File');
        }

        return asInstance(toFile(uploadResult), 'File');

    } catch (error) {
        console.error(`GOOGLE DRIVE RESOLVER: Failed to upload file: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// Upload local file function
export const uploadLocalFile = async (fileName, uploadName) => {
    const fs = await import('fs');
    const path = await import('path');
    
    const localFilePath = path.join(process.cwd(), '/fs', fileName);
    console.log(`GOOGLE DRIVE RESOLVER: Uploading local file from ${localFilePath} to Google Drive\n`);
    
    try {
        let token = getLocalEnv("GOOGLE_ACCESS_TOKEN");
        if (!token) {
            token = await getAccessToken();
        }

        // Read file from local filesystem
        const fileBuffer = fs.readFileSync(localFilePath);
        const finalFileName = uploadName || fileName || path.basename(localFilePath);
        const mimeType = 'application/octet-stream'; // Default MIME type

        // Upload file using media upload
        const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=media';
        const uploadResponse = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': mimeType,
                'Content-Length': fileBuffer.length.toString()
            },
            body: fileBuffer
        });

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            throw new Error(`Upload failed: ${uploadResponse.status} - ${errorText}`);
        }

        const uploadResult = await uploadResponse.json();
        const fileId = uploadResult.id;

        // Update metadata with final file name
        const metadata = { name: finalFileName };
        const updateResult = await makePatchRequest(`/drive/v3/files/${fileId}?supportsAllDrives=true`, metadata);
        
        console.log(`GOOGLE DRIVE RESOLVER: Successfully uploaded file ${finalFileName}`);
        return asInstance(toFile(updateResult), 'File');

    } catch (error) {
        console.error(`GOOGLE DRIVE RESOLVER: Failed to upload local file: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// Folder content functions
export const queryFolderContent = async (env, attrs) => {
    const id = attrs.queryAttributeValues?.get('id') || 'root';
    const cursor = attrs.queryAttributeValues?.get('cursor');

    try {
        const query = `'${id}' in parents and trashed=false`;
        let endpoint = `/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,parents,modifiedTime,createdTime,webViewLink,kind),nextPageToken&pageSize=100&corpora=allDrives&includeItemsFromAllDrives=true&supportsAllDrives=true&orderBy=name`;
        
        if (cursor) {
            endpoint += `&pageToken=${cursor}`;
        }

        const result = await makeGetRequest(endpoint);
        
        const files = [];
        const folders = [];

        for (const item of result.files || []) {
            if (item.mimeType === 'application/vnd.google-apps.folder') {
                folders.push(toFile(item));
            } else {
                files.push(toFile(item));
            }
        }

        return [asInstance({
            files,
            folders,
            next_cursor: result.nextPageToken || null
        }, 'FolderContent')];
    } catch (error) {
        console.error(`GOOGLE DRIVE RESOLVER: Failed to query folder content: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const getFolderContent = async (env, attrs) => {
    const id = attrs.queryAttributeValues?.get('__path__')?.split('/')?.pop() || 'root';

    try {
        const query = `'${id}' in parents and trashed=false`;
        const endpoint = `/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,parents,modifiedTime,createdTime,webViewLink,kind),nextPageToken&pageSize=100&corpora=allDrives&includeItemsFromAllDrives=true&supportsAllDrives=true&orderBy=name`;

        const result = await makeGetRequest(endpoint);
        
        const files = [];
        const folders = [];

        for (const item of result.files || []) {
            if (item.mimeType === 'application/vnd.google-apps.folder') {
                folders.push(toFile(item));
            } else {
                files.push(toFile(item));
            }
        }

        return [asInstance({
            files,
            folders,
            next_cursor: result.nextPageToken || null
        }, 'FolderContent')];
    } catch (error) {
        console.error(`GOOGLE DRIVE RESOLVER: Failed to get folder content: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// File content functions
export const queryFileContent = async (env, attrs) => {
    const id = attrs.queryAttributeValues?.get('__path__')?.split('/')?.pop() ?? null;

    if (!id) {
        return {"result": "error", "message": "File ID is required"};
    }

    console.log(`GOOGLE DRIVE RESOLVER: Querying Google Drive file content: ${id}\n`);
    try {
        // Get file metadata
        const fileMetadata = await makeGetRequest(`/drive/v3/files/${id}?fields=id,name,size,mimeType,modifiedTime&supportsAllDrives=true`);
        
        // Download file content
        const fileContent = await makeFileContentRequest(`/drive/v3/files/${id}?alt=media&supportsAllDrives=true`);
        
        return [asInstance({
            id: fileMetadata.id,
            name: fileMetadata.name,
            content: fileContent.toString('base64'),
            size: parseInt(fileMetadata.size || '0'),
            modified_time: fileMetadata.modifiedTime
        }, 'FileContent')];
    } catch (error) {
        console.error(`GOOGLE DRIVE RESOLVER: Failed to query file content: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// Sync remote file to local filesystem
export const syncRemoteFile = async (fileId, fileName) => {
    const fs = await import('fs');
    const path = await import('path');
    
    console.log(`GOOGLE DRIVE RESOLVER: Syncing remote file to local filesystem: ${fileId}\n`);
    try {
        const fileMetadata = await makeGetRequest(`/drive/v3/files/${fileId}?fields=id,name,size,modifiedTime&supportsAllDrives=true`);
        
        const fileContentBuffer = await makeFileContentRequest(`/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`);
        
        const fname = fileName || fileId + fileMetadata.name;
        const localFilePath = path.join(process.cwd(), '/fs', fname);
        
        const fsDir = path.join(process.cwd(), '/fs');
        if (!fs.existsSync(fsDir)) {
            fs.mkdirSync(fsDir, { recursive: true });
        }
        
        fs.writeFileSync(localFilePath, fileContentBuffer);
        
        console.log(`GOOGLE DRIVE RESOLVER: Successfully saved file to ${localFilePath}, size: ${fileContentBuffer.length} bytes`);
        
        return asInstance({
            id: fileMetadata.id,
            name: fileMetadata.name,
            mime_type: fileMetadata.mimeType,
            parents: null,
            modified_time: fileMetadata.modifiedTime,
            created_time: null,
            web_view_link: localFilePath,
            kind: 'local'
        }, 'File');
        
    } catch (error) {
        console.error(`GOOGLE DRIVE RESOLVER: Failed to sync remote file to local filesystem: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// Subscription functions for real-time updates
async function getAndProcessRecords(resolver, entityType) {
    try {
        let endpoint;
        switch (entityType) {
            case 'documents':
                endpoint = '/drive/v3/files?q=mimeType!="application/vnd.google-apps.folder"&fields=files(id,name,mimeType,webViewLink,modifiedTime)&pageSize=100&corpora=allDrives&includeItemsFromAllDrives=true&supportsAllDrives=true';
                break;
            case 'folders':
                endpoint = '/drive/v3/files?q=mimeType="application/vnd.google-apps.folder"&fields=files(id,name,mimeType,webViewLink,modifiedTime)&pageSize=100&corpora=allDrives&includeItemsFromAllDrives=true&supportsAllDrives=true';
                break;
            default:
                console.error(`GOOGLE DRIVE RESOLVER: Unknown entity type: ${entityType}`);
                return;
        }

        const result = await makeGetRequest(endpoint);
        
        if (result.files && Array.isArray(result.files)) {
            for (const file of result.files) {
                console.log(`GOOGLE DRIVE RESOLVER: Processing ${entityType} ${file.id}`);
                
                const mappedData = entityType === 'documents' ? toDocument(file) : toFolder(file);
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
        console.error(`GOOGLE DRIVE RESOLVER: Failed to process ${entityType} records: ${error}`);
    }
}

async function handleSubsDocuments(resolver) {
    console.log('GOOGLE DRIVE RESOLVER: Fetching documents for subscription...');
    await getAndProcessRecords(resolver, 'documents');
}

async function handleSubsFolders(resolver) {
    console.log('GOOGLE DRIVE RESOLVER: Fetching folders for subscription...');
    await getAndProcessRecords(resolver, 'folders');
}

export async function subsDocuments(resolver) {
    await handleSubsDocuments(resolver);
    const intervalMinutes = parseInt(getLocalEnv("GOOGLE_DRIVE_POLL_INTERVAL_MINUTES")) || 60;
    const intervalMs = intervalMinutes * 60 * 1000;
    console.log(`GOOGLE DRIVE RESOLVER: Setting documents polling interval to ${intervalMinutes} minutes`);
    setInterval(async () => {
        await handleSubsDocuments(resolver);
    }, intervalMs);
}

export async function subsFolders(resolver) {
    await handleSubsFolders(resolver);
    const intervalMinutes = parseInt(getLocalEnv("GOOGLE_DRIVE_POLL_INTERVAL_MINUTES")) || 60;
    const intervalMs = intervalMinutes * 60 * 1000;
    console.log(`GOOGLE DRIVE RESOLVER: Setting folders polling interval to ${intervalMinutes} minutes`);
    setInterval(async () => {
        await handleSubsFolders(resolver);
    }, intervalMs);
}

export function getFileUniqueName(fileName, fileId, fileOriginalName) {
    return fileName || fileId + fileOriginalName;
}