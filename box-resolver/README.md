# Box Agentlang Resolver

Agentlang resolver for Box integration, providing full CRUD operations and real-time subscriptions for files, folders, and users.

## Quick Start

1. **Install dependencies**:
```bash
pnpm install
```

2. **Set environment variables**:

**Option A: OAuth2 Authorization Code (Recommended)**
```bash
export BOX_CLIENT_ID="your-client-id"
export BOX_CLIENT_SECRET="your-client-secret"
export BOX_AUTH_CODE="your-authorization-code"
export BOX_POLL_INTERVAL_MINUTES="60"  # Optional
```

**Option B: OAuth2 Refresh Token (Long-term)**
```bash
export BOX_CLIENT_ID="your-client-id"
export BOX_CLIENT_SECRET="your-client-secret"
export BOX_REFRESH_TOKEN="your-refresh-token"
export BOX_POLL_INTERVAL_MINUTES="60"  # Optional
```

**Option C: Direct Access Token (Testing)**
```bash
export BOX_ACCESS_TOKEN="your-access-token"
export BOX_POLL_INTERVAL_MINUTES="60"  # Optional
```

3. **Run the resolver**:
```bash
agent run
```

## Environment Variables

### Method 1: OAuth2 Authorization Code (Recommended)

| Variable | Description | Example |
|----------|-------------|---------|
| `BOX_CLIENT_ID` | OAuth2 Client ID | `abc123def456ghi789` |
| `BOX_CLIENT_SECRET` | OAuth2 Client Secret | `xyz789abc123def456` |
| `BOX_AUTH_CODE` | Authorization Code | `authcode123` |
| `BOX_POLL_INTERVAL_MINUTES` | Polling interval for subscriptions | `60` |

### Method 2: OAuth2 Refresh Token (Long-term)

| Variable | Description | Example |
|----------|-------------|---------|
| `BOX_CLIENT_ID` | OAuth2 Client ID | `abc123def456ghi789` |
| `BOX_CLIENT_SECRET` | OAuth2 Client Secret | `xyz789abc123def456` |
| `BOX_REFRESH_TOKEN` | OAuth2 Refresh Token | `refreshtoken123` |
| `BOX_POLL_INTERVAL_MINUTES` | Polling interval for subscriptions | `60` |

### Method 3: Direct Access Token (Testing)

| Variable | Description | Example |
|----------|-------------|---------|
| `BOX_ACCESS_TOKEN` | Direct access token | `1!xxxxxxxxxxxxxxxxxxxx` |
| `BOX_POLL_INTERVAL_MINUTES` | Polling interval for subscriptions | `60` |

### Getting Box Credentials

#### For OAuth2 Authorization Code:
1. Go to [Box Developer Console](https://app.box.com/developers/console)
2. Create a new app or select existing app
3. Choose "Custom App" with "OAuth 2.0 with JWT" or "OAuth 2.0 (User Authentication)"
4. Note the Client ID and Client Secret
5. Set the Redirect URI (e.g., `http://localhost:8080/callback`)
6. Generate authorization URL:
   ```
   https://account.box.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&response_type=code&redirect_uri=YOUR_REDIRECT_URI
   ```
7. Visit the URL, authorize the app, and get the authorization code from the callback
8. Use the authorization code with `BOX_AUTH_CODE`

#### For OAuth2 Refresh Token:
1. Follow the OAuth2 Authorization Code flow above
2. The initial token exchange will return a refresh token
3. Store the refresh token and use it with `BOX_REFRESH_TOKEN`

#### For Direct Access Token:
1. Use the OAuth2 flow above to get an access token
2. Use the token directly with `BOX_ACCESS_TOKEN`

## API Reference

### Files

#### Query Files
```http
GET /box/File
GET /box/File/{id}
```

#### Update File
```http
PATCH /box/File/{id}
{
    "name": "updated-file-name.pdf",
    "description": "Updated description"
}
```

#### Delete File
```http
DELETE /box/File/{id}
```

### Folders

#### Create Folder
```http
POST /box/Folder
{
    "name": "My New Folder",
    "parent_id": "0"
}
```

#### Query Folders
```http
GET /box/Folder
GET /box/Folder/{id}
```

#### Update Folder
```http
PATCH /box/Folder/{id}
{
    "name": "Updated Folder Name",
    "description": "Updated description"
}
```

#### Delete Folder
```http
DELETE /box/Folder/{id}
{
    "recursive": "true"
}
```

### Users

#### Create User
```http
POST /box/User
{
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com"
}
```

#### Query Users
```http
GET /box/User
GET /box/User/{id}
```

#### Update User
```http
PATCH /box/User/{id}
{
    "first_name": "Jane",
    "last_name": "Smith",
    "email": "jane.smith@example.com"
}
```

#### Delete User
```http
DELETE /box/User/{id}
{
    "force": "true",
    "notify": "false"
}
```

### Create User Action

#### Create User
```http
POST /box/CreateUserInput
{
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com"
}
```

### Delete User Action

#### Delete User
```http
POST /box/DeleteUserInput
{
    "id": "12345",
    "force": true,
    "notify": false
}
```

### Folder Content

#### Query Folder Content
```http
GET /box/FolderContentInput?id=0&marker=next_marker_value
GET /box/FolderContent/{folderId}
```

### File Content

#### Query File Content
```http
GET /box/FileContent/{fileId}
```

**Response:**
```json
{
    "id": "12345",
    "name": "document.txt",
    "content": "VGhpcyBpcyB0aGUgZmlsZSBjb250ZW50...",
    "size": 1024,
    "modified_at": "2024-01-01T12:00:00Z"
}
```

**Note**: The `content` field contains the file content encoded as a base64 string. To decode:
```javascript
const decodedContent = Buffer.from(content, 'base64').toString('utf8');
```

## Data Models

### File
- `id`: String (unique identifier)
- `name`: String (file name)
- `download_url`: String (download URL)
- `modified_at`: String (last modification date)

### Folder
- `id`: String (unique identifier)
- `name`: String (folder name)
- `modified_at`: String (last modification date)
- `url`: String (folder URL)

### User
- `id`: String (unique identifier)
- `email`: String (user email/login)
- `first_name`: String (first name)
- `last_name`: String (last name)

### FolderContent
- `files`: File (array of files)
- `folders`: Folder (array of folders)
- `next_marker`: String (pagination cursor)

### FileContent
- `id`: String (unique identifier)
- `name`: String (file name)
- `content`: String (file content as base64 encoded string)
- `size`: Number (file size in bytes)
- `modified_at`: String (last modification date)

## Subscriptions

The resolver supports real-time subscriptions for:
- **Files**: Monitors file changes and updates
- **Folders**: Tracks folder updates
- **Users**: Monitors user changes

Subscriptions are configured via the `BOX_POLL_INTERVAL_MINUTES` environment variable (default: 60 minutes).

## Error Handling

The resolver provides comprehensive error handling:
- **Authentication Errors**: Clear messages for OAuth2 failures
- **API Errors**: Detailed error information from Box API
- **Network Errors**: Timeout and connection error handling
- **Validation Errors**: Input validation with helpful messages

## Logging

All operations are logged with the `BOX RESOLVER:` prefix:
- Request/response logging
- Error logging with context
- Subscription activity logging
- Authentication status logging

## Security

- **Token Management**: Secure token caching and refresh
- **Environment Variables**: Sensitive data stored in environment variables
- **HTTPS Only**: All API calls use HTTPS
- **Scope Validation**: Proper OAuth2 scope validation

## Box API Rate Limits

The resolver respects Box API rate limits:
- **Free accounts**: 10 requests per second
- **Enterprise accounts**: Higher limits
- **Automatic retry**: Built-in retry logic for rate limit errors

## Setup

1. **Clone the repository**:
```bash
git clone <repository-url>
cd box-resolver
```

2. **Install dependencies**:
```bash
pnpm install
```

3. **Set environment variables**:
```bash
export BOX_CLIENT_ID="your-client-id"
export BOX_CLIENT_SECRET="your-client-secret"
export BOX_AUTH_CODE="your-authorization-code"
```

4. **Run the resolver**:
```bash
agent run
```

