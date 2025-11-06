# Google Drive Agentlang Resolver

Agentlang resolver for Google Drive integration, providing full CRUD operations and real-time subscriptions for documents, folders, files, and shared drives.

## Quick Start

1. **Install dependencies**:
```bash
pnpm install
```

2. **Set environment variables**:

**Option A: OAuth2 Refresh Token (Recommended)**
```bash
export GOOGLE_DRIVE_CLIENT_ID="your-client-id"
export GOOGLE_DRIVE_CLIENT_SECRET="your-client-secret"
export GOOGLE_DRIVE_REFRESH_TOKEN="your-refresh-token"
export GOOGLE_DRIVE_POLL_INTERVAL_MINUTES="60"  # Optional
```

**Option B: Direct Access Token (Testing)**
```bash
export GOOGLE_DRIVE_ACCESS_TOKEN="your-access-token"
export GOOGLE_DRIVE_POLL_INTERVAL_MINUTES="60"  # Optional
```

3. **Run the resolver**:
```bash
agent run
```

## Environment Variables

### Method 1: OAuth2 Refresh Token (Recommended)

| Variable | Description | Example |
|----------|-------------|---------|
| `GOOGLE_DRIVE_CLIENT_ID` | OAuth2 Client ID | `123456789.apps.googleusercontent.com` |
| `GOOGLE_DRIVE_CLIENT_SECRET` | OAuth2 Client Secret | `GOCSPX-abcdef123456` |
| `GOOGLE_DRIVE_REFRESH_TOKEN` | OAuth2 Refresh Token | `1//04abcdef123456` |
| `GOOGLE_DRIVE_POLL_INTERVAL_MINUTES` | Polling interval for subscriptions | `60` |

### Method 2: Direct Access Token (Testing)

| Variable | Description | Example |
|----------|-------------|---------|
| `GOOGLE_DRIVE_ACCESS_TOKEN` | Direct access token | `ya29.a0AfH6SMC...` |
| `GOOGLE_DRIVE_POLL_INTERVAL_MINUTES` | Polling interval for subscriptions | `60` |

### Getting Google Drive Credentials

#### For OAuth2 Refresh Token:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Google Drive API
4. Create OAuth 2.0 credentials
5. Configure OAuth consent screen
6. Set up scopes:
   - `https://www.googleapis.com/auth/drive`
   - `https://www.googleapis.com/auth/drive.file`
   - `https://www.googleapis.com/auth/drive.readonly`
   - `https://www.googleapis.com/auth/drive.metadata`
7. Get authorization code and exchange for refresh token

#### For Direct Access Token:
1. Follow OAuth2 flow above
2. Use the access token directly with `GOOGLE_DRIVE_ACCESS_TOKEN`

## API Reference

### Documents

#### Query Documents
```http
GET /googledrive/Document
GET /googledrive/Document/{id}
```

#### Update Document
```http
PATCH /googledrive/Document/{id}
{
    "title": "Updated Document Name",
    "description": "Updated description"
}
```

#### Delete Document
```http
DELETE /googledrive/Document/{id}
```

### Folders

#### Create Folder
```http
POST /googledrive/Folder
{
    "title": "My New Folder",
    "parent_id": "folder-id-or-omit-for-root"
}
```

#### Query Folders
```http
GET /googledrive/Folder
GET /googledrive/Folder/{id}
```

#### Update Folder
```http
PATCH /googledrive/Folder/{id}
{
    "title": "Updated Folder Name",
    "description": "Updated description"
}
```

#### Delete Folder
```http
DELETE /googledrive/Folder/{id}
```

### Files

#### Query Files
```http
GET /googledrive/File
GET /googledrive/File/{id}
```

#### Update File
```http
PATCH /googledrive/File/{id}
{
    "name": "updated-file-name.pdf",
    "description": "Updated description"
}
```

#### Delete File
```http
DELETE /googledrive/File/{id}
```

### Drives

#### Query Shared Drives
```http
GET /googledrive/Drive
GET /googledrive/Drive/{id}
```

### Upload File

#### Upload File from Content
```http
POST /googledrive/UploadFileInput
{
    "content": "File content here or base64 encoded",
    "name": "document.txt",
    "mime_type": "text/plain",
    "folder_id": "folder-id-optional",
    "description": "Optional description",
    "is_base64": "true"
}
```

#### Upload Local File (Workflow)
Use the `SyncLocalFile` workflow to upload a local file from the `/fs` directory:
```agentlang
SyncLocalFile {
    fileName: "my-file.pdf",
    uploadName: "uploaded-document.pdf"
}
```

This workflow:
1. Finds the file in the `/fs` directory
2. Uploads it to Google Drive
3. Renames it to `uploadName` (or keeps original name)

### Download File

#### Download Remote File (Workflow)
Use the `SyncRemoteFile` workflow to download a file from Google Drive:
```agentlang
SyncRemoteFile {
    fileId: "1abc2def3ghi",
    fileName: "downloaded-file.pdf"
}
```

This workflow:
1. Downloads the file from Google Drive
2. Saves it to `/fs/{fileName}` (or uses fileId + original name)
3. Creates an Agentlang file record

### Folder Content

#### Query Folder Content
```http
GET /googledrive/FolderContentInput?id=folder-id&cursor=next-page-token
GET /googledrive/FolderContent/{folderId}
```

### File Content

#### Query File Content
```http
GET /googledrive/FileContent/{fileId}
```

**Response:**
```json
{
    "id": "1abc2def3ghi",
    "name": "document.pdf",
    "content": "JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PC9...",
    "size": 52847,
    "modified_time": "2024-01-01T12:00:00Z"
}
```

**Note**: The `content` field contains the file content encoded as a base64 string.

## Data Models

### Document
- `id`: String (unique identifier)
- `url`: String (web view link)
- `title`: String (document title)
- `mime_type`: String (MIME type)
- `updated_at`: String (last modification date)

### Folder
- `id`: String (unique identifier)
- `url`: String (web view link)
- `title`: String (folder title)
- `mime_type`: String (always "application/vnd.google-apps.folder")
- `updated_at`: String (last modification date)

### File
- `id`: String (unique identifier)
- `name`: String (file name)
- `mime_type`: String (MIME type)
- `parents`: String (comma-separated parent folder IDs)
- `modified_time`: String (last modification date)
- `created_time`: String (creation date)
- `web_view_link`: String (browser URL)
- `kind`: String (resource kind)

### Drive
- `id`: String (unique identifier)
- `name`: String (drive name)
- `kind`: String (resource kind)
- `created_time`: String (creation date)
- `hidden`: Boolean (is drive hidden)

### FolderContent
- `files`: File (array of files)
- `folders`: File (array of folders)
- `next_cursor`: String (pagination token)

### FileContent
- `id`: String (unique identifier)
- `name`: String (file name)
- `content`: String (file content as base64 encoded string)
- `size`: Number (file size in bytes)
- `modified_time`: String (last modification date)

## Subscriptions

The resolver supports real-time subscriptions for:
- **Documents**: Monitors document changes and updates
- **Folders**: Tracks folder updates

Subscriptions are configured via the `GOOGLE_DRIVE_POLL_INTERVAL_MINUTES` environment variable (default: 60 minutes).

## Error Handling

The resolver provides comprehensive error handling:
- **Authentication Errors**: Clear messages for OAuth2 failures
- **API Errors**: Detailed error information from Google Drive API
- **Network Errors**: Timeout and connection error handling
- **Validation Errors**: Input validation with helpful messages

## Logging

All operations are logged with the `GOOGLE DRIVE RESOLVER:` prefix:
- Request/response logging
- Error logging with context
- Subscription activity logging
- Authentication status logging

## Security

- **Token Management**: Secure token caching and refresh
- **Environment Variables**: Sensitive data stored in environment variables
- **HTTPS Only**: All API calls use HTTPS
- **Scope Validation**: Proper OAuth2 scope validation

## Google Drive API Limits

The resolver respects Google Drive API limits:
- **Per-user rate limit**: 1,000 requests per 100 seconds per user
- **File size limit**: 5 MB for simple uploads (use chunked upload for larger files)
- **Automatic retry**: Built-in retry logic for rate limit errors

## Setup

1. **Clone the repository**:
```bash
git clone <repository-url>
cd google-drive-resolver
```

2. **Install dependencies**:
```bash
pnpm install
```

3. **Set environment variables**:
```bash
export GOOGLE_DRIVE_CLIENT_ID="your-client-id"
export GOOGLE_DRIVE_CLIENT_SECRET="your-client-secret"
export GOOGLE_DRIVE_REFRESH_TOKEN="your-refresh-token"
```

4. **Run the resolver**:
```bash
agent run
```

