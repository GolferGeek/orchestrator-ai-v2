# Complete Testing Guide - Finance Stock/Crypto Predictor

**Document Created**: 2026-01-16
**Purpose**: Executable testing guide for Claude Code to systematically test every capability
**Test Environment**: Local development (localhost:6100)

---

## Prerequisites

### Required Services Running
- [ ] API running on `http://localhost:6100`
- [ ] Supabase running locally
- [ ] Web app running on `http://localhost:6101` (for UI verification)

### Start Commands
```bash
# Terminal 1: API
cd apps/api && npm run start:dev

# Terminal 2: Web (optional for UI tests)
cd apps/web && npm run dev
```

### Test User Credentials
```
Email: demo.user@orchestratorai.io
Password: DemoUser123!
User ID: b29a590e-b07f-49df-a25b-574c956b5035
Org Slug: finance
Agent Slug: us-tech-stocks-2025
```

---

## Phase 0: Authentication & Setup

### TEST 0.1: Authenticate and Get Token

**Action**: Login to get JWT token

```bash
curl -X POST http://localhost:6100/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo.user@orchestratorai.io",
    "password": "DemoUser123!"
  }'
```

**Expected**: Response with `accessToken` field
**Store**: Save the `accessToken` for all subsequent requests

### TEST 0.2: Verify API Health

```bash
curl http://localhost:6100/health
```

**Expected**: `{"status":"ok"}` or similar health response

### TEST 0.3: Verify Agent Exists

```bash
curl -X GET "http://localhost:6100/agent-to-agent/finance/us-tech-stocks-2025/.well-known/agent.json" \
  -H "Authorization: Bearer {TOKEN}"
```

**Expected**: Agent configuration JSON with prediction agent details

---

## Phase 1: Prediction & Forecasting System

### TEST 1.1: List Universes

**What**: Verify universe management works

```bash
curl -X POST http://localhost:6100/agent-to-agent/finance/us-tech-stocks-2025/tasks \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "dashboard",
    "context": {
      "orgSlug": "finance",
      "agentSlug": "us-tech-stocks-2025",
      "agentType": "prediction",
      "userId": "b29a590e-b07f-49df-a25b-574c956b5035",
      "conversationId": "00000000-0000-0000-0000-000000000000",
      "taskId": "00000000-0000-0000-0000-000000000000",
      "planId": "00000000-0000-0000-0000-000000000000",
      "deliverableId": "00000000-0000-0000-0000-000000000000",
      "provider": "anthropic",
      "model": "claude-sonnet-4-20250514"
    },
    "payload": {
      "mode": "dashboard",
      "action": "universes.list",
      "params": {},
      "filters": {},
      "pagination": {"page": 1, "limit": 50}
    }
  }'
```

**Expected**: Array of universes (stocks, crypto)
**Verify**: At least one universe with `domain: "stocks"` or `domain: "crypto"`

### TEST 1.2: Get Universe Details

```bash
# Use universe ID from TEST 1.1
curl -X POST http://localhost:6100/agent-to-agent/finance/us-tech-stocks-2025/tasks \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "dashboard",
    "context": { ... },
    "payload": {
      "mode": "dashboard",
      "action": "universes.get",
      "params": {"id": "{UNIVERSE_ID}"},
      "filters": {},
      "pagination": {}
    }
  }'
```

**Expected**: Single universe object with configuration details

### TEST 1.3: List Targets (Instruments)

```bash
curl -X POST http://localhost:6100/agent-to-agent/finance/us-tech-stocks-2025/tasks \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "dashboard",
    "context": { ... },
    "payload": {
      "mode": "dashboard",
      "action": "targets.list",
      "params": {},
      "filters": {},
      "pagination": {"page": 1, "limit": 50}
    }
  }'
```

**Expected**: Array of targets (AAPL, MSFT, BTC, ETH, etc.)
**Verify**:
- Production targets should NOT have `T_` prefix
- Each target has `symbol`, `name`, `universe_id`

### TEST 1.4: Get Target Details

```bash
curl -X POST http://localhost:6100/agent-to-agent/finance/us-tech-stocks-2025/tasks \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "dashboard",
    "context": { ... },
    "payload": {
      "mode": "dashboard",
      "action": "targets.get",
      "params": {"id": "{TARGET_ID}"},
      "filters": {},
      "pagination": {}
    }
  }'
```

**Expected**: Single target with full configuration

### TEST 1.5: List Sources

```bash
curl -X POST http://localhost:6100/agent-to-agent/finance/us-tech-stocks-2025/tasks \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "dashboard",
    "context": { ... },
    "payload": {
      "mode": "dashboard",
      "action": "sources.list",
      "params": {},
      "filters": {},
      "pagination": {"page": 1, "limit": 50}
    }
  }'
```

**Expected**: Array of news sources with crawl frequencies
**Verify**: Sources have `crawl_frequency_minutes` (5, 10, 15, 30, or 60)

### TEST 1.6: List Signals

```bash
curl -X POST http://localhost:6100/agent-to-agent/finance/us-tech-stocks-2025/tasks \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "dashboard",
    "context": { ... },
    "payload": {
      "mode": "dashboard",
      "action": "signals.list",
      "params": {},
      "filters": {},
      "pagination": {"page": 1, "limit": 20}
    }
  }'
```

**Expected**: Array of detected signals
**Verify**: Each signal has `direction` (bullish/bearish/neutral), `confidence` (0.0-1.0)

### TEST 1.7: List Predictions

```bash
curl -X POST http://localhost:6100/agent-to-agent/finance/us-tech-stocks-2025/tasks \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "dashboard",
    "context": { ... },
    "payload": {
      "mode": "dashboard",
      "action": "predictions.list",
      "params": {},
      "filters": {},
      "pagination": {"page": 1, "limit": 20}
    }
  }'
```

**Expected**: Array of predictions
**Verify**: Each prediction has:
- `direction` (bullish/bearish)
- `target_price`
- `confidence`
- `timeframe` or `expires_at`

### TEST 1.8: Get Prediction Details

```bash
curl -X POST http://localhost:6100/agent-to-agent/finance/us-tech-stocks-2025/tasks \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "dashboard",
    "context": { ... },
    "payload": {
      "mode": "dashboard",
      "action": "predictions.get",
      "params": {"id": "{PREDICTION_ID}"},
      "filters": {},
      "pagination": {}
    }
  }'
```

**Expected**: Full prediction with linked signals, predictors, and analyst votes

---

## Phase 2: Portfolio & Trading System

### TEST 2.1: List User Portfolios

```bash
curl -X POST http://localhost:6100/agent-to-agent/finance/us-tech-stocks-2025/tasks \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "dashboard",
    "context": { ... },
    "payload": {
      "mode": "dashboard",
      "action": "user-portfolios.list",
      "params": {},
      "filters": {},
      "pagination": {}
    }
  }'
```

**Expected**: User portfolio with $1,000,000 starting balance
**Verify**: `initial_balance` = 1000000

### TEST 2.2: Get Portfolio Summary

```bash
curl -X POST http://localhost:6100/agent-to-agent/finance/us-tech-stocks-2025/tasks \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "dashboard",
    "context": { ... },
    "payload": {
      "mode": "dashboard",
      "action": "user-portfolios.get-summary",
      "params": {"portfolio_id": "{PORTFOLIO_ID}"},
      "filters": {},
      "pagination": {}
    }
  }'
```

**Expected**: Summary with:
- `current_balance`
- `realized_pnl`
- `unrealized_pnl`
- `win_rate`
- `open_positions`
- `closed_positions`

### TEST 2.3: List Analyst Portfolios (Dual Fork)

```bash
curl -X POST http://localhost:6100/agent-to-agent/finance/us-tech-stocks-2025/tasks \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "dashboard",
    "context": { ... },
    "payload": {
      "mode": "dashboard",
      "action": "analyst-portfolios.list",
      "params": {},
      "filters": {},
      "pagination": {}
    }
  }'
```

**Expected**: Two portfolios per analyst (user fork + agent fork)
**Verify**:
- Each analyst has `fork_type`: "user" and "agent"
- Each has `initial_balance` = 1000000
- Agent fork has `status` field (active/warning/probation/suspended)

### TEST 2.4: Get Analyst Portfolio Details

```bash
curl -X POST http://localhost:6100/agent-to-agent/finance/us-tech-stocks-2025/tasks \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "dashboard",
    "context": { ... },
    "payload": {
      "mode": "dashboard",
      "action": "analyst-portfolios.get",
      "params": {"id": "{PORTFOLIO_ID}"},
      "filters": {},
      "pagination": {}
    }
  }'
```

**Expected**: Portfolio with positions and performance metrics

### TEST 2.5: List Positions

```bash
curl -X POST http://localhost:6100/agent-to-agent/finance/us-tech-stocks-2025/tasks \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "dashboard",
    "context": { ... },
    "payload": {
      "mode": "dashboard",
      "action": "positions.list",
      "params": {"portfolio_id": "{PORTFOLIO_ID}"},
      "filters": {},
      "pagination": {}
    }
  }'
```

**Expected**: Array of positions with:
- `entry_price`
- `current_price` or `exit_price`
- `quantity`
- `direction` (long/short)
- `pnl` (realized or unrealized)

---

## Phase 3: Analyst & Learning System

### TEST 3.1: List Analysts

```bash
curl -X POST http://localhost:6100/agent-to-agent/finance/us-tech-stocks-2025/tasks \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "dashboard",
    "context": { ... },
    "payload": {
      "mode": "dashboard",
      "action": "analysts.list",
      "params": {},
      "filters": {},
      "pagination": {}
    }
  }'
```

**Expected**: Array of analysts (Technical, Fundamental, Sentiment, Macro, etc.)
**Verify**: Each has `perspective`, `tier_instructions`, `default_weight`

### TEST 3.2: Get Analyst Details

```bash
curl -X POST http://localhost:6100/agent-to-agent/finance/us-tech-stocks-2025/tasks \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "dashboard",
    "context": { ... },
    "payload": {
      "mode": "dashboard",
      "action": "analysts.get",
      "params": {"id": "{ANALYST_ID}"},
      "filters": {},
      "pagination": {}
    }
  }'
```

**Expected**: Full analyst configuration with context versions

### TEST 3.3: List Analyst Context Versions

```bash
curl -X POST http://localhost:6100/agent-to-agent/finance/us-tech-stocks-2025/tasks \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "dashboard",
    "context": { ... },
    "payload": {
      "mode": "dashboard",
      "action": "analyst-context-versions.list",
      "params": {"analyst_id": "{ANALYST_ID}"},
      "filters": {},
      "pagination": {}
    }
  }'
```

**Expected**: Version history for analyst context
**Verify**: Versions ordered by `version_number` or `created_at`

### TEST 3.4: List Learning Queue

```bash
curl -X POST http://localhost:6100/agent-to-agent/finance/us-tech-stocks-2025/tasks \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "dashboard",
    "context": { ... },
    "payload": {
      "mode": "dashboard",
      "action": "learning-queue.list",
      "params": {},
      "filters": {},
      "pagination": {"page": 1, "limit": 20}
    }
  }'
```

**Expected**: AI-suggested improvements
**Verify**: Each item has `suggestion_type`, `description`, `evidence`

### TEST 3.5: List Review Queue (HITL)

```bash
curl -X POST http://localhost:6100/agent-to-agent/finance/us-tech-stocks-2025/tasks \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "dashboard",
    "context": { ... },
    "payload": {
      "mode": "dashboard",
      "action": "review-queue.list",
      "params": {},
      "filters": {},
      "pagination": {"page": 1, "limit": 20}
    }
  }'
```

**Expected**: Signals awaiting human review (40-70% confidence)
**Verify**: Items have `status` (pending/approved/rejected)

### TEST 3.6: List Learnings

```bash
curl -X POST http://localhost:6100/agent-to-agent/finance/us-tech-stocks-2025/tasks \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "dashboard",
    "context": { ... },
    "payload": {
      "mode": "dashboard",
      "action": "learnings.list",
      "params": {},
      "filters": {},
      "pagination": {"page": 1, "limit": 20}
    }
  }'
```

**Expected**: Adopted learnings
**Verify**: Each has `learning_type`, `applied_to`, `performance_impact`

### TEST 3.7: List Fork Learning Exchanges

```bash
curl -X POST http://localhost:6100/agent-to-agent/finance/us-tech-stocks-2025/tasks \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "dashboard",
    "context": { ... },
    "payload": {
      "mode": "dashboard",
      "action": "fork-learning-exchanges.list",
      "params": {},
      "filters": {},
      "pagination": {}
    }
  }'
```

**Expected**: Exchanges between user and agent forks
**Verify**: Each has `initiator` (user/agent), `outcome` (adopted/rejected/pending)

### TEST 3.8: List Agent Self-Modifications

```bash
curl -X POST http://localhost:6100/agent-to-agent/finance/us-tech-stocks-2025/tasks \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "dashboard",
    "context": { ... },
    "payload": {
      "mode": "dashboard",
      "action": "agent-self-modifications.list",
      "params": {},
      "filters": {},
      "pagination": {}
    }
  }'
```

**Expected**: Log of AI self-improvements
**Verify**: Each has `modification_type`, `performance_context`, `hitl_acknowledged`

### TEST 3.9: Get Daily Analyst Metrics

```bash
curl -X POST http://localhost:6100/agent-to-agent/finance/us-tech-stocks-2025/tasks \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "dashboard",
    "context": { ... },
    "payload": {
      "mode": "dashboard",
      "action": "analyst-performance-metrics.list",
      "params": {},
      "filters": {},
      "pagination": {}
    }
  }'
```

**Expected**: Performance metrics per analyst
**Verify**: `solo_pnl`, `contribution_pnl`, `dissent_accuracy`, `ranking`

---

## Phase 4: Testing & Validation System

### TEST 4.1: List Test Scenarios

```bash
curl -X POST http://localhost:6100/agent-to-agent/finance/us-tech-stocks-2025/tasks \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "dashboard",
    "context": { ... },
    "payload": {
      "mode": "dashboard",
      "action": "test-scenarios.list",
      "params": {},
      "filters": {},
      "pagination": {}
    }
  }'
```

**Expected**: Array of test scenarios

### TEST 4.2: Create Test Scenario

```bash
curl -X POST http://localhost:6100/agent-to-agent/finance/us-tech-stocks-2025/tasks \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "dashboard",
    "context": { ... },
    "payload": {
      "mode": "dashboard",
      "action": "test-scenarios.create",
      "params": {
        "name": "Claude Code Test - {TIMESTAMP}",
        "description": "Automated test scenario created by Claude Code",
        "injection_points": ["signals", "predictions"],
        "config": {
          "test_type": "integration",
          "auto_cleanup": true
        }
      },
      "filters": {},
      "pagination": {}
    }
  }'
```

**Expected**: Created scenario with `id`
**Store**: Save scenario ID for subsequent tests

### TEST 4.3: List Test Articles

```bash
curl -X POST http://localhost:6100/agent-to-agent/finance/us-tech-stocks-2025/tasks \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "dashboard",
    "context": { ... },
    "payload": {
      "mode": "dashboard",
      "action": "test-articles.list",
      "params": {},
      "filters": {},
      "pagination": {}
    }
  }'
```

**Expected**: Array of synthetic test articles

### TEST 4.4: Generate Test Articles

```bash
curl -X POST http://localhost:6100/agent-to-agent/finance/us-tech-stocks-2025/tasks \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "dashboard",
    "context": { ... },
    "payload": {
      "mode": "dashboard",
      "action": "test-articles.generate",
      "params": {
        "scenario_id": "{SCENARIO_ID}",
        "topic": "AAPL",
        "sentiment": "bullish",
        "count": 3
      },
      "filters": {},
      "pagination": {}
    }
  }'
```

**Expected**: Generated articles linked to scenario

### TEST 4.5: Create Test Price Data

```bash
curl -X POST http://localhost:6100/agent-to-agent/finance/us-tech-stocks-2025/tasks \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "dashboard",
    "context": { ... },
    "payload": {
      "mode": "dashboard",
      "action": "test-price-data.bulk-create",
      "params": {
        "scenario_id": "{SCENARIO_ID}",
        "symbol": "AAPL",
        "prices": [
          {"date": "2026-01-10", "open": 150.0, "high": 152.0, "low": 149.5, "close": 151.5, "volume": 1000000},
          {"date": "2026-01-11", "open": 151.5, "high": 155.0, "low": 151.0, "close": 154.8, "volume": 1200000},
          {"date": "2026-01-12", "open": 154.8, "high": 158.0, "low": 154.0, "close": 157.2, "volume": 1500000}
        ]
      },
      "filters": {},
      "pagination": {}
    }
  }'
```

**Expected**: Price data created for scenario

### TEST 4.6: List Test Target Mirrors

```bash
curl -X POST http://localhost:6100/agent-to-agent/finance/us-tech-stocks-2025/tasks \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "dashboard",
    "context": { ... },
    "payload": {
      "mode": "dashboard",
      "action": "test-target-mirrors.list",
      "params": {},
      "filters": {},
      "pagination": {}
    }
  }'
```

**Expected**: T_ prefixed mirror targets

### TEST 4.7: Run Test Scenario

```bash
curl -X POST http://localhost:6100/agent-to-agent/finance/us-tech-stocks-2025/tasks \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "dashboard",
    "context": { ... },
    "payload": {
      "mode": "dashboard",
      "action": "test-scenarios.run",
      "params": {
        "scenario_id": "{SCENARIO_ID}"
      },
      "filters": {},
      "pagination": {}
    }
  }'
```

**Expected**: Scenario execution started
**Verify**: Check scenario status changes to "running" then "completed"

### TEST 4.8: Get Test Scenario Results

```bash
curl -X POST http://localhost:6100/agent-to-agent/finance/us-tech-stocks-2025/tasks \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "dashboard",
    "context": { ... },
    "payload": {
      "mode": "dashboard",
      "action": "test-scenarios.get",
      "params": {"id": "{SCENARIO_ID}"},
      "filters": {},
      "pagination": {}
    }
  }'
```

**Expected**: Scenario with execution results

### TEST 4.9: Verify Test Data Isolation

```bash
curl -X POST http://localhost:6100/agent-to-agent/finance/us-tech-stocks-2025/tasks \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "dashboard",
    "context": { ... },
    "payload": {
      "mode": "dashboard",
      "action": "analytics.test-vs-production",
      "params": {},
      "filters": {},
      "pagination": {}
    }
  }'
```

**Expected**: Stats showing test data is isolated from production

### TEST 4.10: Delete Test Scenario (Cleanup)

```bash
curl -X POST http://localhost:6100/agent-to-agent/finance/us-tech-stocks-2025/tasks \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "dashboard",
    "context": { ... },
    "payload": {
      "mode": "dashboard",
      "action": "test-scenarios.delete",
      "params": {"id": "{SCENARIO_ID}"},
      "filters": {},
      "pagination": {}
    }
  }'
```

**Expected**: Scenario and related test data deleted

---

## Phase 5: Analytics & Monitoring

### TEST 5.1: Get Overall Analytics

```bash
curl -X POST http://localhost:6100/agent-to-agent/finance/us-tech-stocks-2025/tasks \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "dashboard",
    "context": { ... },
    "payload": {
      "mode": "dashboard",
      "action": "analytics.overview",
      "params": {},
      "filters": {},
      "pagination": {}
    }
  }'
```

**Expected**: Overall accuracy metrics

### TEST 5.2: Get Accuracy by Target

```bash
curl -X POST http://localhost:6100/agent-to-agent/finance/us-tech-stocks-2025/tasks \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "dashboard",
    "context": { ... },
    "payload": {
      "mode": "dashboard",
      "action": "analytics.accuracy-by-target",
      "params": {},
      "filters": {},
      "pagination": {}
    }
  }'
```

**Expected**: Accuracy breakdown per symbol

### TEST 5.3: List Strategies

```bash
curl -X POST http://localhost:6100/agent-to-agent/finance/us-tech-stocks-2025/tasks \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "dashboard",
    "context": { ... },
    "payload": {
      "mode": "dashboard",
      "action": "strategies.list",
      "params": {},
      "filters": {},
      "pagination": {}
    }
  }'
```

**Expected**: Array of prediction strategies with performance

### TEST 5.4: List Missed Opportunities

```bash
curl -X POST http://localhost:6100/agent-to-agent/finance/us-tech-stocks-2025/tasks \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "dashboard",
    "context": { ... },
    "payload": {
      "mode": "dashboard",
      "action": "missed-opportunities.list",
      "params": {},
      "filters": {},
      "pagination": {"page": 1, "limit": 20}
    }
  }'
```

**Expected**: Moves that should have been predicted
**Verify**: Each has `move_magnitude`, `root_cause`, `suggested_improvement`

### TEST 5.5: Get Learning Velocity

```bash
curl -X POST http://localhost:6100/agent-to-agent/finance/us-tech-stocks-2025/tasks \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "dashboard",
    "context": { ... },
    "payload": {
      "mode": "dashboard",
      "action": "analytics.learning-velocity",
      "params": {},
      "filters": {},
      "pagination": {}
    }
  }'
```

**Expected**: Metrics on how fast the system is learning

### TEST 5.6: Get Test Data Stats

```bash
curl -X POST http://localhost:6100/agent-to-agent/finance/us-tech-stocks-2025/tasks \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "dashboard",
    "context": { ... },
    "payload": {
      "mode": "dashboard",
      "action": "analytics.test-data-stats",
      "params": {},
      "filters": {},
      "pagination": {}
    }
  }'
```

**Expected**: Statistics on test data volume and isolation

---

## Phase 6: End-to-End Pipeline Test

### TEST 6.1: Full Pipeline Integration Test

This test verifies the complete prediction pipeline works end-to-end:

1. **Create test scenario**
2. **Generate bullish test articles for AAPL**
3. **Create price data showing upward movement**
4. **Run scenario**
5. **Verify signals were detected**
6. **Verify prediction was generated**
7. **Verify evaluation scored correctly**
8. **Cleanup test data**

```bash
# Run the full E2E test
cd apps/api
npx jest --config testing/test/jest-e2e.json prediction-runner-full-pipeline-proof.e2e-spec --verbose
```

**Expected**: All pipeline stages execute successfully

---

## Phase 7: Automated E2E Test Suite

### Run All Prediction Tests

```bash
cd apps/api
npx jest --config testing/test/jest-e2e.json prediction-runner --verbose
```

### Run Specific Test Categories

```bash
# Test scenario CRUD
npx jest --config testing/test/jest-e2e.json prediction-runner-test-scenario-crud.e2e-spec

# Analyst management
npx jest --config testing/test/jest-e2e.json prediction-runner-analyst-crud.e2e-spec

# Learning promotion
npx jest --config testing/test/jest-e2e.json prediction-runner-learning-promotion.e2e-spec

# Review queue
npx jest --config testing/test/jest-e2e.json prediction-runner-review-queue.e2e-spec

# Full pipeline proof
npx jest --config testing/test/jest-e2e.json prediction-runner-full-pipeline-proof.e2e-spec
```

---

## Test Results Tracking

### Test Run Template

| Test ID | Test Name | Status | Notes |
|---------|-----------|--------|-------|
| 0.1 | Authenticate | | |
| 0.2 | API Health | | |
| 0.3 | Agent Exists | | |
| 1.1 | List Universes | | |
| 1.2 | Get Universe | | |
| 1.3 | List Targets | | |
| ... | ... | ... | ... |

### Status Key
- PASS: Test completed successfully
- FAIL: Test failed (note error)
- SKIP: Test skipped (note reason)
- BLOCKED: Dependency not met

---

## Troubleshooting

### Common Issues

**401 Unauthorized**
- Token expired - re-authenticate
- User doesn't exist - check Supabase auth.users

**404 Agent Not Found**
- Wrong orgSlug or agentSlug
- Agent not registered in database

**500 Internal Server Error**
- Check API logs: `cd apps/api && npm run start:dev`
- Verify Supabase is running

**Empty Results**
- Data may not exist yet
- Check filters are correct
- Verify universe/target IDs

### Debug Commands

```bash
# Check API is running
curl http://localhost:6100/health

# Check Supabase
cd apps/api && supabase status

# View API logs
# (visible in terminal running npm run start:dev)

# Check database directly
# Use Supabase Studio at http://localhost:6010
```

---

## Document Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-16 | 1.0 | Initial complete testing guide |
