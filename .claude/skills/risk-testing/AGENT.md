---
name: risk-testing-agent
description: "Expert agent for testing the Investment Risk Analysis system. Understands the entire system architecture, coordinates test phases progressively from simple to advanced, and delegates to specialized skills."
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
category: "testing"
type: "orchestrator"
uses-skills: ["risk-test-auth-skill", "risk-test-api-skill", "risk-test-ui-skill"]
---

# Risk Testing Agent

Expert agent that understands the entire Investment Risk Analysis system and coordinates comprehensive testing progressively from basic to advanced scenarios.

## What This Agent Knows

### System Architecture
- **5-Phase Risk Analysis Pipeline**:
  1. Risk Radar (Dimension Analysis)
  2. Red Team Debate
  3. Composite Scoring
  4. Risk Evaluation & Learning
  5. Advanced Portfolio Analysis

- **Background Runners**:
  - Risk Analysis Runner (every 30 min)
  - Alert Runner (every 5 min)
  - Evaluation Runner (daily @ 6 AM)
  - Learning Runner (daily @ 4 AM)

### Key Concepts
- **Scopes**: Risk analysis contexts with domain, thresholds, LLM config
- **Subjects**: Items being analyzed (stocks, crypto, decisions, projects)
- **Dimensions**: Risk categories measured (Market, Fundamental, Technical, etc.)
- **Composite Scores**: Aggregated 0-100 risk score from dimensions
- **Debates**: Red Team vs Blue Team adversarial analysis
- **Learnings**: AI-suggested improvements (HITL approval workflow)
- **Correlations**: Cross-subject correlation analysis
- **Portfolio**: Scope-level aggregation and trends

### API Structure
- Base: `http://localhost:6103`
- Dashboard endpoint: `POST /agent-to-agent/{orgSlug}/{agentSlug}/tasks`
- All operations use `action: "{entity}.{operation}"` format

### Progressive Test Phases (Simple → Advanced)

#### Phase 1: Foundation (Start Here)
1. **Health Check**: Verify API is running
2. **Authentication**: Get JWT token
3. **List Scopes**: Verify scope retrieval

#### Phase 2: Basic CRUD
4. **Scope Operations**: List, Get, Create
5. **Subject Operations**: List, Get, Create
6. **Dimension Operations**: List, Get

#### Phase 3: Core Analysis
7. **Manual Subject Analysis**: Trigger analysis
8. **View Assessments**: Check dimension scores
9. **View Composite Scores**: Check aggregated scores

#### Phase 4: Advanced Analysis
10. **Red Team Debate**: Trigger and view debates
11. **Alert Management**: View and acknowledge alerts
12. **Learning Queue**: View and approve/reject learnings

#### Phase 5: Portfolio Features
13. **Portfolio Summary**: View aggregated stats
14. **Correlation Matrix**: View subject correlations
15. **Concentration Risk**: Identify high correlation

#### Phase 6: UI Testing (Chrome Extension)
16. **Dashboard Navigation**: Tab switching, sidebar selection
17. **Detail View**: Score display, radar chart, debate summary
18. **Settings**: Scope selection, configuration

## Documentation References

- **Testing Guide**: `docs/risk-testing-guide-2026-01-16.md`
- **API Services**: `apps/api/src/risk-runner/services/`
- **Dashboard Handlers**: `apps/api/src/risk-runner/task-router/handlers/`
- **Web Components**: `apps/web/src/components/AgentPanes/Risk/`

## How To Use

This agent coordinates testing by:
1. Using `risk-test-auth-skill` to authenticate
2. Using `risk-test-api-skill` to call dashboard endpoints
3. Using `risk-test-ui-skill` for Chrome extension testing
4. Running tests progressively from Phase 1 → Phase 6

## Default Configuration

```
orgSlug: finance
agentSlug: investment-risk-agent
agentType: risk
API_URL: http://localhost:6100
WEB_URL: http://localhost:6103
RISK_DASHBOARD_URL: /app/risk/dashboard?agentSlug=investment-risk-agent&orgSlug=finance
SCOPE_ID: b454c2f7-a071-4ea3-acf8-1439b6b2b6c0
```

## Pre-Test Checklist

Before running tests, verify:

1. **Services Running**:
   ```bash
   # Check API health
   curl -s http://localhost:6100/health

   # Check Web app
   curl -s http://localhost:6103 | head -1
   ```

2. **Test Data Exists**:
   ```bash
   # Quick DB check (from apps/api directory)
   npm run supabase:local -- db exec --sql "SELECT COUNT(*) as scopes FROM risk.scopes WHERE org_slug = 'finance'"
   ```

3. **Auth Token Valid** (for browser testing):
   - Check browser console for 401 errors
   - If token expired, re-login via browser

## Common Issues & Solutions

| Issue | Symptom | Solution |
|-------|---------|----------|
| Token expired | 401 errors, redirect to login | Re-authenticate via browser login |
| Wrong org | "Select organization" message | Add `orgSlug=finance` to URL |
| No data showing | Empty lists | Verify test data in database |
| API not responding | Connection errors | Check API server is running on port 6100 |

## Credentials

Read from environment:
- `SUPABASE_TEST_USER` - test user email
- `SUPABASE_TEST_PASSWORD` - test user password

## Quick Start Commands

```bash
# 1. Authenticate
source .claude/skills/risk-testing/test-helper.sh auth

# 2. Health check
source .claude/skills/risk-testing/test-helper.sh health

# 3. List scopes
source .claude/skills/risk-testing/test-helper.sh call "scopes.list"

# 4. List subjects for a scope
source .claude/skills/risk-testing/test-helper.sh call "subjects.list" '{"scopeId": "uuid"}'
```

## Risk Score Thresholds (Default)

| Score Range | Level | Color |
|-------------|-------|-------|
| 80-100 | Critical | Red |
| 60-79 | High | Orange |
| 40-59 | Medium | Yellow |
| 20-39 | Low | Green |
| 0-19 | Minimal | Light Green |

## Alert Thresholds (Default)

| Threshold | Default | Purpose |
|-----------|---------|---------|
| critical_threshold | 80 | Triggers critical alert |
| warning_threshold | 60 | Triggers warning alert |
| rapid_change_threshold | 15% | Detects sudden changes |
| stale_hours | 24 | Marks assessment as stale |
