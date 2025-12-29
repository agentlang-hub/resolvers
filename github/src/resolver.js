// Import agentlang modules
import { getLocalEnv } from "agentlang/out/runtime/auth/defs.js";
import { makeInstance } from "agentlang/out/runtime/module.js";

// Mapper functions for GitHub API responses to Agentlang entities
function toIssue(issue, owner, repo) {
    return {
        id: issue.id.toString(),
        owner: owner,
        repo: repo,
        issue_number: issue.number,
        title: issue.title,
        author: issue.user.login,
        author_id: issue.user.id.toString(),
        state: issue.state,
        date_created: issue.created_at,
        date_last_modified: issue.updated_at,
        body: issue.body || ''
    };
}

function toRepository(repo) {
    return {
        id: repo.id,
        owner: repo.owner.login,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description || '',
        url: repo.html_url,
        date_created: repo.created_at,
        date_last_modified: repo.updated_at
    };
}

function toFile(file) {
    return {
        id: file.sha,
        name: file.path || file.filename,
        url: file.url || file.blob_url,
        last_modified_date: file.committer?.date || new Date().toISOString()
    };
}

function toOrganization(org) {
    return {
        id: org.id,
        login: org.login,
        name: org.name,
        url: org.html_url,
        description: org.description || ''
    };
}

function toUser(user) {
    return {
        id: user.id,
        login: user.login,
        name: user.name || '',
        url: user.html_url,
        email: user.email || ''
    };
}

function asInstance(entity, entityType) {
  const instanceMap = new Map(Object.entries(entity));
  return makeInstance("github", entityType, instanceMap);
}

const getResponseBody = async (response) => {
    try {
        try {
            return await response.json()
        } catch (e) {
            return await response.text();
        }
    } catch (error) {
        console.error("GITHUB RESOLVER: Error reading response body:", error);
        return {};
    }
}

// GitHub API token management
let accessToken = null;
let tokenExpiry = null;

async function getAccessToken() {
    // Return cached token if still valid
    if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
        return accessToken;
    }

    const directToken = getLocalEnv("GITHUB_ACCESS_TOKEN");
    const clientId = getLocalEnv("GITHUB_CLIENT_ID");
    const clientSecret = getLocalEnv("GITHUB_CLIENT_SECRET");
    const authCode = getLocalEnv("GITHUB_AUTH_CODE");
    const refreshToken = getLocalEnv("GITHUB_REFRESH_TOKEN");
    const githubApp = getLocalEnv("GITHUB_APP_PRIVATE_KEY");
    const githubAppId = getLocalEnv("GITHUB_APP_ID");
    const githubInstallationId = getLocalEnv("GITHUB_INSTALLATION_ID");

    // Method 1: Direct access token
    if (directToken) {
        accessToken = directToken;
        console.log('GITHUB RESOLVER: Using direct access token');
        return accessToken;
    }

    // Method 2: OAuth2 with authorization code
    if (clientId && clientSecret && authCode) {
        try {
            const tokenUrl = 'https://github.com/login/oauth/access_token';
            const params = new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                code: authCode
            });

            console.log(`GITHUB RESOLVER: Fetching OAuth2 access token from ${tokenUrl}`);

            const response = await fetch(tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                },
                body: params
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OAuth2 token request failed: ${response.status} - ${errorText}`);
            }

            const tokenData = await response.json();
            
            if (!tokenData.access_token) {
                throw new Error('No access token received from GitHub OAuth2');
            }

            accessToken = tokenData.access_token;
            // Set expiry time (subtract 5 minutes for safety)
            tokenExpiry = Date.now() + ((tokenData.expires_in || 3600) - 300) * 1000;

            console.log(`GITHUB RESOLVER: Successfully obtained OAuth2 access token, expires in ${tokenData.expires_in} seconds`);
            return accessToken;

        } catch (error) {
            console.error(`GITHUB RESOLVER: OAuth2 failed: ${error.message}`);
            throw new Error(`GitHub OAuth2 authentication failed: ${error.message}`);
        }
    }

    // Method 3: OAuth2 with refresh token
    if (clientId && clientSecret && refreshToken) {
        try {
            const tokenUrl = 'https://github.com/login/oauth/access_token';
            const params = new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: refreshToken,
                grant_type: 'refresh_token'
            });

            console.log(`GITHUB RESOLVER: Refreshing OAuth2 access token from ${tokenUrl}`);

            const response = await fetch(tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                },
                body: params
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OAuth2 refresh request failed: ${response.status} - ${errorText}`);
            }

            const tokenData = await response.json();
            
            if (!tokenData.access_token) {
                throw new Error('No access token received from GitHub OAuth2 refresh');
            }

            accessToken = tokenData.access_token;
            // Set expiry time (subtract 5 minutes for safety)
            tokenExpiry = Date.now() + ((tokenData.expires_in || 3600) - 300) * 1000;

            console.log(`GITHUB RESOLVER: Successfully refreshed OAuth2 access token, expires in ${tokenData.expires_in} seconds`);
            return accessToken;

        } catch (error) {
            console.error(`GITHUB RESOLVER: OAuth2 refresh failed: ${error.message}`);
            throw new Error(`GitHub OAuth2 refresh failed: ${error.message}`);
        }
    }

    // Method 4: GitHub App authentication
    if (githubApp && githubAppId && githubInstallationId) {
        try {
            // GitHub App authentication (JWT token)
            const jwt = require('jsonwebtoken');
            const now = Math.floor(Date.now() / 1000);
            const payload = {
                iat: now - 60, // Issued at time (1 minute ago to account for clock skew)
                exp: now + (10 * 60), // Expires at (10 minutes from now)
                iss: githubAppId // Issuer (GitHub App ID)
            };

            const privateKey = Buffer.from(githubApp, 'base64').toString('utf8');
            const appToken = jwt.sign(payload, privateKey, { algorithm: 'RS256' });

            // Get installation access token
            const response = await fetch(`https://api.github.com/app/installations/${githubInstallationId}/access_tokens`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${appToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) {
                throw new Error(`GitHub App token request failed: ${response.status}`);
            }

            const tokenData = await response.json();
            accessToken = tokenData.token;
            console.log('GITHUB RESOLVER: Successfully obtained GitHub App access token');
            return accessToken;

        } catch (error) {
            console.error(`GITHUB RESOLVER: Failed to get GitHub App access token: ${error}`);
            throw new Error(`GitHub App authentication failed: ${error.message}`);
        }
    }

    throw new Error('GitHub authentication is required: GITHUB_ACCESS_TOKEN, OAuth2 credentials (GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_AUTH_CODE), or GitHub App credentials (GITHUB_APP_PRIVATE_KEY, GITHUB_APP_ID, GITHUB_INSTALLATION_ID)');
}

// Generic HTTP functions
const makeRequest = async (endpoint, options = {}) => {
    let token = getLocalEnv("GITHUB_ACCESS_TOKEN");
    
    // If no direct token provided, try to get one via OAuth2 or GitHub App
    if (!token) {
        try {
            token = await getAccessToken();
        } catch (error) {
            throw new Error(`GitHub authentication failed: ${error.message}`);
        }
    }
    
    if (!token) {
        throw new Error('GitHub access token is required');
    }
    
    const baseUrl = 'https://api.github.com';
    const url = `${baseUrl}${endpoint}`;
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'GitHub-Resolver/1.0'
        }
    };

    console.log(`GITHUB RESOLVER: making http request ${options.method} ${url} with options ${JSON.stringify(options)}`)

    const config = { ...defaultOptions, ...options };
    
    // Remove Content-Type header for GET requests without body
    if (config.method === 'GET') {
        delete config.headers['Content-Type'];
    }

    const timeoutMs = 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        console.error(`GITHUB RESOLVER: Request timeout after ${timeoutMs}ms - ${url} - ${JSON.stringify(options)}`);
        controller.abort();
    }, timeoutMs);

    try {
        const response = await fetch(url, {
            ...config,
            signal: controller.signal
        });

        const body = await getResponseBody(response);
        console.log(`GITHUB RESOLVER: response ${response.status} ${response.ok}`, body)
    
        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error(`GITHUB RESOLVER: HTTP Error ${response.status} - ${url} - ${JSON.stringify(options)}`);
            throw new Error(`HTTP Error: ${response.status} - ${JSON.stringify(body)}`);
        }

        return body;

    } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
            console.error(`GITHUB RESOLVER: Request timeout - ${url} - ${JSON.stringify(options)}`);
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'EHOSTUNREACH') {
            console.error(`GITHUB RESOLVER: Network unreachable (${error.code}) - ${url} - ${JSON.stringify(options)}`);
        } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
            console.error(`GITHUB RESOLVER: Connection error (${error.code}) - ${url} - ${JSON.stringify(options)}`);
        } else {
            console.error(`GITHUB RESOLVER: Request failed (${error.name}) - ${url} - ${JSON.stringify(options)}`);
        }
        
        throw error;
    }
};

const makeGetRequest = async (endpoint) => {
    console.log(`GITHUB RESOLVER: Querying GitHub: ${endpoint}\n`);    
    return await makeRequest(endpoint, { method: 'GET' });
};

const makePostRequest = async (endpoint, body) => {
    console.log(`GITHUB RESOLVER: Creating in GitHub: ${endpoint}\n`);
    return await makeRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(body)
    });
};

const makePatchRequest = async (endpoint, body) => {
    console.log(`GITHUB RESOLVER: Updating in GitHub: ${endpoint}\n`);
    return await makeRequest(endpoint, {
        method: 'PATCH',
        body: JSON.stringify(body)
    });
};

const makePutRequest = async (endpoint, body) => {
    console.log(`GITHUB RESOLVER: Creating/Updating in GitHub: ${endpoint}\n`);
    return await makeRequest(endpoint, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
};

const makeDeleteRequest = async (endpoint) => {
    console.log(`GITHUB RESOLVER: Deleting from GitHub: ${endpoint}\n`);
    return await makeRequest(endpoint, { method: 'DELETE' });
};

// Issue functions
export const createIssue = async (env, attributes) => {
    const owner = attributes.attributes.get('owner');
    const repo = attributes.attributes.get('repo');
    const title = attributes.attributes.get('title');
    const body = attributes.attributes.get('body');
    const labels = attributes.attributes.get('labels');

    if (!owner || !repo || !title) {
        return {"result": "error", "message": "Owner, repo, and title are required"};
    }

    const data = { title, body: body || '' };
    if (labels) {
        data.labels = labels.split(',').map(label => label.trim());
    }

    try {
        const result = await makePostRequest(`/repos/${owner}/${repo}/issues`, data);
        return asInstance(toIssue(result, owner, repo), 'Issue');
    } catch (error) {
        console.error(`GITHUB RESOLVER: Failed to create issue: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const queryIssue = async (env, attrs) => {
    const id = attrs.queryAttributeValues?.get('__path__')?.split('/')?.pop() ?? null;

    console.log(`GITHUB RESOLVER: Querying GitHub: ${id}\n`);
    try {
        if (id) {
            const issue = await makeGetRequest(`/repos/issues/${id}`);
            const owner = issue.repository?.owner?.login || 'unknown';
            const repo = issue.repository?.name || 'unknown';
            const mappedData = toIssue(issue, owner, repo);
            return [asInstance(mappedData, 'Issue')];
        } else {
            // Get all repositories first, then get issues from each
            const repos = await makeGetRequest('/user/repos?per_page=100');
            const allIssues = [];

            for (const repo of repos) {
                try {
                    const issues = await makeGetRequest(`/repos/${repo.owner.login}/${repo.name}/issues?state=all&per_page=100`);
                    const mappedIssues = issues.map(issue => {
                        const mappedData = toIssue(issue, repo.owner.login, repo.name);
                        return asInstance(mappedData, 'Issue');
                    });
                    allIssues.push(...mappedIssues);
                } catch (error) {
                    console.warn(`GITHUB RESOLVER: Failed to fetch issues for ${repo.full_name}: ${error.message}`);
                }
            }
            return allIssues;
        }
    } catch (error) {
        console.error(`GITHUB RESOLVER: Failed to query issues: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const updateIssue = async (env, attributes, newAttrs) => {
    const owner = attributes.attributes.get('owner');
    const repo = attributes.attributes.get('repo');
    const issueNumber = attributes.attributes.get('issue_number');

    if (!owner || !repo || !issueNumber) {
        return {"result": "error", "message": "Owner, repo, and issue_number are required"};
    }

    const data = {};
    if (newAttrs.get('title')) {
        data.title = newAttrs.get('title');
    }
    if (newAttrs.get('body')) {
        data.body = newAttrs.get('body');
    }
    if (newAttrs.get('state')) {
        data.state = newAttrs.get('state');
    }
    if (newAttrs.get('labels')) {
        data.labels = newAttrs.get('labels').split(',').map(label => label.trim());
    }

    try {
        const result = await makePatchRequest(`/repos/${owner}/${repo}/issues/${issueNumber}`, data);
        return asInstance(toIssue(result, owner, repo), 'Issue');
    } catch (error) {
        console.error(`GITHUB RESOLVER: Failed to update issue: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const deleteIssue = async (env, attributes) => {
    // GitHub doesn't support deleting issues, only closing them
    const owner = attributes.attributes.get('owner');
    const repo = attributes.attributes.get('repo');
    const issueNumber = attributes.attributes.get('issue_number');

    if (!owner || !repo || !issueNumber) {
        return {"result": "error", "message": "Owner, repo, and issue_number are required"};
    }

    try {
        const result = await makePatchRequest(`/repos/${owner}/${repo}/issues/${issueNumber}`, { state: 'closed' });
        return asInstance(toIssue(result, owner, repo), 'Issue');
    } catch (error) {
        console.error(`GITHUB RESOLVER: Failed to close issue: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// Repository functions
export const createRepository = async (env, attributes) => {
    const name = attributes.attributes.get('name');
    const description = attributes.attributes.get('description');
    const private_repo = attributes.attributes.get('private') === 'true';

    if (!name) {
        return {"result": "error", "message": "Repository name is required"};
    }

    const data = {
        name,
        description: description || '',
        private: private_repo
    };

    try {
        const result = await makePostRequest('/user/repos', data);
        return asInstance(toRepository(result), 'Repository');
    } catch (error) {
        console.error(`GITHUB RESOLVER: Failed to create repository: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const queryRepository = async (env, attrs) => {
    const id = attrs.queryAttributeValues?.get('__path__')?.split('/')?.pop() ?? null;

    console.log(`GITHUB RESOLVER: Querying GitHub: ${id}\n`);
    try {
        if (id) {
            const repo = await makeGetRequest(`/repositories/${id}`);
            return [asInstance(toRepository(repo), 'Repository')];
        } else {
            // Get all repositories
            const repos = await makeGetRequest('/user/repos?per_page=100');
            return repos.map(repo => asInstance(toRepository(repo), 'Repository'));
        }
    } catch (error) {
        console.error(`GITHUB RESOLVER: Failed to query repositories: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const updateRepository = async (env, attributes, newAttrs) => {
    const owner = attributes.attributes.get('owner');
    const repo = attributes.attributes.get('name');

    if (!owner || !repo) {
        return {"result": "error", "message": "Owner and repository name are required"};
    }

    const data = {};
    if (newAttrs.get('name')) {
        data.name = newAttrs.get('name');
    }
    if (newAttrs.get('description')) {
        data.description = newAttrs.get('description');
    }
    if (newAttrs.get('private')) {
        data.private = newAttrs.get('private') === 'true';
    }
    if (newAttrs.get('homepage')) {
        data.homepage = newAttrs.get('homepage');
    }
    if (newAttrs.get('has_issues')) {
        data.has_issues = newAttrs.get('has_issues') === 'true';
    }
    if (newAttrs.get('has_projects')) {
        data.has_projects = newAttrs.get('has_projects') === 'true';
    }
    if (newAttrs.get('has_wiki')) {
        data.has_wiki = newAttrs.get('has_wiki') === 'true';
    }

    try {
        const result = await makePatchRequest(`/repos/${owner}/${repo}`, data);
        return asInstance(toRepository(result), 'Repository');
    } catch (error) {
        console.error(`GITHUB RESOLVER: Failed to update repository: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const deleteRepository = async (env, attributes) => {
    const owner = attributes.attributes.get('owner');
    const repo = attributes.attributes.get('name');

    if (!owner || !repo) {
        return {"result": "error", "message": "Owner and repository name are required"};
    }

    try {
        await makeDeleteRequest(`/repos/${owner}/${repo}`);
        return {"result": "success"};
    } catch (error) {
        console.error(`GITHUB RESOLVER: Failed to delete repository: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// File functions
export const queryFile = async (env, attrs) => {
    const owner = attrs.queryAttributeValues?.get('owner');
    const repo = attrs.queryAttributeValues?.get('repo');
    const path = attrs.queryAttributeValues?.get('path');
    const branch = attrs.queryAttributeValues?.get('branch') || 'main';

    if (!owner || !repo || !path) {
        return {"result": "error", "message": "Owner, repo, and path are required"};
    }

    try {
        const result = await makeGetRequest(`/repos/${owner}/${repo}/contents/${path}?ref=${branch}`);
        const mappedData = toFile(result);
        return [asInstance(mappedData, 'File')];
    } catch (error) {
        console.error(`GITHUB RESOLVER: Failed to query file: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const updateFile = async (env, attributes, newAttrs) => {
    const owner = attributes.attributes.get('owner');
    const repo = attributes.attributes.get('repo');
    const path = attributes.attributes.get('path');
    const content = newAttrs.get('content');
    const message = newAttrs.get('message') || 'Update file';
    const sha = attributes.attributes.get('sha');

    if (!owner || !repo || !path || !content) {
        return {"result": "error", "message": "Owner, repo, path, and content are required"};
    }

    const data = {
        message,
        content: Buffer.from(content).toString('base64'),
        sha: sha || undefined
    };

    try {
        const result = await makePutRequest(`/repos/${owner}/${repo}/contents/${path}`, data);
        return asInstance({
            id: result.content.sha,
            name: path,
            url: result.content.html_url,
            last_modified_date: new Date().toISOString()
        }, 'File');
    } catch (error) {
        console.error(`GITHUB RESOLVER: Failed to update file: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const deleteFile = async (env, attributes) => {
    const owner = attributes.attributes.get('owner');
    const repo = attributes.attributes.get('repo');
    const path = attributes.attributes.get('path');
    const message = attributes.attributes.get('message') || 'Delete file';
    const sha = attributes.attributes.get('sha');

    if (!owner || !repo || !path || !sha) {
        return {"result": "error", "message": "Owner, repo, path, and sha are required"};
    }

    const data = {
        message,
        sha
    };

    try {
        await makeDeleteRequest(`/repos/${owner}/${repo}/contents/${path}`, { body: JSON.stringify(data) });
        return {"result": "success"};
    } catch (error) {
        console.error(`GITHUB RESOLVER: Failed to delete file: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// Write file function
export const writeFile = async (env, attributes) => {
    const owner = attributes.attributes.get('owner');
    const repo = attributes.attributes.get('repo');
    const path = attributes.attributes.get('path');
    const content = attributes.attributes.get('content');
    const message = attributes.attributes.get('message') || 'Write file';
    const sha = attributes.attributes.get('sha');

    if (!owner || !repo || !path || !content) {
        return {"result": "error", "message": "Owner, repo, path, and content are required"};
    }

    const data = {
        message,
        content: Buffer.from(content).toString('base64'),
        sha: sha || undefined
    };

    try {
        const result = await makePutRequest(`/repos/${owner}/${repo}/contents/${path}`, data);
        return asInstance({
            url: result.content.html_url,
            status: 'success',
            sha: result.content.sha
        }, 'WriteFileOutput');
    } catch (error) {
        console.error(`GITHUB RESOLVER: Failed to write file: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const queryWriteFile = async (env, attrs) => {
    const owner = attrs.queryAttributeValues?.get('owner');
    const repo = attrs.queryAttributeValues?.get('repo');
    const path = attrs.queryAttributeValues?.get('path');

    if (!owner || !repo || !path) {
        return {"result": "error", "message": "Owner, repo, and path are required"};
    }

    try {
        const result = await makeGetRequest(`/repos/${owner}/${repo}/contents/${path}`);
        return [asInstance({
            url: result.html_url,
            status: 'success',
            sha: result.sha
        }, 'WriteFileOutput')];
    } catch (error) {
        console.error(`GITHUB RESOLVER: Failed to query write file: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// Query repo files function
export const queryRepoFiles = async (env, attrs) => {
    const owner = attrs.queryAttributeValues?.get('owner');
    const repo = attrs.queryAttributeValues?.get('repo');
    const branch = attrs.queryAttributeValues?.get('branch') || 'main';

    if (!owner || !repo) {
        return {"result": "error", "message": "Owner and repo are required"};
    }

    try {
        const result = await makeGetRequest(`/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`);
        const files = result.tree.filter(item => item.type === 'blob');
        return files.map(file => asInstance(toFile(file), 'File'));
    } catch (error) {
        console.error(`GITHUB RESOLVER: Failed to query repo files: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// Organization functions
export const queryOrganizations = async (env, attrs) => {
    try {
        const orgs = await makeGetRequest('/user/orgs');
        return orgs.map(org => asInstance(toOrganization(org), 'Organization'));
    } catch (error) {
        console.error(`GITHUB RESOLVER: Failed to query organizations: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// User functions
export const queryUser = async (env, attrs) => {
    const username = attrs.queryAttributeValues?.get('username');

    try {
        const endpoint = username ? `/users/${username}` : '/user';
        const user = await makeGetRequest(endpoint);
        return [asInstance(toUser(user), 'User')];
    } catch (error) {
        console.error(`GITHUB RESOLVER: Failed to query user: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// Subscription functions for real-time updates
async function getAndProcessRecords(resolver, entityType) {
    try {
        let endpoint;
        switch (entityType) {
            case 'issues':
                // Get all repositories first, then get issues from each
                const repos = await makeGetRequest('/user/repos?per_page=100');
                for (const repo of repos) {
                    try {
                        const issues = await makeGetRequest(`/repos/${repo.owner.login}/${repo.name}/issues?state=all&per_page=100`);
                        for (const issue of issues) {
                            console.log(`GITHUB RESOLVER: Processing issue ${issue.id}`);
                            
                            const mappedData = toIssue(issue, repo.owner.login, repo.name);
                            const inst = {
                                id: mappedData.id,
                                type: entityType,
                                data: mappedData,
                                timestamp: new Date().toISOString()
                            };
                            
                            await resolver.onSubscription(inst, true);
                        }
                    } catch (error) {
                        console.warn(`GITHUB RESOLVER: Failed to fetch issues for ${repo.full_name}: ${error.message}`);
                    }
                }
                return;
            case 'repositories':
                endpoint = '/user/repos?per_page=100';
                break;
            default:
                console.error(`GITHUB RESOLVER: Unknown entity type: ${entityType}`);
                return;
        }

        const result = await makeGetRequest(endpoint);
        
        if (entityType === 'repositories' && Array.isArray(result)) {
            for (const repo of result) {
                console.log(`GITHUB RESOLVER: Processing repository ${repo.id}`);
                
                const mappedData = toRepository(repo);
                const inst = {
                    id: mappedData.id.toString(),
                    type: entityType,
                    data: mappedData,
                    timestamp: new Date().toISOString()
                };
                
                await resolver.onSubscription(inst, true);
            }
        }
    } catch (error) {
        console.error(`GITHUB RESOLVER: Failed to process ${entityType} records: ${error}`);
    }
}

async function handleSubsIssues(resolver) {
    console.log('GITHUB RESOLVER: Fetching issues for subscription...');
    await getAndProcessRecords(resolver, 'issues');
}

async function handleSubsRepositories(resolver) {
    console.log('GITHUB RESOLVER: Fetching repositories for subscription...');
    await getAndProcessRecords(resolver, 'repositories');
}

export async function subsIssues(resolver) {
    await handleSubsIssues(resolver);
    const intervalMinutes = parseInt(getLocalEnv("GITHUB_POLL_INTERVAL_MINUTES")) || 30;
    const intervalMs = intervalMinutes * 60 * 1000;
    console.log(`GITHUB RESOLVER: Setting issues polling interval to ${intervalMinutes} minutes`);
    setInterval(async () => {
        await handleSubsIssues(resolver);
    }, intervalMs);
}

export async function subsRepositories(resolver) {
    await handleSubsRepositories(resolver);
    const intervalMinutes = parseInt(getLocalEnv("GITHUB_POLL_INTERVAL_MINUTES")) || 30;
    const intervalMs = intervalMinutes * 60 * 1000;
    console.log(`GITHUB RESOLVER: Setting repositories polling interval to ${intervalMinutes} minutes`);
    setInterval(async () => {
        await handleSubsRepositories(resolver);
    }, intervalMs);
}
