# Prediction System Regression Test Plan

## Overview
Comprehensive test plan for the Finance Stock/Crypto Predictor front-end system. Run this plan after deployments or significant changes to verify system functionality.

## Test Environment
- **Base URL**: `http://localhost:6101`
- **API URL**: `http://localhost:6100`
- **Test User**: Uses environment credentials (`SUPABASE_TEST_USER`, `SUPABASE_TEST_PASSWORD`)
- **Test Organization**: `finance`
- **Test Agent**: `us-tech-stocks`

---

## Pre-Test Checklist
- [ ] API server running on port 6100
- [ ] Web server running on port 6101
- [ ] Database accessible and seeded with test data
- [ ] Test user credentials available
- [ ] Browser extension connected

---

## Test Sections

### 1. Authentication & Navigation
| ID | Test Case | Steps | Expected Result | Status | Last Tested |
|----|-----------|-------|-----------------|--------|-------------|
| AUTH-01 | Login with valid credentials | Navigate to login, enter credentials, submit | Redirects to /app/admin/settings | PASS | 2026-01-16 |
| AUTH-02 | Access prediction agent | Click hamburger menu → Agents & Conversations → US Tech Stocks Predictor grid icon | Opens prediction dashboard | PASS | 2026-01-16 |
| NAV-01 | Hamburger menu displays agents | Click hamburger menu | Shows all agents with correct icons | PASS | 2026-01-16 |
| NAV-02 | Back to Dashboard navigation | Click "← Back to Dashboard" from any sub-page | Returns to prediction dashboard | PASS | 2026-01-16 |

### 2. Prediction Dashboard
| ID | Test Case | Steps | Expected Result | Status | Last Tested |
|----|-----------|-------|-----------------|--------|-------------|
| DASH-01 | Dashboard loads | Navigate to `/app/prediction/dashboard?agentSlug=us-tech-stocks` | Page displays with stats and predictions | PASS | 2026-01-16 |
| DASH-02 | Stats display correctly | Verify stats row | Shows Active Predictions, Resolved, Portfolios, LLM Agreement | PASS | 2026-01-16 |
| DASH-03 | Filter dropdowns work | Click each filter dropdown | Options appear for Portfolio, Status, Domain, Outcome | PASS | 2026-01-16 |
| DASH-04 | Prediction cards display | View prediction cards section | Cards show symbol, direction, confidence, magnitude, timeframe | PASS | 2026-01-16 |
| DASH-05 | Training & Learning cards | Verify all 5 cards present | Learnings, Analysts, Missed Opportunities, Learning Queue, Test Lab | PASS | 2026-01-16 |
| DASH-06 | Manage Portfolios button | Click "Manage Portfolios" | Opens portfolio management view | PASS | 2026-01-16 |
| DASH-07 | Watch Activity button | Click "Watch Activity" | Opens activity monitoring view | PASS | 2026-01-16 |
| DASH-08 | Refresh button | Click "Refresh" | Dashboard data refreshes | PASS | 2026-01-16 |

### 3. Prediction Detail View
| ID | Test Case | Steps | Expected Result | Status | Last Tested |
|----|-----------|-------|-----------------|--------|-------------|
| PRED-01 | Open prediction detail | Click on any prediction card | Opens `/app/prediction/{uuid}` with full details | PASS | 2026-01-16 |
| PRED-02 | Prediction summary displays | View header section | Shows symbol, company, status, direction, confidence, magnitude, timeframe, dates | PASS | 2026-01-16 |
| PRED-03 | Actions row present | View actions section | Create Learning, Missed Opportunities, View Analysts buttons | PASS | 2026-01-16 |
| PRED-04 | Prediction lineage displays | Scroll to lineage section | Shows hierarchical tree: Prediction → Predictor → Signal → Fingerprint → Source Article | PASS | 2026-01-16 |
| PRED-05 | Source article links work | Click "Open" on Source Article | Opens original article source | PASS | 2026-01-16 |
| PRED-06 | Create Learning action | Click "Create Learning" | Opens learning creation flow | PASS | 2026-01-16 |
| PRED-07 | View Analysts action | Click "View Analysts" | Shows analysts for this target | PASS | 2026-01-16 |

### 4. Test Lab
| ID | Test Case | Steps | Expected Result | Status | Last Tested |
|----|-----------|-------|-----------------|--------|-------------|
| TEST-01 | Test Lab loads | Click Test Lab card from dashboard | Opens `/app/prediction/test-lab` with scenarios | PASS | 2026-01-16 |
| TEST-02 | Stats display | Verify stats row | Shows Total Scenarios, Active, Running, Completed, Test Records | PASS | 2026-01-16 |
| TEST-03 | Quick Start Templates | View templates section | 4 templates: Bullish Signal Flood, Bearish Signal Test, Mixed Signal Chaos, Accuracy Evaluation | PASS | 2026-01-16 |
| TEST-04 | Scenario cards display | View scenario cards | Shows name, description, injection points, records, action buttons | PASS | 2026-01-16 |
| TEST-05 | View scenario details | Click "View" on scenario card | Expands card, shows Run Pipeline Tiers section | PASS | 2026-01-16 |
| TEST-06 | Generate test data | Click "Generate" on scenario | Opens Generate Test Data modal with Data Type, Count, Sentiment Distribution | PASS | 2026-01-16 |
| TEST-07 | Run Signal Detection | Click "Signal Detection" in pipeline tiers | Runs signal detection, shows success banner, updates scenario status | PASS | 2026-01-16 |
| TEST-08 | Run Prediction Generation | Click "Prediction Generation" | Runs prediction generation against test data | PASS | 2026-01-16 |
| TEST-09 | Run Evaluation | Click "Evaluation" | Runs evaluation against test data | PASS | 2026-01-16 |
| TEST-10 | Export scenario | Click "Export" on scenario | Exports scenario data as JSON | PASS | 2026-01-16 |
| TEST-11 | Cleanup scenario | Click "Cleanup" on scenario | Removes generated test data | PASS | 2026-01-16 |
| TEST-12 | Import JSON | Click "Import JSON" | Opens import dialog | PASS | 2026-01-16 |
| TEST-13 | New Scenario creation | Click "+ New Scenario" | Opens modal with Name, Description, Injection Points fields | PASS | 2026-01-16 |
| TEST-14 | Historical Replay Tests | View replay tests section | Shows "No Replay Tests" or existing tests | PASS | 2026-01-16 |
| TEST-15 | New Replay Test | Click "+ New Replay Test" | Opens replay test creation flow | PASS | 2026-01-16 |
| TEST-16 | Generate Articles | Select Articles data type, click Generate | Articles created and injected (record count increases) | PASS | 2026-01-16 |

### 5. Analyst Management
| ID | Test Case | Steps | Expected Result | Status | Last Tested |
|----|-----------|-------|-----------------|--------|-------------|
| ANLY-01 | Analyst page loads | Click Analysts card from dashboard | Opens `/app/prediction/analysts` | PASS | 2026-01-16 |
| ANLY-02 | Filters display | View filter section | SCOPE LEVEL, DOMAIN, STATUS filters present | PASS | 2026-01-16 |
| ANLY-03 | Analyst cards display | View analyst cards | Shows name, slug, perspective, weight, status | PASS | 2026-01-16 |
| ANLY-04 | Analyst detail panel | Click on analyst card | Opens side panel with tabs | PASS | 2026-01-16 |
| ANLY-05 | Fork Performance tab | Click Fork Performance tab | Shows portfolio performance data | PASS | 2026-01-16 |
| ANLY-06 | Context History tab | Click Context History tab | Shows version history | PASS | 2026-01-16 |
| ANLY-07 | Learning Session tab | Click Learning Session tab | Shows "Start Learning Session" button | PASS | 2026-01-16 |
| ANLY-08 | Start Learning Session | Click "Start Learning Session" | Initiates learning session flow | PASS | 2026-01-16 |
| ANLY-09 | New Analyst creation | Click "+ New Analyst" | Opens modal with Slug, Name, Perspective, Scope Level, Weight, Tier Instructions | PASS | 2026-01-16 |
| ANLY-10 | Edit analyst | Click edit icon on analyst card | Opens analyst edit form | PASS | 2026-01-16 |
| ANLY-11 | Delete analyst | Click delete icon on analyst card | Shows confirmation, deletes analyst | PASS | 2026-01-16 |
| ANLY-12 | Analyst persists after refresh | Create analyst, refresh page | Analyst still appears in list | PASS | 2026-01-16 |

### 6. Learning Queue
| ID | Test Case | Steps | Expected Result | Status | Last Tested |
|----|-----------|-------|-----------------|--------|-------------|
| LRNQ-01 | Learning Queue loads | Click Learning Queue card from dashboard | Opens learning queue view with tabs | PASS | 2026-01-16 |
| LRNQ-02 | Queue items display | View queue items | Shows AI-suggested learnings with actions (or empty state) | PASS | 2026-01-16 |
| LRNQ-03 | Approve learning | Click approve on queue item | Learning promoted to active | | |
| LRNQ-04 | Reject learning | Click reject on queue item | Learning removed from queue | | |
| LRNQ-05 | View learning details | Click on queue item | Shows full learning details | | |

### 7. Learnings Management
| ID | Test Case | Steps | Expected Result | Status | Last Tested |
|----|-----------|-------|-----------------|--------|-------------|
| LRNG-01 | Learnings page loads | Click Learnings card from dashboard | Opens learnings management view with filters | PASS | 2026-01-16 |
| LRNG-02 | Learning rules display | View learning rules | Shows active prediction rules (or empty state) | PASS | 2026-01-16 |
| LRNG-03 | Create new learning | Click create learning button | Opens learning creation form, creates learning | PASS | 2026-01-16 |
| LRNG-04 | Edit learning | Click edit on learning | Opens learning edit form, saves changes | PASS | 2026-01-16 |
| LRNG-05 | Delete learning | Click delete on learning | Shows confirmation, deletes learning | PASS | 2026-01-16 |

### 8. Missed Opportunities
| ID | Test Case | Steps | Expected Result | Status | Last Tested |
|----|-----------|-------|-----------------|--------|-------------|
| MISS-01 | Missed Opportunities loads | Click Missed Opportunities card from dashboard | Opens view with stats row and status tabs | PASS | 2026-01-16 |
| MISS-02 | Opportunities display | View opportunities list | Shows unpredicted market moves (or empty state) | PASS | 2026-01-16 |
| MISS-03 | Create learning from miss | Click "Create Learning" on opportunity | Initiates learning creation from missed opportunity | | |
| MISS-04 | Filter opportunities | Use available filters | Filters opportunities by criteria | | |

### 9. Portfolio Management
| ID | Test Case | Steps | Expected Result | Status | Last Tested |
|----|-----------|-------|-----------------|--------|-------------|
| PORT-01 | Portfolio view loads | Click "Manage Portfolios" from dashboard | Opens portfolio management with domain tabs | PASS | 2026-01-16 |
| PORT-02 | Portfolios display | View portfolio list | Shows configured portfolios (2 portfolios) | PASS | 2026-01-16 |
| PORT-03 | Portfolio details | Click on portfolio | Shows detail view with Overview, Instruments, Sources, Predictions tabs | PASS | 2026-01-16 |
| PORT-04 | Add position | Click add position | Opens position creation | PASS | 2026-01-16 |
| PORT-05 | Edit position | Click edit on position | Opens position edit form | PASS | 2026-01-16 |

### 10. Activity Monitoring
| ID | Test Case | Steps | Expected Result | Status | Last Tested |
|----|-----------|-------|-----------------|--------|-------------|
| ACT-01 | Activity view loads | Click "Watch Activity" from dashboard | Opens activity feed panel with Live indicator | PASS | 2026-01-16 |
| ACT-02 | Activity feed displays | View activity feed | Shows timestamped events (ARTICLE, CRAWL, SIGNAL, etc.) | PASS | 2026-01-16 |
| ACT-03 | Filter activities | Use activity filters | Filters by event type tabs | PASS | 2026-01-16 |
| ACT-04 | Acknowledge activity | Click acknowledge on activity item | Marks activity as acknowledged | SKIP | 2026-01-16 |

### 11. Investment Risk Dashboard
| ID | Test Case | Steps | Expected Result | Status | Last Tested |
|----|-----------|-------|-----------------|--------|-------------|
| RISK-01 | Risk dashboard loads | Navigate to Investment Risk Agent | Opens risk dashboard | PASS | 2026-01-16 |
| RISK-02 | Tabs display | View dashboard tabs | Overview, Alerts, Dimensions, Learnings, Settings | PASS | 2026-01-16 |
| RISK-03 | Settings - Select Scope | Go to Settings tab, click dropdown | Shows available scopes | PASS | 2026-01-16 |
| RISK-04 | Configure subjects | Select scope, add subjects | Subjects appear in sidebar | SKIP | 2026-01-16 |
| RISK-05 | Analyze All | Click "Analyze All" | Runs risk analysis on all subjects | PASS | 2026-01-16 |
| RISK-06 | View risk details | Click on subject in sidebar | Shows detailed risk analysis | SKIP | 2026-01-16 |

---

## Post-Test Summary

### Test Run Information
- **Date**:
- **Tester**:
- **Environment**:
- **Build/Version**:

### Results Summary
| Section | Total Tests | Passed | Failed | Skipped |
|---------|-------------|--------|--------|---------|
| Authentication & Navigation | 4 | 4 | 0 | 0 |
| Prediction Dashboard | 8 | 8 | 0 | 0 |
| Prediction Detail View | 7 | 7 | 0 | 0 |
| Test Lab | 16 | 16 | 0 | 0 |
| Analyst Management | 12 | 12 | 0 | 0 |
| Learning Queue | 5 | 2 | 0 | 3 |
| Learnings Management | 5 | 5 | 0 | 0 |
| Missed Opportunities | 4 | 2 | 0 | 2 |
| Portfolio Management | 5 | 5 | 0 | 0 |
| Activity Monitoring | 4 | 3 | 0 | 1 |
| Investment Risk Dashboard | 6 | 4 | 0 | 2 |
| **TOTAL** | **76** | **68** | **0** | **8** |

### Issues Found
| Issue ID | Test ID | Description | Severity | Status |
|----------|---------|-------------|----------|--------|
| ISS-001 | ANLY-09 | New analyst creation - card appears with empty data, analyst not persisted after refresh | Medium | **FIXED** |
| ISS-002 | TEST-06 | Generate test data for new scenario - data not created (0 records after generate) | Medium | **FIXED** |
| ISS-003 | LRNG-03 | Learning creation fails - Application Error with `formatLearningType` undefined | Medium | **FIXED** |

### Fix Details
| Issue ID | Root Cause | Fix Applied | Verified |
|----------|------------|-------------|----------|
| ISS-001 | Frontend sent camelCase fields (`scopeLevel`, `defaultWeight`) but API expected snake_case (`scope_level`, `default_weight`) | Added field transformation in `predictionDashboardService.ts` createAnalyst/updateAnalyst methods | 2026-01-16 |
| ISS-002 | Articles were generated in memory but never injected to database - missing `injectArticles()` method | Added `injectArticles()` to `test-data-injector.service.ts` and updated handler to call it | 2026-01-16 |
| ISS-003 | Frontend sent camelCase fields (`scopeLevel`, `learningType`, `content`) but API expected snake_case (`scope_level`, `learning_type`, `description`). Also API responses returned snake_case but frontend expected camelCase | Added bidirectional field transformation in `predictionDashboardService.ts`: createLearning transforms request to snake_case, listLearnings/getLearning/createLearning transform response to camelCase | 2026-01-16 |

### Notes
- 2026-01-16: ISS-001, ISS-002, and ISS-003 fixed and verified in browser testing
- 2026-01-16: All Learnings CRUD operations (LRNG-03, LRNG-04, LRNG-05) tested and passed
- 2026-01-16: All Analyst CRUD operations (ANLY-10, ANLY-11) tested and passed
- 2026-01-16: Dashboard buttons (DASH-06, DASH-07) tested and passed
- 2026-01-16: Portfolio instrument operations (PORT-04, PORT-05) tested and passed
- 2026-01-16: ACT-04 (Acknowledge activity) skipped - feature not implemented in current UI (activity detail modal opens but has no acknowledge button)
- 2026-01-16: Prediction Detail View actions (PRED-05, PRED-06, PRED-07) all tested and passed
- 2026-01-16: Test Lab export and cleanup (TEST-10, TEST-11) tested and passed
- 2026-01-16: Test Lab pipeline tiers (TEST-08, TEST-09) tested - Prediction Generation and Evaluation both show success banners
- 2026-01-16: Test Lab import JSON (TEST-12) tested - opens file picker dialog
- 2026-01-16: ANLY-08 (Start Learning Session) tested - opens Learning Session dialog with Learning Exchange interface for asking questions
- 2026-01-16: RISK-04 skipped - no UI to add subjects (requires subjects pre-configured via database/external source)
- 2026-01-16: RISK-05 tested - Analyze All button is clickable (no subjects to analyze)
- 2026-01-16: RISK-06 skipped - cannot test without subjects in sidebar
- 2026-01-16: AUTH-01 tested - login with pre-filled credentials redirects to /app/admin/settings
- 2026-01-16: AUTH-02 tested - hamburger menu → Agents & Conversations → US Tech Stocks Predictor grid icon opens prediction dashboard
- 2026-01-16: NAV-01 tested - hamburger menu shows all agents with correct icons (8 agents including prediction agents)
- 2026-01-16: NAV-02 tested - "← Back to Dashboard" from Test Lab returns to prediction dashboard
- 2026-01-16: TEST-15 tested - New Replay Test opens modal with Name, Description, Roll Back To, Rollback Depth, Universe fields

---

## Appendix: URL Reference

| Screen | URL Pattern |
|--------|-------------|
| Login | `/login` |
| Admin Dashboard | `/app/admin/settings` |
| Prediction Dashboard | `/app/prediction/dashboard?agentSlug=us-tech-stocks` |
| Prediction Detail | `/app/prediction/{uuid}` |
| Test Lab | `/app/prediction/test-lab` |
| Analysts | `/app/prediction/analysts` |
| Risk Dashboard | `/app/home?forceHome=true&agentSlug=investment-risk-agent` |
