#!/bin/bash
# =============================================================================
# Marketing Swarm E2E Tests via cURL
# =============================================================================
#
# Manual test script for Marketing Swarm Phase 2 API endpoints
# Uses proper transport types (ExecutionContext) through the A2A API layer
#
# Prerequisites:
# - Supabase running (npm run dev:supabase)
# - API service running (npm run dev:api) - this also starts LangGraph
# - Environment variables set
#
# Usage:
#   ./marketing-swarm-curl-tests.sh
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

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration - Load from environment or use defaults
SUPABASE_URL="${SUPABASE_URL:-http://127.0.0.1:6010}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-your-anon-key}"
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-your-service-role-key}"
# API endpoint (A2A layer) - NOT LangGraph directly
API_URL="${API_URL:-http://127.0.0.1:6100}"
# LangGraph URL (for status/state endpoints that are exposed directly)
LANGGRAPH_URL="${LANGGRAPH_URL:-http://127.0.0.1:6200}"

# Test user credentials
TEST_EMAIL="${SUPABASE_TEST_USER:-golfergeek@orchestratorai.io}"
TEST_PASSWORD="${SUPABASE_TEST_PASSWORD:-GolferGeek123!}"
# NOTE: TEST_USER_ID will be set from the auth response
TEST_ORG="demo-org"

# Validate required environment variables
if [ "$SUPABASE_SERVICE_ROLE_KEY" = "your-service-role-key" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo -e "${RED}Error: SUPABASE_SERVICE_ROLE_KEY is not set${NC}"
  echo "Please set it in your .env file or export it before running this script"
  exit 1
fi

# Generate unique task ID for this test run (must be valid UUID)
TASK_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
CONVERSATION_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')

echo -e "${BLUE}==============================================================================${NC}"
echo -e "${BLUE} Marketing Swarm cURL E2E Tests (via A2A API)${NC}"
echo -e "${BLUE}==============================================================================${NC}"
echo ""
echo -e "${YELLOW}Configuration:${NC}"
echo "  SUPABASE_URL: $SUPABASE_URL"
echo "  API_URL: $API_URL (A2A endpoint)"
echo "  LANGGRAPH_URL: $LANGGRAPH_URL (status/state)"
echo "  TASK_ID: $TASK_ID"
echo ""

# =============================================================================
# Helper Functions
# =============================================================================

log_test() {
  echo ""
  echo -e "${BLUE}--- TEST: $1 ---${NC}"
}

log_success() {
  echo -e "${GREEN}[PASS]${NC} $1"
}

log_fail() {
  echo -e "${RED}[FAIL]${NC} $1"
}

log_info() {
  echo -e "${YELLOW}[INFO]${NC} $1"
}

# =============================================================================
# Test 0: Authenticate and get token
# =============================================================================

log_test "0. Authenticate with Supabase"

AUTH_RESPONSE=$(curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "Content-Type: application/json" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\"
  }")

AUTH_TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.access_token // empty')

if [ -n "$AUTH_TOKEN" ] && [ "$AUTH_TOKEN" != "null" ]; then
  log_success "Authenticated successfully"
  log_info "Token: ${AUTH_TOKEN:0:20}..."

  # Extract user ID from auth response
  TEST_USER_ID=$(echo "$AUTH_RESPONSE" | jq -r '.user.id // empty')
  if [ -z "$TEST_USER_ID" ] || [ "$TEST_USER_ID" = "null" ]; then
    log_fail "Could not extract user ID from auth response"
    exit 1
  fi
  log_info "User ID: $TEST_USER_ID"
else
  log_fail "Authentication failed"
  echo "$AUTH_RESPONSE" | jq .
  exit 1
fi

# =============================================================================
# Test 1: Get LLM Config IDs from database
# =============================================================================

log_test "1. Get LLM Config IDs"

# Get cloud writer config (using Accept-Profile header for marketing schema)
CLOUD_WRITER_CONFIG=$(curl -s "$SUPABASE_URL/rest/v1/agent_llm_configs?agent_slug=eq.writer-creative&llm_provider=eq.anthropic&select=id" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Accept-Profile: marketing")

CLOUD_WRITER_ID=$(echo "$CLOUD_WRITER_CONFIG" | jq -r '.[0].id // empty')

# Get cloud editor config
CLOUD_EDITOR_CONFIG=$(curl -s "$SUPABASE_URL/rest/v1/agent_llm_configs?agent_slug=eq.editor-clarity&llm_provider=eq.anthropic&select=id" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Accept-Profile: marketing")

CLOUD_EDITOR_ID=$(echo "$CLOUD_EDITOR_CONFIG" | jq -r '.[0].id // empty')

# Get cloud evaluator config
CLOUD_EVALUATOR_CONFIG=$(curl -s "$SUPABASE_URL/rest/v1/agent_llm_configs?agent_slug=eq.evaluator-quality&llm_provider=eq.anthropic&select=id" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Accept-Profile: marketing")

CLOUD_EVALUATOR_ID=$(echo "$CLOUD_EVALUATOR_CONFIG" | jq -r '.[0].id // empty')

if [ -n "$CLOUD_WRITER_ID" ] && [ -n "$CLOUD_EDITOR_ID" ] && [ -n "$CLOUD_EVALUATOR_ID" ]; then
  log_success "Got LLM config IDs"
  log_info "Writer: $CLOUD_WRITER_ID"
  log_info "Editor: $CLOUD_EDITOR_ID"
  log_info "Evaluator: $CLOUD_EVALUATOR_ID"
else
  log_fail "Could not get LLM config IDs"
  echo "Make sure the marketing agents are seeded in the database"
  exit 1
fi

# =============================================================================
# Test 2: Execute the Marketing Swarm via A2A API (API will create the task)
# =============================================================================

log_test "2. Execute Marketing Swarm via A2A API (API creates task from userMessage)"

log_info "This may take 1-2 minutes depending on LLM response times..."
log_info "The API will automatically create the task in marketing.swarm_tasks from the userMessage payload"

# Build the userMessage payload (JSON-stringified object matching frontend format)
# This matches what the frontend sends: a JSON-stringified object with type, contentTypeSlug, promptData, and config
USER_MESSAGE_PAYLOAD=$(jq -n \
  --arg taskId "$TASK_ID" \
  --arg contentTypeSlug "blog-post" \
  --arg cloudWriterId "$CLOUD_WRITER_ID" \
  --arg cloudEditorId "$CLOUD_EDITOR_ID" \
  --arg cloudEvaluatorId "$CLOUD_EVALUATOR_ID" \
  '{
    "type": "marketing-swarm-request",
    "contentTypeSlug": $contentTypeSlug,
    "contentTypeContext": null,
    "promptData": {
      "topic": "The Future of AI in Marketing",
      "audience": "Marketing professionals",
      "goal": "Educate and inspire action",
      "tone": "professional but approachable",
      "keyPoints": [
        "AI is transforming content creation",
        "Personalization at scale is now possible",
        "Human creativity remains essential"
      ]
    },
    "config": {
      "writers": [
        { "agentSlug": "writer-creative", "llmConfigId": $cloudWriterId }
      ],
      "editors": [
        { "agentSlug": "editor-clarity", "llmConfigId": $cloudEditorId }
      ],
      "evaluators": [
        { "agentSlug": "evaluator-quality", "llmConfigId": $cloudEvaluatorId }
      ],
      "execution": {
        "maxLocalConcurrent": 0,
        "maxCloudConcurrent": 5,
        "maxEditCycles": 2,
        "topNForFinalRanking": 1
      }
    }
  }' | jq -c .)

# Build the ExecutionContext as required by A2A protocol
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

# Call the A2A endpoint (API routes to LangGraph internally)
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

# Extract status from nested response structure
# Response can be: .result.payload.content.data.status or .result.data.status or .result.status
EXECUTE_STATUS=$(echo "$EXECUTE_RESPONSE" | jq -r '.result.payload.content.data.status // .result.data.status // .result.status // .data.status // .status // empty')

if [ "$EXECUTE_STATUS" = "completed" ]; then
  log_success "Swarm execution completed"

  # Extract outputs and evaluations from nested response structure
  OUTPUTS_COUNT=$(echo "$EXECUTE_RESPONSE" | jq -r '.result.payload.content.data.outputs | length // .result.data.outputs | length // .data.outputs | length // 0')
  EVALS_COUNT=$(echo "$EXECUTE_RESPONSE" | jq -r '.result.payload.content.data.evaluations | length // .result.data.evaluations | length // .data.evaluations | length // 0')

  log_info "Outputs: $OUTPUTS_COUNT"
  log_info "Evaluations: $EVALS_COUNT"

  # Show winner if exists
  WINNER=$(echo "$EXECUTE_RESPONSE" | jq -r '.result.payload.content.data.winner // .result.data.winner // .data.winner // empty')
  if [ -n "$WINNER" ] && [ "$WINNER" != "null" ]; then
    log_info "Winner ID: $(echo "$WINNER" | jq -r '.id')"
    log_info "Winner Final Rank: $(echo "$WINNER" | jq -r '.final_rank')"
  fi
elif [ "$EXECUTE_STATUS" = "failed" ]; then
  log_fail "Swarm execution failed"
  echo "$EXECUTE_RESPONSE" | jq '.result.data.error // .data.error // .error'
else
  log_info "Execution status: $EXECUTE_STATUS"
  echo "$EXECUTE_RESPONSE" | jq .
fi

# =============================================================================
# Test 3: Check Task Status (via LangGraph directly for status endpoints)
# =============================================================================

log_test "3. Check Task Status"

STATUS_RESPONSE=$(curl -s -X GET "$LANGGRAPH_URL/marketing-swarm/status/$TASK_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN")

STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.data.status // .status // empty')

if [ -n "$STATUS" ]; then
  log_success "Status retrieved: $STATUS"

  PROGRESS=$(echo "$STATUS_RESPONSE" | jq -r '.data.progress // {}')
  log_info "Progress: $PROGRESS"
else
  log_fail "Could not get status"
  echo "$STATUS_RESPONSE" | jq .
fi

# =============================================================================
# Test 4: Get Full State (for frontend reconnection)
# =============================================================================

log_test "4. Get Full State"

STATE_RESPONSE=$(curl -s -X GET "$LANGGRAPH_URL/marketing-swarm/state/$TASK_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN")

STATE_OUTPUTS=$(echo "$STATE_RESPONSE" | jq -r '.data.outputs | length // 0')
STATE_EVALS=$(echo "$STATE_RESPONSE" | jq -r '.data.evaluations | length // 0')

if [ "$STATE_OUTPUTS" -gt 0 ]; then
  log_success "State retrieved"
  log_info "Outputs in state: $STATE_OUTPUTS"
  log_info "Evaluations in state: $STATE_EVALS"

  # Show first output details
  log_info "First output status: $(echo "$STATE_RESPONSE" | jq -r '.data.outputs[0].status')"
  log_info "First output writer: $(echo "$STATE_RESPONSE" | jq -r '.data.outputs[0].writer_agent_slug')"
  log_info "First output editor: $(echo "$STATE_RESPONSE" | jq -r '.data.outputs[0].editor_agent_slug')"

  # Show content preview
  CONTENT_PREVIEW=$(echo "$STATE_RESPONSE" | jq -r '.data.outputs[0].content // "no content"' | head -c 200)
  log_info "Content preview: ${CONTENT_PREVIEW}..."
else
  log_fail "State is empty"
  echo "$STATE_RESPONSE" | jq .
fi

# =============================================================================
# Test 5: Verify Database State
# =============================================================================

log_test "5. Verify Database State"

# Check outputs
OUTPUTS=$(curl -s "$SUPABASE_URL/rest/v1/outputs?task_id=eq.$TASK_ID&select=id,status,writer_agent_slug,editor_agent_slug,edit_cycle,initial_rank,final_rank" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Accept-Profile: marketing")

OUTPUT_COUNT=$(echo "$OUTPUTS" | jq 'length')
log_info "Outputs in DB: $OUTPUT_COUNT"
echo "$OUTPUTS" | jq -c '.[] | {id: .id[:8], status, writer: .writer_agent_slug, editor: .editor_agent_slug, edit_cycle, initial_rank, final_rank}'

# Check evaluations
EVALUATIONS=$(curl -s "$SUPABASE_URL/rest/v1/evaluations?task_id=eq.$TASK_ID&select=id,stage,status,score,rank,weighted_score" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Accept-Profile: marketing")

EVAL_COUNT=$(echo "$EVALUATIONS" | jq 'length')
log_info "Evaluations in DB: $EVAL_COUNT"
echo "$EVALUATIONS" | jq -c '.[] | {id: .id[:8], stage, status, score, rank, weighted_score}'

# =============================================================================
# Test 6: Verify Edit Cycles
# =============================================================================

log_test "6. Verify Edit Cycles"

EDIT_CYCLE=$(echo "$OUTPUTS" | jq -r '.[0].edit_cycle // 0')
log_info "Edit cycles completed: $EDIT_CYCLE"

if [ "$EDIT_CYCLE" -ge 1 ]; then
  log_success "Edit cycle tracking working"
else
  log_info "No edit cycles recorded (content may have been approved on first pass)"
fi

# =============================================================================
# Test 7: Verify Two-Stage Evaluation
# =============================================================================

log_test "7. Verify Two-Stage Evaluation"

INITIAL_EVALS=$(echo "$EVALUATIONS" | jq '[.[] | select(.stage == "initial")] | length')
FINAL_EVALS=$(echo "$EVALUATIONS" | jq '[.[] | select(.stage == "final")] | length')

log_info "Initial evaluations: $INITIAL_EVALS"
log_info "Final evaluations: $FINAL_EVALS"

# Check score ranges for initial
if [ "$INITIAL_EVALS" -gt 0 ]; then
  INITIAL_SCORES=$(echo "$EVALUATIONS" | jq '[.[] | select(.stage == "initial") | .score] | add / length')
  log_info "Average initial score: $INITIAL_SCORES"
  log_success "Initial evaluation phase completed"
fi

# Check weighted scores for final
if [ "$FINAL_EVALS" -gt 0 ]; then
  WEIGHTED_SCORES=$(echo "$EVALUATIONS" | jq '[.[] | select(.stage == "final") | .weighted_score] | add')
  log_info "Total weighted scores: $WEIGHTED_SCORES"
  log_success "Final ranking phase completed"
fi

# =============================================================================
# Cleanup
# =============================================================================

log_test "Cleanup"

log_info "To clean up test data, run:"
echo "  curl -X DELETE \"$SUPABASE_URL/rest/v1/evaluations?task_id=eq.$TASK_ID\" -H \"apikey: \$SUPABASE_SERVICE_ROLE_KEY\" -H \"Authorization: Bearer \$SUPABASE_SERVICE_ROLE_KEY\" -H \"Accept-Profile: marketing\""
echo "  curl -X DELETE \"$SUPABASE_URL/rest/v1/outputs?task_id=eq.$TASK_ID\" -H \"apikey: \$SUPABASE_SERVICE_ROLE_KEY\" -H \"Authorization: Bearer \$SUPABASE_SERVICE_ROLE_KEY\" -H \"Accept-Profile: marketing\""
echo "  curl -X DELETE \"$SUPABASE_URL/rest/v1/swarm_tasks?task_id=eq.$TASK_ID\" -H \"apikey: \$SUPABASE_SERVICE_ROLE_KEY\" -H \"Authorization: Bearer \$SUPABASE_SERVICE_ROLE_KEY\" -H \"Accept-Profile: marketing\""

echo ""
echo -e "${BLUE}==============================================================================${NC}"
echo -e "${GREEN}Tests Complete!${NC}"
echo -e "${BLUE}==============================================================================${NC}"
echo ""
echo "Task ID: $TASK_ID"
echo ""
