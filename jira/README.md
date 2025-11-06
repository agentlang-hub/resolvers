# Jira Agentlang Resolver

Agentlang resolver for Jira integration, providing full CRUD operations and real-time subscriptions for issues, projects, issue types, and more.

## Quick Start

1. **Install dependencies**:
```bash
pnpm install
```

2. **Set environment variables**:

**Option A: Simple API Token (Recommended for most users)**
```bash
export JIRA_CLOUD_ID="your-cloud-id"
export JIRA_BASE_URL="https://your-domain.atlassian.net"
export JIRA_EMAIL="your-email@example.com"
export JIRA_API_TOKEN="your-api-token"
export JIRA_POLL_INTERVAL_MINUTES="5"  # Optional
```

**Option B: Direct Access Token (Testing)**
```bash
export JIRA_CLOUD_ID="your-cloud-id"
export JIRA_BASE_URL="https://your-domain.atlassian.net"
export JIRA_ACCESS_TOKEN="your-access-token"
export JIRA_POLL_INTERVAL_MINUTES="5"  # Optional
```

**Option C: OAuth2 Client Credentials (Enterprise)**
```bash
export JIRA_CLOUD_ID="your-cloud-id"
export JIRA_BASE_URL="https://your-domain.atlassian.net"
export JIRA_CLIENT_ID="your-client-id"
export JIRA_CLIENT_SECRET="your-client-secret"
export JIRA_POLL_INTERVAL_MINUTES="5"  # Optional
```

3. **Run the resolver**:
```bash
agent run
```

## Environment Variables

### Method 1: Simple API Token (Recommended for most users)

| Variable | Description | Example |
|----------|-------------|---------|
| `JIRA_CLOUD_ID` | Your Jira cloud ID | `your-domain` |
| `JIRA_BASE_URL` | Your Jira instance URL | `https://your-domain.atlassian.net` |
| `JIRA_EMAIL` | Your Jira account email | `your-email@example.com` |
| `JIRA_API_TOKEN` | Jira API token | `ATATT3xFfGF0...` |
| `JIRA_POLL_INTERVAL_MINUTES` | Polling interval for subscriptions | `5` |

### Method 2: Direct Access Token (Testing)

| Variable | Description | Example |
|----------|-------------|---------|
| `JIRA_CLOUD_ID` | Your Jira cloud ID | `your-domain` |
| `JIRA_BASE_URL` | Your Jira instance URL | `https://your-domain.atlassian.net` |
| `JIRA_ACCESS_TOKEN` | Direct access token | `eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `JIRA_POLL_INTERVAL_MINUTES` | Polling interval for subscriptions | `5` |

### Method 3: OAuth2 Client Credentials (Enterprise)

| Variable | Description | Example |
|----------|-------------|---------|
| `JIRA_CLOUD_ID` | Your Jira cloud ID | `your-domain` |
| `JIRA_BASE_URL` | Your Jira instance URL | `https://your-domain.atlassian.net` |
| `JIRA_CLIENT_ID` | OAuth2 Client ID | `1234567890abcdef1234567890abcdef` |
| `JIRA_CLIENT_SECRET` | OAuth2 Client Secret | `abcdef1234567890abcdef1234567890` |
| `JIRA_POLL_INTERVAL_MINUTES` | Polling interval for subscriptions | `5` |

### Getting Jira Credentials

#### For Simple API Token (Recommended):
1. Go to [Atlassian Account Settings](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Click "Create API token"
3. Give it a label (e.g., "Agentlang Resolver")
4. Copy the generated token
5. Use your Jira account email and the API token
6. Get your Cloud ID from your Jira instance URL (the part before `.atlassian.net`)

#### For Direct Access Token:
1. Use the OAuth2 flow below to get an access token
2. Use the token directly with `JIRA_ACCESS_TOKEN`

#### For OAuth2 Client Credentials:
1. Go to [Atlassian Developer Console](https://developer.atlassian.com/console/myapps/)
2. Create a new app or select existing app
3. Go to "OAuth 2.0 (3LO)" settings
4. Add scopes: `read:jira-work`, `write:jira-work`, `manage:jira-project`
5. Note the Client ID and Client Secret
6. Get your Cloud ID from your Jira instance URL

### Getting Cloud ID

Your Cloud ID can be found in your Jira URL:
- URL: `https://your-domain.atlassian.net`
- Cloud ID: `your-domain` (the part before `.atlassian.net`)

Or get it programmatically:
```bash
curl -X GET "https://api.atlassian.com/oauth/token/accessible-resources" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## API Reference

### Issues

#### Create Issue
```http
POST /jira/Issue
{
    "summary": "Fix critical bug",
    "description": "This is a critical bug that needs immediate attention",
    "assignee": "5d6f8b2a1a2b3c4d5e6f7g8h",
    "labels": "bug,urgent",
    "project": "PROJ",
    "issue_type": "Bug"
}
```

#### Query Issues
```http
GET /jira/Issue
GET /jira/Issue/{id}
```

#### Update Issue
```http
PATCH /jira/Issue/{id}
{
    "summary": "Updated issue title",
    "description": "Updated description",
    "assignee": "5d6f8b2a1a2b3c4d5e6f7g8h",
    "labels": "bug,resolved"
}
```

#### Delete Issue
```http
DELETE /jira/Issue/{id}
```

### Projects

#### Create Project
```http
POST /jira/Project
{
    "key": "NEWPROJ",
    "name": "New Project",
    "project_type_key": "software"
}
```

#### Query Projects
```http
GET /jira/Project
GET /jira/Project/{id}
```

#### Update Project
```http
PATCH /jira/Project/{id}
{
    "name": "Updated Project Name",
    "key": "UPDATED"
}
```

#### Delete Project
```http
DELETE /jira/Project/{id}
```

### Issue Types

#### Query Issue Types
```http
GET /jira/IssueType
GET /jira/IssueType?project_id=10001
```

### Create Issue Action

#### Create Issue
```http
POST /jira/CreateIssueInput
{
    "summary": "New feature request",
    "description": "Add new functionality",
    "project": "PROJ",
    "issue_type": "Story"
}
```

#### Query Create Issue
```http
GET /jira/CreateIssueOutput/{id}
```

### Users

#### Query Users
```http
GET /jira/User
GET /jira/User?account_id=5d6f8b2a1a2b3c4d5e6f7g8h
```

### Status

#### Query Status
```http
GET /jira/Status
```

## Data Models

### Issue
- `id`: String (unique identifier)
- `created_at`: String (creation date)
- `updated_at`: String (last modification date)
- `key`: String (issue key like PROJ-123)
- `summary`: String (issue title)
- `issue_type`: String (Bug, Story, Task, etc.)
- `status`: String (To Do, In Progress, Done, etc.)
- `assignee`: String (assignee display name)
- `url`: String (API URL)
- `web_url`: String (browser URL)
- `project_id`: String (project ID)
- `project_key`: String (project key)
- `project_name`: String (project name)
- `comments`: Comment (array of comments)

### Comment
- `id`: String (comment ID)
- `created_at`: String (creation date)
- `updated_at`: String (last modification date)
- `author`: Author (comment author)
- `body`: String (comment content)

### Author
- `account_id`: String (Atlassian account ID)
- `active`: Boolean (is user active)
- `display_name`: String (display name)
- `email_address`: String (email address)

### Project
- `id`: String (unique identifier)
- `key`: String (project key)
- `name`: String (project name)
- `url`: String (API URL)
- `project_type_key`: String (software, service_desk, business)
- `web_url`: String (browser URL)

### IssueType
- `project_id`: String (project ID)
- `id`: String (issue type ID)
- `name`: String (issue type name)
- `description`: String (issue type description)
- `url`: String (API URL)

### User
- `account_id`: String (Atlassian account ID)
- `display_name`: String (display name)
- `email_address`: String (email address)
- `active`: Boolean (is user active)
- `time_zone`: String (user timezone)

### Status
- `id`: String (status ID)
- `name`: String (status name)
- `description`: String (status description)
- `status_category`: String (To Do, In Progress, Done)

## Subscriptions

The resolver supports real-time subscriptions for:
- **Issues**: Monitors issue changes and updates
- **Projects**: Tracks project updates
- **Issue Types**: Monitors issue type changes

Subscriptions are configured via the `JIRA_POLL_INTERVAL_MINUTES` environment variable (default: 5 minutes).

## Error Handling

The resolver provides comprehensive error handling:
- **Authentication Errors**: Clear messages for API token failures
- **API Errors**: Detailed error information from Jira API
- **Network Errors**: Timeout and connection error handling
- **Validation Errors**: Input validation with helpful messages

## Logging

All operations are logged with the `JIRA RESOLVER:` prefix:
- Request/response logging
- Error logging with context
- Subscription activity logging
- Authentication status logging

## Security

- **Token Management**: Secure API token handling
- **Environment Variables**: Sensitive data stored in environment variables
- **HTTPS Only**: All API calls use HTTPS
- **Basic Auth**: Uses email + API token authentication

## Jira API Rate Limits

The resolver respects Jira API rate limits:
- **Cloud instances**: 300 requests per minute per app
- **Server instances**: Varies by configuration
- **Automatic retry**: Built-in retry logic for rate limit errors

## Setup

1. **Clone the repository**:
```bash
git clone <repository-url>
cd jira-resolver
```

2. **Install dependencies**:
```bash
pnpm install
```

3. **Set environment variables**:
```bash
export JIRA_CLOUD_ID="your-domain"
export JIRA_BASE_URL="https://your-domain.atlassian.net"
export JIRA_EMAIL="your-email@example.com"
export JIRA_API_TOKEN="your-api-token"
```

4. **Run the resolver**:
```bash
agent run
```

## OAuth2 Authentication Flow

The resolver automatically handles OAuth2 authentication when using client credentials:

1. **Token Request**: When no direct access token is provided, the resolver makes a POST request to `https://auth.atlassian.com/oauth/token`
2. **Client Credentials**: Uses `grant_type=client_credentials` with your client ID, secret, and audience
3. **Token Caching**: Automatically caches the access token and refreshes it before expiry
4. **Error Handling**: Provides clear error messages if authentication fails
5. **Fallback**: Falls back to API token authentication if OAuth2 fails

## API Endpoints

The resolver uses the Atlassian Cloud API:
- **Base URL**: `https://api.atlassian.com`
- **Jira Endpoint**: `/ex/jira/{cloudId}/rest/api/3/...`
- **Authentication**: Bearer token (OAuth2) or Basic auth (API token)
