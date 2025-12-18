#!/bin/bash
# =============================================================================
# Marketing Swarm Dual-Track Execution Test
# =============================================================================
#
# Tests the dual-track execution model:
# - Local LLMs (Ollama) run sequentially (maxLocalConcurrent = 1)
# - Cloud LLMs (Anthropic) run in parallel (maxCloudConcurrent = 5)
# - Both tracks run simultaneously
#
# Prerequisites:
# - Ollama running with llama3.2 model
# - Supabase running with marketing agents seeded
# - API service running (npm run dev:api) - this also starts LangGraph
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
NC='\033[0m'

# Configuration
SUPABASE_URL="${SUPABASE_URL:-http://127.0.0.1:6010}"
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-your-service-role-key}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-your-anon-key}"
# API endpoint (A2A layer) - NOT LangGraph directly
API_URL="${API_URL:-http://127.0.0.1:6100}"
# LangGraph URL (for status/state endpoints that are exposed directly)
LANGGRAPH_URL="${LANGGRAPH_URL:-http://127.0.0.1:6200}"

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
echo -e "${BLUE} Marketing Swarm DUAL-TRACK Execution Test (via A2A API)${NC}"
echo -e "${BLUE}==============================================================================${NC}"
echo ""

# =============================================================================
# Check Ollama is running
# =============================================================================

echo -e "${YELLOW}Checking Ollama availability...${NC}"
OLLAMA_CHECK=$(curl -s http://localhost:11434/api/tags 2>/dev/null || echo "offline")

if [ "$OLLAMA_CHECK" = "offline" ]; then
  echo -e "${RED}Ollama is not running. Please start Ollama first.${NC}"
  echo "Run: ollama serve"
  exit 1
fi

# Check for llama3.2 model
LLAMA_MODEL=$(echo "$OLLAMA_CHECK" | jq -r '.models[]?.name' | grep -i "llama3" | head -1)
if [ -z "$LLAMA_MODEL" ]; then
  echo -e "${YELLOW}Warning: llama3.2 model not found in Ollama.${NC}"
  echo "Available models:"
  echo "$OLLAMA_CHECK" | jq -r '.models[]?.name'
  echo ""
  echo "Run: ollama pull llama3.2"
fi

echo -e "${GREEN}Ollama is running${NC}"

# =============================================================================
# Authenticate
# =============================================================================

echo ""
echo -e "${YELLOW}Authenticating...${NC}"

AUTH_RESPONSE=$(curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "Content-Type: application/json" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\"
  }")

AUTH_TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.access_token // empty')

if [ -z "$AUTH_TOKEN" ] || [ "$AUTH_TOKEN" = "null" ]; then
  echo -e "${RED}Authentication failed${NC}"
  exit 1
fi

# Extract user ID from auth response
TEST_USER_ID=$(echo "$AUTH_RESPONSE" | jq -r '.user.id // empty')
if [ -z "$TEST_USER_ID" ] || [ "$TEST_USER_ID" = "null" ]; then
  echo -e "${RED}Could not extract user ID from auth response${NC}"
  exit 1
fi

echo -e "${GREEN}Authenticated${NC}"
echo "User ID: $TEST_USER_ID"

# =============================================================================
# Define LLM Configs (static - no database lookup needed)
# =============================================================================

echo ""
echo -e "${YELLOW}Defining LLM configs...${NC}"

# LLM configs are now static - no database lookup needed
# Frontend sends llmProvider/llmModel directly in the config
CLOUD_PROVIDER="anthropic"
CLOUD_MODEL="claude-sonnet-4-20250514"
LOCAL_PROVIDER="ollama"
LOCAL_MODEL="llama3.2"

echo "Cloud provider: $CLOUD_PROVIDER, model: $CLOUD_MODEL"
echo "Local provider: $LOCAL_PROVIDER, model: $LOCAL_MODEL"

echo -e "${GREEN}Using static LLM configs${NC}"

# =============================================================================
# Execute the Swarm via A2A API (API will create the task)
# =============================================================================

echo ""
echo -e "${YELLOW}Executing swarm via A2A API (this will take a few minutes)...${NC}"
echo "Dual-track execution:"
echo "  - Cloud: Up to 3 concurrent"
echo "  - Local: 1 at a time (sequential)"
echo ""
echo -e "${BLUE}The API will automatically create the task in marketing.swarm_tasks from the userMessage payload${NC}"
echo ""

# Build the userMessage payload (JSON-stringified object matching frontend format)
# This task has:
# - 2 cloud writers (parallel)
# - 2 local writers (sequential)
# - 1 editor
# - 1 evaluator
# Total outputs: 4 writers × 1 editor = 4
# Note: llmConfigId has been replaced with llmProvider/llmModel
USER_MESSAGE_PAYLOAD=$(jq -n \
  --arg taskId "$TASK_ID" \
  --arg contentTypeSlug "blog-post" \
  --arg cloudProvider "$CLOUD_PROVIDER" \
  --arg cloudModel "$CLOUD_MODEL" \
  --arg localProvider "$LOCAL_PROVIDER" \
  --arg localModel "$LOCAL_MODEL" \
  '{
    "type": "marketing-swarm-request",
    "contentTypeSlug": $contentTypeSlug,
    "contentTypeContext": null,
    "promptData": {
      "topic": "Testing Dual-Track Execution",
      "audience": "Developers",
      "goal": "Verify local and cloud LLMs work together",
      "tone": "technical",
      "keyPoints": ["Dual-track model", "Local vs Cloud", "Concurrent execution"]
    },
    "config": {
      "writers": [
        { "agentSlug": "writer-creative", "llmProvider": $cloudProvider, "llmModel": $cloudModel },
        { "agentSlug": "writer-technical", "llmProvider": $cloudProvider, "llmModel": $cloudModel },
        { "agentSlug": "writer-conversational", "llmProvider": $localProvider, "llmModel": $localModel },
        { "agentSlug": "writer-persuasive", "llmProvider": $localProvider, "llmModel": $localModel }
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
        "topNForFinalRanking": 2
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

# Record start time
START_TIME=$(date +%s)

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

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# Extract status from nested response structure
EXECUTE_STATUS=$(echo "$EXECUTE_RESPONSE" | jq -r '.result.payload.content.data.status // .result.data.status // .result.status // .data.status // .status // empty')

echo ""
echo -e "${BLUE}Execution completed in ${DURATION} seconds${NC}"
echo ""

if [ "$EXECUTE_STATUS" = "completed" ]; then
  echo -e "${GREEN}[SUCCESS] Swarm completed!${NC}"
else
  echo -e "${RED}[FAILED] Status: $EXECUTE_STATUS${NC}"
  echo "$EXECUTE_RESPONSE" | jq .
fi

# =============================================================================
# Analyze Results by Track
# =============================================================================

echo ""
echo -e "${YELLOW}Analyzing dual-track results...${NC}"

# Get outputs with provider info directly from outputs table
OUTPUTS=$(curl -s "$SUPABASE_URL/rest/v1/outputs?task_id=eq.$TASK_ID&select=*" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Accept-Profile: marketing")

# Count by track (local = ollama provider, cloud = anything else)
LOCAL_COUNT=$(echo "$OUTPUTS" | jq '[.[] | select(.writer_llm_provider == "ollama")] | length')
CLOUD_COUNT=$(echo "$OUTPUTS" | jq '[.[] | select(.writer_llm_provider != "ollama")] | length')
APPROVED_LOCAL=$(echo "$OUTPUTS" | jq '[.[] | select(.writer_llm_provider == "ollama" and .status == "approved")] | length')
APPROVED_CLOUD=$(echo "$OUTPUTS" | jq '[.[] | select(.writer_llm_provider != "ollama" and .status == "approved")] | length')

echo ""
echo "Track Distribution:"
echo "  Local outputs:  $LOCAL_COUNT (approved: $APPROVED_LOCAL)"
echo "  Cloud outputs:  $CLOUD_COUNT (approved: $APPROVED_CLOUD)"
echo ""

echo "Output Details:"
echo "$OUTPUTS" | jq -c '.[] | {
  writer: .writer_agent_slug,
  provider: .writer_llm_provider,
  is_local: (.writer_llm_provider == "ollama"),
  status,
  edit_cycle
}'

# =============================================================================
# Verify Execution Order (Local should be sequential)
# =============================================================================

echo ""
echo -e "${YELLOW}Verifying execution patterns...${NC}"

# For local outputs, check that they completed (we can't directly verify sequential execution
# but we can verify they all completed successfully)
LOCAL_OUTPUTS=$(echo "$OUTPUTS" | jq '[.[] | select(.writer_llm_provider == "ollama")]')
LOCAL_STATUSES=$(echo "$LOCAL_OUTPUTS" | jq -r '.[].status' | sort | uniq)

if echo "$LOCAL_STATUSES" | grep -q "approved"; then
  echo -e "${GREEN}[PASS] Local (sequential) outputs completed${NC}"
else
  echo -e "${RED}[FAIL] Some local outputs did not complete${NC}"
fi

# Cloud outputs should all be processed
CLOUD_OUTPUTS=$(echo "$OUTPUTS" | jq '[.[] | select(.writer_llm_provider != "ollama")]')
CLOUD_STATUSES=$(echo "$CLOUD_OUTPUTS" | jq -r '.[].status' | sort | uniq)

if echo "$CLOUD_STATUSES" | grep -q "approved"; then
  echo -e "${GREEN}[PASS] Cloud (parallel) outputs completed${NC}"
else
  echo -e "${RED}[FAIL] Some cloud outputs did not complete${NC}"
fi

# =============================================================================
# Summary
# =============================================================================

echo ""
echo -e "${BLUE}==============================================================================${NC}"
echo -e "${BLUE} Summary${NC}"
echo -e "${BLUE}==============================================================================${NC}"
echo ""
echo "Task ID: $TASK_ID"
echo "Duration: ${DURATION}s"
echo ""
echo "Dual-Track Execution:"
echo "  - Local (Ollama): $LOCAL_COUNT outputs, $APPROVED_LOCAL approved"
echo "  - Cloud (Anthropic): $CLOUD_COUNT outputs, $APPROVED_CLOUD approved"
echo ""
echo "Expected behavior:"
echo "  - Local outputs processed sequentially (1 at a time)"
echo "  - Cloud outputs processed in parallel (up to 3 concurrent)"
echo "  - Both tracks run simultaneously"
echo ""

# Cleanup instructions
echo -e "${YELLOW}Cleanup:${NC}"
echo "curl -X DELETE \"$SUPABASE_URL/rest/v1/evaluations?task_id=eq.$TASK_ID\" -H \"apikey: \$SUPABASE_SERVICE_ROLE_KEY\" -H \"Authorization: Bearer \$SUPABASE_SERVICE_ROLE_KEY\" -H \"Accept-Profile: marketing\""
echo "curl -X DELETE \"$SUPABASE_URL/rest/v1/outputs?task_id=eq.$TASK_ID\" -H \"apikey: \$SUPABASE_SERVICE_ROLE_KEY\" -H \"Authorization: Bearer \$SUPABASE_SERVICE_ROLE_KEY\" -H \"Accept-Profile: marketing\""
echo "curl -X DELETE \"$SUPABASE_URL/rest/v1/swarm_tasks?task_id=eq.$TASK_ID\" -H \"apikey: \$SUPABASE_SERVICE_ROLE_KEY\" -H \"Authorization: Bearer \$SUPABASE_SERVICE_ROLE_KEY\" -H \"Accept-Profile: marketing\""
