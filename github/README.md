# GitHub Agentlang Resolver

Agentlang resolver for GitHub integration, providing full CRUD operations and real-time subscriptions for issues, repositories, files, and more.

## Quick Start

1. **Install dependencies**:
```bash
pnpm install
```

2. **Set environment variables**:

**Option A: Direct Access Token (Testing)**
```bash
export GITHUB_ACCESS_TOKEN="your-personal-access-token-here"
export GITHUB_POLL_INTERVAL_MINUTES="30"  # Optional
```

**Option B: OAuth2 Authorization Code (Recommended for production)**
```bash
export GITHUB_CLIENT_ID="your-client-id"
export GITHUB_CLIENT_SECRET="your-client-secret"
export GITHUB_AUTH_CODE="your-authorization-code"
export GITHUB_POLL_INTERVAL_MINUTES="30"  # Optional
```

**Option C: OAuth2 Refresh Token (Long-term)**
```bash
export GITHUB_CLIENT_ID="your-client-id"
export GITHUB_CLIENT_SECRET="your-client-secret"
export GITHUB_REFRESH_TOKEN="your-refresh-token"
export GITHUB_POLL_INTERVAL_MINUTES="30"  # Optional
```

**Option D: GitHub App (Enterprise)**
```bash
export GITHUB_APP_PRIVATE_KEY="your-base64-encoded-private-key"
export GITHUB_APP_ID="your-github-app-id"
export GITHUB_INSTALLATION_ID="your-installation-id"
export GITHUB_POLL_INTERVAL_MINUTES="30"  # Optional
```

3. **Run the resolver**:
```bash
agent run
```

## Environment Variables

The resolver supports four authentication methods:

### Method 1: Direct Access Token (Testing)

| Variable | Description | Example |
|----------|-------------|---------|
| `GITHUB_ACCESS_TOKEN` | GitHub Personal Access Token | `ghp_xxxxxxxxxxxxxxxxxxxx` |
| `GITHUB_POLL_INTERVAL_MINUTES` | Polling interval for subscriptions | `30` |

### Method 2: OAuth2 Authorization Code (Recommended for production)

| Variable | Description | Example |
|----------|-------------|---------|
| `GITHUB_CLIENT_ID` | OAuth2 Client ID | `Iv1.8a61f9b3a7aba766` |
| `GITHUB_CLIENT_SECRET` | OAuth2 Client Secret | `1234567890abcdef1234567890abcdef` |
| `GITHUB_AUTH_CODE` | Authorization Code | `abc123def456ghi789` |
| `GITHUB_POLL_INTERVAL_MINUTES` | Polling interval for subscriptions | `30` |

### Method 3: OAuth2 Refresh Token (Long-term)

| Variable | Description | Example |
|----------|-------------|---------|
| `GITHUB_CLIENT_ID` | OAuth2 Client ID | `Iv1.8a61f9b3a7aba766` |
| `GITHUB_CLIENT_SECRET` | OAuth2 Client Secret | `1234567890abcdef1234567890abcdef` |
| `GITHUB_REFRESH_TOKEN` | OAuth2 Refresh Token | `gho_xxxxxxxxxxxxxxxxxxxx` |
| `GITHUB_POLL_INTERVAL_MINUTES` | Polling interval for subscriptions | `30` |

### Method 4: GitHub App (Enterprise)

| Variable | Description | Example |
|----------|-------------|---------|
| `GITHUB_APP_PRIVATE_KEY` | Base64 encoded private key | `LS0tLS1CRUdJTi...` |
| `GITHUB_APP_ID` | GitHub App ID | `123456` |
| `GITHUB_INSTALLATION_ID` | Installation ID | `789012` |
| `GITHUB_POLL_INTERVAL_MINUTES` | Polling interval for subscriptions | `30` |

### Getting GitHub Credentials

#### For Direct Access Token:
1. Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Select appropriate scopes:
   - `repo` - Full control of private repositories
   - `read:org` - Read org and team membership
   - `user` - Read user profile data
4. Generate and copy the token

#### For OAuth2 Authorization Code:
1. Go to [GitHub Settings > Developer settings > OAuth Apps](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Set Authorization callback URL: `http://localhost:8080/callback` (or your app's callback)
4. Note the Client ID and Client Secret
5. Generate authorization URL:
   ```
   https://github.com/login/oauth/authorize?client_id=YOUR_CLIENT_ID&scope=repo,read:org,user
   ```
6. Visit the URL, authorize the app, and get the authorization code from the callback
7. Use the authorization code with `GITHUB_AUTH_CODE`

#### For OAuth2 Refresh Token:
1. Follow the OAuth2 Authorization Code flow above
2. The initial token exchange will return a refresh token
3. Store the refresh token and use it with `GITHUB_REFRESH_TOKEN`

#### For GitHub App:
1. Go to [GitHub Settings > Developer settings > GitHub Apps](https://github.com/settings/apps)
2. Click "New GitHub App"
3. Configure the app with required permissions:
   - **Repository permissions**: Contents (Read & Write), Issues (Read & Write), Metadata (Read)
   - **Account permissions**: Organizations and teams (Read)
4. Install the app on your account or organization
5. Generate a private key and base64 encode it
6. Note the App ID and Installation ID

### OAuth2 Authentication Flow

The resolver automatically handles OAuth2 authentication:

1. **Authorization Code**: Uses the authorization code to get an access token
2. **Token Exchange**: Makes a POST request to `https://github.com/login/oauth/access_token`
3. **Token Caching**: Automatically caches the access token and refreshes it before expiry
4. **Refresh Token**: Uses refresh token for long-term access without re-authorization
5. **Error Handling**: Provides clear error messages if authentication fails

### GitHub App Authentication Flow

The resolver automatically handles GitHub App authentication:

1. **JWT Token**: Creates a JSON Web Token using the private key and app ID
2. **Installation Token**: Exchanges JWT for an installation access token
3. **API Calls**: Uses the installation token for all GitHub API requests
4. **Token Refresh**: Automatically refreshes tokens when they expire

## API Reference

### Issues

#### Create Issue
```http
POST /github/Issue
{
    "owner": "octocat",
    "repo": "Hello-World",
    "title": "Found a bug",
    "body": "I'm having a problem with this.",
    "labels": "bug,urgent"
}
```

#### Query Issues
```http
GET /github/Issue
GET /github/Issue/{id}
```

#### Update Issue
```http
PATCH /github/Issue/{id}
{
    "title": "Updated title",
    "body": "Updated description",
    "state": "closed",
    "labels": "bug,resolved"
}
```

#### Close Issue (Delete)
```http
DELETE /github/Issue/{id}
```

### Repositories

#### Create Repository
```http
POST /github/Repository
{
    "name": "my-new-repo",
    "description": "A new repository",
    "private": "false"
}
```

#### Query Repositories
```http
GET /github/Repository
GET /github/Repository/{id}
```

#### Update Repository
```http
PATCH /github/Repository/{id}
{
    "name": "updated-repo-name",
    "description": "Updated description",
    "private": "true",
    "homepage": "https://example.com"
}
```

#### Delete Repository
```http
DELETE /github/Repository/{id}
```

### Files

#### Query File
```http
GET /github/File?owner=octocat&repo=Hello-World&path=README.md&branch=main
```

#### Update File
```http
PATCH /github/File/{id}
{
    "content": "New file content",
    "message": "Update file"
}
```

#### Delete File
```http
DELETE /github/File/{id}
```

### Write File

#### Write File
```http
POST /github/WriteFileInput
{
    "owner": "octocat",
    "repo": "Hello-World",
    "path": "docs/README.md",
    "content": "File content here",
    "message": "Add documentation"
}
```

#### Query Write File
```http
GET /github/WriteFileOutput?owner=octocat&repo=Hello-World&path=docs/README.md
```

### Repository Files

#### Query Repository Files
```http
GET /github/RepoInput?owner=octocat&repo=Hello-World&branch=main
```

### Organizations

#### Query Organizations
```http
GET /github/Organization
```

### Users

#### Query User
```http
GET /github/User
GET /github/User?username=octocat
```

## Data Models

### Issue
- `id`: String (unique identifier)
- `owner`: String (repository owner)
- `repo`: String (repository name)
- `issue_number`: Number (issue number)
- `title`: String (issue title)
- `author`: String (issue author username)
- `author_id`: String (issue author ID)
- `state`: String (open/closed)
- `date_created`: String (creation date)
- `date_last_modified`: String (last modification date)
- `body`: String (issue description)

### Repository
- `id`: Number (unique identifier)
- `owner`: String (repository owner)
- `name`: String (repository name)
- `full_name`: String (full repository name)
- `description`: String (repository description)
- `url`: String (repository URL)
- `date_created`: String (creation date)
- `date_last_modified`: String (last modification date)

### File
- `id`: String (file SHA)
- `name`: String (file path/name)
- `url`: String (file URL)
- `last_modified_date`: String (last modification date)

### Organization
- `id`: Number (unique identifier)
- `login`: String (organization login)
- `name`: String (organization name)
- `url`: String (organization URL)
- `description`: String (organization description)

### User
- `id`: Number (unique identifier)
- `login`: String (username)
- `name`: String (display name)
- `url`: String (profile URL)
- `email`: String (email address)

## Subscriptions

The resolver supports real-time subscriptions for:
- **Issues**: Monitors issue changes across all repositories
- **Repositories**: Tracks repository updates and changes

Subscriptions are configured via the `GITHUB_POLL_INTERVAL_MINUTES` environment variable (default: 30 minutes).

## Error Handling

The resolver provides comprehensive error handling:
- **Authentication Errors**: Clear messages for token failures
- **API Errors**: Detailed error information from GitHub API
- **Network Errors**: Timeout and connection error handling
- **Validation Errors**: Input validation with helpful messages

## Logging

All operations are logged with the `GITHUB RESOLVER:` prefix:
- Request/response logging
- Error logging with context
- Subscription activity logging
- Authentication status logging

## Security

- **Token Management**: Secure token handling and refresh
- **Environment Variables**: Sensitive data stored in environment variables
- **HTTPS Only**: All API calls use HTTPS
- **Scope Validation**: Proper GitHub scope validation

## GitHub API Rate Limits

The resolver respects GitHub API rate limits:
- **Authenticated requests**: 5,000 requests per hour
- **GitHub App requests**: 15,000 requests per hour
- **Automatic retry**: Built-in retry logic for rate limit errors

## Setup

1. **Clone the repository**:
```bash
git clone <repository-url>
cd github-resolver
```

2. **Install dependencies**:
```bash
pnpm install
```

3. **Set environment variables**:
```bash
export GITHUB_CLIENT_ID="your-client-id"
export GITHUB_CLIENT_SECRET="your-client-secret"
export GITHUB_AUTH_CODE="your-authorization-code"
```

4. **Run the resolver**:
```bash
agent run
```