# Zoom Resolver Documentation

## Overview

The Zoom resolver provides a comprehensive integration with Zoom's REST API. It supports full CRUD operations for users, meetings, webinars, and recordings management.

## Configuration

### Environment Variables

Set the following environment variables to configure the Zoom resolver:

**Option 1: Direct Access Token** (if you already have a token)
```bash
ZOOM_ACCESS_TOKEN=your_access_token_here     # Your Zoom OAuth access token
ZOOM_BASE_URL=https://api.zoom.us/v2        # Zoom API base URL (optional, defaults to https://api.zoom.us/v2)
```

**Option 2: Server-to-Server OAuth** (Recommended - automatic token management)
```bash
ZOOM_ACCOUNT_ID=your_account_id              # Your Zoom Account ID
ZOOM_CLIENT_ID=your_client_id                # Your Zoom Client ID
ZOOM_CLIENT_SECRET=your_client_secret        # Your Zoom Client Secret
ZOOM_BASE_URL=https://api.zoom.us/v2        # Zoom API base URL (optional, defaults to https://api.zoom.us/v2)
```

### Authentication

The Zoom resolver supports two authentication methods:

#### Method 1: Direct Access Token

If you already have an access token, set `ZOOM_ACCESS_TOKEN` in your environment variables. The token will be used directly for all API requests.

#### Method 2: Server-to-Server OAuth (Automatic Token Management)

The resolver can automatically obtain and manage access tokens using Server-to-Server OAuth. This is the recommended method for server applications.

**Setup Steps:**

1. **Create a Server-to-Server OAuth App:**
   - Go to [Zoom App Marketplace](https://marketplace.zoom.us/)
   - Sign in and click **Develop** → **Build App**
   - Choose **Server-to-Server OAuth**
   - Fill in the basic information
   - Under **App Credentials**, you'll get:
     - **Account ID**
     - **Client ID**
     - **Client Secret**

2. **Configure Environment Variables:**
   ```bash
   export ZOOM_ACCOUNT_ID="your_account_id"
   export ZOOM_CLIENT_ID="your_client_id"
   export ZOOM_CLIENT_SECRET="your_client_secret"
   ```

3. **Automatic Token Management:**
   - The resolver automatically fetches an access token using the credentials
   - Tokens are cached and automatically refreshed when they expire
   - Tokens expire after 1 hour (3600 seconds)
   - The resolver refreshes tokens 5 minutes before expiration

**How It Works:**

The resolver makes a POST request to Zoom's OAuth endpoint:
```
POST https://zoom.us/oauth/token?grant_type=account_credentials&account_id=YOUR_ACCOUNT_ID
Authorization: Basic BASE64(CLIENT_ID:CLIENT_SECRET)
```

The response includes:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR...",
  "token_type": "bearer",
  "expires_in": 3599
}
```

The resolver caches this token and automatically refreshes it when needed.

**Note:** Zoom no longer supports JWT authentication. Use Server-to-Server OAuth for all backend integrations.

For more information, see the [Zoom OAuth Guide](https://marketplace.zoom.us/docs/guides/auth/oauth).

## Entities

### User

Represents a Zoom user account.

**Fields:**
- `id` (String) - Unique identifier for the user
- `email` (String) - User's email address
- `first_name` (String) - User's first name
- `last_name` (String) - User's last name
- `display_name` (String) - User's display name
- `type` (Number) - User type (1=Basic, 2=Licensed, 3=On-prem)
- `role_name` (String) - User's role name
- `pmi` (Number) - Personal Meeting ID
- `use_pmi` (Boolean) - Whether to use Personal Meeting ID
- `personal_meeting_url` (String) - Personal meeting URL
- `timezone` (String) - User's timezone
- `verified` (Number) - Email verification status
- `dept` (String) - Department
- `created_at` (String) - Account creation timestamp
- `last_login_time` (String) - Last login timestamp
- `last_client_version` (String) - Last client version used
- `language` (String) - User's language preference
- `phone_country` (String) - Phone country code
- `phone_number` (String) - Phone number
- `status` (String) - Account status (active, inactive, pending)
- `job_title` (String) - Job title
- `location` (String) - Location
- `login_types` (Array) - Login types
- `role_id` (String) - Role ID
- `account_id` (String) - Account ID
- `account_number` (Number) - Account number
- `account_type` (String) - Account type
- `jid` (String) - JID
- `group_ids` (Array) - Group IDs
- `im_group_ids` (Array) - IM group IDs

**Operations:**
- `create` - Create a new user
- `query` - Query users (single by ID or list all)
- `update` - Update user information
- `delete` - Delete a user (supports delete, disassociate, or recover actions)

### Meeting

Represents a Zoom meeting.

**Fields:**
- `id` (String) - Unique identifier for the meeting
- `uuid` (String) - Meeting UUID
- `host_id` (String) - Host user ID
- `host_email` (String) - Host email address
- `topic` (String) - Meeting topic
- `type` (Number) - Meeting type (1=Instant, 2=Scheduled, 3=Recurring no fixed time, 8=Recurring fixed time)
- `status` (String) - Meeting status
- `start_time` (String) - Meeting start time (ISO 8601 format)
- `duration` (Number) - Meeting duration in minutes
- `timezone` (String) - Meeting timezone
- `created_at` (String) - Creation timestamp
- `start_url` (String) - Start URL for the host
- `join_url` (String) - Join URL for participants
- `password` (String) - Meeting password
- `h323_password` (String) - H.323 password
- `pstn_password` (String) - PSTN password
- `encrypted_password` (String) - Encrypted password
- `settings` (Map) - Meeting settings (join before host, mute on entry, etc.)
- `agenda` (String) - Meeting agenda
- `recurrence` (Map) - Recurrence settings for recurring meetings
- `occurrences` (Array) - Occurrence details for recurring meetings
- `tracking_fields` (Array) - Tracking fields
- `occurrences_count` (Number) - Number of occurrences

**Operations:**
- `create` - Create a new meeting (requires host_id or user_id)
- `query` - Query meetings (single by ID, by user, or list user's meetings)
- `update` - Update meeting information
- `delete` - Delete a meeting (supports occurrence_id and schedule_for_reminder options)

### Webinar

Represents a Zoom webinar.

**Fields:**
- `id` (String) - Unique identifier for the webinar
- `uuid` (String) - Webinar UUID
- `host_id` (String) - Host user ID
- `host_email` (String) - Host email address
- `topic` (String) - Webinar topic
- `type` (Number) - Webinar type (5=Scheduled, 6=Recurring no fixed time, 9=Recurring fixed time)
- `start_time` (String) - Webinar start time (ISO 8601 format)
- `duration` (Number) - Webinar duration in minutes
- `timezone` (String) - Webinar timezone
- `created_at` (String) - Creation timestamp
- `join_url` (String) - Join URL for participants
- `agenda` (String) - Webinar agenda
- `password` (String) - Webinar password
- `h323_password` (String) - H.323 password
- `pstn_password` (String) - PSTN password
- `encrypted_password` (String) - Encrypted password
- `settings` (Map) - Webinar settings
- `recurrence` (Map) - Recurrence settings for recurring webinars
- `occurrences` (Array) - Occurrence details for recurring webinars
- `tracking_fields` (Array) - Tracking fields
- `occurrences_count` (Number) - Number of occurrences
- `registration_url` (String) - Registration URL

**Operations:**
- `create` - Create a new webinar (requires host_id or user_id)
- `query` - Query webinars (single by ID, by user, or list user's webinars)
- `update` - Update webinar information
- `delete` - Delete a webinar (supports occurrence_id and schedule_for_reminder options)

### Recording

Represents a Zoom meeting recording.

**Fields:**
- `id` (String) - Unique identifier (meeting ID)
- `uuid` (String) - Recording UUID
- `account_id` (String) - Account ID
- `host_id` (String) - Host user ID
- `host_email` (String) - Host email address
- `topic` (String) - Meeting topic
- `type` (Number) - Meeting type
- `start_time` (String) - Meeting start time
- `timezone` (String) - Timezone
- `duration` (Number) - Recording duration in minutes
- `total_size` (Number) - Total file size in bytes
- `recording_count` (Number) - Number of recording files
- `share_url` (String) - Share URL
- `recording_files` (Array) - Array of recording file objects
- `password` (String) - Recording password
- `recording_play_passcode` (String) - Playback passcode

**Operations:**
- `query` - Query recordings (by meeting ID, by user, or list user's recordings)
- `delete` - Delete recordings (supports trash or delete action)

## 🔧 API Reference

### Users

#### Create User
```http
POST /zoom/User
Content-Type: application/json

{
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "type": 1,
    "timezone": "America/New_York",
    "dept": "Engineering",
    "language": "en-US",
    "phone_country": "US",
    "phone_number": "+1234567890",
    "job_title": "Software Engineer",
    "location": "San Francisco"
}
```

#### Query User
```http
GET /zoom/User/{id}
```

#### Query All Users
```http
GET /zoom/User
```

#### Update User
```http
PATCH /zoom/User
Content-Type: application/json

{
    "id": "AGZs_ROaQDOSogf3ewZHCA",
    "first_name": "Jane",
    "last_name": "Smith",
    "job_title": "Senior Developer",
    "timezone": "America/Los_Angeles"
}
```

#### Delete User
```http
DELETE /zoom/User
Content-Type: application/json

{
    "id": "AGZs_ROaQDOSogf3ewZHCA",
    "action": "delete"
}
```

### Meetings

#### Create Meeting
```http
POST /zoom/Meeting
Content-Type: application/json

{
    "host_id": "AGZs_ROaQDOSogf3ewZHCA",
    "topic": "Test Meeting",
    "type": 2,
    "start_time": "2025-12-12T10:00:00Z",
    "duration": 30,
    "timezone": "America/Los_Angeles",
    "password": "U8Qse4",
    "agenda": "My API Meeting",
    "settings": {
        "host_video": true,
        "participant_video": true,
        "join_before_host": true,
        "mute_upon_entry": false,
        "waiting_room": false
    }
}
```

#### Query Meeting
```http
GET /zoom/Meeting/{id}
```

#### Query Meetings by User
```http
GET /zoom/Meeting?user_id={user_id}
```

#### Update Meeting
```http
PATCH /zoom/Meeting
Content-Type: application/json

{
    "id": 81012350689,
    "topic": "Updated Meeting Topic",
    "duration": 45,
    "start_time": "2025-12-12T11:00:00Z",
    "agenda": "Updated agenda"
}
```

#### Delete Meeting
```http
DELETE /zoom/Meeting
Content-Type: application/json

{
    "id": 81012350689
}
```

#### Delete Meeting Occurrence
```http
DELETE /zoom/Meeting
Content-Type: application/json

{
    "id": 81012350689,
    "occurrence_id": "occurrence789"
}
```

### Webinars

#### Create Webinar
```http
POST /zoom/Webinar
Content-Type: application/json

{
    "host_id": "AGZs_ROaQDOSogf3ewZHCA",
    "topic": "Product Launch Webinar",
    "type": 5,
    "start_time": "2025-01-20T14:00:00Z",
    "duration": 60,
    "timezone": "America/New_York",
    "password": "webinar123",
    "agenda": "Product launch presentation"
}
```

#### Query Webinar
```http
GET /zoom/Webinar/{id}
```

#### Query Webinars by User
```http
GET /zoom/Webinar?user_id={user_id}
```

#### Update Webinar
```http
PATCH /zoom/Webinar
Content-Type: application/json

{
    "id": 123456789,
    "topic": "Updated Webinar Topic",
    "duration": 90,
    "start_time": "2025-01-20T15:00:00Z"
}
```

#### Delete Webinar
```http
DELETE /zoom/Webinar
Content-Type: application/json

{
    "id": 123456789
}
```

### Recordings

#### Query Recording by Meeting ID
```http
GET /zoom/Recording?meeting_id={meeting_id}
```

#### Query Recordings by User
```http
GET /zoom/Recording?user_id={user_id}
```

#### Delete Recording
```http
DELETE /zoom/Recording
Content-Type: application/json

{
    "meeting_id": 81012350689,
    "action": "trash"
}
```

## Error Handling

All operations return a result object with the following structure:

**Success:**
```javascript
{
  result: 'success',
  id: 'entity_id' // For create operations
}
```

**Error:**
```javascript
{
  result: 'error',
  message: 'Error description'
}
```

For query operations, successful results return an array of entity instances.

## Meeting Types

- `1` - Instant meeting
- `2` - Scheduled meeting
- `3` - Recurring meeting with no fixed time
- `8` - Recurring meeting with fixed time

## Webinar Types

- `5` - Scheduled webinar
- `6` - Recurring webinar with no fixed time
- `9` - Recurring webinar with fixed time

## User Types

- `1` - Basic user
- `2` - Licensed user
- `3` - On-prem user

## Notes

- All timestamps should be in ISO 8601 format (e.g., `2024-01-15T10:00:00Z`)
- Meeting and webinar durations are in minutes
- Passwords are optional but recommended for security
- Recurring meetings/webinars require additional recurrence settings
- Access tokens expire after 1 hour and need to be refreshed
- Some operations require specific Zoom account permissions
- The `settings` field contains nested configuration objects for meetings/webinars

## API Reference

For detailed API documentation, refer to the [Zoom API Reference](https://marketplace.zoom.us/docs/api-reference/zoom-api).

## Rate Limits

Zoom API has rate limits:
- Most endpoints: 100 requests per second
- Some endpoints: 20 requests per second

The resolver includes timeout handling (30 seconds) and proper error handling for rate limit scenarios.

## Support

For issues or questions, please refer to the main project documentation or contact support.

