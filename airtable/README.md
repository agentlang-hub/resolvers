# Airtable Agentlang Resolver

Agentlang resolver for Airtable integration, providing full CRUD operations and real-time subscriptions for bases, tables, fields, and records.

## Quick Start

1. **Install dependencies**:
```bash
pnpm install
```

2. **Set environment variables**:
```bash
export AIRTABLE_API_KEY="your-api-key"
export AIRTABLE_BASE_IDS="base1,base2"  # Optional, for subscriptions
export AIRTABLE_TABLE_IDS="table1,table2"  # Optional, for subscriptions
export AIRTABLE_POLL_INTERVAL_MINUTES="5"  # Optional
```

3. **Run the resolver**:
```bash
agent run
```

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `AIRTABLE_API_KEY` | Your Airtable Personal Access Token | `pat...` |
| `AIRTABLE_BASE_IDS` | Comma-separated list of base IDs for subscriptions | `app123,app456` |
| `AIRTABLE_TABLE_IDS` | Comma-separated list of table IDs for subscriptions | `tbl123,tbl456` |
| `AIRTABLE_POLL_INTERVAL_MINUTES` | Polling interval for subscriptions | `5` |

### Getting Airtable Credentials

1. Go to [Airtable Account Settings](https://airtable.com/account)
2. Navigate to "Developer" section
3. Click "Create new token"
4. Give it a name (e.g., "Agentlang Resolver")
5. Set scopes: `data.records:read`, `data.records:write`, `schema.bases:read`
6. Copy the generated Personal Access Token
7. Get your Base ID from the base URL: `https://airtable.com/appXXXXXXXXXXXXXX` (the part after `/app/`)

## API Reference

### Bases

#### Query Bases
```http
GET /airtable/Base
GET /airtable/Base/{id}
```

### Tables

#### Query Tables
```http
GET /airtable/Table?base_id={baseId}
GET /airtable/Table/{tableId}?base_id={baseId}
```

### Fields

#### Query Fields
```http
GET /airtable/Field?base_id={baseId}&table_id={tableId}
```

### Records

#### Create Record
```http
POST /airtable/Record
{
    "fields": {
        "Name": "John Doe",
        "Email": "john@example.com"
    },
    "table_id": "tblXXXXXXXXXXXXXX",
    "base_id": "appXXXXXXXXXXXXXX"
}
```

#### Query Records
```http
GET /airtable/Record?base_id={baseId}&table_id={tableId}
GET /airtable/Record/{recordId}?base_id={baseId}&table_id={tableId}
```

#### Update Record
```http
PATCH /airtable/Record/{id}
{
    "fields": {
        "Name": "Jane Doe"
    },
    "table_id": "tblXXXXXXXXXXXXXX",
    "base_id": "appXXXXXXXXXXXXXX"
}
```

#### Delete Record
```http
DELETE /airtable/Record/{id}
{
    "table_id": "tblXXXXXXXXXXXXXX",
    "base_id": "appXXXXXXXXXXXXXX"
}
```

### Create Record Action

#### Create Record
```http
POST /airtable/CreateRecordInput
{
    "fields": {
        "Name": "New Record",
        "Status": "Active"
    },
    "table_id": "tblXXXXXXXXXXXXXX",
    "base_id": "appXXXXXXXXXXXXXX"
}
```

#### Query Create Record
```http
GET /airtable/CreateRecordOutput/{id}
```

### Update Record Action

#### Update Record
```http
PATCH /airtable/UpdateRecordInput
{
    "id": "recXXXXXXXXXXXXXX",
    "fields": {
        "Status": "Completed"
    },
    "table_id": "tblXXXXXXXXXXXXXX",
    "base_id": "appXXXXXXXXXXXXXX"
}
```

## Data Models

### Base
- `id`: String (unique identifier)
- `name`: String (base name)
- `permission_level`: String (permission level)

### Table
- `id`: String (unique identifier)
- `name`: String (table name)
- `description`: String (table description)
- `base_id`: String (parent base ID)

### Field
- `id`: String (unique identifier)
- `name`: String (field name)
- `type`: String (field type: singleLineText, email, number, etc.)
- `description`: String (field description)
- `table_id`: String (parent table ID)

### Record
- `id`: String (unique identifier)
- `created_time`: String (creation timestamp)
- `fields`: Object (record field values)
- `table_id`: String (parent table ID)
- `base_id`: String (parent base ID)

## Subscriptions

The resolver supports real-time subscriptions for:
- **Bases**: Monitors base changes
- **Tables**: Tracks table updates within specified bases
- **Fields**: Monitors field changes within specified tables
- **Records**: Tracks record changes within specified tables

Subscriptions are configured via the `AIRTABLE_POLL_INTERVAL_MINUTES` environment variable (default: 5 minutes).

For table, field, and record subscriptions, you must set `AIRTABLE_BASE_IDS` and `AIRTABLE_TABLE_IDS` environment variables with comma-separated lists of IDs.

## Error Handling

The resolver provides comprehensive error handling:
- **Authentication Errors**: Clear messages for API key failures
- **API Errors**: Detailed error information from Airtable API
- **Network Errors**: Timeout and connection error handling
- **Validation Errors**: Input validation with helpful messages

## Logging

All operations are logged with the `AIRTABLE RESOLVER:` prefix:
- Request/response logging
- Error logging with context
- Subscription activity logging
- Authentication status logging

## Security

- **Token Management**: Secure API key handling
- **Environment Variables**: Sensitive data stored in environment variables
- **HTTPS Only**: All API calls use HTTPS
- **Bearer Token**: Uses Personal Access Token authentication

## Airtable API Rate Limits

The resolver respects Airtable API rate limits:
- **Free plan**: 5 requests per second
- **Plus plan**: 5 requests per second
- **Pro plan**: 10 requests per second
- **Enterprise plan**: Custom limits

## Setup

1. **Clone the repository**:
```bash
git clone <repository-url>
cd airtable-resolver
```

2. **Install dependencies**:
```bash
pnpm install
```

3. **Set environment variables**:
```bash
export AIRTABLE_API_KEY="pat..."
export AIRTABLE_BASE_IDS="app123,app456"
export AIRTABLE_TABLE_IDS="tbl123,tbl456"
export AIRTABLE_POLL_INTERVAL_MINUTES="5"
```

4. **Run the resolver**:
```bash
agent run
```

## API Endpoints

The resolver uses the Airtable REST API:
- **Base URL**: `https://api.airtable.com/v0`
- **Metadata Endpoint**: `/meta/bases/{baseId}/...`
- **Data Endpoint**: `/{baseId}/{tableId}/...`
- **Authentication**: Bearer token (Personal Access Token)

## Field Types

Airtable supports various field types. When creating or updating records, ensure your field values match the expected type:
- `singleLineText`, `multilineText`: String values
- `email`: Email address string
- `url`: URL string
- `number`: Numeric values
- `percent`: Numeric values (0-100)
- `currency`: Numeric values
- `singleSelect`, `multipleSelects`: String or array of strings
- `date`: ISO 8601 date string
- `checkbox`: Boolean values
- `phoneNumber`: Phone number string
- `multipleRecordLinks`: Array of record IDs
- And more...

Refer to [Airtable API documentation](https://airtable.com/developers/web/api/field-model) for complete field type reference.

