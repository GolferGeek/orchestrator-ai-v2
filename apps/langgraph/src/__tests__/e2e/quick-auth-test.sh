#!/bin/bash
# Quick auth test

SUPABASE_URL="http://127.0.0.1:6010"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
EMAIL="golfergeek@orchestratorai.io"
PASSWORD="GolferGeek123!"

echo "Testing Supabase auth..."
echo "URL: $SUPABASE_URL"

AUTH_RESPONSE=$(curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "Content-Type: application/json" \
  -H "apikey: $ANON_KEY" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\"}")

AUTH_TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.access_token // empty')
TEST_USER_ID=$(echo "$AUTH_RESPONSE" | jq -r '.user.id // empty')

if [ -n "$AUTH_TOKEN" ] && [ "$AUTH_TOKEN" != "null" ]; then
  echo ""
  echo "SUCCESS! Token: ${AUTH_TOKEN:0:40}..."
  echo "User ID: $TEST_USER_ID"

  # Now test A2A endpoint
  echo ""
  echo "Testing A2A endpoint for marketing-swarm..."

  # Generate proper UUIDs
  TASK_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
  CONV_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')

  echo "Task ID: $TASK_ID"
  echo "Conversation ID: $CONV_ID"

  A2A_RESPONSE=$(curl -s -X POST "http://127.0.0.1:6100/agent-to-agent/demo-org/marketing-swarm/tasks" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -d "{
      \"jsonrpc\": \"2.0\",
      \"id\": \"test-1\",
      \"method\": \"agent.converse\",
      \"params\": {
        \"mode\": \"converse\",
        \"context\": {
          \"orgSlug\": \"demo-org\",
          \"userId\": \"$TEST_USER_ID\",
          \"conversationId\": \"$CONV_ID\",
          \"taskId\": \"$TASK_ID\",
          \"planId\": \"00000000-0000-0000-0000-000000000000\",
          \"deliverableId\": \"00000000-0000-0000-0000-000000000000\",
          \"agentSlug\": \"marketing-swarm\",
          \"agentType\": \"api\",
          \"provider\": \"anthropic\",
          \"model\": \"claude-sonnet-4-20250514\"
        },
        \"userMessage\": \"Hello, this is a test conversation with the marketing swarm agent.\"
      }
    }")

  echo ""
  echo "A2A Response:"
  echo "$A2A_RESPONSE" | jq .
else
  echo "AUTH FAILED"
  echo "$AUTH_RESPONSE" | jq .
fi
