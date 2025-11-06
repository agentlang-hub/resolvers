# HubSpot Resolver for Agentlang

A HubSpot CRM resolver for Agentlang that provides full CRUD operations and real-time subscriptions for contacts, companies, deals, owners, and tasks.

## Quick Start

### Prerequisites

1. Install Agentlang CLI globally:
```bash
pnpm install -g agentlangcli
```

2. Set up environment variables (see [Environment Variables](#environment-variables) section)

3. Run the resolver:
```bash
agent run
```

## Environment Variables

The following environment variables are required:

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `HUBSPOT_ACCESS_TOKEN` | HubSpot API access token | `pat-na1-12345678-1234-1234-1234-123456789abc` |
| `HUBSPOT_BASE_URL` | HubSpot API base URL (optional) | `https://api.hubapi.com` |

### Optional Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `HUBSPOT_POLL_INTERVAL_MINUTES` | Polling interval for subscriptions | `15` | `10` |

### Getting HubSpot Access Token

1. Go to [HubSpot Developer Portal](https://developers.hubspot.com/)
2. Create a new private app or use an existing one
3. Generate an access token with the required scopes:
   - `crm.objects.contacts.read`
   - `crm.objects.contacts.write`
   - `crm.objects.companies.read`
   - `crm.objects.companies.write`
   - `crm.objects.deals.read`
   - `crm.objects.deals.write`
   - `crm.objects.tasks.read`
   - `crm.objects.tasks.write`
   - `crm.schemas.contacts.read`
   - `crm.schemas.companies.read`
   - `crm.schemas.deals.read`
   - `crm.schemas.tasks.read`
   - `crm.users.owners.read`
   - `crm.users.owners.write`

## 🔧 API Reference

### Contacts

#### Create Contact
```http
POST /hubspot/Contact
Content-Type: application/json

{
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    "job_title": "Software Engineer",
    "lead_status": "NEW",
    "lifecycle_stage": "lead",
    "salutation": "Mr.",
    "mobile_phone_number": "+1234567890",
    "website_url": "https://johndoe.com",
    "owner": "123456789"
}
```

#### Query Contact
```http
GET /hubspot/Contact/{id}
```

#### Query All Contacts
```http
GET /hubspot/Contact
```

#### Update Contact
```http
PATCH /hubspot/Contact
Content-Type: application/json

{
    "id": "123456789",
    "first_name": "Jane",
    "last_name": "Smith",
    "email": "jane.smith@example.com",
    "job_title": "Product Manager"
}
```

#### Delete Contact
```http
DELETE /hubspot/Contact
Content-Type: application/json

{
    "id": "123456789"
}
```

### Companies

#### Create Company
```http
POST /hubspot/Company
Content-Type: application/json

{
    "name": "Acme Corporation",
    "industry": "Technology",
    "description": "Leading technology company",
    "country": "United States",
    "city": "San Francisco",
    "lead_status": "NEW",
    "lifecycle_stage": "lead",
    "owner": "123456789",
    "year_founded": "2020",
    "website_url": "https://acme.com"
}
```

#### Query Company
```http
GET /hubspot/Company/{id}
```

#### Query All Companies
```http
GET /hubspot/Company
```

#### Update Company
```http
PATCH /hubspot/Company
Content-Type: application/json

{
    "id": "123456789",
    "name": "Acme Corp",
    "industry": "Software",
    "description": "Updated description"
}
```

#### Delete Company
```http
DELETE /hubspot/Company
Content-Type: application/json

{
    "id": "123456789"
}
```

### Deals

#### Create Deal
```http
POST /hubspot/Deal
Content-Type: application/json

{
    "deal_name": "Enterprise Contract",
    "deal_stage": "qualifiedtobuy",
    "amount": "50000",
    "close_date": "2024-12-31",
    "deal_type": "newbusiness",
    "description": "Large enterprise deal",
    "owner": "123456789",
    "pipeline": "default",
    "priority": "high"
}
```

#### Query Deal
```http
GET /hubspot/Deal/{id}
```

#### Query All Deals
```http
GET /hubspot/Deal
```

#### Update Deal
```http
PATCH /hubspot/Deal
Content-Type: application/json

{
    "id": "123456789",
    "deal_name": "Updated Deal Name",
    "amount": "75000",
    "deal_stage": "closedwon"
}
```

#### Delete Deal
```http
DELETE /hubspot/Deal
Content-Type: application/json

{
    "id": "123456789"
}
```

### Owners

#### Create Owner
```http
POST /hubspot/Owner
Content-Type: application/json

{
    "email": "owner@example.com",
    "first_name": "John",
    "last_name": "Owner"
}
```

#### Query Owner
```http
GET /hubspot/Owner/{id}
```

#### Query All Owners
```http
GET /hubspot/Owner
```

#### Update Owner
```http
PATCH /hubspot/Owner
Content-Type: application/json

{
    "id": "123456789",
    "email": "updated@example.com",
    "first_name": "Jane"
}
```

#### Delete Owner
```http
DELETE /hubspot/Owner
Content-Type: application/json

{
    "id": "123456789"
}
```

### Tasks

#### Create Task
```http
POST /hubspot/Task
Content-Type: application/json

{
    "task_type": "CALL",
    "title": "Follow up with client",
    "priority": "HIGH",
    "assigned_to": "123456789",
    "due_date": "2024-12-31T23:59:59Z",
    "status": "NOT_STARTED",
    "description": "Call client about proposal",
    "owner": "123456789"
}
```

#### Query Task
```http
GET /hubspot/Task/{id}
```

#### Query All Tasks
```http
GET /hubspot/Task
```

#### Update Task
```http
PATCH /hubspot/Task
Content-Type: application/json

{
    "id": "123456789",
    "title": "Updated task title",
    "status": "IN_PROGRESS",
    "priority": "MEDIUM"
}
```

#### Delete Task
```http
DELETE /hubspot/Task
Content-Type: application/json

{
    "id": "123456789"
}
```

## Setup Instructions

1. **Clone the repository** and navigate to the hubspot directory:
```bash
cd hubspot
```

2. **Install dependencies**:
```bash
pnpm install
```

3. **Set environment variables**:
```bash
export HUBSPOT_ACCESS_TOKEN="your-access-token-here"
export HUBSPOT_BASE_URL="https://api.hubapi.com"  # Optional
export HUBSPOT_POLL_INTERVAL_MINUTES="15"  # Optional
```

4. **Run the resolver**:
```bash
agent run
```