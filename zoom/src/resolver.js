const al_module = await import(`${process.cwd()}/node_modules/agentlang/out/runtime/module.js`)

const makeInstance = al_module.makeInstance

function asInstance(entity, entityType) {
    const instanceMap = new Map(Object.entries(entity))
    return makeInstance('zoom', entityType, instanceMap)
}

const getResponseBody = async (response) => {
    try {
        try {
            return await response.json()
        } catch (e) {
            return await response.text();
        }
    } catch (error) {
        console.error("ZOOM RESOLVER: Error reading response body:", error);
        return {};
    }
}

// Token management
let cachedToken = null;
let tokenExpiry = null;

async function getAccessToken() {
    // Return cached token if still valid (with 5 minute buffer)
    if (cachedToken && tokenExpiry && Date.now() < tokenExpiry - 300000) {
        return cachedToken;
    }

    const directToken = process.env.ZOOM_ACCESS_TOKEN;
    const accountId = process.env.ZOOM_ACCOUNT_ID;
    const clientId = process.env.ZOOM_CLIENT_ID;
    const clientSecret = process.env.ZOOM_CLIENT_SECRET;

    // Method 1: Direct access token
    if (directToken) {
        cachedToken = directToken;
        console.log('ZOOM RESOLVER: Using direct access token');
        return cachedToken;
    }

    // Method 2: Server-to-Server OAuth
    if (accountId && clientId && clientSecret) {
        try {
            const credentials = `${clientId}:${clientSecret}`;
            const base64Credentials = Buffer.from(credentials).toString('base64');
            
            const tokenUrl = `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`;
            
            console.log(`ZOOM RESOLVER: Fetching OAuth access token from ${tokenUrl}`);

            const response = await fetch(tokenUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${base64Credentials}`
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OAuth token request failed: ${response.status} - ${errorText}`);
            }

            const tokenData = await response.json();
            
            if (!tokenData.access_token) {
                throw new Error('No access token received from Zoom OAuth');
            }

            cachedToken = tokenData.access_token;
            // Set expiry time (subtract 5 minutes for safety)
            tokenExpiry = Date.now() + ((tokenData.expires_in || 3600) - 300) * 1000;

            console.log(`ZOOM RESOLVER: Successfully obtained OAuth access token, expires in ${tokenData.expires_in} seconds`);
            return cachedToken;

        } catch (error) {
            console.error(`ZOOM RESOLVER: OAuth failed: ${error.message}`);
            throw new Error(`Zoom OAuth authentication failed: ${error.message}`);
        }
    }

    throw new Error('Zoom authentication is required: ZOOM_ACCESS_TOKEN, or OAuth credentials (ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET)');
}

// Generic HTTP functions
const makeRequest = async (endpoint, options = {}) => {
    const baseUrl = process.env.ZOOM_BASE_URL || 'https://api.zoom.us/v2'
    
    let accessToken;
    try {
        accessToken = await getAccessToken();
    } catch (error) {
        throw new Error(`Zoom authentication failed: ${error.message}`);
    }
    
    if (!accessToken) {
        throw new Error('Zoom access token is required');
    }
    
    const url = `${baseUrl}${endpoint}`;
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        }
    };

    console.log(`ZOOM RESOLVER: making http request ${options.method} ${url} with options ${JSON.stringify(options)}`)

    const config = { ...defaultOptions, ...options };
    
    // Remove Content-Type header for GET requests without body
    if (config.method === 'GET') {
        delete config.headers['Content-Type'];
    }

    const timeoutMs = 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        console.error(`ZOOM RESOLVER: Request timeout after ${timeoutMs}ms - ${url} - ${JSON.stringify(options)}`);
        controller.abort();
    }, timeoutMs);

    try {
        const response = await fetch(url, {
            ...config,
            signal: controller.signal
        });

        const body = await getResponseBody(response);
        console.log(`ZOOM RESOLVER: response ${response.status} ${response.ok}`, body)
    
        clearTimeout(timeoutId);

        // Handle 401 Unauthorized - token may have expired, try refreshing
        if (response.status === 401 && !options._retry) {
            console.log('ZOOM RESOLVER: Received 401, refreshing token and retrying...');
            // Clear cached token to force refresh
            cachedToken = null;
            tokenExpiry = null;
            
            // Retry the request with a new token
            const newToken = await getAccessToken();
            const retryConfig = {
                ...config,
                _retry: true,
                headers: {
                    ...config.headers,
                    'Authorization': `Bearer ${newToken}`
                }
            };
            
            // Create new controller for retry
            const retryController = new AbortController();
            const retryTimeoutId = setTimeout(() => {
                console.error(`ZOOM RESOLVER: Request timeout after ${timeoutMs}ms (retry) - ${url}`);
                retryController.abort();
            }, timeoutMs);
            
            try {
                const retryResponse = await fetch(url, {
                    ...retryConfig,
                    signal: retryController.signal
                });
                
                clearTimeout(retryTimeoutId);
                
                const retryBody = await getResponseBody(retryResponse);
                if (!retryResponse.ok) {
                    console.error(`ZOOM RESOLVER: HTTP Error ${retryResponse.status} after retry - ${url}`);
                    throw new Error(`HTTP Error: ${retryResponse.status} - ${JSON.stringify(retryBody)}`);
                }
                
                return retryBody;
            } catch (retryError) {
                clearTimeout(retryTimeoutId);
                throw retryError;
            }
        }

        if (!response.ok) {
            console.error(`ZOOM RESOLVER: HTTP Error ${response.status} - ${url} - ${JSON.stringify(options)}`);
            throw new Error(`HTTP Error: ${response.status} - ${JSON.stringify(body)}`);
        }

        return body;

    } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
            console.error(`ZOOM RESOLVER: Request timeout - ${url} - ${JSON.stringify(options)}`);
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'EHOSTUNREACH') {
            console.error(`ZOOM RESOLVER: Network unreachable (${error.code}) - ${url} - ${JSON.stringify(options)}`);
        } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
            console.error(`ZOOM RESOLVER: Connection error (${error.code}) - ${url} - ${JSON.stringify(options)}`);
        } else {
            console.error(`ZOOM RESOLVER: Request failed (${error.name}) - ${url} - ${JSON.stringify(options)}`);
        }
        
        throw error;
    }
};

const makeGetRequest = async (endpoint) => {
    console.log(`ZOOM RESOLVER: Querying Zoom: ${endpoint}\n`);    
    return await makeRequest(endpoint, { method: 'GET' });
};

const makePostRequest = async (endpoint, body) => {
    console.log(`ZOOM RESOLVER: Creating in Zoom: ${endpoint}\n`);
    return await makeRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(body)
    });
};

const makePatchRequest = async (endpoint, body) => {
    console.log(`ZOOM RESOLVER: Updating in Zoom: ${endpoint}\n`);
    return await makeRequest(endpoint, {
        method: 'PATCH',
        body: JSON.stringify(body)
    });
};

const makeDeleteRequest = async (endpoint) => {
    console.log(`ZOOM RESOLVER: Deleting from Zoom: ${endpoint}\n`);
    return await makeRequest(endpoint, { method: 'DELETE' });
};

// User functions
export const createUser = async (env, attributes) => {
    const data = {
        action: 'create',
        user_info: {
            email: attributes.attributes.get('email'),
            first_name: attributes.attributes.get('first_name'),
            last_name: attributes.attributes.get('last_name'),
            display_name: attributes.attributes.get('display_name'),
            type: attributes.attributes.get('type') || 1,
            timezone: attributes.attributes.get('timezone'),
            dept: attributes.attributes.get('dept'),
            language: attributes.attributes.get('language'),
            phone_country: attributes.attributes.get('phone_country'),
            phone_number: attributes.attributes.get('phone_number'),
            job_title: attributes.attributes.get('job_title'),
            location: attributes.attributes.get('location')
        }
    };

    try {
        const result = await makePostRequest('/users', data);
        return {"result": "success", "id": result.id};
    } catch (error) {
        console.error(`ZOOM RESOLVER: Failed to create user: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const queryUser = async (env, attrs) => {
    const id = attrs.queryAttributeValues?.get('__path__')?.split('/')?.pop() ?? null;

    console.log(`ZOOM RESOLVER: Querying Zoom: ${id}\n`);
    try {
        let inst
        if (id) {
            inst = await makeGetRequest(`/users/${id}`);
        } else {
            inst = await makeGetRequest('/users');
            inst = inst.users || []
        }
        if (!(inst instanceof Array)) {
            inst = [inst]
        }
        return inst.map((data) => { return asInstance(data, 'User') })
    } catch (error) {
        console.error(`ZOOM RESOLVER: Failed to query users: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const updateUser = async (env, attributes, newAttrs) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "User ID is required for update"};
    }

    const data = {};
    if (newAttrs.get('first_name')) data.first_name = newAttrs.get('first_name');
    if (newAttrs.get('last_name')) data.last_name = newAttrs.get('last_name');
    if (newAttrs.get('display_name')) data.display_name = newAttrs.get('display_name');
    if (newAttrs.get('timezone')) data.timezone = newAttrs.get('timezone');
    if (newAttrs.get('dept')) data.dept = newAttrs.get('dept');
    if (newAttrs.get('language')) data.language = newAttrs.get('language');
    if (newAttrs.get('phone_country')) data.phone_country = newAttrs.get('phone_country');
    if (newAttrs.get('phone_number')) data.phone_number = newAttrs.get('phone_number');
    if (newAttrs.get('job_title')) data.job_title = newAttrs.get('job_title');
    if (newAttrs.get('location')) data.location = newAttrs.get('location');
    if (newAttrs.get('type')) data.type = newAttrs.get('type');

    try {
        const result = await makePatchRequest(`/users/${id}`, data);
        return asInstance(result, 'User')
    } catch (error) {
        console.error(`ZOOM RESOLVER: Failed to update user: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const deleteUser = async (env, attributes) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "User ID is required for deletion"};
    }

    const action = attributes.attributes.get('action') || 'delete'; // delete, disassociate, or recover

    try {
        await makeDeleteRequest(`/users/${id}?action=${action}`);
        return {"result": "success"};
    } catch (error) {
        console.error(`ZOOM RESOLVER: Failed to delete user: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// Meeting functions
export const createMeeting = async (env, attributes) => {
    const userId = attributes.attributes.get('host_id') || attributes.attributes.get('user_id');
    if (!userId) {
        return {"result": "error", "message": "Host ID or User ID is required"};
    }

    const data = {
        topic: attributes.attributes.get('topic'),
        type: attributes.attributes.get('type') || 2, // Scheduled meeting
        start_time: attributes.attributes.get('start_time'),
        duration: attributes.attributes.get('duration'),
        timezone: attributes.attributes.get('timezone'),
        password: attributes.attributes.get('password'),
        agenda: attributes.attributes.get('agenda'),
        settings: attributes.attributes.get('settings') || {}
    };

    try {
        const result = await makePostRequest(`/users/${userId}/meetings`, data);
        return {"result": "success", "id": result.id};
    } catch (error) {
        console.error(`ZOOM RESOLVER: Failed to create meeting: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const queryMeeting = async (env, attrs) => {
    const id = attrs.queryAttributeValues?.get('__path__')?.split('/')?.pop() ?? null;
    const userId = attrs.queryAttributeValues?.get('user_id');

    console.log(`ZOOM RESOLVER: Querying Zoom: ${id}\n`);
    try {
        let inst
        if (id) {
            inst = await makeGetRequest(`/meetings/${id}`);
        } else if (userId) {
            inst = await makeGetRequest(`/users/${userId}/meetings`);
            inst = inst.meetings || []
        } else {
            return {"result": "error", "message": "Meeting ID or User ID is required"};
        }
        if (!(inst instanceof Array)) {
            inst = [inst]
        }
        return inst.map((data) => { return asInstance(data, 'Meeting') })
    } catch (error) {
        console.error(`ZOOM RESOLVER: Failed to query meetings: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const updateMeeting = async (env, attributes, newAttrs) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "Meeting ID is required for update"};
    }

    const data = {};
    if (newAttrs.get('topic')) data.topic = newAttrs.get('topic');
    if (newAttrs.get('type')) data.type = newAttrs.get('type');
    if (newAttrs.get('start_time')) data.start_time = newAttrs.get('start_time');
    if (newAttrs.get('duration')) data.duration = newAttrs.get('duration');
    if (newAttrs.get('timezone')) data.timezone = newAttrs.get('timezone');
    if (newAttrs.get('password')) data.password = newAttrs.get('password');
    if (newAttrs.get('agenda')) data.agenda = newAttrs.get('agenda');
    if (newAttrs.get('settings')) data.settings = newAttrs.get('settings');

    try {
        const result = await makePatchRequest(`/meetings/${id}`, data);
        return asInstance(result, 'Meeting')
    } catch (error) {
        console.error(`ZOOM RESOLVER: Failed to update meeting: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const deleteMeeting = async (env, attributes) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "Meeting ID is required for deletion"};
    }

    const occurrenceId = attributes.attributes.get('occurrence_id');
    const scheduleForReminder = attributes.attributes.get('schedule_for_reminder') || false;

    let endpoint = `/meetings/${id}`;
    if (occurrenceId) {
        endpoint += `?occurrence_id=${occurrenceId}`;
    }
    if (scheduleForReminder) {
        endpoint += (occurrenceId ? '&' : '?') + 'schedule_for_reminder=true';
    }

    try {
        await makeDeleteRequest(endpoint);
        return {"result": "success"};
    } catch (error) {
        console.error(`ZOOM RESOLVER: Failed to delete meeting: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// Webinar functions
export const createWebinar = async (env, attributes) => {
    const userId = attributes.attributes.get('host_id') || attributes.attributes.get('user_id');
    if (!userId) {
        return {"result": "error", "message": "Host ID or User ID is required"};
    }

    const data = {
        topic: attributes.attributes.get('topic'),
        type: attributes.attributes.get('type') || 5, // Scheduled webinar
        start_time: attributes.attributes.get('start_time'),
        duration: attributes.attributes.get('duration'),
        timezone: attributes.attributes.get('timezone'),
        password: attributes.attributes.get('password'),
        agenda: attributes.attributes.get('agenda'),
        settings: attributes.attributes.get('settings') || {}
    };

    try {
        const result = await makePostRequest(`/users/${userId}/webinars`, data);
        return {"result": "success", "id": result.id};
    } catch (error) {
        console.error(`ZOOM RESOLVER: Failed to create webinar: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const queryWebinar = async (env, attrs) => {
    const id = attrs.queryAttributeValues?.get('__path__')?.split('/')?.pop() ?? null;
    const userId = attrs.queryAttributeValues?.get('user_id');

    console.log(`ZOOM RESOLVER: Querying Zoom: ${id}\n`);
    try {
        let inst
        if (id) {
            inst = await makeGetRequest(`/webinars/${id}`);
        } else if (userId) {
            inst = await makeGetRequest(`/users/${userId}/webinars`);
            inst = inst.webinars || []
        } else {
            return {"result": "error", "message": "Webinar ID or User ID is required"};
        }
        if (!(inst instanceof Array)) {
            inst = [inst]
        }
        return inst.map((data) => { return asInstance(data, 'Webinar') })
    } catch (error) {
        console.error(`ZOOM RESOLVER: Failed to query webinars: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const updateWebinar = async (env, attributes, newAttrs) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "Webinar ID is required for update"};
    }

    const data = {};
    if (newAttrs.get('topic')) data.topic = newAttrs.get('topic');
    if (newAttrs.get('type')) data.type = newAttrs.get('type');
    if (newAttrs.get('start_time')) data.start_time = newAttrs.get('start_time');
    if (newAttrs.get('duration')) data.duration = newAttrs.get('duration');
    if (newAttrs.get('timezone')) data.timezone = newAttrs.get('timezone');
    if (newAttrs.get('password')) data.password = newAttrs.get('password');
    if (newAttrs.get('agenda')) data.agenda = newAttrs.get('agenda');
    if (newAttrs.get('settings')) data.settings = newAttrs.get('settings');

    try {
        const result = await makePatchRequest(`/webinars/${id}`, data);
        return asInstance(result, 'Webinar')
    } catch (error) {
        console.error(`ZOOM RESOLVER: Failed to update webinar: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const deleteWebinar = async (env, attributes) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "Webinar ID is required for deletion"};
    }

    const occurrenceId = attributes.attributes.get('occurrence_id');
    const scheduleForReminder = attributes.attributes.get('schedule_for_reminder') || false;

    let endpoint = `/webinars/${id}`;
    if (occurrenceId) {
        endpoint += `?occurrence_id=${occurrenceId}`;
    }
    if (scheduleForReminder) {
        endpoint += (occurrenceId ? '&' : '?') + 'schedule_for_reminder=true';
    }

    try {
        await makeDeleteRequest(endpoint);
        return {"result": "success"};
    } catch (error) {
        console.error(`ZOOM RESOLVER: Failed to delete webinar: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// Recording functions
export const queryRecording = async (env, attrs) => {
    const id = attrs.queryAttributeValues?.get('__path__')?.split('/')?.pop() ?? null;
    const userId = attrs.queryAttributeValues?.get('user_id');
    const meetingId = attrs.queryAttributeValues?.get('meeting_id');

    console.log(`ZOOM RESOLVER: Querying Zoom: ${id}\n`);
    try {
        let inst
        if (id) {
            inst = await makeGetRequest(`/meetings/${id}/recordings`);
        } else if (meetingId) {
            inst = await makeGetRequest(`/meetings/${meetingId}/recordings`);
        } else if (userId) {
            inst = await makeGetRequest(`/users/${userId}/recordings`);
            inst = inst.meetings || []
        } else {
            return {"result": "error", "message": "Recording ID, Meeting ID, or User ID is required"};
        }
        if (!(inst instanceof Array)) {
            inst = [inst]
        }
        return inst.map((data) => { return asInstance(data, 'Recording') })
    } catch (error) {
        console.error(`ZOOM RESOLVER: Failed to query recordings: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const deleteRecording = async (env, attributes) => {
    const meetingId = attributes.attributes.get('meeting_id') || attributes.attributes.get('id');
    if (!meetingId) {
        return {"result": "error", "message": "Meeting ID is required for deletion"};
    }

    const action = attributes.attributes.get('action') || 'trash'; // trash or delete

    try {
        await makeDeleteRequest(`/meetings/${meetingId}/recordings?action=${action}`);
        return {"result": "success"};
    } catch (error) {
        console.error(`ZOOM RESOLVER: Failed to delete recording: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

