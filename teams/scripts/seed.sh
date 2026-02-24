#!/usr/bin/env bash
#
# Seed integration-manager with the Microsoft Teams OAuth2 integration.
#
# Usage:
#   ./scripts/seed.sh <CLIENT_ID> <CLIENT_SECRET>
#
# Optionally set INTEG_MANAGER_HOST (default: http://localhost:8085)
# and REDIRECT_URI (default: http://localhost:8280/oauth/callback).

set -euo pipefail

CLIENT_ID="${1:?Usage: $0 <CLIENT_ID> <CLIENT_SECRET>}"
CLIENT_SECRET="${2:?Usage: $0 <CLIENT_ID> <CLIENT_SECRET>}"
HOST="${INTEG_MANAGER_HOST:-http://localhost:8085}"
REDIRECT_URI="${REDIRECT_URI:-http://localhost:8280/oauth/callback}"

echo "==> Creating integration 'teams'..."
curl -sf -X POST "$HOST/integmanager.core/integration" \
  -H "Content-Type: application/json" \
  -d '{"name": "teams"}' \
  && echo " OK" || echo " (may already exist)"

echo "==> Creating OAuth2 config entry..."
curl -sf -X POST "$HOST/integmanager.core/integration/teams/integrationConfig/config" \
  -H "Content-Type: application/json" \
  -d '{"name": "graph-oauth", "type": "oauth-2.0"}' \
  && echo " OK" || echo " (may already exist)"

echo "==> Setting OAuth2 parameters..."
curl -sf -X POST "$HOST/integmanager.core/integration/teams/integrationConfig/config/graph-oauth/configOAuth2/oauth2Config" \
  -H "Content-Type: application/json" \
  -d "{
    \"clientId\": \"$CLIENT_ID\",
    \"clientSecret\": \"$CLIENT_SECRET\",
    \"authorizationUrl\": \"https://login.microsoftonline.com/common/oauth2/v2.0/authorize\",
    \"tokenUrl\": \"https://login.microsoftonline.com/common/oauth2/v2.0/token\",
    \"scopes\": \"ChannelMessage.Send,ChannelMessage.Read.All,Team.ReadBasic.All,Channel.ReadBasic.All,Chat.Create,ChatMessage.Send,offline_access\",
    \"redirectUri\": \"$REDIRECT_URI\",
    \"grantType\": \"authorization_code\",
    \"pkce\": true
  }" \
  && echo " OK" || { echo " FAILED"; exit 1; }

echo ""
echo "Done. Next step: run ./scripts/authorize.sh to complete the OAuth flow."
