# Risk Analysis Module - Comprehensive Testing Guide

**Created:** 2026-01-16
**Version:** 1.0
**Module:** Risk Analysis (apps/api/src/risk-runner)

---

## Table of Contents

1. [Overview](#overview)
2. [User Capabilities Summary](#user-capabilities-summary)
3. [API/Backend Testing Scenarios](#testing-scenarios)
   - [A. Scope Management](#a-scope-management)
   - [B. Subject Management](#b-subject-management)
   - [C. Risk Radar (Dimension Analysis)](#c-risk-radar-dimension-analysis)
   - [D. Red Team Debate](#d-red-team-debate)
   - [E. Composite Scoring](#e-composite-scoring)
   - [F. Alerts](#f-alerts)
   - [G. Evaluations](#g-evaluations)
   - [H. Learning Queue (HITL)](#h-learning-queue-hitl)
   - [I. Correlation Analysis](#i-correlation-analysis)
   - [J. Portfolio Risk](#j-portfolio-risk)
4. [Integration Test Scenarios](#integration-test-scenarios)
5. [Edge Cases & Error Handling](#edge-cases--error-handling)
6. [Performance Testing](#performance-testing)
7. [Front-End UI Testing (Browser/Chrome Extension)](#front-end-ui-testing-browserchrome-extension)
   - [K. Header & Navigation](#k-header--navigation-tests)
   - [L. Overview Tab - Sidebar](#l-overview-tab---sidebar-tests)
   - [M. Overview Tab - Detail View](#m-overview-tab---detail-view-tests)
   - [N. Alerts Tab](#n-alerts-tab-tests)
   - [O. Dimensions Tab](#o-dimensions-tab-tests)
   - [P. Learnings Tab](#p-learnings-tab-tests)
   - [Q. Settings Tab](#q-settings-tab-tests)
   - [R. Loading & State](#r-loading--state-tests)
   - [S. End-to-End UI Scenarios](#s-end-to-end-ui-scenarios)
   - [T. Accessibility](#t-accessibility-tests)
   - [U. Data Flow Verification](#u-data-flow-verification)
8. [Complete User Interaction Checklist](#complete-user-interaction-checklist)

---

## Overview

The Risk Analysis module provides a comprehensive system for analyzing risk across multiple dimensions, aggregating scores, running adversarial debates, generating alerts, evaluating accuracy, and learning from outcomes. This guide covers all testable scenarios from both user and system perspectives.

### System Architecture Quick Reference

```
User Actions → Dashboard Router → Handlers → Services → Repositories → Database
                                     ↓
Scheduled Runners (Background) → Services → Repositories → Database
```

### Key Components

| Component | Purpose |
|-----------|---------|
| **Scopes** | Define risk analysis contexts (domain, thresholds, config) |
| **Subjects** | Individual items being analyzed (stocks, crypto, decisions) |
| **Dimensions** | Risk categories being measured (Market, Fundamental, etc.) |
| **Assessments** | Individual dimension scores (0-100) |
| **Composite Scores** | Aggregated overall risk score |
| **Debates** | Red Team adversarial analysis results |
| **Alerts** | Threshold breaches and change notifications |
| **Evaluations** | Prediction vs. actual outcome comparisons |
| **Learnings** | AI-suggested improvements (HITL workflow) |
| **Correlations** | Cross-subject correlation analysis |
| **Portfolio** | Scope-level aggregation and trends |

---

## User Capabilities Summary

### What Users Can Do

#### Setup & Configuration
- Create, update, delete risk analysis scopes
- Configure LLM providers for different tiers (gold/silver/bronze)
- Set alert thresholds (critical, warning, rapid change, stale)
- Enable/disable analysis features (Risk Radar, Red Team)
- Create, update, delete subjects within scopes
- Configure subject metadata (sector, industry, market cap, etc.)

#### Analysis & Monitoring
- Manually trigger analysis for subjects or entire scopes
- View real-time risk scores (0-100) with confidence levels
- See dimension-level breakdowns with reasoning and evidence
- Review Red Team debate results and score adjustments
- Acknowledge and manage alerts

#### Quality & Learning
- View evaluation results (prediction vs. actual outcomes)
- Access accuracy metrics (calibration, Brier score)
- Review AI-suggested learnings
- Approve/reject learnings with notes
- Track learning effectiveness

#### Portfolio Analysis
- View portfolio risk summaries
- Analyze risk distribution across subjects
- See subject contributions to portfolio risk
- View correlation matrix between subjects
- Identify concentration risk
- Track portfolio trends over time

---

## Testing Scenarios

### A. Scope Management

#### A.1 Create Scope

| Test ID | Scenario | Input | Expected Output |
|---------|----------|-------|-----------------|
| A.1.1 | Create minimal scope | `{ organization_slug, agent_slug, name, domain: 'investment' }` | Scope created with default thresholds |
| A.1.2 | Create scope with custom thresholds | Include `thresholds: { critical_threshold: 75, warning_threshold: 55 }` | Scope uses custom thresholds |
| A.1.3 | Create scope with LLM config | Include `llm_config: { gold: { provider: 'anthropic', model: 'claude-3' } }` | Scope stores LLM config |
| A.1.4 | Create scope with analysis config | Include `analysis_config: { riskRadar: { enabled: true }, redTeam: { enabled: true, threshold: 60 } }` | Features configured correctly |
| A.1.5 | Create test scope | Include `is_test: true, test_scenario_id: 'test-123'` | Scope marked as test |
| A.1.6 | Create scope - missing required fields | Omit `name` or `domain` | Validation error |
| A.1.7 | Create scope - invalid domain | `domain: 'invalid'` | Validation error - must be investment/business/project/personal |
| A.1.8 | Create scope - duplicate name | Same name in same org | Should handle gracefully (allow or reject based on business rules) |

#### A.2 Read Scope

| Test ID | Scenario | Input | Expected Output |
|---------|----------|-------|-----------------|
| A.2.1 | List all scopes | `action: 'scopes.list'` | Array of scopes with pagination |
| A.2.2 | List scopes with filters | `filters: { domain: 'investment', is_active: true }` | Filtered results |
| A.2.3 | Get scope by ID | `action: 'scopes.get', params: { id }` | Single scope with full details |
| A.2.4 | Get non-existent scope | Invalid ID | 404 or null response |
| A.2.5 | List scopes - pagination | `pagination: { page: 2, limit: 10 }` | Correct page of results |

#### A.3 Update Scope

| Test ID | Scenario | Input | Expected Output |
|---------|----------|-------|-----------------|
| A.3.1 | Update scope name | `{ name: 'New Name' }` | Name updated |
| A.3.2 | Update thresholds | `{ thresholds: { critical_threshold: 85 } }` | Thresholds merged/updated |
| A.3.3 | Deactivate scope | `{ is_active: false }` | Scope deactivated, runners skip it |
| A.3.4 | Update analysis config | `{ analysis_config: { redTeam: { enabled: false } } }` | Config updated |
| A.3.5 | Update non-existent scope | Invalid ID | 404 error |

#### A.4 Delete Scope

| Test ID | Scenario | Input | Expected Output |
|---------|----------|-------|-----------------|
| A.4.1 | Delete scope | Valid scope ID | Scope soft-deleted or removed |
| A.4.2 | Delete scope with subjects | Scope has active subjects | Cascade behavior (delete subjects or prevent deletion) |
| A.4.3 | Delete non-existent scope | Invalid ID | 404 error |

#### A.5 Analyze Scope

| Test ID | Scenario | Input | Expected Output |
|---------|----------|-------|-----------------|
| A.5.1 | Trigger scope analysis | `action: 'scopes.analyze', params: { id }` | All active subjects analyzed |
| A.5.2 | Analyze inactive scope | Scope with `is_active: false` | Should reject or warn |
| A.5.3 | Analyze scope with no subjects | Empty scope | Completes with 0 analyzed |

---

### B. Subject Management

#### B.1 Create Subject

| Test ID | Scenario | Input | Expected Output |
|---------|----------|-------|-----------------|
| B.1.1 | Create stock subject | `{ scope_id, identifier: 'AAPL', subject_type: 'stock', metadata: { exchange: 'NASDAQ', sector: 'Technology' } }` | Subject created |
| B.1.2 | Create crypto subject | `{ identifier: 'BTC', subject_type: 'crypto', metadata: { blockchain: 'Bitcoin' } }` | Subject created |
| B.1.3 | Create decision subject | `{ identifier: 'hire-decision', subject_type: 'decision', metadata: { category: 'HR', deadline: '2026-02-01' } }` | Subject created |
| B.1.4 | Create project subject | `{ identifier: 'project-alpha', subject_type: 'project' }` | Subject created |
| B.1.5 | Create test subject | Include `is_test: true` | Subject marked as test |
| B.1.6 | Create subject - invalid scope | Non-existent scope_id | Validation error |
| B.1.7 | Create subject - missing identifier | Omit `identifier` | Validation error |
| B.1.8 | Create subject - invalid type | `subject_type: 'invalid'` | Validation error |
| B.1.9 | Create duplicate subject | Same identifier in same scope | Should handle (allow or reject) |

#### B.2 Read Subject

| Test ID | Scenario | Input | Expected Output |
|---------|----------|-------|-----------------|
| B.2.1 | List subjects in scope | `action: 'subjects.list', params: { scope_id }` | Array of subjects |
| B.2.2 | List subjects with filters | `filters: { subject_type: 'stock', is_active: true }` | Filtered results |
| B.2.3 | Get subject by ID | `action: 'subjects.get', params: { id }` | Single subject with details |
| B.2.4 | Get subject with latest score | Include composite score in response | Subject + current risk score |
| B.2.5 | Get non-existent subject | Invalid ID | 404 or null |

#### B.3 Update Subject

| Test ID | Scenario | Input | Expected Output |
|---------|----------|-------|-----------------|
| B.3.1 | Update subject metadata | `{ metadata: { sector: 'Finance' } }` | Metadata updated |
| B.3.2 | Deactivate subject | `{ is_active: false }` | Subject deactivated, excluded from analysis |
| B.3.3 | Update subject name | `{ name: 'Apple Inc.' }` | Name updated |
| B.3.4 | Update non-existent subject | Invalid ID | 404 error |

#### B.4 Delete Subject

| Test ID | Scenario | Input | Expected Output |
|---------|----------|-------|-----------------|
| B.4.1 | Delete subject | Valid subject ID | Subject removed |
| B.4.2 | Delete subject with assessments | Subject has historical data | Cascade behavior defined |
| B.4.3 | Delete non-existent subject | Invalid ID | 404 error |

#### B.5 Analyze Subject

| Test ID | Scenario | Input | Expected Output |
|---------|----------|-------|-----------------|
| B.5.1 | Manual analysis trigger | `action: 'subjects.analyze', params: { id }` | Full analysis executed |
| B.5.2 | Analyze inactive subject | Subject with `is_active: false` | Should reject or warn |
| B.5.3 | Analyze subject - concurrent request | Same subject being analyzed | Handle gracefully (queue or reject) |

---

### C. Risk Radar (Dimension Analysis)

#### C.1 Dimension Assessment Generation

| Test ID | Scenario | Input | Expected Output |
|---------|----------|-------|-----------------|
| C.1.1 | Analyze all dimensions | Subject with 5 configured dimensions | 5 assessments created |
| C.1.2 | Assessment score range | Any analysis | Score between 0-100 |
| C.1.3 | Assessment confidence range | Any analysis | Confidence between 0.0-1.0 |
| C.1.4 | Assessment includes reasoning | Any analysis | `reasoning` field populated |
| C.1.5 | Assessment includes evidence | Any analysis | `evidence` array populated |
| C.1.6 | Assessment includes signals | Any analysis | `signals` array with impact indicators |
| C.1.7 | LLM failure handling | LLM returns error | Graceful fallback or retry |
| C.1.8 | Partial dimension failure | 3 of 5 dimensions fail | Complete dimensions still saved |

#### C.2 Read Assessments

| Test ID | Scenario | Input | Expected Output |
|---------|----------|-------|-----------------|
| C.2.1 | List assessments | `action: 'assessments.list'` | Array of assessments |
| C.2.2 | Get assessments by subject | `action: 'assessments.by-subject', params: { subject_id }` | All assessments for subject |
| C.2.3 | Get assessments by dimension | `action: 'assessments.by-dimension', params: { dimension_id }` | All assessments for dimension |
| C.2.4 | Get single assessment | `action: 'assessments.get', params: { id }` | Full assessment details |
| C.2.5 | Assessment history | Multiple analyses over time | Historical assessments available |

---

### D. Red Team Debate

#### D.1 Debate Triggering

| Test ID | Scenario | Input | Expected Output |
|---------|----------|-------|-----------------|
| D.1.1 | Trigger on high score | Composite score > threshold (default 50) | Debate initiated |
| D.1.2 | Trigger on low confidence | Confidence < lowConfidenceThreshold (default 0.5) | Debate initiated |
| D.1.3 | No trigger - score below threshold | Score = 40, threshold = 50 | No debate |
| D.1.4 | No trigger - high confidence | Confidence = 0.8, threshold = 0.5 | No debate (if score also below) |
| D.1.5 | Debate disabled in config | `analysis_config.redTeam.enabled: false` | No debate regardless of score |
| D.1.6 | Custom threshold respected | `redTeam.threshold: 70`, score = 65 | No debate |

#### D.2 Debate Execution

| Test ID | Scenario | Input | Expected Output |
|---------|----------|-------|-----------------|
| D.2.1 | Blue Team assessment | Initial risk assessment | Blue Team position documented |
| D.2.2 | Red Team challenge | Blue Team assessment | Red Team counter-arguments |
| D.2.3 | Arbiter synthesis | Both team outputs | Final synthesized assessment |
| D.2.4 | Score adjustment | Debate complete | `debate_adjustment` calculated |
| D.2.5 | Key takeaways | Debate complete | Summary points extracted |
| D.2.6 | LLM failure in debate | One team LLM fails | Graceful handling |

#### D.3 Read Debates

| Test ID | Scenario | Input | Expected Output |
|---------|----------|-------|-----------------|
| D.3.1 | List debates | `action: 'debates.list'` | Array of debates |
| D.3.2 | Get debates by subject | `action: 'debates.by-subject', params: { subject_id }` | Subject's debate history |
| D.3.3 | Get single debate | `action: 'debates.get', params: { id }` | Full debate details |
| D.3.4 | Debate linked to composite score | Any debate | `composite_score_id` populated |

---

### E. Composite Scoring

#### E.1 Score Aggregation

| Test ID | Scenario | Input | Expected Output |
|---------|----------|-------|-----------------|
| E.1.1 | Aggregate dimension scores | 5 assessments with scores | Single composite score (0-100) |
| E.1.2 | Weighted aggregation | Dimensions with different weights | Weights applied correctly |
| E.1.3 | Confidence aggregation | Multiple confidence values | Aggregated confidence calculated |
| E.1.4 | Dimension scores breakdown | Aggregation complete | `dimension_scores` object populated |
| E.1.5 | Valid until calculation | Score created | `valid_until` timestamp set |
| E.1.6 | Previous score superseded | New score created | Old score status = 'superseded' |
| E.1.7 | Debate adjustment applied | Debate completed | Final score includes adjustment |

#### E.2 Score Status Management

| Test ID | Scenario | Input | Expected Output |
|---------|----------|-------|-----------------|
| E.2.1 | Active score | Newly created | `status: 'active'` |
| E.2.2 | Superseded score | New analysis run | Old score `status: 'superseded'` |
| E.2.3 | Expired score | Past `valid_until` | `status: 'expired'` or stale check returns true |
| E.2.4 | Stale score detection | `isScoreStale()` called | Returns true if > stale_hours |

#### E.3 Read Composite Scores

| Test ID | Scenario | Input | Expected Output |
|---------|----------|-------|-----------------|
| E.3.1 | List composite scores | `action: 'composite-scores.list'` | Array of scores |
| E.3.2 | Get current score | `action: 'composite-scores.get', params: { subject_id }` | Latest active score |
| E.3.3 | Get score history | `action: 'composite-scores.history', params: { subject_id }` | Historical scores |
| E.3.4 | Score with assessments | Include linked assessments | Full assessment details |

---

### F. Alerts

#### F.1 Alert Generation

| Test ID | Scenario | Input | Expected Output |
|---------|----------|-------|-----------------|
| F.1.1 | Threshold breach - critical | Score = 85, critical_threshold = 80 | Critical alert created |
| F.1.2 | Threshold breach - warning | Score = 65, warning_threshold = 60 | Warning alert created |
| F.1.3 | No alert - below warning | Score = 55 | No alert |
| F.1.4 | Rapid change alert | Score changed 20%, threshold = 15% | Rapid change alert |
| F.1.5 | No rapid change alert | Score changed 10% | No alert |
| F.1.6 | Dimension spike alert | Single dimension = 95 | Dimension spike alert |
| F.1.7 | Stale assessment alert | No analysis for > stale_hours | Stale assessment alert |
| F.1.8 | Alert severity levels | Various conditions | info/warning/critical assigned correctly |
| F.1.9 | Alert details populated | Any alert | Relevant details (threshold, actual, previous, etc.) |

#### F.2 Alert Runner

| Test ID | Scenario | Input | Expected Output |
|---------|----------|-------|-----------------|
| F.2.1 | Runner execution | Scheduled (every 5 min) | All subjects checked |
| F.2.2 | Runner result | Execution complete | `AlertRunnerResult` with counts by severity |
| F.2.3 | Inactive subjects skipped | Subject `is_active: false` | Not checked for alerts |
| F.2.4 | Inactive scopes skipped | Scope `is_active: false` | All subjects in scope skipped |

#### F.3 Alert Management

| Test ID | Scenario | Input | Expected Output |
|---------|----------|-------|-----------------|
| F.3.1 | List alerts | `action: 'alerts.list'` | Array of alerts |
| F.3.2 | List unacknowledged alerts | `filters: { acknowledged: false }` | Unacknowledged only |
| F.3.3 | Get alerts by subject | `action: 'alerts.by-subject', params: { subject_id }` | Subject's alerts |
| F.3.4 | Acknowledge alert | `action: 'alerts.acknowledge', params: { id }` | Alert marked acknowledged |
| F.3.5 | Acknowledge with note | Include acknowledgment note | Note stored |
| F.3.6 | Acknowledge non-existent alert | Invalid ID | 404 error |

---

### G. Evaluations

#### G.1 Evaluation Generation

| Test ID | Scenario | Input | Expected Output |
|---------|----------|-------|-----------------|
| G.1.1 | 7-day evaluation | Score from 7+ days ago | Evaluation created |
| G.1.2 | 30-day evaluation | Score from 30+ days ago | Evaluation created |
| G.1.3 | 90-day evaluation | Score from 90+ days ago | Evaluation created |
| G.1.4 | Prediction vs actual comparison | Score + actual outcome | Accuracy calculated |
| G.1.5 | Accurate prediction | Prediction close to actual | Marked accurate |
| G.1.6 | Inaccurate prediction | Prediction far from actual | Marked inaccurate |

#### G.2 Evaluation Runner

| Test ID | Scenario | Input | Expected Output |
|---------|----------|-------|-----------------|
| G.2.1 | Runner execution | Scheduled (daily @ 6 AM) | Eligible scores evaluated |
| G.2.2 | Find scores to evaluate | Query | Scores in evaluation windows returned |
| G.2.3 | Runner result | Execution complete | `EvaluationRunnerResult` with counts |
| G.2.4 | Skip already evaluated | Score already has evaluation | Not re-evaluated |

#### G.3 Accuracy Metrics

| Test ID | Scenario | Input | Expected Output |
|---------|----------|-------|-----------------|
| G.3.1 | Calculate accuracy metrics | `action: 'evaluations.accuracy-metrics'` | Metrics object returned |
| G.3.2 | Calibration error | Multiple evaluations | Calibration score calculated |
| G.3.3 | Brier score | Multiple evaluations | Brier score calculated |
| G.3.4 | By-dimension accuracy | Evaluations with dimension data | Per-dimension accuracy stats |
| G.3.5 | Insufficient data | < minimum evaluations | Graceful handling (null or warning) |

#### G.4 Read Evaluations

| Test ID | Scenario | Input | Expected Output |
|---------|----------|-------|-----------------|
| G.4.1 | List evaluations | `action: 'evaluations.list'` | Array of evaluations |
| G.4.2 | Get evaluations by subject | `action: 'evaluations.by-subject', params: { subject_id }` | Subject's evaluations |
| G.4.3 | Get single evaluation | `action: 'evaluations.get', params: { id }` | Full evaluation details |

---

### H. Learning Queue (HITL)

#### H.1 Learning Generation

| Test ID | Scenario | Input | Expected Output |
|---------|----------|-------|-----------------|
| H.1.1 | Pattern analysis | Evaluation failures analyzed | Learning suggestions created |
| H.1.2 | Learning type - rule | Pattern suggests rule | `suggested_learning_type: 'rule'` |
| H.1.3 | Learning type - pattern | Pattern detected | `suggested_learning_type: 'pattern'` |
| H.1.4 | Learning type - avoid | Negative pattern | `suggested_learning_type: 'avoid'` |
| H.1.5 | Learning type - weight adjustment | Dimension consistently off | `suggested_learning_type: 'weight_adjustment'` |
| H.1.6 | Learning type - threshold | Threshold needs adjustment | `suggested_learning_type: 'threshold'` |
| H.1.7 | Scope level assignment | Pattern scope determined | Correct `suggested_scope_level` |
| H.1.8 | AI confidence | Suggestion created | `ai_confidence` populated |
| H.1.9 | AI reasoning | Suggestion created | `ai_reasoning` populated |

#### H.2 Learning Runner

| Test ID | Scenario | Input | Expected Output |
|---------|----------|-------|-----------------|
| H.2.1 | Runner execution | Scheduled (daily @ 4 AM) | Learning analysis complete |
| H.2.2 | Update effectiveness scores | Approved learnings applied | Effectiveness recalculated |
| H.2.3 | Retire ineffective learnings | Effectiveness < 40% | Learning retired |
| H.2.4 | Retire unused learnings | Not applied in 90 days | Learning retired |
| H.2.5 | Historical replay | Learning tested against history | Replay results stored |
| H.2.6 | Runner result | Execution complete | `LearningRunnerResult` with counts |

#### H.3 Learning Queue Management

| Test ID | Scenario | Input | Expected Output |
|---------|----------|-------|-----------------|
| H.3.1 | List pending learnings | `action: 'learning-queue.list', filters: { status: 'pending' }` | Pending items |
| H.3.2 | Get single learning | `action: 'learning-queue.get', params: { id }` | Full learning details |
| H.3.3 | Approve learning | `action: 'learning-queue.approve', params: { id }` | Status = 'approved' |
| H.3.4 | Approve with modification | Include modified config | Learning updated and approved |
| H.3.5 | Reject learning | `action: 'learning-queue.reject', params: { id }` | Status = 'rejected' |
| H.3.6 | Reject with reason | Include rejection reason | Reason stored |
| H.3.7 | Approve non-existent | Invalid ID | 404 error |
| H.3.8 | Approve already processed | Already approved/rejected | Error or no-op |

---

### I. Correlation Analysis

#### I.1 Correlation Calculation

| Test ID | Scenario | Input | Expected Output |
|---------|----------|-------|-----------------|
| I.1.1 | Generate correlation matrix | Scope with multiple subjects | Matrix of correlation coefficients |
| I.1.2 | Correlation range | Any calculation | Value between -1 and 1 |
| I.1.3 | Perfect positive correlation | Identical score patterns | Correlation = 1.0 |
| I.1.4 | Perfect negative correlation | Inverse patterns | Correlation = -1.0 |
| I.1.5 | No correlation | Random patterns | Correlation ≈ 0 |
| I.1.6 | Strength categorization | Correlation calculated | Category (weak/moderate/strong) assigned |
| I.1.7 | Insufficient data | < minimum data points | Graceful handling |

#### I.2 Concentration Risk

| Test ID | Scenario | Input | Expected Output |
|---------|----------|-------|-----------------|
| I.2.1 | Identify high concentration | Multiple highly correlated subjects | Concentration risk flagged |
| I.2.2 | Pair analysis | `action: 'correlations.pair', params: { subject_ids: [a, b] }` | Pair correlation details |
| I.2.3 | Concentration threshold | Configurable threshold | Only pairs above threshold flagged |
| I.2.4 | Systematic risk detection | Many subjects correlate | Systematic risk identified |

#### I.3 Read Correlations

| Test ID | Scenario | Input | Expected Output |
|---------|----------|-------|-----------------|
| I.3.1 | Get correlation matrix | `action: 'correlations.matrix', params: { scope_id }` | Full matrix |
| I.3.2 | Get pair correlation | `action: 'correlations.pair', params: { subject_a_id, subject_b_id }` | Single pair details |
| I.3.3 | Get concentration risk | `action: 'correlations.concentration', params: { scope_id }` | Concentration analysis |

---

### J. Portfolio Risk

#### J.1 Portfolio Summary

| Test ID | Scenario | Input | Expected Output |
|---------|----------|-------|-----------------|
| J.1.1 | Calculate summary | `action: 'portfolio.summary', params: { scope_id }` | Summary object |
| J.1.2 | Average score | Multiple subjects | Correct average |
| J.1.3 | Max score | Multiple subjects | Correct maximum |
| J.1.4 | Min score | Multiple subjects | Correct minimum |
| J.1.5 | Risk distribution | Subjects analyzed | Distribution by category (low/moderate/elevated/high/critical) |
| J.1.6 | Dimension performance | Aggregated | Per-dimension portfolio stats |
| J.1.7 | Empty portfolio | No active subjects | Graceful handling |

#### J.2 Subject Contributions

| Test ID | Scenario | Input | Expected Output |
|---------|----------|-------|-----------------|
| J.2.1 | Get contributions | `action: 'portfolio.contributions', params: { scope_id }` | Contribution list |
| J.2.2 | Weighted contributions | Subjects with weights | Weights applied |
| J.2.3 | Top risk contributors | Any portfolio | Sorted by contribution |
| J.2.4 | Contribution percentage | Each subject | Percentage of portfolio risk |

#### J.3 Portfolio Heatmap

| Test ID | Scenario | Input | Expected Output |
|---------|----------|-------|-----------------|
| J.3.1 | Get heatmap data | `action: 'portfolio.heatmap', params: { scope_id }` | Heatmap matrix |
| J.3.2 | Subjects vs dimensions | Matrix generated | Subjects on one axis, dimensions on other |
| J.3.3 | Color coding | Scores in matrix | Risk levels color-coded |

#### J.4 Portfolio Trend

| Test ID | Scenario | Input | Expected Output |
|---------|----------|-------|-----------------|
| J.4.1 | Daily trend | `action: 'portfolio.trend', params: { scope_id, period: 'day' }` | Daily data points |
| J.4.2 | Weekly trend | `period: 'week'` | Weekly aggregated data |
| J.4.3 | Monthly trend | `period: 'month'` | Monthly aggregated data |
| J.4.4 | Trend direction | Data over time | Trend indicator (improving/stable/worsening) |
| J.4.5 | Insufficient history | New scope | Limited or empty data |

---

## Integration Test Scenarios

### INT.1 Full Analysis Flow

| Test ID | Scenario | Steps | Expected Outcome |
|---------|----------|-------|------------------|
| INT.1.1 | Complete subject analysis | 1. Create scope 2. Create subject 3. Trigger analysis | All phases complete (assessments, composite, debate if triggered, alerts checked) |
| INT.1.2 | Scope-wide analysis | 1. Create scope 2. Create 5 subjects 3. Analyze scope | All 5 subjects analyzed |
| INT.1.3 | Runner-triggered analysis | 1. Setup scope/subjects 2. Wait for runner (30 min) | Automatic analysis executes |

### INT.2 Alert to Learning Flow

| Test ID | Scenario | Steps | Expected Outcome |
|---------|----------|-------|------------------|
| INT.2.1 | High risk → Alert → Evaluation → Learning | 1. Subject scores 90 2. Alert generated 3. 7 days pass 4. Evaluation 5. Learning suggested | Full quality loop completes |
| INT.2.2 | Inaccurate prediction → Learning | 1. Prediction made 2. Actual differs significantly 3. Evaluation marks inaccurate 4. Learning generated | Improvement suggested |

### INT.3 Portfolio Flow

| Test ID | Scenario | Steps | Expected Outcome |
|---------|----------|-------|------------------|
| INT.3.1 | Multi-subject portfolio analysis | 1. Create scope 2. Add 10 subjects 3. Analyze all 4. View portfolio | Summary, contributions, correlations all available |
| INT.3.2 | Concentration detection | 1. Add correlated subjects 2. Run correlation analysis | High concentration identified |

### INT.4 HITL Workflow

| Test ID | Scenario | Steps | Expected Outcome |
|---------|----------|-------|------------------|
| INT.4.1 | Learning approval flow | 1. Learning suggested 2. User reviews 3. User approves 4. Learning applied | Learning impacts future analysis |
| INT.4.2 | Learning rejection flow | 1. Learning suggested 2. User reviews 3. User rejects with reason | Learning archived, not applied |

---

## Edge Cases & Error Handling

### ERR.1 Data Edge Cases

| Test ID | Scenario | Expected Behavior |
|---------|----------|-------------------|
| ERR.1.1 | No historical data for correlation | Return empty or warning |
| ERR.1.2 | Single subject in scope | Portfolio summary handles gracefully |
| ERR.1.3 | All subjects inactive | Runners complete with 0 processed |
| ERR.1.4 | Dimension with no weight | Use default weight or error |
| ERR.1.5 | Score exactly at threshold | Consistent threshold behavior (< or <=) |

### ERR.2 LLM Failures

| Test ID | Scenario | Expected Behavior |
|---------|----------|-------------------|
| ERR.2.1 | LLM timeout | Retry with backoff, then graceful failure |
| ERR.2.2 | LLM rate limit | Queue and retry |
| ERR.2.3 | LLM invalid response | Parse error handling, fallback |
| ERR.2.4 | LLM partial response | Handle incomplete data |

### ERR.3 Concurrency

| Test ID | Scenario | Expected Behavior |
|---------|----------|-------------------|
| ERR.3.1 | Concurrent analysis same subject | Lock or queue |
| ERR.3.2 | Runner overlaps | Previous run completes or skipped |
| ERR.3.3 | Concurrent alert acknowledgment | No duplicates or conflicts |

### ERR.4 Data Integrity

| Test ID | Scenario | Expected Behavior |
|---------|----------|-------------------|
| ERR.4.1 | Orphaned assessment (no subject) | Cleanup or prevent |
| ERR.4.2 | Circular scope reference | Validation prevents |
| ERR.4.3 | Invalid score (< 0 or > 100) | Validation rejects |
| ERR.4.4 | Invalid confidence (< 0 or > 1) | Validation rejects |

---

## Performance Testing

### PERF.1 Scale Testing

| Test ID | Scenario | Target | Metric |
|---------|----------|--------|--------|
| PERF.1.1 | 100 subjects in scope | Analyze all | Time to complete |
| PERF.1.2 | 1000 subjects across scopes | Runner execution | Time and memory |
| PERF.1.3 | 10,000 historical scores | Correlation matrix | Calculation time |
| PERF.1.4 | Portfolio with 500 subjects | Summary generation | Response time |

### PERF.2 Runner Performance

| Test ID | Scenario | Target | Metric |
|---------|----------|--------|--------|
| PERF.2.1 | Risk Analysis Runner | Complete before next cycle (30 min) | Execution time |
| PERF.2.2 | Alert Runner | Complete before next cycle (5 min) | Execution time |
| PERF.2.3 | Evaluation Runner | Complete within reasonable time | Execution time |
| PERF.2.4 | Learning Runner | Complete within reasonable time | Execution time |

### PERF.3 API Response Times

| Test ID | Scenario | Target | Metric |
|---------|----------|--------|--------|
| PERF.3.1 | List endpoints | < 200ms | P95 response time |
| PERF.3.2 | Get single entity | < 100ms | P95 response time |
| PERF.3.3 | Manual analysis trigger | < 30s | Time to completion |
| PERF.3.4 | Portfolio summary | < 500ms | P95 response time |

---

## Test Data Requirements

### Required Test Fixtures

1. **Test Scopes**: At least one scope per domain (investment, business, project, personal)
2. **Test Subjects**: Multiple subjects per scope covering each type (stock, crypto, decision, project)
3. **Historical Data**: Assessments and scores spanning 90+ days for evaluation testing
4. **Configured Dimensions**: Standard dimension set with weights
5. **Test User/Org**: Test organization and user credentials

### Test Environment Configuration

```typescript
// Example test scope configuration
{
  name: 'Test Investment Scope',
  domain: 'investment',
  is_test: true,
  test_scenario_id: 'integration-test-001',
  thresholds: {
    critical_threshold: 80,
    warning_threshold: 60,
    rapid_change_threshold: 15,
    stale_hours: 24
  },
  analysis_config: {
    riskRadar: { enabled: true },
    redTeam: { enabled: true, threshold: 50, lowConfidenceThreshold: 0.5 }
  }
}
```

---

## Appendix: Dashboard Action Reference

| Entity | Action | Description |
|--------|--------|-------------|
| scopes | list | List all scopes |
| scopes | get | Get scope by ID |
| scopes | create | Create new scope |
| scopes | update | Update scope |
| scopes | delete | Delete scope |
| scopes | analyze | Trigger scope-wide analysis |
| subjects | list | List subjects |
| subjects | get | Get subject by ID |
| subjects | create | Create subject |
| subjects | update | Update subject |
| subjects | delete | Delete subject |
| subjects | analyze | Trigger subject analysis |
| composite-scores | list | List scores |
| composite-scores | get | Get score by ID |
| composite-scores | history | Get score history |
| assessments | list | List assessments |
| assessments | get | Get assessment by ID |
| assessments | by-subject | Get assessments for subject |
| assessments | by-dimension | Get assessments for dimension |
| debates | list | List debates |
| debates | get | Get debate by ID |
| debates | by-subject | Get debates for subject |
| alerts | list | List alerts |
| alerts | get | Get alert by ID |
| alerts | acknowledge | Acknowledge alert |
| alerts | by-subject | Get alerts for subject |
| evaluations | list | List evaluations |
| evaluations | get | Get evaluation by ID |
| evaluations | by-subject | Get evaluations for subject |
| evaluations | accuracy-metrics | Get accuracy metrics |
| learning-queue | list | List pending learnings |
| learning-queue | get | Get learning by ID |
| learning-queue | approve | Approve learning |
| learning-queue | reject | Reject learning |
| correlations | matrix | Get correlation matrix |
| correlations | pair | Get pair correlation |
| correlations | concentration | Get concentration risk |
| portfolio | summary | Get portfolio summary |
| portfolio | contributions | Get subject contributions |
| portfolio | heatmap | Get risk heatmap |
| portfolio | trend | Get portfolio trend |

---

## Front-End UI Testing (Browser/Chrome Extension)

This section covers all user interface testing scenarios for the Risk Dashboard, designed for testing with Claude Code Chrome Extension or manual browser testing.

### UI Component Architecture

```
RiskAgentPane (Main Container)
├── Header Controls (Title, Scope, Analyze All, Refresh)
├── Error Banner (Conditional)
├── Stats Summary Cards (6 cards)
├── Tab Navigation (5 tabs)
└── Tab Content Areas
    ├── Overview Tab
    │   ├── RiskSidebar (Left Panel - Subject List)
    │   └── RiskDetailView (Main Content)
    │       ├── RiskScoreBadge
    │       ├── RiskRadarChart
    │       ├── RiskDimensionCard (Grid)
    │       ├── RiskDebateSummary
    │       └── Alerts Section
    ├── Alerts Tab → AlertsComponent
    ├── Dimensions Tab → DimensionsComponent
    ├── Learnings Tab → LearningsComponent
    └── Settings Tab → SettingsComponent
```

### File Locations

| Component | Path |
|-----------|------|
| Main Dashboard | `apps/web/src/components/AgentPanes/Risk/RiskAgentPane.vue` |
| Detail View | `apps/web/src/components/AgentPanes/Risk/RiskDetailView.vue` |
| Sidebar | `apps/web/src/components/AgentPanes/Risk/RiskSidebar.vue` |
| Radar Chart | `apps/web/src/components/AgentPanes/Risk/RiskRadarChart.vue` |
| Dimension Card | `apps/web/src/components/AgentPanes/Risk/RiskDimensionCard.vue` |
| Debate Summary | `apps/web/src/components/AgentPanes/Risk/RiskDebateSummary.vue` |
| Alerts | `apps/web/src/components/AgentPanes/Risk/AlertsComponent.vue` |
| Dimensions | `apps/web/src/components/AgentPanes/Risk/DimensionsComponent.vue` |
| Learnings | `apps/web/src/components/AgentPanes/Risk/LearningsComponent.vue` |
| Settings | `apps/web/src/components/AgentPanes/Risk/SettingsComponent.vue` |
| Score Badge | `apps/web/src/components/AgentPanes/Risk/shared/RiskScoreBadge.vue` |
| Store | `apps/web/src/stores/riskDashboardStore.ts` |
| Service | `apps/web/src/services/riskDashboardService.ts` |
| Types | `apps/web/src/types/risk-agent.ts` |

---

### K. Header & Navigation Tests

#### K.1 Header Controls

| Test ID | Scenario | Action | Expected Result |
|---------|----------|--------|-----------------|
| K.1.1 | Dashboard title display | Load dashboard | "Investment Risk Dashboard" title visible |
| K.1.2 | Current scope display | Load with active scope | Scope name shown in header |
| K.1.3 | Analyze All - enabled state | Scope selected, not analyzing | Button enabled and clickable |
| K.1.4 | Analyze All - disabled state | No scope selected | Button disabled |
| K.1.5 | Analyze All - analyzing state | Click Analyze All | Button shows "Analyzing..." and disabled |
| K.1.6 | Analyze All - execution | Click Analyze All | All subjects in scope analyzed, stats refresh |
| K.1.7 | Refresh button - enabled | Dashboard loaded | Button enabled |
| K.1.8 | Refresh button - disabled | Data loading | Button disabled during load |
| K.1.9 | Refresh button - execution | Click Refresh | All data reloads, UI updates |

#### K.2 Error Banner

| Test ID | Scenario | Action | Expected Result |
|---------|----------|--------|-----------------|
| K.2.1 | Error banner hidden | No errors | Banner not visible |
| K.2.2 | Error banner display | API error occurs | Banner shows with error message |
| K.2.3 | Error banner close | Click X button | Banner dismisses, error cleared |
| K.2.4 | Error icon display | Error present | Warning icon (⚠) visible |

#### K.3 Stats Summary Cards

| Test ID | Scenario | Action | Expected Result |
|---------|----------|--------|-----------------|
| K.3.1 | Total subjects card | Load with subjects | Shows correct count |
| K.3.2 | Analyzed subjects card | Load with scores | Shows count of subjects with scores |
| K.3.3 | Avg risk score - normal | Average < 60% | Normal styling |
| K.3.4 | Avg risk score - warning | Average >= 60% | Warning color styling |
| K.3.5 | Critical alerts card | Critical alerts exist | Red card shows count |
| K.3.6 | Critical alerts hidden | No critical alerts | Card not displayed |
| K.3.7 | Warning alerts card | Warning alerts exist | Yellow card shows count |
| K.3.8 | Warning alerts hidden | No warning alerts | Card not displayed |
| K.3.9 | Pending learnings card | Learnings exist | Card shows count |
| K.3.10 | Pending learnings hidden | No learnings | Card not displayed |

#### K.4 Tab Navigation

| Test ID | Scenario | Action | Expected Result |
|---------|----------|--------|-----------------|
| K.4.1 | Overview tab default | Load dashboard | Overview tab active |
| K.4.2 | Switch to Alerts tab | Click "Alerts" | Alerts tab content shows |
| K.4.3 | Switch to Dimensions tab | Click "Dimensions" | Dimensions tab content shows |
| K.4.4 | Switch to Learnings tab | Click "Learnings" | Learnings tab content shows |
| K.4.5 | Switch to Settings tab | Click "Settings" | Settings tab content shows |
| K.4.6 | Alerts tab badge | Unacknowledged alerts exist | Badge shows count |
| K.4.7 | Alerts tab badge hidden | No unacknowledged alerts | No badge displayed |
| K.4.8 | Learnings tab badge | Pending learnings exist | Badge shows count |
| K.4.9 | Learnings tab badge hidden | No pending learnings | No badge displayed |
| K.4.10 | Tab active state | Click any tab | Tab shows active styling |

---

### L. Overview Tab - Sidebar Tests

#### L.1 Subject List Display

| Test ID | Scenario | Action | Expected Result |
|---------|----------|--------|-----------------|
| L.1.1 | Sidebar header | Load with subjects | "Subjects" title with count badge |
| L.1.2 | Subject list populated | Subjects exist | All active subjects listed |
| L.1.3 | Subject identifier display | View list | Identifier shown in bold |
| L.1.4 | Subject name display | View list | Name shown as secondary text |
| L.1.5 | Risk score badge | Subject has score | Score badge with color coding |
| L.1.6 | Subject type badge | View list | Type badge (stock/crypto/etc.) |
| L.1.7 | Stale badge display | Assessment > 7 days old | Yellow "Stale" badge visible |
| L.1.8 | Stale badge hidden | Recent assessment | No stale badge |
| L.1.9 | Empty state - no subjects | No subjects in scope | "No subjects configured" message |
| L.1.10 | Empty state - no matches | Search with no results | "No subjects match..." message |

#### L.2 Search Functionality

| Test ID | Scenario | Action | Expected Result |
|---------|----------|--------|-----------------|
| L.2.1 | Search input visible | Load sidebar | Search box present with placeholder |
| L.2.2 | Search by identifier | Type "AAPL" | Only matching subjects shown |
| L.2.3 | Search by name | Type "Apple" | Only matching subjects shown |
| L.2.4 | Search case insensitive | Type "aapl" | Matches "AAPL" |
| L.2.5 | Search real-time filter | Type character by character | List filters with each keystroke |
| L.2.6 | Clear search | Delete search text | All subjects return |
| L.2.7 | No results | Type non-matching text | Empty state shows |

#### L.3 Subject Selection

| Test ID | Scenario | Action | Expected Result |
|---------|----------|--------|-----------------|
| L.3.1 | Hover state | Mouse over subject | Background highlight |
| L.3.2 | Click to select | Click subject | Subject highlighted, detail view loads |
| L.3.3 | Selected state styling | Subject selected | Blue highlight + left border |
| L.3.4 | Cursor style | Hover over subject | Pointer cursor |
| L.3.5 | Scroll functionality | Many subjects | Scrollable list |
| L.3.6 | Selection persists | Switch tabs and return | Same subject still selected |

---

### M. Overview Tab - Detail View Tests

#### M.1 Empty State

| Test ID | Scenario | Action | Expected Result |
|---------|----------|--------|-----------------|
| M.1.1 | No selection message | No subject selected | "Select a subject from the sidebar..." message |

#### M.2 Header Section

| Test ID | Scenario | Action | Expected Result |
|---------|----------|--------|-----------------|
| M.2.1 | Subject identifier | Select subject | Identifier shown as h3 |
| M.2.2 | Subject name | Select subject | Name shown as paragraph |
| M.2.3 | Re-analyze button | Subject selected | Button visible and enabled |
| M.2.4 | Re-analyze execution | Click Re-analyze | Analysis runs, data refreshes |
| M.2.5 | Trigger Debate button visible | Score >= 70% | Yellow button appears |
| M.2.6 | Trigger Debate button hidden | Score < 70% | Button not shown |
| M.2.7 | Trigger Debate execution | Click Trigger Debate | Debate runs, summary appears |

#### M.3 Composite Score Card

| Test ID | Scenario | Action | Expected Result |
|---------|----------|--------|-----------------|
| M.3.1 | Score badge display | Subject has score | Score shown as percentage |
| M.3.2 | Score color - critical | Score >= 80 | Red color |
| M.3.3 | Score color - high | Score 60-79 | Orange color |
| M.3.4 | Score color - medium | Score 40-59 | Yellow color |
| M.3.5 | Score color - low | Score 20-39 | Green color |
| M.3.6 | Score color - minimal | Score < 20 | Light green color |
| M.3.7 | Risk label display | Any score | Appropriate label text |
| M.3.8 | Confidence display | Score exists | "Confidence: XX%" shown |
| M.3.9 | Last analyzed date | Score exists | Formatted timestamp shown |
| M.3.10 | Debate adjustment | Debate exists | "Debate adjustment: ±XX%" shown |
| M.3.11 | No debate adjustment | No debate | Adjustment not shown |

#### M.4 Risk Radar Chart

| Test ID | Scenario | Action | Expected Result |
|---------|----------|--------|-----------------|
| M.4.1 | Chart renders | Subject with assessments | SVG radar chart visible |
| M.4.2 | Grid circles | View chart | 5 concentric rings visible |
| M.4.3 | Axis lines | View chart | One line per dimension |
| M.4.4 | Data polygon | View chart | Filled semi-transparent polygon |
| M.4.5 | Data points | View chart | Circle at each score intersection |
| M.4.6 | Dimension labels | View chart | Labels around perimeter |
| M.4.7 | Legend display | View chart | Legend below with all dimensions |
| M.4.8 | Legend color coding | View legend | Colors match score levels |
| M.4.9 | Legend scores | View legend | Formatted percentages shown |
| M.4.10 | Chart sizing | Various viewports | Chart scales appropriately |

#### M.5 Dimension Assessment Cards

| Test ID | Scenario | Action | Expected Result |
|---------|----------|--------|-----------------|
| M.5.1 | Card grid layout | Multiple assessments | Grid of cards, auto-fill |
| M.5.2 | Dimension name | View card | Name in header |
| M.5.3 | Score badge | View card | RiskScoreBadge in header |
| M.5.4 | Confidence display | View card | "Confidence: XX%" |
| M.5.5 | Weight display | Weight configured | "Weight: XX%" shown |
| M.5.6 | Signals section | Signals exist | "Key Signals:" with list |
| M.5.7 | Signal positive color | Positive impact | Green text |
| M.5.8 | Signal negative color | Negative impact | Red text |
| M.5.9 | Signal neutral color | Neutral impact | Gray text |
| M.5.10 | Max signals shown | Many signals | Max 3 displayed |
| M.5.11 | Show Reasoning button | Reasoning exists | Button in footer |
| M.5.12 | Expand reasoning | Click "Show Reasoning" | Reasoning text appears |
| M.5.13 | Collapse reasoning | Click "Hide Reasoning" | Reasoning text hides |
| M.5.14 | Border color - critical | Score >= 80 | Red left border |
| M.5.15 | Border color - high | Score 60-79 | Orange left border |
| M.5.16 | Border color - medium | Score 40-59 | Yellow left border |
| M.5.17 | Border color - low | Score < 40 | Green left border |
| M.5.18 | Card hover state | Mouse over card | Hover effect visible |

#### M.6 Debate Summary

| Test ID | Scenario | Action | Expected Result |
|---------|----------|--------|-----------------|
| M.6.1 | Summary hidden | No debate | Section not visible |
| M.6.2 | Summary visible | Debate exists | Three-column layout shows |
| M.6.3 | Score adjustment banner | View summary | Adjustment percentage shown |
| M.6.4 | Adjustment - increase | Adjustment > +5% | Red background |
| M.6.5 | Adjustment - decrease | Adjustment < -5% | Green background |
| M.6.6 | Adjustment - neutral | Adjustment ±5% | Gray background |
| M.6.7 | Blue Team column | View summary | Heart icon, "Blue Team (Defense)" title |
| M.6.8 | Blue Team strength | View column | "Strength: XX%" shown |
| M.6.9 | Blue Team arguments | View column | Bulleted list of arguments |
| M.6.10 | Blue Team mitigating factors | Factors exist | Sub-section with list |
| M.6.11 | Red Team column | View summary | X icon, "Red Team (Challenge)" title |
| M.6.12 | Red Team risk score | View column | "Risk Score: XX%" shown |
| M.6.13 | Red Team challenges | View column | Bulleted list of challenges |
| M.6.14 | Red Team hidden risks | Risks exist | Sub-section with list |
| M.6.15 | Arbiter column | View summary | Arbiter icon, "Arbiter (Synthesis)" title |
| M.6.16 | Arbiter summary | View column | Prose explanation text |
| M.6.17 | Arbiter key takeaways | Takeaways exist | Bulleted list |
| M.6.18 | Arbiter recommendation | View column | Recommendation box |
| M.6.19 | Debate timestamp | View summary | "Debate conducted:" with date |
| M.6.20 | Responsive stacking | Screen < 768px | Columns stack vertically |

#### M.7 Active Alerts Section

| Test ID | Scenario | Action | Expected Result |
|---------|----------|--------|-----------------|
| M.7.1 | Alerts hidden | No alerts for subject | Section not visible |
| M.7.2 | Alerts visible | Alerts exist | Alerts list shown |
| M.7.3 | Critical alert styling | Critical alert | Red tint background |
| M.7.4 | Warning alert styling | Warning alert | Yellow tint background |
| M.7.5 | Info alert styling | Info alert | Gray background |
| M.7.6 | Severity badge | View alert | Badge shows severity |
| M.7.7 | Alert message | View alert | Message text shown |
| M.7.8 | Alert timestamp | View alert | Created time shown |
| M.7.9 | Alert details | Details exist | Trigger score, threshold shown |

---

### N. Alerts Tab Tests

| Test ID | Scenario | Action | Expected Result |
|---------|----------|--------|-----------------|
| N.1 | Empty state | No unacknowledged alerts | "No unacknowledged alerts" message |
| N.2 | Alerts list | Alerts exist | List of alert cards |
| N.3 | Alert header | View card | Severity badge, subject name, timestamp |
| N.4 | Alert message | View card | Message text visible |
| N.5 | Alert details | Details exist | Trigger score and threshold shown |
| N.6 | Critical alert card | Severity = critical | Red left border + light red background |
| N.7 | Warning alert card | Severity = warning | Orange left border + light yellow background |
| N.8 | Info alert card | Severity = info | Gray left border + light gray background |
| N.9 | Acknowledge button | View card | Button visible |
| N.10 | Acknowledge click | Click Acknowledge | Alert removed from list |
| N.11 | Tab badge update | Acknowledge alert | Tab badge count decreases |
| N.12 | Multiple alerts | Many alerts | All displayed in list |

---

### O. Dimensions Tab Tests

| Test ID | Scenario | Action | Expected Result |
|---------|----------|--------|-----------------|
| O.1 | Empty state | No dimensions | "No dimensions configured for this scope" message |
| O.2 | Dimensions grid | Dimensions exist | Grid of cards (min 280px width) |
| O.3 | Dimension slug | View card | Monospace slug in light box |
| O.4 | Dimension weight | View card | "Weight: XX%" shown |
| O.5 | Dimension name | View card | h4 heading |
| O.6 | Dimension description | Description exists | Paragraph text shown |
| O.7 | Active status | isActive = true | Green "Active" badge |
| O.8 | Inactive status | isActive = false | Gray "Inactive" badge |
| O.9 | Inactive card opacity | Inactive dimension | 60% opacity styling |
| O.10 | Grid scroll | Many dimensions | Grid scrollable |

---

### P. Learnings Tab Tests

| Test ID | Scenario | Action | Expected Result |
|---------|----------|--------|-----------------|
| P.1 | Empty state | No pending learnings | "No pending learnings to review" message |
| P.2 | Learnings list | Learnings exist | Vertical list of cards |
| P.3 | Learning type badge | View card | Blue badge (prompt_improvement, weight_adjustment, etc.) |
| P.4 | Dimension badge | Dimension linked | Gray dimension name badge |
| P.5 | Learning description | View card | Description paragraph |
| P.6 | Suggested change label | View card | "Suggested Change:" label |
| P.7 | JSON code block | View card | Pretty-printed JSON, monospace |
| P.8 | Approve button | View card | Green "Approve" button |
| P.9 | Reject button | View card | Gray "Reject" button |
| P.10 | Approve click | Click Approve | Learning removed, badge updates |
| P.11 | Reject click | Click Reject | Learning removed, badge updates |
| P.12 | Multiple learnings | Many learnings | All displayed in list |

---

### Q. Settings Tab Tests

#### Q.1 Scope Selector

| Test ID | Scenario | Action | Expected Result |
|---------|----------|--------|-----------------|
| Q.1.1 | Scope dropdown | Load settings | "Select Scope" dropdown visible |
| Q.1.2 | Dropdown options | Click dropdown | All scopes listed as "Name (domain)" |
| Q.1.3 | Current selection | Scope selected | Dropdown shows current scope |
| Q.1.4 | Change scope | Select different scope | All data refreshes for new scope |

#### Q.2 Scope Configuration

| Test ID | Scenario | Action | Expected Result |
|---------|----------|--------|-----------------|
| Q.2.1 | Section hidden | No scope selected | Configuration not shown |
| Q.2.2 | Section visible | Scope selected | Configuration section appears |
| Q.2.3 | Name field | View settings | Text input with scope name |
| Q.2.4 | Name editable | Edit name field | Changes saved on blur |
| Q.2.5 | Domain field | View settings | Text input (disabled) |
| Q.2.6 | Domain read-only | Try to edit | Cannot modify |
| Q.2.7 | Description field | View settings | Textarea with description |
| Q.2.8 | Description editable | Edit description | Changes saved on blur |

#### Q.3 Threshold Configuration

| Test ID | Scenario | Action | Expected Result |
|---------|----------|--------|-----------------|
| Q.3.1 | Section visible | Thresholds configured | Threshold section shown |
| Q.3.2 | Alert threshold | View thresholds | Formatted percentage (read-only) |
| Q.3.3 | Debate threshold | View thresholds | Formatted percentage (read-only) |
| Q.3.4 | Stale days | View thresholds | Number of days (read-only) |

#### Q.4 Analysis Configuration

| Test ID | Scenario | Action | Expected Result |
|---------|----------|--------|-----------------|
| Q.4.1 | Section visible | Config exists | Analysis config section shown |
| Q.4.2 | Risk Radar status | Enabled | Green "Enabled" text |
| Q.4.3 | Risk Radar status | Disabled | Gray "Disabled" text |
| Q.4.4 | Debate System status | Enabled | Green "Enabled" text |
| Q.4.5 | Debate System status | Disabled | Gray "Disabled" text |
| Q.4.6 | Learning Loop status | Enabled | Green "Enabled" text |
| Q.4.7 | Learning Loop status | Disabled | Gray "Disabled" text |

#### Q.5 LLM Configuration

| Test ID | Scenario | Action | Expected Result |
|---------|----------|--------|-----------------|
| Q.5.1 | Section visible | LLM config exists | LLM section shown |
| Q.5.2 | Provider display | View config | Provider name (read-only) |
| Q.5.3 | Model display | View config | Model name (read-only) |
| Q.5.4 | Temperature display | Temperature set | Temperature value (read-only) |
| Q.5.5 | Temperature hidden | No temperature | Row not shown |

---

### R. Loading & State Tests

| Test ID | Scenario | Action | Expected Result |
|---------|----------|--------|-----------------|
| R.1 | Loading overlay | Initial load | Overlay visible during data fetch |
| R.2 | Loading complete | Data loaded | Overlay disappears |
| R.3 | Analyzing state | Click Analyze All | "Analyzing..." button state |
| R.4 | Buttons disabled during load | Loading active | Action buttons disabled |
| R.5 | Buttons disabled during analyze | Analyzing active | Action buttons disabled |
| R.6 | Error state display | API error | Error banner appears |
| R.7 | Empty states | No data | Appropriate empty messages |

---

### S. End-to-End UI Scenarios

#### S.1 Complete Dashboard Workflow

| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| S.1.1 | Initial load flow | 1. Navigate to dashboard | Scopes load → First scope selected → Data populates → Stats show |
| S.1.2 | Subject selection flow | 1. Click subject in sidebar | Detail view loads → Radar chart renders → Assessments display |
| S.1.3 | Analysis workflow | 1. Click "Analyze All" 2. Wait for completion | Loading state → Analysis runs → Stats refresh → Scores update |
| S.1.4 | Debate trigger workflow | 1. Select high-risk subject (≥70%) 2. Click "Trigger Debate" | Debate runs → Three-column summary appears |
| S.1.5 | Alert management workflow | 1. Go to Alerts tab 2. Click Acknowledge | Alert disappears → Badge count decreases |
| S.1.6 | Learning approval workflow | 1. Go to Learnings tab 2. Click Approve | Learning disappears → Badge count decreases |
| S.1.7 | Scope switch workflow | 1. Go to Settings tab 2. Change scope dropdown | All data refreshes → New subjects load → Detail view clears |

#### S.2 Search and Filter Workflow

| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| S.2.1 | Search and select | 1. Type in search 2. Click filtered result | Subject filters → Selection works → Detail loads |
| S.2.2 | Clear search | 1. Search 2. Clear text | All subjects return |

#### S.3 Responsive Behavior

| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| S.3.1 | Desktop layout | View at 1200px+ | Full sidebar + detail layout |
| S.3.2 | Tablet layout | View at 768px-1199px | Adjusted spacing, readable |
| S.3.3 | Mobile layout | View at < 768px | Debate columns stack, cards adjust |
| S.3.4 | Radar chart resize | Resize window | Chart scales proportionally |

#### S.4 Error Recovery

| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| S.4.1 | Network error recovery | 1. Disconnect network 2. Try action 3. Reconnect 4. Retry | Error shows → Reconnect → Action succeeds |
| S.4.2 | Error dismissal | 1. Error occurs 2. Click close | Banner dismisses → Can continue |

---

### T. Accessibility Tests

| Test ID | Scenario | Action | Expected Result |
|---------|----------|--------|-----------------|
| T.1 | Keyboard navigation | Tab through interface | All interactive elements focusable |
| T.2 | Focus indicators | Focus on elements | Visible focus ring |
| T.3 | Button labels | Screen reader check | Buttons have accessible names |
| T.4 | Color contrast | All text | Meets WCAG AA contrast |
| T.5 | Alt text | Charts/images | Appropriate descriptions |
| T.6 | ARIA labels | Complex widgets | Proper ARIA attributes |

---

### U. Data Flow Verification

| Test ID | Scenario | Verify | Expected Behavior |
|---------|----------|--------|-------------------|
| U.1 | Page load → Store | Check store state | Scopes, subjects, scores populated |
| U.2 | Select subject → API | Monitor network | `getSubjectDetail` called |
| U.3 | Analyze → API | Monitor network | `analyzeSubject` or `analyzeScope` called |
| U.4 | Acknowledge → Store | Check store state | Alert removed from store |
| U.5 | Approve learning → Store | Check store state | Learning removed from store |
| U.6 | Scope change → Full refresh | Monitor network | Multiple API calls for new scope data |

---

## Complete User Interaction Checklist

### Overview Tab
- [ ] Click subject in sidebar → Load subject details
- [ ] Type in sidebar search box → Filter subjects
- [ ] Click "Re-analyze" button → Trigger subject analysis
- [ ] Click "Trigger Debate" button → Trigger debate
- [ ] Click "Show Reasoning" on dimension cards → Expand reasoning
- [ ] Click "Hide Reasoning" on dimension cards → Collapse reasoning
- [ ] Hover over sidebar items → Show hover background
- [ ] Scroll sidebar → Browse subjects
- [ ] Scroll detail view → See all content

### Alerts Tab
- [ ] Click "Acknowledge" button → Acknowledge alert
- [ ] View alert severity badge
- [ ] View alert details

### Dimensions Tab
- [ ] View dimension cards grid
- [ ] View dimension weights and status

### Learnings Tab
- [ ] Click "Approve" button → Approve learning
- [ ] Click "Reject" button → Reject learning
- [ ] View learning type badge
- [ ] View suggested change JSON

### Settings Tab
- [ ] Change scope dropdown → Switch scope
- [ ] Edit scope name field → Update scope
- [ ] Edit scope description → Update scope
- [ ] View threshold configuration
- [ ] View analysis configuration
- [ ] View LLM configuration

### Header
- [ ] Click "Analyze All" button → Trigger batch analysis
- [ ] Click "Refresh" button → Reload data
- [ ] Close error banner → Dismiss error

### Stats Cards
- [ ] View total subjects count
- [ ] View analyzed subjects count
- [ ] View average risk score with color coding
- [ ] View critical alerts count (conditional)
- [ ] View warning alerts count (conditional)
- [ ] View pending learnings count (conditional)

### Tab Navigation
- [ ] Click "Overview" tab → Switch to overview
- [ ] Click "Alerts" tab → Switch to alerts
- [ ] Click "Dimensions" tab → Switch to dimensions
- [ ] Click "Learnings" tab → Switch to learnings
- [ ] Click "Settings" tab → Switch to settings
- [ ] View tab badges (alerts and learnings counts)

### Loading & Error States
- [ ] View loading overlay during data fetch
- [ ] View "Analyzing..." button state
- [ ] View disabled buttons during loading
- [ ] View error banner when API errors occur
- [ ] View empty states when no data exists

---

*End of Testing Guide*
