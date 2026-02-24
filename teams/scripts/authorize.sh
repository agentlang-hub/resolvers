#!/usr/bin/env bash
#
# Get the OAuth authorization URL from integration-manager and open it.
#
# Usage:
#   ./scripts/authorize.sh
#
# Optionally set INTEG_MANAGER_HOST (default: http://localhost:8085).

set -euo pipefail

HOST="${INTEG_MANAGER_HOST:-http://localhost:8085}"

echo "==> Requesting authorization URL from integration-manager..."
RESPONSE=$(curl -sf "$HOST/integmanager.auth/oauthFlow?action=authorize&integrationName=teams")

# Extract the authorizationUrl from the JSON response
AUTH_URL=$(echo "$RESPONSE" | grep -o '"authorizationUrl":"[^"]*"' | cut -d'"' -f4)

if [ -z "$AUTH_URL" ]; then
    echo "Failed to extract authorization URL from response:"
    echo "$RESPONSE"
    exit 1
fi

echo ""
echo "Open this URL in your browser to sign in and consent:"
echo ""
echo "  $AUTH_URL"
echo ""

# Try to open in browser (macOS / Linux)
if command -v open &>/dev/null; then
    echo "Opening in default browser..."
    open "$AUTH_URL"
elif command -v xdg-open &>/dev/null; then
    echo "Opening in default browser..."
    xdg-open "$AUTH_URL"
else
    echo "(Could not auto-open browser — copy the URL above.)"
fi

echo ""
echo "After signing in and consenting, the OAuth callback will complete automatically."
echo "Then run ./scripts/smoke-test.sh to verify the integration."
