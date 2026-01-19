---
name: prediction-test-navigation-skill
description: "Navigate and call prediction dashboard API endpoints. Knows all entities, operations, and payload formats."
allowed-tools: Bash, Read
category: "testing"
type: "utility"
---

# Prediction Test Navigation Skill

Provides patterns for calling all prediction dashboard endpoints.

## Dashboard Endpoint

```
POST http://localhost:6100/agent-to-agent/finance/us-tech-stocks/tasks
Authorization: Bearer {TOKEN}
Content-Type: application/json
```

## Payload Template

```json
{
  "mode": "dashboard",
  "context": {
    "orgSlug": "finance",
    "agentSlug": "us-tech-stocks",
    "agentType": "prediction",
    "userId": "{USER_ID}",
    "conversationId": "00000000-0000-0000-0000-000000000000",
    "taskId": "00000000-0000-0000-0000-000000000000",
    "planId": "00000000-0000-0000-0000-000000000000",
    "deliverableId": "00000000-0000-0000-0000-000000000000",
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514"
  },
  "payload": {
    "mode": "dashboard",
    "action": "{ENTITY}.{OPERATION}",
    "params": {},
    "filters": {},
    "pagination": {"page": 1, "limit": 50}
  }
}
```

## Available Entities & Operations

**Supported Entities** (from dashboard router):
- universes
- targets
- predictions
- sources
- signals
- analysts
- learnings
- learning-queue
- review-queue
- strategies
- missed-opportunities
- tool-requests
- learning-promotion
- test-scenarios
- test-articles
- test-price-data
- test-target-mirrors
- analytics
- source-seen-items
- agent-activity
- learning-session

### Core Entities
| Entity | Operations |
|--------|------------|
| universes | list, get, create, update, delete |
| targets | list (needs universeId), get, create, update, delete |
| predictions | list (needs universeId), get |
| sources | list (needs universeId), get, create, update, delete |
| signals | list (needs targetId), get |

### Analyst Entities
| Entity | Operations |
|--------|------------|
| analysts | list, get, create, update, delete |

### Learning Entities
| Entity | Operations |
|--------|------------|
| learnings | list, get |
| learning-queue | list, get |
| review-queue | list, get |
| learning-promotion | list, promote, get-candidates |
| learning-session | list, get |

### Test Entities
| Entity | Operations |
|--------|------------|
| test-scenarios | list, get, create, update, delete, run |
| test-articles | list, get, create, generate, bulk-create |
| test-price-data | list, create, bulk-create |
| test-target-mirrors | list, get, create, update, delete |

### Analytics & Monitoring
| Entity | Operations |
|--------|------------|
| analytics | accuracy-comparison, accuracy-by-strategy, accuracy-by-target, learning-velocity, scenario-effectiveness, promotion-funnel, summary |
| strategies | list, get |
| missed-opportunities | list, get |
| agent-activity | list, get, acknowledge, stats |
| source-seen-items | list |
| tool-requests | list, get |

## Helper Function (Bash)

```bash
# Call dashboard endpoint
call_dashboard() {
  local ACTION=$1
  local PARAMS=${2:-"{}"}
  local FILTERS=${3:-"{}"}

  curl -s -X POST "http://localhost:6100/agent-to-agent/finance/us-tech-stocks/tasks" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{
      \"mode\": \"dashboard\",
      \"context\": {
        \"orgSlug\": \"finance\",
        \"agentSlug\": \"us-tech-stocks\",
        \"agentType\": \"prediction\",
        \"userId\": \"${USER_ID}\",
        \"conversationId\": \"00000000-0000-0000-0000-000000000000\",
        \"taskId\": \"00000000-0000-0000-0000-000000000000\",
        \"planId\": \"00000000-0000-0000-0000-000000000000\",
        \"deliverableId\": \"00000000-0000-0000-0000-000000000000\",
        \"provider\": \"anthropic\",
        \"model\": \"claude-sonnet-4-20250514\"
      },
      \"payload\": {
        \"mode\": \"dashboard\",
        \"action\": \"${ACTION}\",
        \"params\": ${PARAMS},
        \"filters\": ${FILTERS},
        \"pagination\": {\"page\": 1, \"limit\": 50}
      }
    }"
}

# Usage examples:
# call_dashboard "universes.list"
# call_dashboard "targets.list" "{}" "{\"universe_id\": \"abc\"}"
# call_dashboard "test-scenarios.create" "{\"name\": \"Test\", \"description\": \"Desc\"}"
```

## Common Test Calls

### List universes
```bash
call_dashboard "universes.list"
```

### List targets (requires universeId in params)
```bash
# NOTE: universeId goes in PARAMS, not filters
call_dashboard "targets.list" '{"universeId": "uuid-here"}'
```

### Get specific target
```bash
call_dashboard "targets.get" "{\"id\": \"target-uuid\"}"
```

### List predictions
```bash
call_dashboard "predictions.list"
```

### List analysts
```bash
call_dashboard "analysts.list"
```

### Create test scenario
```bash
call_dashboard "test-scenarios.create" "{\"name\": \"My Test\", \"description\": \"Test desc\", \"injection_points\": [\"signals\"]}"
```

### Run test scenario
```bash
call_dashboard "test-scenarios.run" "{\"scenario_id\": \"scenario-uuid\"}"
```

## Response Format

Successful responses typically return:
```json
{
  "success": true,
  "data": [ ... ] or { ... },
  "pagination": { "page": 1, "limit": 50, "total": N }
}
```

Error responses:
```json
{
  "success": false,
  "error": "Error message"
}
```

## Tips

1. Always check `success` field in response
2. Use `jq` to parse JSON responses
3. Store IDs from list calls for subsequent get/update/delete calls
4. Test data uses `T_` prefix for target symbols
