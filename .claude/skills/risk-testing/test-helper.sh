#!/bin/bash
# Risk Testing Helper Script
# Usage:
#   ./test-helper.sh auth                    # Authenticate and save token
#   ./test-helper.sh health                  # Health check
#   ./test-helper.sh call <action> [params] [filters]  # Call dashboard endpoint

COMMAND=${1:-"help"}
API_URL="http://localhost:6100"
ORG_SLUG="finance"
AGENT_SLUG="investment-risk-agent"
AUTH_FILE="/tmp/risk_test_auth.env"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Load auth if exists
if [ -f "$AUTH_FILE" ]; then
  source "$AUTH_FILE"
fi

case "$COMMAND" in
  "auth")
    echo -e "${YELLOW}Authenticating...${NC}"

    # Read credentials from .env
    EMAIL=$(grep -E "^SUPABASE_TEST_USER=" .env | cut -d'=' -f2)
    PASSWORD=$(grep -E "^SUPABASE_TEST_PASSWORD=" .env | cut -d'=' -f2)

    if [ -z "$EMAIL" ] || [ -z "$PASSWORD" ]; then
      echo -e "${RED}ERROR: Missing SUPABASE_TEST_USER or SUPABASE_TEST_PASSWORD in .env${NC}"
      exit 1
    fi

    # Login
    RESPONSE=$(curl -s -X POST "${API_URL}/auth/login" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")

    # Extract token
    TOKEN=$(echo "$RESPONSE" | jq -r '.accessToken')
    USER_ID=$(echo "$RESPONSE" | jq -r '.user.id')

    if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
      echo "export TOKEN=\"$TOKEN\"" > "$AUTH_FILE"
      echo "export USER_ID=\"$USER_ID\"" >> "$AUTH_FILE"
      echo -e "${GREEN}AUTH SUCCESS${NC}"
      echo "TOKEN: ${TOKEN:0:50}..."
      echo "USER_ID: $USER_ID"
      echo "Saved to: $AUTH_FILE"
    else
      echo -e "${RED}AUTH FAILED${NC}"
      echo "$RESPONSE"
      exit 1
    fi
    ;;

  "health")
    echo -e "${YELLOW}Checking API health...${NC}"
    RESPONSE=$(curl -s "${API_URL}/health")
    echo "$RESPONSE"
    if echo "$RESPONSE" | grep -q "ok"; then
      echo -e "${GREEN}API is healthy${NC}"
    else
      echo -e "${RED}API health check failed${NC}"
    fi
    ;;

  "check-token")
    echo -e "${YELLOW}Checking auth token...${NC}"
    if [ -z "$TOKEN" ]; then
      echo -e "${RED}No token found. Run './test-helper.sh auth' first${NC}"
      exit 1
    fi

    # Try a simple API call to verify token
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/agent-to-agent/${ORG_SLUG}/${AGENT_SLUG}/tasks" \
      -H "Authorization: Bearer ${TOKEN}" \
      -H "Content-Type: application/json" \
      -d "{\"mode\":\"dashboard\",\"context\":{\"orgSlug\":\"${ORG_SLUG}\",\"agentSlug\":\"${AGENT_SLUG}\",\"agentType\":\"risk\",\"userId\":\"${USER_ID}\",\"conversationId\":\"00000000-0000-0000-0000-000000000000\",\"taskId\":\"00000000-0000-0000-0000-000000000000\",\"planId\":\"00000000-0000-0000-0000-000000000000\",\"deliverableId\":\"00000000-0000-0000-0000-000000000000\",\"provider\":\"anthropic\",\"model\":\"claude-sonnet-4-20250514\"},\"payload\":{\"mode\":\"dashboard\",\"action\":\"scopes.list\",\"params\":{},\"filters\":{},\"pagination\":{\"page\":1,\"limit\":1}}}")

    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" = "401" ]; then
      echo -e "${RED}Token EXPIRED (401 Unauthorized)${NC}"
      echo "Run './test-helper.sh auth' to get a new token"
      exit 1
    elif [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "200" ]; then
      echo -e "${GREEN}Token VALID${NC}"
      echo "User ID: $USER_ID"
      echo "Token: ${TOKEN:0:30}..."
    else
      echo -e "${YELLOW}Unexpected status: $HTTP_CODE${NC}"
      echo "$BODY"
    fi
    ;;

  "refresh")
    echo -e "${YELLOW}Refreshing auth token...${NC}"
    # Just re-run auth
    $0 auth
    ;;

  "db")
    QUERY=${2:-"SELECT COUNT(*) as count FROM risk.scopes"}
    echo -e "${YELLOW}Running database query...${NC}"
    # Run from apps/api directory
    cd /Users/golfergeek/projects/orchAI/orchestrator-ai-v2/apps/api && npm run supabase:local -- db exec --sql "$QUERY"
    ;;

  "db-summary")
    echo -e "${YELLOW}Checking test data summary...${NC}"
    cd /Users/golfergeek/projects/orchAI/orchestrator-ai-v2/apps/api && npm run supabase:local -- db exec --sql "
      SELECT
        (SELECT COUNT(*) FROM risk.scopes WHERE org_slug = 'finance') as scopes,
        (SELECT COUNT(*) FROM risk.dimensions WHERE scope_id = 'b454c2f7-a071-4ea3-acf8-1439b6b2b6c0') as dimensions,
        (SELECT COUNT(*) FROM risk.subjects WHERE scope_id = 'b454c2f7-a071-4ea3-acf8-1439b6b2b6c0') as subjects,
        (SELECT COUNT(*) FROM risk.assessments) as assessments,
        (SELECT COUNT(*) FROM risk.composite_scores) as scores
    "
    ;;

  "call")
    ACTION=${2:-"scopes.list"}
    PARAMS=${3:-"{}"}
    FILTERS=${4:-"{}"}

    if [ -z "$TOKEN" ]; then
      echo -e "${RED}ERROR: Not authenticated. Run './test-helper.sh auth' first${NC}"
      exit 1
    fi

    # Build request body
    REQUEST_BODY=$(cat <<EOF
{
  "mode": "dashboard",
  "context": {
    "orgSlug": "${ORG_SLUG}",
    "agentSlug": "${AGENT_SLUG}",
    "agentType": "risk",
    "userId": "${USER_ID}",
    "conversationId": "00000000-0000-0000-0000-000000000000",
    "taskId": "00000000-0000-0000-0000-000000000000",
    "planId": "00000000-0000-0000-0000-000000000000",
    "deliverableId": "00000000-0000-0000-0000-000000000000",
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514"
  },
  "payload": {
    "mode": "dashboard",
    "action": "${ACTION}",
    "params": ${PARAMS},
    "filters": ${FILTERS},
    "pagination": {"page": 1, "limit": 50}
  }
}
EOF
)

    # Make request
    curl -s -X POST "${API_URL}/agent-to-agent/${ORG_SLUG}/${AGENT_SLUG}/tasks" \
      -H "Authorization: Bearer ${TOKEN}" \
      -H "Content-Type: application/json" \
      -d "${REQUEST_BODY}"
    ;;

  "help"|*)
    echo "Risk Testing Helper Script"
    echo ""
    echo "Usage:"
    echo "  ./test-helper.sh auth                           # Authenticate and save token"
    echo "  ./test-helper.sh check-token                    # Check if token is still valid"
    echo "  ./test-helper.sh refresh                        # Refresh auth token"
    echo "  ./test-helper.sh health                         # Health check"
    echo "  ./test-helper.sh call <action> [params] [filters]  # Call API"
    echo "  ./test-helper.sh db \"<SQL>\"                     # Run direct database query"
    echo "  ./test-helper.sh db-summary                     # Show test data summary"
    echo ""
    echo "Examples:"
    echo "  ./test-helper.sh auth"
    echo "  ./test-helper.sh check-token"
    echo "  ./test-helper.sh health"
    echo "  ./test-helper.sh call scopes.list"
    echo "  ./test-helper.sh call subjects.list '{\"scopeId\": \"uuid\"}'"
    echo "  ./test-helper.sh call subjects.analyze '{\"id\": \"uuid\"}'"
    echo "  ./test-helper.sh call alerts.list '{}' '{\"acknowledged\": false}'"
    echo "  ./test-helper.sh db \"SELECT * FROM risk.scopes LIMIT 1\""
    echo "  ./test-helper.sh db-summary"
    echo ""
    echo "Progressive Test Phases:"
    echo "  Phase 1: auth, health, scopes.list"
    echo "  Phase 2: subjects.list, subjects.get, dimensions.list"
    echo "  Phase 3: subjects.analyze, assessments.by-subject, composite-scores.get"
    echo "  Phase 4: debates.trigger, alerts.acknowledge, learning-queue.approve"
    echo "  Phase 5: portfolio.summary, correlations.matrix, correlations.concentration"
    echo ""
    echo "Test Data Reference:"
    echo "  Scope ID: b454c2f7-a071-4ea3-acf8-1439b6b2b6c0"
    echo "  Org Slug: finance"
    echo "  Agent Slug: investment-risk-agent"
    ;;
esac
