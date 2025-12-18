#!/bin/bash
# =============================================================================
# Marketing Swarm Observability SSE Test
# =============================================================================
#
# Tests that observability events are properly emitted during swarm execution
# by subscribing to the SSE stream and collecting events while running a task.
#
# This test verifies:
# 1. SSE connection can be established with auth
# 2. Events are received during swarm execution
# 3. Event structure contains visualization-ready data
#
# Prerequisites:
# - API service running (npm run dev:api)
# - Environment variables set
#
# =============================================================================

set -e

# Load environment variables from .env file if it exists
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../../.." && pwd)"
if [ -f "$PROJECT_ROOT/.env" ]; then
  set -a
  source "$PROJECT_ROOT/.env"
  set +a
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
SUPABASE_URL="${SUPABASE_URL:-http://127.0.0.1:6010}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-your-anon-key}"
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-your-service-role-key}"
API_URL="${API_URL:-http://127.0.0.1:6100}"

TEST_EMAIL="${SUPABASE_TEST_USER:-golfergeek@orchestratorai.io}"
TEST_PASSWORD="${SUPABASE_TEST_PASSWORD:-GolferGeek123!}"
TEST_ORG="demo-org"

# Validate required environment variables
if [ "$SUPABASE_SERVICE_ROLE_KEY" = "your-service-role-key" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo -e "${RED}Error: SUPABASE_SERVICE_ROLE_KEY is not set${NC}"
  echo "Please set it in your .env file or export it before running this script"
  exit 1
fi

TASK_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
CONVERSATION_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
SSE_OUTPUT_FILE="/tmp/sse-events-${TASK_ID}.jsonl"
SSE_PID=""

echo -e "${BLUE}==============================================================================${NC}"
echo -e "${BLUE} Marketing Swarm Observability SSE Test${NC}"
echo -e "${BLUE}==============================================================================${NC}"
echo ""
echo -e "${YELLOW}Task ID:${NC} $TASK_ID"
echo -e "${YELLOW}SSE Output:${NC} $SSE_OUTPUT_FILE"
echo ""

# Cleanup function
cleanup() {
  if [ -n "$SSE_PID" ] && kill -0 "$SSE_PID" 2>/dev/null; then
    echo -e "\n${YELLOW}Stopping SSE listener (PID: $SSE_PID)...${NC}"
    kill "$SSE_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# =============================================================================
# 1. Authenticate
# =============================================================================

echo -e "${CYAN}[1/6] Authenticating...${NC}"

AUTH_RESPONSE=$(curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "Content-Type: application/json" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\"
  }")

AUTH_TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.access_token // empty')
TEST_USER_ID=$(echo "$AUTH_RESPONSE" | jq -r '.user.id // empty')

if [ -z "$AUTH_TOKEN" ] || [ "$AUTH_TOKEN" = "null" ]; then
  echo -e "${RED}Authentication failed${NC}"
  echo "$AUTH_RESPONSE" | jq .
  exit 1
fi

echo -e "${GREEN}Authenticated as user: $TEST_USER_ID${NC}"

# =============================================================================
# 2. Start SSE Listener (background)
# =============================================================================

echo -e "${CYAN}[2/6] Starting SSE listener in background...${NC}"

# Start curl to listen to SSE stream, writing to file
# Filter by agentSlug=marketing-swarm to only get our events
curl -s -N "$API_URL/observability/stream?agentSlug=marketing-swarm" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Accept: text/event-stream" \
  > "$SSE_OUTPUT_FILE" 2>&1 &

SSE_PID=$!
echo -e "${GREEN}SSE listener started (PID: $SSE_PID)${NC}"

# Give SSE connection time to establish
sleep 2

# Verify SSE is running and got connection event
if ! kill -0 "$SSE_PID" 2>/dev/null; then
  echo -e "${RED}SSE listener died unexpectedly${NC}"
  cat "$SSE_OUTPUT_FILE"
  exit 1
fi

# Check for connection event
if grep -q "connected" "$SSE_OUTPUT_FILE"; then
  echo -e "${GREEN}SSE connection established${NC}"
else
  echo -e "${YELLOW}Warning: No connection event yet (may arrive later)${NC}"
fi

# =============================================================================
# 3. Define LLM Configs (static - no database lookup needed)
# =============================================================================

echo -e "${CYAN}[3/6] Defining LLM configs...${NC}"

# LLM configs are now static - no database lookup needed
# Frontend sends llmProvider/llmModel directly in the config
CLOUD_PROVIDER="anthropic"
CLOUD_MODEL="claude-sonnet-4-20250514"

echo -e "${GREEN}Using static LLM configs (provider: $CLOUD_PROVIDER, model: $CLOUD_MODEL)${NC}"

# =============================================================================
# 4. Execute Marketing Swarm (API will create task, collect events while running)
# =============================================================================

echo -e "${CYAN}[4/6] Executing marketing swarm via A2A API...${NC}"
echo -e "${YELLOW}The API will automatically create the task in marketing.swarm_tasks from the userMessage payload${NC}"
echo -e "${YELLOW}Collecting SSE events during execution...${NC}"

# Build the userMessage payload (JSON-stringified object matching frontend format)
# Note: llmConfigId has been replaced with llmProvider/llmModel
USER_MESSAGE_PAYLOAD=$(jq -n \
  --arg taskId "$TASK_ID" \
  --arg contentTypeSlug "blog-post" \
  --arg cloudProvider "$CLOUD_PROVIDER" \
  --arg cloudModel "$CLOUD_MODEL" \
  '{
    "type": "marketing-swarm-request",
    "contentTypeSlug": $contentTypeSlug,
    "contentTypeContext": null,
    "promptData": {
      "topic": "Observability Test - AI in Marketing",
      "audience": "Marketing professionals",
      "goal": "Test SSE event streaming",
      "tone": "professional",
      "keyPoints": ["Event streaming", "Real-time updates", "Visualization"]
    },
    "config": {
      "writers": [
        { "agentSlug": "writer-creative", "llmProvider": $cloudProvider, "llmModel": $cloudModel }
      ],
      "editors": [
        { "agentSlug": "editor-clarity", "llmProvider": $cloudProvider, "llmModel": $cloudModel }
      ],
      "evaluators": [
        { "agentSlug": "evaluator-quality", "llmProvider": $cloudProvider, "llmModel": $cloudModel }
      ],
      "execution": {
        "maxLocalConcurrent": 1,
        "maxCloudConcurrent": 3,
        "maxEditCycles": 1,
        "topNForFinalRanking": 1
      }
    }
  }' | jq -c .)

EXECUTION_CONTEXT=$(jq -n \
  --arg orgSlug "$TEST_ORG" \
  --arg userId "$TEST_USER_ID" \
  --arg conversationId "$CONVERSATION_ID" \
  --arg taskId "$TASK_ID" \
  '{
    "orgSlug": $orgSlug,
    "userId": $userId,
    "conversationId": $conversationId,
    "taskId": $taskId,
    "planId": "00000000-0000-0000-0000-000000000000",
    "deliverableId": "00000000-0000-0000-0000-000000000000",
    "agentSlug": "marketing-swarm",
    "agentType": "api",
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514"
  }' | jq -c .)

START_TIME=$(date +%s)

# Execute the swarm
# Note: Using build.execute method to match frontend (not agent.build)
EXECUTE_RESPONSE=$(curl -s -X POST "$API_URL/agent-to-agent/$TEST_ORG/marketing-swarm/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": \"1\",
    \"method\": \"build.execute\",
    \"params\": {
      \"mode\": \"build\",
      \"context\": $EXECUTION_CONTEXT,
      \"userMessage\": $(echo "$USER_MESSAGE_PAYLOAD" | jq -R .)
    }
  }")

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

EXECUTE_STATUS=$(echo "$EXECUTE_RESPONSE" | jq -r '.result.success // false')

echo ""
echo -e "${BLUE}Execution completed in ${DURATION}s${NC}"

if [ "$EXECUTE_STATUS" = "true" ]; then
  echo -e "${GREEN}Swarm execution: SUCCESS${NC}"
else
  echo -e "${RED}Swarm execution: FAILED${NC}"
  echo "$EXECUTE_RESPONSE" | jq .
fi

# Give SSE stream time to flush
sleep 3

# =============================================================================
# 6. Analyze Collected Events
# =============================================================================

echo ""
echo -e "${CYAN}[6/6] Analyzing collected SSE events...${NC}"
echo ""

# Stop SSE listener
if kill -0 "$SSE_PID" 2>/dev/null; then
  kill "$SSE_PID" 2>/dev/null || true
  SSE_PID=""
fi

# Count and categorize events
TOTAL_LINES=$(wc -l < "$SSE_OUTPUT_FILE" | tr -d ' ')
DATA_LINES=$(grep -c "^data:" "$SSE_OUTPUT_FILE" 2>/dev/null || echo "0")

echo -e "${BLUE}=== SSE Event Summary ===${NC}"
echo "Total lines received: $TOTAL_LINES"
echo "Data events: $DATA_LINES"
echo ""

# Extract and analyze events
echo -e "${BLUE}=== Event Types Received ===${NC}"
grep "^data:" "$SSE_OUTPUT_FILE" | sed 's/^data: //' | while read -r line; do
  EVENT_TYPE=$(echo "$line" | jq -r '.hook_event_type // .event_type // "unknown"' 2>/dev/null)
  TASK=$(echo "$line" | jq -r '.context.taskId // .taskId // "N/A"' 2>/dev/null)
  STATUS=$(echo "$line" | jq -r '.status // "N/A"' 2>/dev/null)
  STEP=$(echo "$line" | jq -r '.step // "N/A"' 2>/dev/null)
  PROGRESS=$(echo "$line" | jq -r '.progress // "N/A"' 2>/dev/null)

  # Truncate task ID for display
  TASK_SHORT="${TASK:0:8}"

  echo "  $EVENT_TYPE | task:$TASK_SHORT | status:$STATUS | step:$STEP | progress:$PROGRESS"
done

echo ""
echo -e "${BLUE}=== Event Content Analysis ===${NC}"

# Check for specific event types we need for visualization
STARTED_EVENTS=$(grep "^data:" "$SSE_OUTPUT_FILE" | grep -c "langgraph.started" 2>/dev/null || echo "0")
PROCESSING_EVENTS=$(grep "^data:" "$SSE_OUTPUT_FILE" | grep -c "langgraph.processing" 2>/dev/null || echo "0")
COMPLETED_EVENTS=$(grep "^data:" "$SSE_OUTPUT_FILE" | grep -c "langgraph.completed" 2>/dev/null || echo "0")
PHASE_EVENTS=$(grep "^data:" "$SSE_OUTPUT_FILE" | grep -c "phase_changed" 2>/dev/null || echo "0")
OUTPUT_EVENTS=$(grep "^data:" "$SSE_OUTPUT_FILE" | grep -c "output_updated" 2>/dev/null || echo "0")
EVAL_EVENTS=$(grep "^data:" "$SSE_OUTPUT_FILE" | grep -c "evaluation_updated" 2>/dev/null || echo "0")
RANKING_EVENTS=$(grep "^data:" "$SSE_OUTPUT_FILE" | grep -c "ranking_updated" 2>/dev/null || echo "0")

echo "langgraph.started events:    $STARTED_EVENTS"
echo "langgraph.processing events: $PROCESSING_EVENTS"
echo "langgraph.completed events:  $COMPLETED_EVENTS"
echo "phase_changed events:        $PHASE_EVENTS"
echo "output_updated events:       $OUTPUT_EVENTS"
echo "evaluation_updated events:   $EVAL_EVENTS"
echo "ranking_updated events:      $RANKING_EVENTS"

echo ""
echo -e "${BLUE}=== Verification Results ===${NC}"

PASS_COUNT=0
FAIL_COUNT=0

# Test: Connection established
if grep -q "connected" "$SSE_OUTPUT_FILE"; then
  echo -e "${GREEN}[PASS]${NC} SSE connection event received"
  ((PASS_COUNT++))
else
  echo -e "${RED}[FAIL]${NC} No SSE connection event"
  ((FAIL_COUNT++))
fi

# Test: Started event received
if [ "$STARTED_EVENTS" -gt 0 ]; then
  echo -e "${GREEN}[PASS]${NC} Received langgraph.started event(s)"
  ((PASS_COUNT++))
else
  echo -e "${RED}[FAIL]${NC} No langgraph.started events"
  ((FAIL_COUNT++))
fi

# Test: Processing events received
if [ "$PROCESSING_EVENTS" -gt 0 ]; then
  echo -e "${GREEN}[PASS]${NC} Received langgraph.processing event(s)"
  ((PASS_COUNT++))
else
  echo -e "${RED}[FAIL]${NC} No langgraph.processing events"
  ((FAIL_COUNT++))
fi

# Test: Completed event received
if [ "$COMPLETED_EVENTS" -gt 0 ]; then
  echo -e "${GREEN}[PASS]${NC} Received langgraph.completed event(s)"
  ((PASS_COUNT++))
else
  echo -e "${RED}[FAIL]${NC} No langgraph.completed events"
  ((FAIL_COUNT++))
fi

# Test: Events contain context
CONTEXT_EVENTS=$(grep "^data:" "$SSE_OUTPUT_FILE" | grep -c '"context"' 2>/dev/null || echo "0")
if [ "$CONTEXT_EVENTS" -gt 0 ]; then
  echo -e "${GREEN}[PASS]${NC} Events contain ExecutionContext"
  ((PASS_COUNT++))
else
  echo -e "${RED}[FAIL]${NC} Events missing ExecutionContext"
  ((FAIL_COUNT++))
fi

# Test: Events have taskId matching our task
OUR_TASK_EVENTS=$(grep "^data:" "$SSE_OUTPUT_FILE" | grep -c "$TASK_ID" 2>/dev/null || echo "0")
if [ "$OUR_TASK_EVENTS" -gt 0 ]; then
  echo -e "${GREEN}[PASS]${NC} Events filtered to our task ($OUR_TASK_EVENTS events)"
  ((PASS_COUNT++))
else
  echo -e "${YELLOW}[WARN]${NC} No events matched our task ID (may be filtering issue)"
fi

echo ""
echo -e "${BLUE}==============================================================================${NC}"
echo -e "Results: ${GREEN}$PASS_COUNT passed${NC}, ${RED}$FAIL_COUNT failed${NC}"
echo -e "${BLUE}==============================================================================${NC}"

# Show sample event for inspection
echo ""
echo -e "${BLUE}=== Sample Event (for structure inspection) ===${NC}"
SAMPLE_EVENT=$(grep "^data:" "$SSE_OUTPUT_FILE" | grep -v "connected" | head -1 | sed 's/^data: //')
if [ -n "$SAMPLE_EVENT" ]; then
  echo "$SAMPLE_EVENT" | jq .
else
  echo "No data events to sample"
fi

# Show full raw output for debugging
echo ""
echo -e "${BLUE}=== Raw SSE Output (first 50 lines) ===${NC}"
head -50 "$SSE_OUTPUT_FILE"

echo ""
echo -e "${YELLOW}Full SSE output saved to: $SSE_OUTPUT_FILE${NC}"

# Cleanup test data
echo ""
echo -e "${YELLOW}Cleanup commands:${NC}"
echo "curl -X DELETE \"$SUPABASE_URL/rest/v1/evaluations?task_id=eq.$TASK_ID\" -H \"apikey: \$SUPABASE_SERVICE_ROLE_KEY\" -H \"Authorization: Bearer \$SUPABASE_SERVICE_ROLE_KEY\" -H \"Accept-Profile: marketing\""
echo "curl -X DELETE \"$SUPABASE_URL/rest/v1/outputs?task_id=eq.$TASK_ID\" -H \"apikey: \$SUPABASE_SERVICE_ROLE_KEY\" -H \"Authorization: Bearer \$SUPABASE_SERVICE_ROLE_KEY\" -H \"Accept-Profile: marketing\""
echo "curl -X DELETE \"$SUPABASE_URL/rest/v1/swarm_tasks?task_id=eq.$TASK_ID\" -H \"apikey: \$SUPABASE_SERVICE_ROLE_KEY\" -H \"Authorization: Bearer \$SUPABASE_SERVICE_ROLE_KEY\" -H \"Accept-Profile: marketing\""
