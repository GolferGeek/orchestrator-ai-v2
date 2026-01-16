---
name: risk-test-api-skill
description: "Navigate and call risk dashboard API endpoints. Knows all entities, operations, and payload formats for progressive testing."
allowed-tools: Bash, Read
category: "testing"
type: "utility"
---

# Risk Test API Skill

Provides patterns for calling all risk dashboard endpoints, organized progressively from basic to advanced.

## Dashboard Endpoint

```
POST http://localhost:6100/agent-to-agent/finance/investment-risk-agent/tasks
Authorization: Bearer {TOKEN}
Content-Type: application/json
```

## Payload Template

```json
{
  "mode": "dashboard",
  "context": {
    "orgSlug": "finance",
    "agentSlug": "investment-risk-agent",
    "agentType": "risk",
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

---

## Progressive Test Entities

### Phase 1: Foundation (Start Here)

#### Health Check
```bash
curl -s http://localhost:6100/health
# Expected: {"status":"ok"}
```

### Phase 2: Basic CRUD

#### Scopes Entity
| Operation | Action | Params | Description |
|-----------|--------|--------|-------------|
| List all | `scopes.list` | - | Get all scopes |
| Get one | `scopes.get` | `{id}` | Get scope by ID |
| Create | `scopes.create` | `{name, domain, ...}` | Create new scope |
| Update | `scopes.update` | `{id, name?, ...}` | Update scope |
| Delete | `scopes.delete` | `{id}` | Delete scope |

#### Subjects Entity
| Operation | Action | Params | Description |
|-----------|--------|--------|-------------|
| List | `subjects.list` | `{scopeId}` | List subjects in scope |
| Get | `subjects.get` | `{id}` | Get subject by ID |
| Create | `subjects.create` | `{scopeId, identifier, subjectType}` | Create subject |
| Update | `subjects.update` | `{id, ...}` | Update subject |
| Delete | `subjects.delete` | `{id}` | Delete subject |

#### Dimensions Entity
| Operation | Action | Params | Description |
|-----------|--------|--------|-------------|
| List | `dimensions.list` | `{scopeId}` | List dimensions for scope |
| Get | `dimensions.get` | `{id}` | Get dimension by ID |

### Phase 3: Core Analysis

#### Subject Analysis
| Operation | Action | Params | Description |
|-----------|--------|--------|-------------|
| Analyze subject | `subjects.analyze` | `{id}` | Trigger analysis |
| Analyze scope | `scopes.analyze` | `{id}` | Analyze all subjects |

#### Composite Scores Entity
| Operation | Action | Params | Description |
|-----------|--------|--------|-------------|
| List | `composite-scores.list` | - | List all scores |
| Get | `composite-scores.get` | `{subjectId}` | Get latest score |
| History | `composite-scores.history` | `{subjectId}` | Get score history |

#### Assessments Entity
| Operation | Action | Params | Description |
|-----------|--------|--------|-------------|
| List | `assessments.list` | - | List all assessments |
| By subject | `assessments.by-subject` | `{subjectId}` | Assessments for subject |
| By dimension | `assessments.by-dimension` | `{dimensionId}` | Assessments for dimension |
| Get | `assessments.get` | `{id}` | Get single assessment |

### Phase 4: Advanced Analysis

#### Debates Entity
| Operation | Action | Params | Description |
|-----------|--------|--------|-------------|
| List | `debates.list` | - | List all debates |
| By subject | `debates.by-subject` | `{subjectId}` | Debates for subject |
| Get | `debates.get` | `{id}` | Get debate details |
| Trigger | `debates.trigger` | `{compositeScoreId}` | Trigger new debate |

#### Alerts Entity
| Operation | Action | Params | Description |
|-----------|--------|--------|-------------|
| List | `alerts.list` | - | List all alerts |
| By subject | `alerts.by-subject` | `{subjectId}` | Alerts for subject |
| Get | `alerts.get` | `{id}` | Get alert details |
| Acknowledge | `alerts.acknowledge` | `{id, notes?}` | Acknowledge alert |

#### Learning Queue Entity
| Operation | Action | Params | Description |
|-----------|--------|--------|-------------|
| List | `learning-queue.list` | `{status?: 'pending'}` | List learnings |
| Get | `learning-queue.get` | `{id}` | Get learning details |
| Approve | `learning-queue.approve` | `{id, notes?}` | Approve learning |
| Reject | `learning-queue.reject` | `{id, notes?}` | Reject learning |

#### Evaluations Entity
| Operation | Action | Params | Description |
|-----------|--------|--------|-------------|
| List | `evaluations.list` | - | List evaluations |
| By subject | `evaluations.by-subject` | `{subjectId}` | Evaluations for subject |
| Get | `evaluations.get` | `{id}` | Get evaluation details |
| Accuracy | `evaluations.accuracy-metrics` | - | Get accuracy metrics |

### Phase 5: Portfolio Features

#### Correlations Entity
| Operation | Action | Params | Description |
|-----------|--------|--------|-------------|
| Matrix | `correlations.matrix` | `{scopeId}` | Full correlation matrix |
| Pair | `correlations.pair` | `{subjectAId, subjectBId}` | Pair correlation |
| Concentration | `correlations.concentration` | `{scopeId}` | Concentration risk |

#### Portfolio Entity
| Operation | Action | Params | Description |
|-----------|--------|--------|-------------|
| Summary | `portfolio.summary` | `{scopeId}` | Portfolio risk summary |
| Contributions | `portfolio.contributions` | `{scopeId}` | Subject contributions |
| Heatmap | `portfolio.heatmap` | `{scopeId}` | Risk heatmap data |
| Trend | `portfolio.trend` | `{scopeId, period}` | Portfolio trend |

---

## Helper Function (Bash)

```bash
# Call dashboard endpoint
call_risk_dashboard() {
  local ACTION=$1
  local PARAMS=${2:-"{}"}
  local FILTERS=${3:-"{}"}

  curl -s -X POST "http://localhost:6100/agent-to-agent/finance/investment-risk-agent/tasks" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{
      \"mode\": \"dashboard\",
      \"context\": {
        \"orgSlug\": \"finance\",
        \"agentSlug\": \"investment-risk-agent\",
        \"agentType\": \"risk\",
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
```

---

## Progressive Test Calls

### Phase 1: Foundation
```bash
# 1.1 Health check
curl -s http://localhost:6100/health

# 1.2 Authenticate (run auth skill first)
```

### Phase 2: Basic CRUD
```bash
# 2.1 List scopes
call_risk_dashboard "scopes.list"

# 2.2 Get scope details (use ID from 2.1)
call_risk_dashboard "scopes.get" '{"id": "scope-uuid"}'

# 2.3 List subjects for scope
call_risk_dashboard "subjects.list" '{"scopeId": "scope-uuid"}'

# 2.4 Get subject details
call_risk_dashboard "subjects.get" '{"id": "subject-uuid"}'

# 2.5 List dimensions
call_risk_dashboard "dimensions.list" '{"scopeId": "scope-uuid"}'
```

### Phase 3: Core Analysis
```bash
# 3.1 Trigger subject analysis
call_risk_dashboard "subjects.analyze" '{"id": "subject-uuid"}'

# 3.2 Get assessments for subject
call_risk_dashboard "assessments.by-subject" '{"subjectId": "subject-uuid"}'

# 3.3 Get composite score
call_risk_dashboard "composite-scores.get" '{"subjectId": "subject-uuid"}'

# 3.4 Get score history
call_risk_dashboard "composite-scores.history" '{"subjectId": "subject-uuid"}'
```

### Phase 4: Advanced Analysis
```bash
# 4.1 List alerts
call_risk_dashboard "alerts.list"

# 4.2 Acknowledge alert
call_risk_dashboard "alerts.acknowledge" '{"id": "alert-uuid", "notes": "Reviewed and accepted"}'

# 4.3 List pending learnings
call_risk_dashboard "learning-queue.list" '{}' '{"status": "pending"}'

# 4.4 Approve learning
call_risk_dashboard "learning-queue.approve" '{"id": "learning-uuid"}'

# 4.5 Trigger debate (for high-risk subject)
call_risk_dashboard "debates.trigger" '{"compositeScoreId": "score-uuid"}'

# 4.6 Get debate details
call_risk_dashboard "debates.by-subject" '{"subjectId": "subject-uuid"}'
```

### Phase 5: Portfolio Features
```bash
# 5.1 Get portfolio summary
call_risk_dashboard "portfolio.summary" '{"scopeId": "scope-uuid"}'

# 5.2 Get correlation matrix
call_risk_dashboard "correlations.matrix" '{"scopeId": "scope-uuid"}'

# 5.3 Get concentration risk
call_risk_dashboard "correlations.concentration" '{"scopeId": "scope-uuid"}'

# 5.4 Get subject contributions
call_risk_dashboard "portfolio.contributions" '{"scopeId": "scope-uuid"}'

# 5.5 Get portfolio trend
call_risk_dashboard "portfolio.trend" '{"scopeId": "scope-uuid", "period": "week"}'
```

---

## Response Format

Successful responses:
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

---

## Create Test Data

### Create Scope
```bash
call_risk_dashboard "scopes.create" '{
  "name": "Test Investment Scope",
  "domain": "investment",
  "description": "Test scope for risk analysis",
  "is_test": true,
  "thresholds": {
    "critical_threshold": 80,
    "warning_threshold": 60,
    "rapid_change_threshold": 15,
    "stale_hours": 24
  },
  "analysis_config": {
    "riskRadar": {"enabled": true},
    "redTeam": {"enabled": true, "threshold": 50}
  }
}'
```

### Create Subject
```bash
call_risk_dashboard "subjects.create" '{
  "scopeId": "scope-uuid",
  "identifier": "AAPL",
  "name": "Apple Inc.",
  "subjectType": "stock",
  "metadata": {
    "exchange": "NASDAQ",
    "sector": "Technology"
  },
  "is_test": true
}'
```

---

## Tips

1. Always check `success` field in response
2. Use `jq` to parse JSON responses: `| jq '.data[0].id'`
3. Store IDs from list calls for subsequent operations
4. Test data should use `is_test: true` flag
5. Run phases sequentially - each builds on previous
