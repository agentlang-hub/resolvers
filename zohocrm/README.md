# Zoho CRM Resolver for Agentlang

A Zoho CRM resolver inspired by the Zendesk resolver. It exposes CRUD operations for core CRM objects (leads, contacts, accounts, deals, tasks, and notes) using the Zoho CRM v2 REST API.

## Quick Start

1. Install Agentlang CLI (if not already):
   ```bash
   pnpm install -g agentlangcli
   ```
2. Export the required environment variables (see below).
3. Run the resolver from this directory:
   ```bash
   agent run
   ```

## Environment Variables

| Variable | Required | Description | Example |
| --- | --- | --- | --- |
| `ZOHO_CRM_ACCESS_TOKEN` | one of | Direct OAuth access token | `1000.xxxxxx` |
| `ZOHO_CRM_CLIENT_ID` | one of | OAuth client id (for code/refresh flow) | `1000.ABC` |
| `ZOHO_CRM_CLIENT_SECRET` | one of | OAuth client secret | `****` |
| `ZOHO_CRM_AUTH_CODE` | code flow | Authorization code (with redirect) | `1000.xxxx` |
| `ZOHO_CRM_REDIRECT_URL` | code flow | Redirect URL used to obtain code | `https://app/callback` |
| `ZOHO_CRM_REFRESH_TOKEN` | refresh flow | Refresh token | `1000.xxxx` |
| `ZOHO_CRM_BASE_URL` |  | API base (defaults to `https://www.zohoapis.com/crm/v2`) | `https://www.zohoapis.eu/crm/v2` |
| `ZOHO_CRM_ACCOUNTS_URL` |  | Accounts domain (defaults to `https://accounts.zoho.com`) | `https://accounts.zoho.eu` |
| `ZOHO_CRM_ORG_ID` |  | Optional org header for multi-org setups | `123456789` |
| `ZOHO_CRM_POLL_INTERVAL_MINUTES` |  | Poll interval for subscriptions (default 10) | `5` |

Authentication options (choose one):
- Supply `ZOHO_CRM_ACCESS_TOKEN` directly, **or**
- Provide `ZOHO_CRM_CLIENT_ID` + `ZOHO_CRM_CLIENT_SECRET` + `ZOHO_CRM_REFRESH_TOKEN`, **or**
- Provide `ZOHO_CRM_CLIENT_ID` + `ZOHO_CRM_CLIENT_SECRET` + `ZOHO_CRM_AUTH_CODE` + `ZOHO_CRM_REDIRECT_URL` (one-time exchange).

## Entities & Operations

- Leads, Contacts, Accounts, Deals, Tasks, Notes
- Operations: create, query (by id or list), update, delete
- Each resolver returns Agentlang instances for seamless agent tool use, and supports subscription polling (interval configurable via `ZOHO_CRM_POLL_INTERVAL_MINUTES`).

## Notes

- Default base URL targets the US data center; set `ZOHO_CRM_BASE_URL` for EU/IN/AU/CN.
