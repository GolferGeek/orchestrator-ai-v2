# Test-Based Learning Loop - Comprehensive Test Plan

**Created:** January 11, 2026
**PRD Reference:** [2026-01-11-test-based-learning-loop.md](../prd/2026-01-11-test-based-learning-loop.md)
**Status:** Active

---

## Executive Summary

This test plan validates the complete Test-Based Learning Loop implementation across:
- **37 database migrations** (schema, triggers, indexes, views)
- **50+ API services and handlers** (prediction-runner module)
- **30+ Vue components** (prediction dashboard, test lab, analytics)
- **11 system invariants** (data isolation, safety, traceability)

The testing strategy is organized into **5 phases**, with Claude Code executing backend tests autonomously and flagging frontend tests that require human interaction.

---

## Table of Contents

1. [Phase 1: Infrastructure Verification](#phase-1-infrastructure-verification)
2. [Phase 2: Database Integrity](#phase-2-database-integrity)
3. [Phase 3: API Endpoint Testing](#phase-3-api-endpoint-testing)
4. [Phase 4: Frontend Component Testing](#phase-4-frontend-component-testing)
5. [Phase 5: End-to-End Scenario Validation](#phase-5-end-to-end-scenario-validation)
6. [Test Results Summary](#test-results-summary)

---

## Phase 1: Infrastructure Verification

### 1.1 Build Verification

| Test ID | Description | Command | Expected Result | Status |
|---------|-------------|---------|-----------------|--------|
| INF-001 | API app builds successfully | `npm run build -w @orchestrator/api` | No errors | ⏳ |
| INF-002 | Web app builds successfully | `npm run build -w @orchestrator/web` | No errors | ⏳ |
| INF-003 | API lint passes | `npm run lint -w @orchestrator/api` | No errors | ⏳ |
| INF-004 | Web lint passes | `npm run lint -w @orchestrator/web` | No errors | ⏳ |

### 1.2 Existing Unit Tests

| Test ID | Description | Command | Expected Result | Status |
|---------|-------------|---------|-----------------|--------|
| INF-005 | Prediction runner unit tests pass | `npm run test -- --testPathPattern="prediction-runner"` | All pass | ⏳ |
| INF-006 | Test data isolation tests pass | `npm run test -- --testPathPattern="test-data-isolation"` | All pass | ⏳ |
| INF-007 | Test scenario handler tests pass | `npm run test -- --testPathPattern="test-scenario.handler"` | All pass | ⏳ |

---

## Phase 2: Database Integrity

### 2.1 Migration Verification

| Test ID | Description | Method | Expected Result | Status |
|---------|-------------|--------|-----------------|--------|
| DB-001 | All migrations applied | Query `supabase_migrations` | 37+ prediction migrations | ⏳ |
| DB-002 | `is_test` column exists on all tables | Check schema | sources, signals, predictors, predictions, evaluations, learnings | ⏳ |
| DB-003 | Test scenarios table exists | Check schema | `prediction.test_scenarios` | ⏳ |
| DB-004 | Test articles table exists | Check schema | `prediction.test_articles` | ⏳ |
| DB-005 | Test price data table exists | Check schema | `prediction.test_price_data` | ⏳ |
| DB-006 | Test target mirrors table exists | Check schema | `prediction.test_target_mirrors` | ⏳ |
| DB-007 | Scenario runs table exists | Check schema | `prediction.scenario_runs` | ⏳ |
| DB-008 | Test audit log table exists | Check schema | `prediction.test_audit_log` | ⏳ |
| DB-009 | Learning lineage table exists | Check schema | `prediction.learning_lineage` | ⏳ |

### 2.2 Trigger Verification (INV-02, INV-03, INV-04, INV-08, INV-11)

| Test ID | Invariant | Description | Method | Status |
|---------|-----------|-------------|--------|--------|
| DB-010 | INV-02 | Test source creates test signals | Insert signal from is_test=true source | ⏳ |
| DB-011 | INV-03 | Test signal creates test predictors | Insert predictor from is_test=true signal | ⏳ |
| DB-012 | INV-04 | Test predictors only affect T_ targets | Try to create test predictor for non-T_ target (should fail) | ⏳ |
| DB-013 | INV-08 | T_ prefix enforced on test targets | Try to create test_target_mirror with non-T_ prefix (should fail) | ⏳ |
| DB-014 | INV-11 | Auto-create test mirror on target creation | Insert real target, verify T_ mirror created | ⏳ |

### 2.3 View Verification

| Test ID | Description | View | Status |
|---------|-------------|------|--------|
| DB-015 | Test data stats view works | `prediction.v_test_data_stats` | ⏳ |
| DB-016 | Production indexes exist | Check idx_*_production indexes | ⏳ |
| DB-017 | Analytics views work | `prediction.v_test_production_comparison` | ⏳ |

---

## Phase 3: API Endpoint Testing

### 3.1 Test Scenarios API

| Test ID | Endpoint | Method | Test Case | Expected | Status |
|---------|----------|--------|-----------|----------|--------|
| API-001 | `/prediction/test-scenarios` | GET | List all scenarios | 200, array | ⏳ |
| API-002 | `/prediction/test-scenarios` | POST | Create scenario | 201, scenario object | ⏳ |
| API-003 | `/prediction/test-scenarios/:id` | GET | Get single scenario | 200, scenario | ⏳ |
| API-004 | `/prediction/test-scenarios/:id` | PUT | Update scenario | 200, updated | ⏳ |
| API-005 | `/prediction/test-scenarios/:id/run` | POST | Run scenario | 201, run_id | ⏳ |

### 3.2 Test Articles API

| Test ID | Endpoint | Method | Test Case | Expected | Status |
|---------|----------|--------|-----------|----------|--------|
| API-006 | `/prediction/test-articles` | GET | List all articles | 200, array | ⏳ |
| API-007 | `/prediction/test-articles` | POST | Create article | 201, article object | ⏳ |
| API-008 | `/prediction/test-articles/generate` | POST | AI generate article | 201, generated article | ⏳ |
| API-009 | `/prediction/test-articles/:id` | DELETE | Delete article | 200/204 | ⏳ |

### 3.3 Test Prices API

| Test ID | Endpoint | Method | Test Case | Expected | Status |
|---------|----------|--------|-----------|----------|--------|
| API-010 | `/prediction/test-prices` | GET | List prices for symbol | 200, array | ⏳ |
| API-011 | `/prediction/test-prices` | POST | Create price point | 201, price object | ⏳ |
| API-012 | `/prediction/test-prices/bulk` | POST | Bulk create prices | 201, count | ⏳ |

### 3.4 Targets & Mirrors API

| Test ID | Endpoint | Method | Test Case | Expected | Status |
|---------|----------|--------|-----------|----------|--------|
| API-013 | `/prediction/targets` | GET | List targets (production mode) | Only non-T_ targets | ⏳ |
| API-014 | `/prediction/targets?is_test=true` | GET | List targets (test mode) | Includes T_ targets | ⏳ |
| API-015 | `/prediction/test-target-mirrors` | GET | List mirrors | Mirror relationships | ⏳ |

### 3.5 Learning Promotion API

| Test ID | Endpoint | Method | Test Case | Expected | Status |
|---------|----------|--------|-----------|----------|--------|
| API-016 | `/prediction/learnings/promotion-candidates` | GET | Get candidates | Test learnings meeting criteria | ⏳ |
| API-017 | `/prediction/learnings/:id/promote` | POST | Promote learning | 200, promoted | ⏳ |
| API-018 | `/prediction/learnings/:id/promote` | POST | Promote without notes | 400, validation error | ⏳ |

### 3.6 Scenario Runs API

| Test ID | Endpoint | Method | Test Case | Expected | Status |
|---------|----------|--------|-----------|----------|--------|
| API-019 | `/prediction/scenario-runs` | GET | List runs | 200, array | ⏳ |
| API-020 | `/prediction/scenario-runs/:id` | GET | Get run with artifacts | 200, run + linked artifacts | ⏳ |

### 3.7 Analytics API

| Test ID | Endpoint | Method | Test Case | Expected | Status |
|---------|----------|--------|-----------|----------|--------|
| API-021 | `/prediction/analytics/test-vs-production` | GET | Compare metrics | Side-by-side metrics | ⏳ |
| API-022 | `/prediction/analytics/learning-velocity` | GET | Learning velocity | Velocity metrics | ⏳ |

---

## Phase 4: Frontend Component Testing

### 4.1 Component Load Verification (Claude Code)

These tests verify components load without errors by checking the dev server.

| Test ID | Component | Route | Verification | Status |
|---------|-----------|-------|--------------|--------|
| FE-001 | PredictionDashboard | `/prediction` | No console errors | ⏳ |
| FE-002 | TestLabView | `/prediction/test-lab` | No console errors | ⏳ |
| FE-003 | LearningPromotionView | `/prediction/test/promotion` | No console errors | ⏳ |
| FE-004 | BacktestView | `/prediction/test/backtest` | No console errors | ⏳ |
| FE-005 | AnalyticsDashboardView | `/prediction/test/analytics` | No console errors | ⏳ |

### 4.2 Visual Verification (Human Required)

These tests require human eyes to verify correct rendering.

| Test ID | Screen | Route | Checklist | Status |
|---------|--------|-------|-----------|--------|
| FE-H01 | Test Control Center | `/prediction/test-lab` | TEST MODE indicator visible when enabled | 🔘 Human |
| FE-H02 | Targets & Mirrors | `/prediction/targets` | T_ targets shown in test mode | 🔘 Human |
| FE-H03 | Scenario Builder | `/prediction/test-lab` | Can create scenario with T_ targets | 🔘 Human |
| FE-H04 | Synthetic Articles | `/prediction/test-lab` | Can create/edit test articles | 🔘 Human |
| FE-H05 | Promotion Queue | `/prediction/test/promotion` | Shows validation metrics | 🔘 Human |
| FE-H06 | Analytics Split | `/prediction/test/analytics` | Shows test vs prod comparison | 🔘 Human |

---

## Phase 5: End-to-End Scenario Validation

### 5.1 SCN-001: Earnings Beat (Happy Path)

| Step | Action | Expected | Status |
|------|--------|----------|--------|
| 1 | Create test target T_TEST_AAPL | Target created | ⏳ |
| 2 | Create synthetic earnings article | Article with is_test=true | ⏳ |
| 3 | Create test price timeline | Prices injected | ⏳ |
| 4 | Create scenario | Scenario saved | ⏳ |
| 5 | Run scenario | scenario_run created | ⏳ |
| 6 | Verify signals created | Signals with is_test=true | ⏳ |
| 7 | Verify predictors created | Predictors with is_test=true | ⏳ |
| 8 | Verify production unaffected | Production queries exclude test data | ⏳ |

### 5.2 SCN-011: Leakage Prevention (Negative Test)

| Step | Action | Expected | Status |
|------|--------|----------|--------|
| 1 | Try to create test predictor for AAPL (not T_AAPL) | Should fail with error | ⏳ |
| 2 | Try to set is_test=false on test signal | Should fail with trigger | ⏳ |
| 3 | Query production endpoints | Should never return is_test=true | ⏳ |

### 5.3 SCN-012: Promotion Gate (Happy Path)

| Step | Action | Expected | Status |
|------|--------|----------|--------|
| 1 | Create test learning from scenario | Learning with is_test=true | ⏳ |
| 2 | Mark learning as validated | validation_metrics populated | ⏳ |
| 3 | Promote learning with notes | New prod learning, lineage tracked | ⏳ |
| 4 | Verify audit log | promotion action logged | ⏳ |

---

## Test Results Summary

### Overall Status

| Phase | Total | Pass | Fail | Pending |
|-------|-------|------|------|---------|
| Phase 1: Infrastructure | 7 | 0 | 0 | 7 |
| Phase 2: Database | 17 | 0 | 0 | 17 |
| Phase 3: API | 22 | 0 | 0 | 22 |
| Phase 4: Frontend | 11 | 0 | 0 | 11 |
| Phase 5: E2E | 15 | 0 | 0 | 15 |
| **Total** | **72** | **0** | **0** | **72** |

### Invariant Coverage

| Invariant | Test IDs | Status |
|-----------|----------|--------|
| INV-01: Production excludes is_test=true | API-013, E2E-SCN-011 | ⏳ |
| INV-02: Test sources → test signals | DB-010 | ⏳ |
| INV-03: Test signals → test predictors | DB-011 | ⏳ |
| INV-04: Test predictors → T_ targets only | DB-012, E2E-SCN-011 | ⏳ |
| INV-05: Climate filters is_test | TBD | ⏳ |
| INV-06: Metrics exclude test predictions | API-021 | ⏳ |
| INV-07: Promotion requires human approval | API-017, API-018 | ⏳ |
| INV-08: Test targets have T_ prefix | DB-013 | ⏳ |
| INV-09: Promotion preserves original | E2E-SCN-012 | ⏳ |
| INV-10: Scenario runs record versions | API-020 | ⏳ |
| INV-11: Auto-create T_ mirror | DB-014 | ⏳ |

---

## Execution Log

### Session: January 11, 2026

```
[Timestamp] Test execution begins
[Timestamp] Phase 1: ...
```

*(This section will be populated as tests run)*

---

## Notes

- Tests marked 🔘 Human require manual verification
- All other tests will be executed by Claude Code
- Results will be updated in real-time during execution
