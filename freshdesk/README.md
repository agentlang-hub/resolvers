# Freshdesk Agentlang Resolver

Agentlang resolver for Freshdesk integration, providing full CRUD operations and real-time subscriptions for tickets, contacts, agents, companies, and groups.

## Quick Start

1. **Install dependencies**:
```bash
pnpm install
```

2. **Set environment variables**:
```bash
export FRESHDESK_DOMAIN="your-domain"
export FRESHDESK_BASE_URL="https://your-domain.freshdesk.com"  # Optional, auto-generated if not set
export FRESHDESK_API_KEY="your-api-key"
export FRESHDESK_POLL_INTERVAL_MINUTES="5"  # Optional
```

3. **Run the resolver**:
```bash
agent run
```

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `FRESHDESK_DOMAIN` | Your Freshdesk domain (without .freshdesk.com) | `yourcompany` |
| `FRESHDESK_BASE_URL` | Your Freshdesk instance URL | `https://yourcompany.freshdesk.com` (optional, auto-generated) |
| `FRESHDESK_API_KEY` | Your Freshdesk API key | `your-api-key` |
| `FRESHDESK_POLL_INTERVAL_MINUTES` | Polling interval for subscriptions | `5` |

### Getting Freshdesk Credentials

1. Log in to your Freshdesk account
2. Click on your profile picture in the top right corner
3. Select "Profile Settings"
4. On the right pane, click on "View API Key"
5. Complete the captcha verification
6. Copy the generated API key
7. Your domain is the part before `.freshdesk.com` in your Freshdesk URL

## API Reference

### Tickets

#### Create Ticket
```http
POST /freshdesk/Ticket
{
    "subject": "Support request",
    "description": "I need help with...",
    "email": "customer@example.com",
    "priority": "1",
    "status": "2",
    "type": "Question",
    "tags": "urgent,support",
    "group_id": "123",
    "responder_id": "456",
    "company_id": "789"
}
```

#### Query Tickets
```http
GET /freshdesk/Ticket
GET /freshdesk/Ticket/{id}
```

#### Update Ticket
```http
PATCH /freshdesk/Ticket/{id}
{
    "subject": "Updated subject",
    "status": "3",
    "priority": "2",
    "tags": "resolved"
}
```

#### Delete Ticket
```http
DELETE /freshdesk/Ticket/{id}
```

### Contacts

#### Create Contact
```http
POST /freshdesk/Contact
{
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "mobile": "+1234567890",
    "company_id": "123",
    "job_title": "Manager",
    "address": "123 Main St"
}
```

#### Query Contacts
```http
GET /freshdesk/Contact
GET /freshdesk/Contact/{id}
```

#### Update Contact
```http
PATCH /freshdesk/Contact/{id}
{
    "name": "Jane Doe",
    "phone": "+9876543210"
}
```

#### Delete Contact
```http
DELETE /freshdesk/Contact/{id}
```

### Agents

#### Query Agents
```http
GET /freshdesk/Agent
GET /freshdesk/Agent/{id}
```

### Companies

#### Create Company
```http
POST /freshdesk/Company
{
    "name": "Acme Corp",
    "description": "A leading company",
    "note": "Important client",
    "domains": "acme.com,acmecorp.com",
    "industry": "Technology"
}
```

#### Query Companies
```http
GET /freshdesk/Company
GET /freshdesk/Company/{id}
```

#### Update Company
```http
PATCH /freshdesk/Company/{id}
{
    "name": "Updated Company Name",
    "description": "New description"
}
```

#### Delete Company
```http
DELETE /freshdesk/Company/{id}
```

### Groups

#### Query Groups
```http
GET /freshdesk/Group
GET /freshdesk/Group/{id}
```

### Create Ticket Action

#### Create Ticket
```http
POST /freshdesk/CreateTicketInput
{
    "subject": "New support ticket",
    "description": "Issue description",
    "email": "customer@example.com",
    "priority": "1",
    "status": "2"
}
```

#### Query Create Ticket
```http
GET /freshdesk/CreateTicketOutput/{id}
```

### Create Contact Action

#### Create Contact
```http
POST /freshdesk/CreateContactInput
{
    "name": "New Contact",
    "email": "contact@example.com",
    "phone": "+1234567890"
}
```

#### Query Create Contact
```http
GET /freshdesk/CreateContactOutput/{id}
```

## Data Models

### Ticket
- `id`: String (unique identifier)
- `created_at`: String (creation timestamp)
- `updated_at`: String (last modification timestamp)
- `subject`: String (ticket subject)
- `description`: String (ticket description)
- `status`: String (ticket status: 2=Open, 3=Pending, 4=Resolved, 5=Closed)
- `priority`: String (ticket priority: 1=Low, 2=Medium, 3=High, 4=Urgent)
- `type`: String (ticket type)
- `source`: String (ticket source)
- `requester_id`: String (requester ID)
- `responder_id`: String (assigned agent ID)
- `group_id`: String (assigned group ID)
- `company_id`: String (associated company ID)
- `tags`: String (comma-separated tags)
- `url`: String (API URL)
- `web_url`: String (browser URL)

### Contact
- `id`: String (unique identifier)
- `created_at`: String (creation timestamp)
- `updated_at`: String (last modification timestamp)
- `name`: String (contact name)
- `email`: String (email address)
- `phone`: String (phone number)
- `mobile`: String (mobile number)
- `company_id`: String (associated company ID)
- `job_title`: String (job title)
- `active`: Boolean (is contact active)
- `address`: String (address)

### Agent
- `id`: String (unique identifier)
- `created_at`: String (creation timestamp)
- `updated_at`: String (last modification timestamp)
- `email`: String (email address)
- `name`: String (agent name)
- `active`: Boolean (is agent active)
- `job_title`: String (job title)
- `phone`: String (phone number)
- `mobile`: String (mobile number)
- `time_zone`: String (timezone)
- `role`: String (agent role)

### Company
- `id`: String (unique identifier)
- `created_at`: String (creation timestamp)
- `updated_at`: String (last modification timestamp)
- `name`: String (company name)
- `description`: String (company description)
- `note`: String (internal notes)
- `domains`: String (comma-separated domains)
- `industry`: String (industry)
- `custom_fields`: Object (custom field values)

### Group
- `id`: String (unique identifier)
- `created_at`: String (creation timestamp)
- `updated_at`: String (last modification timestamp)
- `name`: String (group name)
- `description`: String (group description)
- `agent_ids`: String (comma-separated agent IDs)

## Subscriptions

The resolver supports real-time subscriptions for:
- **Tickets**: Monitors ticket changes and updates
- **Contacts**: Tracks contact updates
- **Agents**: Monitors agent changes
- **Companies**: Tracks company updates
- **Groups**: Monitors group changes

Subscriptions are configured via the `FRESHDESK_POLL_INTERVAL_MINUTES` environment variable (default: 5 minutes).

## Error Handling

The resolver provides comprehensive error handling:
- **Authentication Errors**: Clear messages for API key failures
- **API Errors**: Detailed error information from Freshdesk API
- **Network Errors**: Timeout and connection error handling
- **Validation Errors**: Input validation with helpful messages

## Logging

All operations are logged with the `FRESHDESK RESOLVER:` prefix:
- Request/response logging
- Error logging with context
- Subscription activity logging
- Authentication status logging

## Security

- **Token Management**: Secure API key handling
- **Environment Variables**: Sensitive data stored in environment variables
- **HTTPS Only**: All API calls use HTTPS
- **Basic Auth**: Uses API key with Basic authentication

## Freshdesk API Rate Limits

The resolver respects Freshdesk API rate limits:
- **Free plan**: 500 requests per hour
- **Growth plan**: 1000 requests per hour
- **Pro plan**: 2000 requests per hour
- **Enterprise plan**: 5000 requests per hour

## Setup

1. **Clone the repository**:
```bash
git clone <repository-url>
cd freshdesk-resolver
```

2. **Install dependencies**:
```bash
pnpm install
```

3. **Set environment variables**:
```bash
export FRESHDESK_DOMAIN="yourcompany"
export FRESHDESK_BASE_URL="https://yourcompany.freshdesk.com"
export FRESHDESK_API_KEY="your-api-key"
export FRESHDESK_POLL_INTERVAL_MINUTES="5"
```

4. **Run the resolver**:
```bash
agent run
```

## API Endpoints

The resolver uses the Freshdesk REST API v2:
- **Base URL**: `https://{domain}.freshdesk.com/api/v2`
- **Authentication**: Basic auth with API key
- **Format**: JSON

## Ticket Status Values

- `2`: Open
- `3`: Pending
- `4`: Resolved
- `5`: Closed

## Ticket Priority Values

- `1`: Low
- `2`: Medium
- `3`: High
- `4`: Urgent

## Ticket Source Values

- `1`: Email
- `2`: Portal
- `3`: Phone
- `4`: Chat
- `5`: Feedback widget
- `6`: Outbound email
- `7`: Mobihelp

## Notes

- All IDs are converted to strings for consistency
- Tags are handled as comma-separated strings
- Domains are handled as comma-separated strings
- Agent IDs in groups are handled as comma-separated strings
- The resolver automatically handles pagination for list queries (limited to 100 records per query)

