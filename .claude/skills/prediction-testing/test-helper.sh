#!/bin/bash
# Prediction Testing Helper Script
# Usage: ./test-helper.sh <action> [params_json] [filters_json]

source /tmp/prediction_test_auth.env

ACTION=${1:-"universes.list"}
PARAMS=${2:-"{}"}
FILTERS=${3:-"{}"}

API_URL="http://localhost:6100"
ORG_SLUG="finance"
AGENT_SLUG="us-tech-stocks"

# Build the request body
REQUEST_BODY=$(cat <<EOF
{
  "mode": "dashboard",
  "context": {
    "orgSlug": "${ORG_SLUG}",
    "agentSlug": "${AGENT_SLUG}",
    "agentType": "prediction",
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

# Make the request
curl -s -X POST "${API_URL}/agent-to-agent/${ORG_SLUG}/${AGENT_SLUG}/tasks" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "${REQUEST_BODY}"
