# Zoho Expense Agentlang Resolver

Lightweight Agentlang resolver for the Zoho Expense v1 API. Supports direct token usage or OAuth2 (auth code) exchange, and requires your Zoho organization ID. The API base defaults to `https://www.zohoapis.com`.

## Setup

1. Install dependencies (if any):
```bash
pnpm install
```

2. Provide authentication and org details via environment variables:

**Option A: Direct access token**
```bash
export ZOHO_EXPENSE_ACCESS_TOKEN="<access_token>"
export ZOHO_EXPENSE_ORG_ID="<organization_id>"
```

**Option B: OAuth2 authorization code exchange**
```bash
export ZOHO_EXPENSE_CLIENT_ID="<client_id>"
export ZOHO_EXPENSE_CLIENT_SECRET="<client_secret>"
export ZOHO_EXPENSE_AUTH_CODE="<one_time_auth_code>"
export ZOHO_EXPENSE_REDIRECT_URL="<redirect_url_registered_with_zoho>"
export ZOHO_EXPENSE_ORG_ID="<organization_id>"
```

Optional:
```bash
export ZOHO_EXPENSE_REFRESH_TOKEN="<refresh_token_if_available>"
export ZOHO_EXPENSE_BASE_URL="https://www.zohoapis.com"      # defaults to this
export ZOHO_EXPENSE_ACCOUNTS_URL="https://accounts.zoho.com" # derived from base by default
export ZOHO_EXPENSE_TIMEOUT_MS="30000"                       # request timeout in ms
```

3. Run the resolver:
```bash
agent run
```

## Entities and Operations

- `Expense`: query list/single, create.
- `Report`: query list/single.
- `Currency`: query list/single.
- `ExpenseCategory`: query list/single.

## Notes

- All requests automatically append `organization_id` to the Zoho Expense endpoints.
- Authorization uses `Zoho-oauthtoken <token>` header.
- The resolver will cache OAuth tokens until expiry and will refresh when a refresh token is provided. If only an auth code is provided, it will exchange it once and cache the result for the process lifetime.

