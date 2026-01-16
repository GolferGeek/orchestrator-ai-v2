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
| AUTH-01 | Login with valid credentials | Navigate to login, enter credentials, submit | Redirects to /app/admin/settings | | |
| AUTH-02 | Access prediction agent | Click hamburger menu → Agents & Conversations → US Tech Stocks Predictor grid icon | Opens prediction dashboard | | |
| NAV-01 | Hamburger menu displays agents | Click hamburger menu | Shows all agents with correct icons | | |
| NAV-02 | Back to Dashboard navigation | Click "← Back to Dashboard" from any sub-page | Returns to prediction dashboard | | |

### 2. Prediction Dashboard
| ID | Test Case | Steps | Expected Result | Status | Last Tested |
|----|-----------|-------|-----------------|--------|-------------|
| DASH-01 | Dashboard loads | Navigate to `/app/prediction/dashboard?agentSlug=us-tech-stocks` | Page displays with stats and predictions | PASS | 2026-01-16 |
| DASH-02 | Stats display correctly | Verify stats row | Shows Active Predictions, Resolved, Portfolios, LLM Agreement | PASS | 2026-01-16 |
| DASH-03 | Filter dropdowns work | Click each filter dropdown | Options appear for Portfolio, Status, Domain, Outcome | | |
| DASH-04 | Prediction cards display | View prediction cards section | Cards show symbol, direction, confidence, magnitude, timeframe | PASS | 2026-01-16 |
| DASH-05 | Training & Learning cards | Verify all 5 cards present | Learnings, Analysts, Missed Opportunities, Learning Queue, Test Lab | PASS | 2026-01-16 |
| DASH-06 | Manage Portfolios button | Click "Manage Portfolios" | Opens portfolio management view | | |
| DASH-07 | Watch Activity button | Click "Watch Activity" | Opens activity monitoring view | | |
| DASH-08 | Refresh button | Click "Refresh" | Dashboard data refreshes | | |

### 3. Prediction Detail View
| ID | Test Case | Steps | Expected Result | Status | Last Tested |
|----|-----------|-------|-----------------|--------|-------------|
| PRED-01 | Open prediction detail | Click on any prediction card | Opens `/app/prediction/{uuid}` with full details | PASS | 2026-01-16 |
| PRED-02 | Prediction summary displays | View header section | Shows symbol, company, status, direction, confidence, magnitude, timeframe, dates | PASS | 2026-01-16 |
| PRED-03 | Actions row present | View actions section | Create Learning, Missed Opportunities, View Analysts buttons | PASS | 2026-01-16 |
| PRED-04 | Prediction lineage displays | Scroll to lineage section | Shows hierarchical tree: Prediction → Predictor → Signal → Fingerprint → Source Article | PASS | 2026-01-16 |
| PRED-05 | Source article links work | Click "Open" on Source Article | Opens original article source | | |
| PRED-06 | Create Learning action | Click "Create Learning" | Opens learning creation flow | | |
| PRED-07 | View Analysts action | Click "View Analysts" | Shows analysts for this target | | |

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
| TEST-08 | Run Prediction Generation | Click "Prediction Generation" | Runs prediction generation against test data | | |
| TEST-09 | Run Evaluation | Click "Evaluation" | Runs evaluation against test data | | |
| TEST-10 | Export scenario | Click "Export" on scenario | Exports scenario data as JSON | | |
| TEST-11 | Cleanup scenario | Click "Cleanup" on scenario | Removes generated test data | | |
| TEST-12 | Import JSON | Click "Import JSON" | Opens import dialog | | |
| TEST-13 | New Scenario creation | Click "+ New Scenario" | Opens modal with Name, Description, Injection Points fields | PASS | 2026-01-16 |
| TEST-14 | Historical Replay Tests | View replay tests section | Shows "No Replay Tests" or existing tests | PASS | 2026-01-16 |
| TEST-15 | New Replay Test | Click "+ New Replay Test" | Opens replay test creation flow | | |

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
| ANLY-08 | Start Learning Session | Click "Start Learning Session" | Initiates learning session flow | | |
| ANLY-09 | New Analyst creation | Click "+ New Analyst" | Opens analyst creation form | | |
| ANLY-10 | Edit analyst | Click edit icon on analyst card | Opens analyst edit form | | |
| ANLY-11 | Delete analyst | Click delete icon on analyst card | Shows confirmation, deletes analyst | | |

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
| LRNG-03 | Create new learning | Click create learning button | Opens learning creation form | | |
| LRNG-04 | Edit learning | Click edit on learning | Opens learning edit form | | |
| LRNG-05 | Delete learning | Click delete on learning | Shows confirmation, deletes learning | | |

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
| PORT-04 | Add position | Click add position | Opens position creation | | |
| PORT-05 | Edit position | Click edit on position | Opens position edit form | | |

### 10. Activity Monitoring
| ID | Test Case | Steps | Expected Result | Status | Last Tested |
|----|-----------|-------|-----------------|--------|-------------|
| ACT-01 | Activity view loads | Click "Watch Activity" from dashboard | Opens activity feed panel with Live indicator | PASS | 2026-01-16 |
| ACT-02 | Activity feed displays | View activity feed | Shows timestamped events (ARTICLE, CRAWL, SIGNAL, etc.) | PASS | 2026-01-16 |
| ACT-03 | Filter activities | Use activity filters | Filters by event type tabs | PASS | 2026-01-16 |
| ACT-04 | Acknowledge activity | Click acknowledge on activity item | Marks activity as acknowledged | | |

### 11. Investment Risk Dashboard
| ID | Test Case | Steps | Expected Result | Status | Last Tested |
|----|-----------|-------|-----------------|--------|-------------|
| RISK-01 | Risk dashboard loads | Navigate to Investment Risk Agent | Opens risk dashboard | PASS | 2026-01-16 |
| RISK-02 | Tabs display | View dashboard tabs | Overview, Alerts, Dimensions, Learnings, Settings | PASS | 2026-01-16 |
| RISK-03 | Settings - Select Scope | Go to Settings tab, click dropdown | Shows available scopes | PASS | 2026-01-16 |
| RISK-04 | Configure subjects | Select scope, add subjects | Subjects appear in sidebar | | |
| RISK-05 | Analyze All | Click "Analyze All" | Runs risk analysis on all subjects | | |
| RISK-06 | View risk details | Click on subject in sidebar | Shows detailed risk analysis | | |

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
| Authentication & Navigation | 4 | | | |
| Prediction Dashboard | 8 | | | |
| Prediction Detail View | 7 | | | |
| Test Lab | 15 | | | |
| Analyst Management | 11 | | | |
| Learning Queue | 5 | | | |
| Learnings Management | 5 | | | |
| Missed Opportunities | 4 | | | |
| Portfolio Management | 5 | | | |
| Activity Monitoring | 4 | | | |
| Investment Risk Dashboard | 6 | | | |
| **TOTAL** | **74** | | | |

### Issues Found
| Issue ID | Test ID | Description | Severity | Status |
|----------|---------|-------------|----------|--------|
| | | | | |

### Notes
-

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
