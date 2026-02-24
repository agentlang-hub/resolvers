#!/usr/bin/env bash
#
# Smoke-test all 6 teams resolver operations against a running agentlang app.
#
# Usage:
#   ./scripts/smoke-test.sh [DM_USER_ID]
#
# DM_USER_ID is optional — the user ID or email to send a direct message to.
# If omitted, the sendDirectMessage test is skipped.
#
# Optionally set AL_HOST (default: http://localhost:8080).

set -euo pipefail

AL_HOST="${AL_HOST:-http://localhost:8080}"
DM_USER="${1:-}"
PASS=0
FAIL=0

green() { printf "\033[32m%s\033[0m\n" "$1"; }
red()   { printf "\033[31m%s\033[0m\n" "$1"; }
bold()  { printf "\033[1m%s\033[0m\n" "$1"; }

check() {
    local label="$1" response="$2"
    if echo "$response" | grep -q '"error"'; then
        red "  FAIL: $label"
        echo "    $response"
        FAIL=$((FAIL + 1))
        return 1
    else
        green "  PASS: $label"
        PASS=$((PASS + 1))
        return 0
    fi
}

bold "=== Teams Resolver Smoke Test ==="
echo "Target: $AL_HOST"
echo ""

# --- 1. joinedTeams ---
bold "1. joinedTeams"
TEAMS_RESPONSE=$(curl -sf -X POST "$AL_HOST/teams/joinedTeams" \
    -H "Content-Type: application/json" \
    -d '{}')
echo "  Response: $(echo "$TEAMS_RESPONSE" | head -c 200)"
check "joinedTeams" "$TEAMS_RESPONSE" || true

# Extract first team ID
TEAM_ID=$(echo "$TEAMS_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -z "$TEAM_ID" ]; then
    red "  No team found — cannot continue channel/message tests."
    echo ""
    bold "Results: $PASS passed, $FAIL failed"
    exit 1
fi
echo "  Using team: $TEAM_ID"
echo ""

# --- 2. listChannels ---
bold "2. listChannels"
CHANNELS_RESPONSE=$(curl -sf -X POST "$AL_HOST/teams/listChannels" \
    -H "Content-Type: application/json" \
    -d "{\"teamId\": \"$TEAM_ID\"}")
echo "  Response: $(echo "$CHANNELS_RESPONSE" | head -c 200)"
check "listChannels" "$CHANNELS_RESPONSE" || true

# Extract first channel ID
CHANNEL_ID=$(echo "$CHANNELS_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -z "$CHANNEL_ID" ]; then
    red "  No channel found — cannot continue message tests."
    echo ""
    bold "Results: $PASS passed, $FAIL failed"
    exit 1
fi
echo "  Using channel: $CHANNEL_ID"
echo ""

# --- 3. sendChannelMessage ---
bold "3. sendChannelMessage"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
MSG_RESPONSE=$(curl -sf -X POST "$AL_HOST/teams/sendChannelMessage" \
    -H "Content-Type: application/json" \
    -d "{\"teamId\": \"$TEAM_ID\", \"channelId\": \"$CHANNEL_ID\", \"message\": \"Smoke test from agentlang at $TIMESTAMP\"}")
echo "  Response: $MSG_RESPONSE"
check "sendChannelMessage" "$MSG_RESPONSE" || true

# Extract message ID for threading
MSG_ID=$(echo "$MSG_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
# If the response is just a plain string ID (not JSON object), use it directly
if [ -z "$MSG_ID" ]; then
    MSG_ID=$(echo "$MSG_RESPONSE" | tr -d '"' | tr -d '{}' | tr -d ' ')
fi
echo ""

# --- 4. replyToThread ---
if [ -n "$MSG_ID" ]; then
    bold "4. replyToThread"
    REPLY_RESPONSE=$(curl -sf -X POST "$AL_HOST/teams/replyToThread" \
        -H "Content-Type: application/json" \
        -d "{\"teamId\": \"$TEAM_ID\", \"channelId\": \"$CHANNEL_ID\", \"messageId\": \"$MSG_ID\", \"message\": \"Threaded reply from smoke test\"}")
    echo "  Response: $REPLY_RESPONSE"
    check "replyToThread" "$REPLY_RESPONSE" || true
    echo ""

    # --- 5. listThreadReplies ---
    bold "5. listThreadReplies"
    # Small delay to let the reply propagate
    sleep 2
    REPLIES_RESPONSE=$(curl -sf -X POST "$AL_HOST/teams/listThreadReplies" \
        -H "Content-Type: application/json" \
        -d "{\"teamId\": \"$TEAM_ID\", \"channelId\": \"$CHANNEL_ID\", \"messageId\": \"$MSG_ID\"}")
    echo "  Response: $(echo "$REPLIES_RESPONSE" | head -c 200)"
    check "listThreadReplies" "$REPLIES_RESPONSE" || true
    echo ""
else
    red "4. replyToThread — SKIPPED (no message ID from step 3)"
    red "5. listThreadReplies — SKIPPED (no message ID from step 3)"
    FAIL=$((FAIL + 2))
    echo ""
fi

# --- 6. sendDirectMessage ---
if [ -n "$DM_USER" ]; then
    bold "6. sendDirectMessage"
    DM_RESPONSE=$(curl -sf -X POST "$AL_HOST/teams/sendDirectMessage" \
        -H "Content-Type: application/json" \
        -d "{\"userId\": \"$DM_USER\", \"message\": \"DM smoke test from agentlang at $TIMESTAMP\"}")
    echo "  Response: $DM_RESPONSE"
    check "sendDirectMessage" "$DM_RESPONSE" || true
else
    bold "6. sendDirectMessage — SKIPPED (no DM_USER_ID argument)"
    echo "  Pass a user ID or email as argument to test: ./scripts/smoke-test.sh user@example.com"
fi

echo ""
bold "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
