# Risk Analysis System Regression Test Plan

## Overview
Comprehensive progressive test plan for the Investment Risk Analysis system. Tests are organized from simple to complex, allowing incremental validation.

## Test Environment
- **API URL**: `http://localhost:6100`
- **Web URL**: `http://localhost:6101`
- **Test User**: Uses environment credentials (`SUPABASE_TEST_USER`, `SUPABASE_TEST_PASSWORD`)
- **Test Organization**: `finance`
- **Test Agent**: `investment-risk-agent`

---

## Pre-Test Checklist
- [ ] API server running on port 6103
- [ ] Web server running on port 6101
- [ ] Database accessible
- [ ] Test user credentials in .env
- [ ] Browser extension connected (for UI tests)

---

## Phase 1: Foundation (Start Here)

### 1.1 Health & Authentication
| ID | Test Case | Steps | Expected Result | Status | Tested |
|----|-----------|-------|-----------------|--------|--------|
| FOUND-01 | API Health Check | Run `./test-helper.sh health` | Returns `{"status":"ok"}` | | |
| FOUND-02 | Authentication | Run `./test-helper.sh auth` | Returns TOKEN and USER_ID | | |
| FOUND-03 | Token saved | Check `/tmp/risk_test_auth.env` | File contains TOKEN and USER_ID | | |

### 1.2 Basic Scope Access
| ID | Test Case | Steps | Expected Result | Status | Tested |
|----|-----------|-------|-----------------|--------|--------|
| FOUND-04 | List Scopes | `./test-helper.sh call scopes.list` | Returns array of scopes | | |
| FOUND-05 | Scope has required fields | Check response | Each scope has id, name, domain | | |

---

## Phase 2: Basic CRUD Operations

### 2.1 Scope Management
| ID | Test Case | Steps | Expected Result | Status | Tested |
|----|-----------|-------|-----------------|--------|--------|
| CRUD-01 | Get scope by ID | `call scopes.get '{"id": "uuid"}'` | Returns single scope | | |
| CRUD-02 | Create test scope | `call scopes.create '{...}'` | Scope created with is_test=true | | |
| CRUD-03 | Update scope name | `call scopes.update '{"id": "uuid", "name": "New"}'` | Name updated | | |
| CRUD-04 | Delete scope | `call scopes.delete '{"id": "uuid"}'` | Scope deleted | | |

### 2.2 Subject Management
| ID | Test Case | Steps | Expected Result | Status | Tested |
|----|-----------|-------|-----------------|--------|--------|
| CRUD-05 | List subjects | `call subjects.list '{"scopeId": "uuid"}'` | Returns subjects array | | |
| CRUD-06 | Get subject by ID | `call subjects.get '{"id": "uuid"}'` | Returns single subject | | |
| CRUD-07 | Create stock subject | `call subjects.create '{"scopeId":...,"identifier":"AAPL","subjectType":"stock"}'` | Subject created | | |
| CRUD-08 | Create crypto subject | `call subjects.create '{"identifier":"BTC","subjectType":"crypto"}'` | Subject created | | |
| CRUD-09 | Update subject | `call subjects.update '{"id":"uuid","name":"New Name"}'` | Subject updated | | |
| CRUD-10 | Delete subject | `call subjects.delete '{"id": "uuid"}'` | Subject deleted | | |

### 2.3 Dimension Access
| ID | Test Case | Steps | Expected Result | Status | Tested |
|----|-----------|-------|-----------------|--------|--------|
| CRUD-11 | List dimensions | `call dimensions.list '{"scopeId": "uuid"}'` | Returns dimensions | | |
| CRUD-12 | Get dimension | `call dimensions.get '{"id": "uuid"}'` | Returns dimension details | | |

---

## Phase 3: Core Analysis

### 3.1 Subject Analysis
| ID | Test Case | Steps | Expected Result | Status | Tested |
|----|-----------|-------|-----------------|--------|--------|
| ANLY-01 | Analyze single subject | `call subjects.analyze '{"id": "uuid"}'` | Analysis completes | | |
| ANLY-02 | Analysis creates assessments | Check assessments.by-subject | New assessments exist | | |
| ANLY-03 | Analysis creates composite | Check composite-scores.get | New composite score exists | | |
| ANLY-04 | Analyze entire scope | `call scopes.analyze '{"id": "uuid"}'` | All subjects analyzed | | |

### 3.2 Assessment Retrieval
| ID | Test Case | Steps | Expected Result | Status | Tested |
|----|-----------|-------|-----------------|--------|--------|
| ANLY-05 | List assessments | `call assessments.list` | Returns assessments | | |
| ANLY-06 | Get by subject | `call assessments.by-subject '{"subjectId": "uuid"}'` | Returns subject's assessments | | |
| ANLY-07 | Get by dimension | `call assessments.by-dimension '{"dimensionId": "uuid"}'` | Returns dimension's assessments | | |
| ANLY-08 | Assessment has score | Check response | Score between 0-100 | | |
| ANLY-09 | Assessment has confidence | Check response | Confidence between 0-1 | | |
| ANLY-10 | Assessment has reasoning | Check response | reasoning field populated | | |

### 3.3 Composite Scores
| ID | Test Case | Steps | Expected Result | Status | Tested |
|----|-----------|-------|-----------------|--------|--------|
| ANLY-11 | List composite scores | `call composite-scores.list` | Returns scores | | |
| ANLY-12 | Get by subject | `call composite-scores.get '{"subjectId": "uuid"}'` | Returns latest score | | |
| ANLY-13 | Get score history | `call composite-scores.history '{"subjectId": "uuid"}'` | Returns historical scores | | |
| ANLY-14 | Score has dimension breakdown | Check response | dimension_scores populated | | |
| ANLY-15 | Score in valid range | Check response | overall_score between 0-100 | | |

---

## Phase 4: Advanced Analysis

### 4.1 Red Team Debate
| ID | Test Case | Steps | Expected Result | Status | Tested |
|----|-----------|-------|-----------------|--------|--------|
| DEBT-01 | List debates | `call debates.list` | Returns debates | | |
| DEBT-02 | Get by subject | `call debates.by-subject '{"subjectId": "uuid"}'` | Returns subject's debates | | |
| DEBT-03 | Trigger debate | `call debates.trigger '{"compositeScoreId": "uuid"}'` | Debate created | | |
| DEBT-04 | Debate has Blue Team | Check response | blue_team data present | | |
| DEBT-05 | Debate has Red Team | Check response | red_team data present | | |
| DEBT-06 | Debate has Arbiter | Check response | arbiter data present | | |
| DEBT-07 | Debate has adjustment | Check response | score_adjustment calculated | | |

### 4.2 Alert Management
| ID | Test Case | Steps | Expected Result | Status | Tested |
|----|-----------|-------|-----------------|--------|--------|
| ALRT-01 | List alerts | `call alerts.list` | Returns alerts | | |
| ALRT-02 | List unacknowledged | `call alerts.list '{}' '{"acknowledged": false}'` | Returns only unacknowledged | | |
| ALRT-03 | Get by subject | `call alerts.by-subject '{"subjectId": "uuid"}'` | Returns subject's alerts | | |
| ALRT-04 | Alert has severity | Check response | severity is critical/warning/info | | |
| ALRT-05 | Acknowledge alert | `call alerts.acknowledge '{"id": "uuid"}'` | Alert acknowledged | | |
| ALRT-06 | Acknowledge with note | Include notes field | Note saved | | |

### 4.3 Learning Queue (HITL)
| ID | Test Case | Steps | Expected Result | Status | Tested |
|----|-----------|-------|-----------------|--------|--------|
| LRNQ-01 | List pending | `call learning-queue.list '{}' '{"status": "pending"}'` | Returns pending learnings | | |
| LRNQ-02 | Get learning | `call learning-queue.get '{"id": "uuid"}'` | Returns learning details | | |
| LRNQ-03 | Learning has type | Check response | learning_type populated | | |
| LRNQ-04 | Approve learning | `call learning-queue.approve '{"id": "uuid"}'` | Status becomes approved | | |
| LRNQ-05 | Reject learning | `call learning-queue.reject '{"id": "uuid"}'` | Status becomes rejected | | |
| LRNQ-06 | Approve with notes | Include notes field | Notes saved | | |

### 4.4 Evaluations
| ID | Test Case | Steps | Expected Result | Status | Tested |
|----|-----------|-------|-----------------|--------|--------|
| EVAL-01 | List evaluations | `call evaluations.list` | Returns evaluations | | |
| EVAL-02 | Get by subject | `call evaluations.by-subject '{"subjectId": "uuid"}'` | Returns subject's evaluations | | |
| EVAL-03 | Get accuracy metrics | `call evaluations.accuracy-metrics` | Returns metrics | | |

---

## Phase 5: Portfolio Features

### 5.1 Portfolio Summary
| ID | Test Case | Steps | Expected Result | Status | Tested |
|----|-----------|-------|-----------------|--------|--------|
| PORT-01 | Get summary | `call portfolio.summary '{"scopeId": "uuid"}'` | Returns summary | | |
| PORT-02 | Summary has avg score | Check response | average_score present | | |
| PORT-03 | Summary has distribution | Check response | risk_distribution present | | |
| PORT-04 | Get contributions | `call portfolio.contributions '{"scopeId": "uuid"}'` | Returns contributions | | |
| PORT-05 | Get heatmap | `call portfolio.heatmap '{"scopeId": "uuid"}'` | Returns heatmap data | | |
| PORT-06 | Get trend | `call portfolio.trend '{"scopeId": "uuid", "period": "week"}'` | Returns trend data | | |

### 5.2 Correlation Analysis
| ID | Test Case | Steps | Expected Result | Status | Tested |
|----|-----------|-------|-----------------|--------|--------|
| CORR-01 | Get correlation matrix | `call correlations.matrix '{"scopeId": "uuid"}'` | Returns matrix | | |
| CORR-02 | Matrix values in range | Check response | Values between -1 and 1 | | |
| CORR-03 | Get pair correlation | `call correlations.pair '{"subjectAId":"uuid","subjectBId":"uuid"}'` | Returns pair data | | |
| CORR-04 | Get concentration risk | `call correlations.concentration '{"scopeId": "uuid"}'` | Returns concentration | | |
| CORR-05 | Concentration has pairs | Check response | High correlation pairs listed | | |

---

## Phase 6: UI Testing (Chrome Extension)

### 6.1 Dashboard Navigation
| ID | Test Case | Steps | Expected Result | Status | Tested |
|----|-----------|-------|-----------------|--------|--------|
| UI-01 | Dashboard loads | Navigate to `/app/home?forceHome=true&agentSlug=investment-risk-agent` | Page displays | | |
| UI-02 | Title correct | View header | Shows "Investment Risk Dashboard" | | |
| UI-03 | Tabs visible | View tab bar | 5 tabs: Overview, Alerts, Dimensions, Learnings, Settings | | |
| UI-04 | Tab switching | Click each tab | Content changes appropriately | | |
| UI-05 | Refresh button | Click Refresh | Data reloads | | |

### 6.2 Settings Tab
| ID | Test Case | Steps | Expected Result | Status | Tested |
|----|-----------|-------|-----------------|--------|--------|
| UI-06 | Settings loads | Click Settings tab | Settings content displays | | |
| UI-07 | Scope dropdown | Click scope dropdown | Shows available scopes | | |
| UI-08 | Select scope | Choose different scope | All data refreshes | | |
| UI-09 | Edit scope name | Change name field | Changes saved | | |
| UI-10 | Threshold display | View thresholds | Shows critical/warning/rapid/stale | | |

### 6.3 Subject Sidebar
| ID | Test Case | Steps | Expected Result | Status | Tested |
|----|-----------|-------|-----------------|--------|--------|
| UI-11 | Sidebar displays | View Overview tab | Sidebar with subjects visible | | |
| UI-12 | Subject count badge | View header | Shows correct count | | |
| UI-13 | Search subjects | Type in search | List filters in real-time | | |
| UI-14 | Select subject | Click subject | Highlighted, detail loads | | |
| UI-15 | Score badge colors | View list | Colors match risk levels | | |
| UI-16 | Stale badge | View stale subject | Yellow badge appears | | |

### 6.4 Detail View
| ID | Test Case | Steps | Expected Result | Status | Tested |
|----|-----------|-------|-----------------|--------|--------|
| UI-17 | Detail loads | Select subject | Detail view displays | | |
| UI-18 | Subject header | View detail | Shows identifier and name | | |
| UI-19 | Score card | View detail | Shows score, confidence, date | | |
| UI-20 | Radar chart | View detail | SVG chart renders | | |
| UI-21 | Dimension cards | View detail | Grid of assessment cards | | |
| UI-22 | Expand reasoning | Click "Show Reasoning" | Reasoning text appears | | |
| UI-23 | Re-analyze button | Click Re-analyze | Analysis runs | | |

### 6.5 Debate Summary
| ID | Test Case | Steps | Expected Result | Status | Tested |
|----|-----------|-------|-----------------|--------|--------|
| UI-24 | Trigger Debate visible | View high-risk subject (>=70%) | Button appears | | |
| UI-25 | Trigger Debate | Click button | Debate summary appears | | |
| UI-26 | Three columns | View summary | Blue Team, Red Team, Arbiter | | |
| UI-27 | Score adjustment | View banner | Shows adjustment percentage | | |

### 6.6 Alerts Tab
| ID | Test Case | Steps | Expected Result | Status | Tested |
|----|-----------|-------|-----------------|--------|--------|
| UI-28 | Alerts tab loads | Click Alerts tab | Alert list displays | | |
| UI-29 | Alert cards | View list | Shows severity, message, actions | | |
| UI-30 | Acknowledge alert | Click Acknowledge | Alert removed | | |
| UI-31 | Tab badge updates | After acknowledge | Badge count decreases | | |

### 6.7 Learnings Tab
| ID | Test Case | Steps | Expected Result | Status | Tested |
|----|-----------|-------|-----------------|--------|--------|
| UI-32 | Learnings tab loads | Click Learnings tab | Learning list displays | | |
| UI-33 | Learning cards | View list | Shows type, description, JSON | | |
| UI-34 | Approve learning | Click Approve | Learning removed | | |
| UI-35 | Reject learning | Click Reject | Learning removed | | |
| UI-36 | Tab badge updates | After action | Badge count decreases | | |

### 6.8 Stats Cards
| ID | Test Case | Steps | Expected Result | Status | Tested |
|----|-----------|-------|-----------------|--------|--------|
| UI-37 | Stats display | View dashboard | Stats row visible | | |
| UI-38 | Total subjects | Check count | Matches API count | | |
| UI-39 | Analyzed subjects | Check count | Matches API count | | |
| UI-40 | Avg risk score | Check value | Matches calculated average | | |
| UI-41 | Alert badges | Check conditional cards | Show when alerts exist | | |

---

## Post-Test Summary

### Test Run Information
- **Date**:
- **Tester**:
- **Environment**:
- **Build/Version**:

### Results by Phase
| Phase | Total | Passed | Failed | Skipped |
|-------|-------|--------|--------|---------|
| Phase 1: Foundation | 5 | | | |
| Phase 2: Basic CRUD | 12 | | | |
| Phase 3: Core Analysis | 15 | | | |
| Phase 4: Advanced | 18 | | | |
| Phase 5: Portfolio | 10 | | | |
| Phase 6: UI Testing | 41 | | | |
| **TOTAL** | **101** | | | |

### Issues Found
| Issue ID | Test ID | Description | Severity | Status |
|----------|---------|-------------|----------|--------|
| | | | | |

### Notes
-

---

## Quick Reference: Test Commands

```bash
# Phase 1
./test-helper.sh health
./test-helper.sh auth
./test-helper.sh call scopes.list

# Phase 2
./test-helper.sh call subjects.list '{"scopeId": "UUID"}'
./test-helper.sh call dimensions.list '{"scopeId": "UUID"}'

# Phase 3
./test-helper.sh call subjects.analyze '{"id": "UUID"}'
./test-helper.sh call assessments.by-subject '{"subjectId": "UUID"}'
./test-helper.sh call composite-scores.get '{"subjectId": "UUID"}'

# Phase 4
./test-helper.sh call debates.trigger '{"compositeScoreId": "UUID"}'
./test-helper.sh call alerts.acknowledge '{"id": "UUID"}'
./test-helper.sh call learning-queue.approve '{"id": "UUID"}'

# Phase 5
./test-helper.sh call portfolio.summary '{"scopeId": "UUID"}'
./test-helper.sh call correlations.matrix '{"scopeId": "UUID"}'
```
