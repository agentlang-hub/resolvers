# Expensify Resolver for Agentlang

An Expensify expense management resolver for Agentlang that provides full CRUD operations and real-time subscriptions for expenses, reports, and policies.

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

The resolver requires Expensify API credentials:

| Variable | Description | Example |
|----------|-------------|---------|
| `EXPENSIFY_PARTNER_USER_ID` | Expensify Partner User ID | `your-partner-user-id` |
| `EXPENSIFY_PARTNER_USER_SECRET` | Expensify Partner User Secret | `your-partner-user-secret` |

### Optional Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `EXPENSIFY_POLL_INTERVAL_MINUTES` | Polling interval for subscriptions | `15` | `10` |

### Getting Expensify Credentials

1. Go to [Expensify Integrations](https://www.expensify.com/tools/integrations/)
2. Generate your `partnerUserID` and `partnerUserSecret`
3. Store these securely, as they won't be displayed again
4. Set them as environment variables:
   ```bash
   export EXPENSIFY_PARTNER_USER_ID="your-partner-user-id"
   export EXPENSIFY_PARTNER_USER_SECRET="your-partner-user-secret"
   ```

### API Rate Limits

Expensify's API has rate limits:
- Up to 5 requests every 10 seconds
- Up to 20 requests every 60 seconds

Exceeding these limits may result in a 429 error. The resolver includes error handling for rate limits.

## API Reference

### Expenses

#### Create Expense
```http
POST /expensify/Expense
Content-Type: application/json

{
    "merchant": "Starbucks",
    "amount": 5.50,
    "currency": "USD",
    "category": "Meals & Entertainment",
    "employee_email": "employee@example.com",
    "comment": "Coffee meeting",
    "expense_type": "business",
    "report_id": "123456",
    "tag": "client-meeting"
}
```

#### Query Expense
```http
GET /expensify/Expense/{id}
```

#### Query All Expenses
```http
GET /expensify/Expense
```

#### Update Expense
```http
PATCH /expensify/Expense
Content-Type: application/json

{
    "id": "789012",
    "merchant": "Updated Merchant",
    "amount": 10.00,
    "category": "Travel"
}
```

#### Delete Expense
```http
DELETE /expensify/Expense
Content-Type: application/json

{
    "id": "789012"
}
```

### Reports

#### Create Report
```http
POST /expensify/Report
Content-Type: application/json

{
    "report_name": "Q4 Business Expenses",
    "employee_email": "employee@example.com",
    "policy_id": "policy123"
}
```

#### Query Report
```http
GET /expensify/Report/{id}
```

#### Query All Reports
```http
GET /expensify/Report
```

#### Update Report
```http
PATCH /expensify/Report
Content-Type: application/json

{
    "id": "report456",
    "report_name": "Updated Report Name",
    "policy_id": "policy789"
}
```

#### Delete Report
```http
DELETE /expensify/Report
Content-Type: application/json

{
    "id": "report456"
}
```

### Policies

#### Create Policy
```http
POST /expensify/Policy
Content-Type: application/json

{
    "name": "Company Travel Policy",
    "output_currency": "USD",
    "owner_email": "admin@example.com"
}
```

#### Query Policy
```http
GET /expensify/Policy/{id}
```

#### Query All Policies
```http
GET /expensify/Policy
```

#### Update Policy
```http
PATCH /expensify/Policy
Content-Type: application/json

{
    "id": "policy123",
    "name": "Updated Policy Name",
    "output_currency": "EUR"
}
```

#### Delete Policy
```http
DELETE /expensify/Policy
Content-Type: application/json

{
    "id": "policy123"
}
```

## Setup Instructions

1. **Clone the repository** and navigate to the expensify directory:
```bash
cd expensify
```

2. **Install dependencies**:
```bash
pnpm install
```

3. **Set environment variables**:
```bash
export EXPENSIFY_PARTNER_USER_ID="your-partner-user-id"
export EXPENSIFY_PARTNER_USER_SECRET="your-partner-user-secret"
export EXPENSIFY_POLL_INTERVAL_MINUTES="15"  # Optional
```

4. **Run the resolver**:
```bash
agent run
```

## API Details

### Authentication

The resolver uses Expensify's Partner User ID and Partner User Secret for authentication. All requests are sent to:
```
https://integrations.expensify.com/Integration-Server/ExpensifyIntegrations
```

### Request Format

All API requests use a JSON payload with a `requestJobDescription` structure:
```json
{
    "requestJobDescription": {
        "type": "get|create|update|delete",
        "credentials": {
            "partnerUserID": "your-id",
            "partnerUserSecret": "your-secret"
        },
        "inputSettings": {
            "type": "expenses|reports|policies",
            // Additional settings based on operation
        }
    }
}
```

### Response Format

Expensify API responses follow this structure:
```json
{
    "responseCode": 200,
    "responseObject": {
        // Response data
    }
}
```

The resolver automatically extracts the `responseObject` and handles error cases.

## Entity Descriptions

### Expense
Individual expense items with details like merchant, amount, category, and receipt information. Expenses can be associated with reports and policies.

### Report
Expense reports that contain multiple expenses and track approval status, submission dates, and reimbursement information.

### Policy
Company expense policies that define rules, settings, currency, and other configuration options for expense management.

## Error Handling

The resolver includes comprehensive error handling for:
- Network errors (timeouts, connection failures)
- API errors (rate limits, authentication failures)
- Invalid requests (missing required fields)
- Response parsing errors

All errors are logged with detailed information for debugging.

