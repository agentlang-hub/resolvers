# Microsoft Teams Resolver for Agentlang

Send and receive messages in Microsoft Teams channels, threads, and 1:1 chats from Agentlang apps using the Microsoft Graph API v1.0.

## Prerequisites

You need access to a Microsoft 365 tenant with Teams enabled. A free sandbox is no longer available — it requires a Visual Studio Enterprise subscription or an existing organization tenant with admin consent.

### 1. Azure AD App Registration

1. Go to [Azure Portal > App registrations](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade) and create a new registration.
2. Set the **Redirect URI** to `http://localhost:8280/oauth/callback` (type: Web).
3. Under **API permissions**, add the following **Delegated** Microsoft Graph permissions:
   - `ChannelMessage.Send`
   - `ChannelMessage.Read.All`
   - `Team.ReadBasic.All`
   - `Channel.ReadBasic.All`
   - `Chat.Create`
   - `ChatMessage.Send`
   - `offline_access`
4. Under **Certificates & secrets**, create a new **Client secret** and note the value.
5. Note the **Application (client) ID** from the Overview page.

### 2. Integration Manager

Start integration-manager on port 8085 (default), then seed the teams integration using the provided script:

```bash
./scripts/seed.sh <AZURE_AD_CLIENT_ID> <AZURE_AD_CLIENT_SECRET>
```

### 3. Complete OAuth Flow

```bash
./scripts/authorize.sh
```

This fetches the authorization URL from integration-manager and opens it in your browser. Sign in with your Microsoft account and consent to the requested permissions.

### 4. Environment Variables

| Variable | Default | Description |
|---|---|---|
| `INTEG_MANAGER_HOST` | `http://localhost:8085` | Integration manager base URL |
| `AL_HOST` | `http://localhost:8080` | Agentlang app base URL (used by smoke test) |

## Usage

### List joined teams

```
{teams/joinedTeams {}} @as myTeams
```

Returns a list of Team entities (`id`, `displayName`, `description`).

### List channels in a team

```
{teams/listChannels {teamId "<team-id>"}} @as channels
```

Returns a list of Channel entities (`id`, `displayName`, `membershipType`).

### Send a channel message

```
{teams/sendChannelMessage {teamId "<team-id>", channelId "<channel-id>", message "hello"}} @as response
```

Returns the message ID. Optional `contentType`: `"text"` (default) or `"html"`.

### Reply to a thread

```
{teams/replyToThread {teamId "<team-id>", channelId "<channel-id>", messageId "<msg-id>", message "reply"}} @as response
```

Returns the reply ID.

### List thread replies

```
{teams/listThreadReplies {teamId "<team-id>", channelId "<channel-id>", messageId "<msg-id>"}} @as replies
```

Returns a list of Message entities (`id`, `body`, `from`, `createdDateTime`).

### Send a direct message

```
{teams/sendDirectMessage {userId "<user-id-or-email>", message "hello"}} @as response
```

Creates a 1:1 chat if one doesn't exist, then sends the message. Returns the message ID.

## Testing

### Unit tests

```bash
npx vitest run
```

### Smoke test (requires running agentlang app + integration-manager with completed OAuth)

```bash
# Test all operations (skips DM)
./scripts/smoke-test.sh

# Include direct message test
./scripts/smoke-test.sh user@example.com
```

## Phase 2 (planned)

- Human-in-the-loop suspension/approval flows (matching the slack `send`/`receive` pattern with `env.suspend()`)
