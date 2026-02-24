const INTEG_MANAGER_HOST = process.env.INTEG_MANAGER_HOST || 'http://localhost:8085'

async function fetchAuthHeaders() {
    const resp = await fetch(
        `${INTEG_MANAGER_HOST}/integmanager.auth/authHeaders?integrationName=teams`
    )
    if (!resp.ok) {
        throw new Error(`Failed to get auth headers for teams: ${resp.status}`)
    }
    const data = await resp.json()
    return data.headers
}

async function standardHeaders() {
    const authHeaders = await fetchAuthHeaders()
    return { ...authHeaders, "Content-Type": "application/json" }
}

async function handleFetch(url, req) {
    try {
        const response = await fetch(url, req);
        if (!response.ok) {
            return { error: `HTTP error! status: ${response.status} ${response.text} ${response.statusText}` }
        }
        return await response.json();
    } catch (error) {
        return { error: error.message };
    }
}

function graphUrl(path) {
    return `https://graph.microsoft.com/v1.0${path}`
}

// --- Discovery (event + workflow pattern) ---

export async function joinedTeams(env) {
    const url = graphUrl('/me/joinedTeams')
    const result = await handleFetch(url, {
        method: 'GET',
        headers: await standardHeaders()
    })
    if (result.error) return result
    return result.value
}

export async function listChannels(teamId, env) {
    const url = graphUrl(`/teams/${encodeURIComponent(teamId)}/channels`)
    const result = await handleFetch(url, {
        method: 'GET',
        headers: await standardHeaders()
    })
    if (result.error) return result
    return result.value
}

export async function listThreadReplies(teamId, channelId, messageId, env) {
    const url = graphUrl(
        `/teams/${encodeURIComponent(teamId)}/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(messageId)}/replies`
    )
    const result = await handleFetch(url, {
        method: 'GET',
        headers: await standardHeaders()
    })
    if (result.error) return result
    return result.value
}

// --- Messaging (event + workflow pattern) ---

export async function sendChannelMessage(teamId, channelId, message, contentType, env) {
    const ct = contentType || 'text'
    const url = graphUrl(
        `/teams/${encodeURIComponent(teamId)}/channels/${encodeURIComponent(channelId)}/messages`
    )
    const result = await handleFetch(url, {
        method: 'POST',
        headers: await standardHeaders(),
        body: JSON.stringify({
            body: { contentType: ct, content: message }
        })
    })
    if (result.error) return result
    return result.id
}

export async function replyToThread(teamId, channelId, messageId, message, contentType, env) {
    const ct = contentType || 'text'
    const url = graphUrl(
        `/teams/${encodeURIComponent(teamId)}/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(messageId)}/replies`
    )
    const result = await handleFetch(url, {
        method: 'POST',
        headers: await standardHeaders(),
        body: JSON.stringify({
            body: { contentType: ct, content: message }
        })
    })
    if (result.error) return result
    return result.id
}

export async function sendDirectMessage(userId, message, contentType, env) {
    const ct = contentType || 'text'

    // Step 1: Create (or get existing) oneOnOne chat
    const chatResult = await handleFetch(graphUrl('/chats'), {
        method: 'POST',
        headers: await standardHeaders(),
        body: JSON.stringify({
            chatType: 'oneOnOne',
            members: [
                {
                    '@odata.type': '#microsoft.graph.aadUserConversationMember',
                    roles: ['owner'],
                    'user@odata.bind': `https://graph.microsoft.com/v1.0/users('${encodeURIComponent(userId)}')`
                }
            ]
        })
    })
    if (chatResult.error) return chatResult
    const chatId = chatResult.id

    // Step 2: Send message in the chat
    const msgResult = await handleFetch(graphUrl(`/chats/${encodeURIComponent(chatId)}/messages`), {
        method: 'POST',
        headers: await standardHeaders(),
        body: JSON.stringify({
            body: { contentType: ct, content: message }
        })
    })
    if (msgResult.error) return msgResult
    return msgResult.id
}
