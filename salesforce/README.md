# Salesforce Resolver for Agentlang

A Salesforce CRM resolver for Agentlang that provides full CRUD operations and real-time subscriptions for contacts, leads, accounts, opportunities, tickets, and articles.

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

The resolver supports two authentication methods:

### Method 1: Direct Access Token (Recommended for testing)

| Variable | Description | Example |
|----------|-------------|---------|
| `SALESFORCE_ACCESS_TOKEN` | Salesforce API access token | `00D000000000000!AR8AM1...` |
| `SALESFORCE_BASE_URL` or `SALESFORCE_INSTANCE_URL` | Salesforce instance URL | `https://your-instance.salesforce.com` |

### Method 2: OAuth2 Client Credentials (Recommended for production)

| Variable | Description | Example |
|----------|-------------|---------|
| `SALESFORCE_CLIENT_ID` | Connected App Client ID | `your-id-token` |
| `SALESFORCE_CLIENT_SECRET` | Connected App Client Secret | `your-app-client-secret` |
| `SALESFORCE_BASE_URL` or `SALESFORCE_INSTANCE_URL` | Salesforce instance URL | `https://your-instance.salesforce.com` |

### Optional Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `SALESFORCE_POLL_INTERVAL_MINUTES` | Polling interval for subscriptions | `15` | `10` |

### Getting Salesforce Credentials

#### For Direct Access Token:
1. Go to [Salesforce Developer Console](https://developer.salesforce.com/)
2. Create a new connected app or use an existing one
3. Generate an access token with the required permissions:
   - `api` - Access and manage your data
   - `offline_access` - Perform requests on your behalf at any time
   - `refresh_token` - Refresh access tokens

#### For OAuth2 Client Credentials:
1. Go to [Salesforce Setup](https://your-instance.salesforce.com/setup)
2. Navigate to **App Manager** → **New Connected App**
3. Fill in the required fields:
   - **Connected App Name**: Your app name
   - **API Name**: Your API name
   - **Contact Email**: Your email
4. In **API (Enable OAuth Settings)**:
   - Check **Enable OAuth Settings**
   - **Callback URL**: `http://localhost:8080/callback` (or your callback URL)
   - **Selected OAuth Scopes**: Add `Access and manage your data (api)`
5. Save and get your **Consumer Key** (Client ID) and **Consumer Secret** (Client Secret)
6. The resolver will automatically fetch access tokens using these credentials

### OAuth2 Authentication Flow

The resolver automatically handles OAuth2 authentication when using client credentials:

1. **Token Request**: When no direct access token is provided, the resolver makes a POST request to `/services/oauth2/token`
2. **Client Credentials**: Uses `grant_type=client_credentials` with your client ID and secret
3. **Token Caching**: Automatically caches the access token and refreshes it before expiry
4. **Error Handling**: Provides clear error messages if authentication fails

**Example OAuth2 Request:**
```bash
curl --location --request POST 'https://your-instance.salesforce.com/services/oauth2/token?grant_type=client_credentials&client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET'
```

## API Reference

### Contacts

#### Create Contact
```http
POST /salesforce/Contact
Content-Type: application/json

{
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    "account_id": "001000000000000",
    "owner_id": "005000000000000",
    "mobile": "+1234567890",
    "phone": "+1234567890",
    "salutation": "Mr.",
    "title": "Software Engineer"
}
```

#### Query Contact
```http
GET /salesforce/Contact/{id}
```

#### Query All Contacts
```http
GET /salesforce/Contact
```

#### Update Contact
```http
PATCH /salesforce/Contact
Content-Type: application/json

{
    "id": "003000000000000",
    "first_name": "Jane",
    "last_name": "Smith",
    "email": "jane.smith@example.com",
    "title": "Product Manager"
}
```

#### Delete Contact
```http
DELETE /salesforce/Contact
Content-Type: application/json

{
    "id": "003000000000000"
}
```

### Leads

#### Create Lead
```http
POST /salesforce/Lead
Content-Type: application/json

{
    "first_name": "John",
    "last_name": "Doe",
    "company_name": "Acme Corp",
    "email": "john.doe@acme.com",
    "phone": "+1234567890",
    "title": "CEO",
    "website": "https://acme.com",
    "industry": "Technology"
}
```

#### Query Lead
```http
GET /salesforce/Lead/{id}
```

#### Query All Leads
```http
GET /salesforce/Lead
```

#### Update Lead
```http
PATCH /salesforce/Lead
Content-Type: application/json

{
    "id": "00Q000000000000",
    "first_name": "Jane",
    "last_name": "Smith",
    "company_name": "Updated Corp"
}
```

#### Delete Lead
```http
DELETE /salesforce/Lead
Content-Type: application/json

{
    "id": "00Q000000000000"
}
```

### Accounts

#### Create Account
```http
POST /salesforce/Account
Content-Type: application/json

{
    "name": "Acme Corporation",
    "description": "Leading technology company",
    "website": "https://acme.com",
    "industry": "Technology",
    "billing_city": "San Francisco",
    "billing_country": "United States",
    "owner_id": "005000000000000"
}
```

#### Query Account
```http
GET /salesforce/Account/{id}
```

#### Query All Accounts
```http
GET /salesforce/Account
```

#### Update Account
```http
PATCH /salesforce/Account
Content-Type: application/json

{
    "id": "001000000000000",
    "name": "Acme Corp",
    "industry": "Software",
    "description": "Updated description"
}
```

#### Delete Account
```http
DELETE /salesforce/Account
Content-Type: application/json

{
    "id": "001000000000000"
}
```

### Opportunities

#### Create Opportunity
```http
POST /salesforce/Opportunity
Content-Type: application/json

{
    "opportunity_name": "Enterprise Contract",
    "account_id": "001000000000000",
    "amount": 50000,
    "description": "Large enterprise deal",
    "close_date": "2024-12-31",
    "stage": "Prospecting",
    "probability": 25,
    "type": "New Business",
    "owner_id": "005000000000000"
}
```

#### Query Opportunity
```http
GET /salesforce/Opportunity/{id}
```

#### Query All Opportunities
```http
GET /salesforce/Opportunity
```

#### Update Opportunity
```http
PATCH /salesforce/Opportunity
Content-Type: application/json

{
    "id": "006000000000000",
    "opportunity_name": "Updated Deal Name",
    "amount": 75000,
    "stage": "Negotiation/Review"
}
```

#### Delete Opportunity
```http
DELETE /salesforce/Opportunity
Content-Type: application/json

{
    "id": "006000000000000"
}
```

### Tickets (Cases)

#### Create Ticket
```http
POST /salesforce/Ticket
Content-Type: application/json

{
    "subject": "Login Issue",
    "account_id": "001000000000000",
    "contact_id": "003000000000000",
    "owner_id": "005000000000000",
    "priority": "High",
    "status": "New",
    "description": "User cannot login to the system",
    "type": "Problem",
    "origin": "Web"
}
```

#### Query Ticket
```http
GET /salesforce/Ticket/{id}
```

#### Query All Tickets
```http
GET /salesforce/Ticket
```

#### Update Ticket
```http
PATCH /salesforce/Ticket
Content-Type: application/json

{
    "id": "500000000000000",
    "subject": "Updated Issue",
    "status": "In Progress",
    "priority": "Medium"
}
```

#### Delete Ticket
```http
DELETE /salesforce/Ticket
Content-Type: application/json

{
    "id": "500000000000000"
}
```

### Articles

#### Create Article
```http
POST /salesforce/Article
Content-Type: application/json

{
    "title": "How to Reset Password",
    "content": "Step-by-step guide to reset your password..."
}
```

#### Query Article
```http
GET /salesforce/Article/{id}
```

#### Query All Articles
```http
GET /salesforce/Article
```

#### Update Article
```http
PATCH /salesforce/Article
Content-Type: application/json

{
    "id": "ka0000000000000",
    "title": "Updated Article Title",
    "content": "Updated content..."
}
```

#### Delete Article
```http
DELETE /salesforce/Article
Content-Type: application/json

{
    "id": "ka0000000000000"
}
```

## Setup Instructions

1. **Clone the repository** and navigate to the salesforce directory:
```bash
cd salesforce
```

2. **Install dependencies**:
```bash
pnpm install
```

3. **Set environment variables**:

**Option A: Direct Access Token (Testing)**
```bash
export SALESFORCE_ACCESS_TOKEN="your-access-token-here"
export SALESFORCE_BASE_URL="https://your-instance.salesforce.com"
export SALESFORCE_POLL_INTERVAL_MINUTES="15"  # Optional
```

**Option B: OAuth2 Client Credentials (Production)**
```bash
export SALESFORCE_CLIENT_ID="your-client-id-here"
export SALESFORCE_CLIENT_SECRET="your-client-secret-here"
export SALESFORCE_BASE_URL="https://your-instance.salesforce.com"
export SALESFORCE_POLL_INTERVAL_MINUTES="15"  # Optional
```

4. **Run the resolver**:
```bash
agent run
```
