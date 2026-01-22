## Zendesk Resolver for Agentlang

A Zendesk support resolver for Agentlang that offers CRUD operations and polling-based subscriptions for tickets, helpers for ticket comments, users, organizations, and Help Center content (categories, sections, articles).

### Quick Start
1) Install Agentlang CLI  
`pnpm install -g agentlangcli`
2) Set env vars (see below)  
3) Run the resolver  
`agent run`

### Environment Variables
| Variable | Description | Example |
|----------|-------------|---------|
| `ZENDESK_SUBDOMAIN` | Your Zendesk subdomain | `acme` |
| `ZENDESK_EMAIL` | Agent email with API token access | `agent@acme.com` |
| `ZENDESK_API_TOKEN` | Zendesk API token | `xxxx` |
| `ZENDESK_POLL_INTERVAL_MINUTES` | (Optional) Poll interval for subscriptions | `10` |

### Getting a Zendesk API Token
1) In Zendesk Admin Center, go to **Apps and integrations → APIs → Zendesk API**  
2) Enable **Token Access** and create a new token  
3) Copy the token once, store securely, and set it in `ZENDESK_API_TOKEN`  

### API (high level)
- Tickets: CRUD + subscribe (`zendesk/Ticket`)
- Ticket comments: add/list (`zendesk/TicketComment`)
- Users: CRUD (`zendesk/User`)
- Organizations: CRUD (`zendesk/Organization`)
- Help Center categories: CRUD (`zendesk/Category`)
- Help Center sections: CRUD (`zendesk/Section`)
- Help Center articles: CRUD (`zendesk/Article`, optional filter by `section_id` on query)
- Help Center user segments: CRUD (`zendesk/UserSegment`)
- Help Center permission groups: CRUD (`zendesk/PermissionGroup`)

### Setup
```
cd zendesk
pnpm install
export ZENDESK_SUBDOMAIN="acme"
export ZENDESK_EMAIL="agent@acme.com"
export ZENDESK_API_TOKEN="your-token"
agent run
```

### Notes
- Auth uses basic auth with `email/token:api_token`
- Subscriptions use polling; adjust `ZENDESK_POLL_INTERVAL_MINUTES` as needed
