import { describe, test, assert, vi, beforeEach } from 'vitest';
import {
    joinedTeams,
    listChannels,
    listThreadReplies,
    sendChannelMessage,
    replyToThread,
    sendDirectMessage,
} from '../src/resolver.js';

// Every exported function calls fetch twice: once for auth headers, once for the Graph API.
// We stub globalThis.fetch to return canned responses in order.

const AUTH_RESPONSE = {
    headers: { Authorization: 'Bearer test-token' }
};

function stubFetch(...graphResponses) {
    const calls = [];
    let i = 0;
    vi.stubGlobal('fetch', vi.fn(async (url, opts) => {
        calls.push({ url, opts });
        // Auth calls go to integration-manager; Graph calls go to graph.microsoft.com
        if (url.includes('integmanager.auth')) {
            return { ok: true, json: async () => AUTH_RESPONSE };
        }
        const resp = graphResponses[i++] || graphResponses[graphResponses.length - 1];
        return resp;
    }));
    return calls;
}

function okResponse(body) {
    return { ok: true, status: 200, statusText: 'OK', json: async () => body };
}

function errorResponse(status, statusText) {
    return { ok: false, status, statusText, text: '' };
}

beforeEach(() => {
    vi.unstubAllGlobals();
});

// ---- joinedTeams ----

describe('joinedTeams', () => {
    test('GETs /me/joinedTeams and returns value array', async () => {
        const teams = [{ id: 't1', displayName: 'Alpha' }, { id: 't2', displayName: 'Beta' }];
        const calls = stubFetch(okResponse({ value: teams }));

        const result = await joinedTeams();

        assert.deepEqual(result, teams);
        const graphCall = calls.find(c => c.url.includes('graph.microsoft.com'));
        assert(graphCall);
        assert.equal(graphCall.url, 'https://graph.microsoft.com/v1.0/me/joinedTeams');
        assert.equal(graphCall.opts.method, 'GET');
    });

    test('passes auth headers to Graph API', async () => {
        stubFetch(okResponse({ value: [] }));

        await joinedTeams();

        const graphCall = globalThis.fetch.mock.calls.find(c => c[0].includes('graph.microsoft.com'));
        assert.equal(graphCall[1].headers.Authorization, 'Bearer test-token');
        assert.equal(graphCall[1].headers['Content-Type'], 'application/json');
    });

    test('returns error object when Graph API fails', async () => {
        stubFetch(errorResponse(403, 'Forbidden'));

        const result = await joinedTeams();

        assert(result.error);
        assert(result.error.includes('403'));
    });

    test('returns error object when fetch throws', async () => {
        vi.stubGlobal('fetch', vi.fn(async (url) => {
            if (url.includes('integmanager.auth')) {
                return { ok: true, json: async () => AUTH_RESPONSE };
            }
            throw new Error('network down');
        }));

        const result = await joinedTeams();

        assert.deepEqual(result, { error: 'network down' });
    });
});

// ---- listChannels ----

describe('listChannels', () => {
    test('GETs /teams/{teamId}/channels and returns value array', async () => {
        const channels = [{ id: 'c1', displayName: 'General' }];
        const calls = stubFetch(okResponse({ value: channels }));

        const result = await listChannels('team-abc');

        assert.deepEqual(result, channels);
        const graphCall = calls.find(c => c.url.includes('graph.microsoft.com'));
        assert.equal(graphCall.url, 'https://graph.microsoft.com/v1.0/teams/team-abc/channels');
        assert.equal(graphCall.opts.method, 'GET');
    });

    test('encodes teamId in URL', async () => {
        const calls = stubFetch(okResponse({ value: [] }));

        await listChannels('has spaces/slashes');

        const graphCall = calls.find(c => c.url.includes('graph.microsoft.com'));
        assert(graphCall.url.includes(encodeURIComponent('has spaces/slashes')));
    });

    test('returns error object when Graph API fails', async () => {
        stubFetch(errorResponse(404, 'Not Found'));

        const result = await listChannels('no-such-team');

        assert(result.error);
        assert(result.error.includes('404'));
    });
});

// ---- listThreadReplies ----

describe('listThreadReplies', () => {
    test('GETs correct replies URL and returns value array', async () => {
        const replies = [{ id: 'r1', body: { content: 'reply' } }];
        const calls = stubFetch(okResponse({ value: replies }));

        const result = await listThreadReplies('t1', 'c1', 'm1');

        assert.deepEqual(result, replies);
        const graphCall = calls.find(c => c.url.includes('graph.microsoft.com'));
        assert.equal(
            graphCall.url,
            'https://graph.microsoft.com/v1.0/teams/t1/channels/c1/messages/m1/replies'
        );
        assert.equal(graphCall.opts.method, 'GET');
    });

    test('encodes all path parameters', async () => {
        const calls = stubFetch(okResponse({ value: [] }));

        await listThreadReplies('t/1', 'c/2', 'm/3');

        const graphCall = calls.find(c => c.url.includes('graph.microsoft.com'));
        assert(graphCall.url.includes('t%2F1'));
        assert(graphCall.url.includes('c%2F2'));
        assert(graphCall.url.includes('m%2F3'));
    });
});

// ---- sendChannelMessage ----

describe('sendChannelMessage', () => {
    test('POSTs message with default contentType "text"', async () => {
        const calls = stubFetch(okResponse({ id: 'msg-1' }));

        const result = await sendChannelMessage('t1', 'c1', 'hello');

        assert.equal(result, 'msg-1');
        const graphCall = calls.find(c => c.url.includes('graph.microsoft.com'));
        assert.equal(graphCall.opts.method, 'POST');
        const body = JSON.parse(graphCall.opts.body);
        assert.deepEqual(body, { body: { contentType: 'text', content: 'hello' } });
    });

    test('POSTs message with explicit contentType "html"', async () => {
        const calls = stubFetch(okResponse({ id: 'msg-2' }));

        const result = await sendChannelMessage('t1', 'c1', '<b>bold</b>', 'html');

        assert.equal(result, 'msg-2');
        const body = JSON.parse(calls.find(c => c.url.includes('graph.microsoft.com')).opts.body);
        assert.equal(body.body.contentType, 'html');
    });

    test('constructs correct URL with encoded parameters', async () => {
        const calls = stubFetch(okResponse({ id: 'x' }));

        await sendChannelMessage('t/1', 'c/2', 'hi');

        const graphCall = calls.find(c => c.url.includes('graph.microsoft.com'));
        assert.equal(
            graphCall.url,
            `https://graph.microsoft.com/v1.0/teams/${encodeURIComponent('t/1')}/channels/${encodeURIComponent('c/2')}/messages`
        );
    });

    test('returns error object when Graph API fails', async () => {
        stubFetch(errorResponse(500, 'Internal Server Error'));

        const result = await sendChannelMessage('t1', 'c1', 'hi');

        assert(result.error);
        assert(result.error.includes('500'));
    });
});

// ---- replyToThread ----

describe('replyToThread', () => {
    test('POSTs reply to correct URL and returns reply id', async () => {
        const calls = stubFetch(okResponse({ id: 'reply-1' }));

        const result = await replyToThread('t1', 'c1', 'm1', 'my reply');

        assert.equal(result, 'reply-1');
        const graphCall = calls.find(c => c.url.includes('graph.microsoft.com'));
        assert.equal(
            graphCall.url,
            'https://graph.microsoft.com/v1.0/teams/t1/channels/c1/messages/m1/replies'
        );
        assert.equal(graphCall.opts.method, 'POST');
        const body = JSON.parse(graphCall.opts.body);
        assert.deepEqual(body, { body: { contentType: 'text', content: 'my reply' } });
    });

    test('passes through html contentType', async () => {
        const calls = stubFetch(okResponse({ id: 'reply-2' }));

        await replyToThread('t1', 'c1', 'm1', '<i>italic</i>', 'html');

        const body = JSON.parse(calls.find(c => c.url.includes('graph.microsoft.com')).opts.body);
        assert.equal(body.body.contentType, 'html');
    });
});

// ---- sendDirectMessage ----

describe('sendDirectMessage', () => {
    test('creates oneOnOne chat then sends message, returns message id', async () => {
        // Two Graph API calls: POST /chats, POST /chats/{id}/messages
        // Each preceded by an auth call, so 4 fetch calls total
        const calls = stubFetch(
            okResponse({ id: 'chat-99' }),   // POST /chats
            okResponse({ id: 'dm-1' })       // POST /chats/chat-99/messages
        );

        const result = await sendDirectMessage('user@example.com', 'hey');

        assert.equal(result, 'dm-1');

        const graphCalls = calls.filter(c => c.url.includes('graph.microsoft.com'));
        assert.equal(graphCalls.length, 2);

        // First Graph call: create chat
        assert.equal(graphCalls[0].url, 'https://graph.microsoft.com/v1.0/chats');
        assert.equal(graphCalls[0].opts.method, 'POST');
        const chatBody = JSON.parse(graphCalls[0].opts.body);
        assert.equal(chatBody.chatType, 'oneOnOne');
        assert(chatBody.members[0]['user@odata.bind'].includes(encodeURIComponent('user@example.com')));

        // Second Graph call: send message in chat
        assert.equal(graphCalls[1].url, 'https://graph.microsoft.com/v1.0/chats/chat-99/messages');
        assert.equal(graphCalls[1].opts.method, 'POST');
        const msgBody = JSON.parse(graphCalls[1].opts.body);
        assert.deepEqual(msgBody, { body: { contentType: 'text', content: 'hey' } });
    });

    test('returns error if chat creation fails', async () => {
        stubFetch(errorResponse(400, 'Bad Request'));

        const result = await sendDirectMessage('bad-user', 'hey');

        assert(result.error);
        assert(result.error.includes('400'));
    });

    test('returns error if message send fails after chat creation succeeds', async () => {
        stubFetch(
            okResponse({ id: 'chat-1' }),
            errorResponse(403, 'Forbidden')
        );

        const result = await sendDirectMessage('user@example.com', 'hey');

        assert(result.error);
        assert(result.error.includes('403'));
    });

    test('uses html contentType when specified', async () => {
        const calls = stubFetch(
            okResponse({ id: 'chat-1' }),
            okResponse({ id: 'dm-2' })
        );

        await sendDirectMessage('user@example.com', '<b>hi</b>', 'html');

        const graphCalls = calls.filter(c => c.url.includes('graph.microsoft.com'));
        const msgBody = JSON.parse(graphCalls[1].opts.body);
        assert.equal(msgBody.body.contentType, 'html');
    });
});

// ---- auth failure ----

describe('auth failure', () => {
    test('throws when integration-manager returns non-ok', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => {
            return { ok: false, status: 401 };
        }));

        try {
            await joinedTeams();
            assert.fail('should have thrown');
        } catch (e) {
            assert(e.message.includes('Failed to get auth headers'));
            assert(e.message.includes('401'));
        }
    });
});
