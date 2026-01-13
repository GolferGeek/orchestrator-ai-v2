# Prediction System - Complete Testing Guide

**Version**: 1.0
**Last Updated**: 2026-01-12
**Sprints Covered**: 0-7 Complete

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Getting Started](#2-getting-started)
3. [UI Screens Reference](#3-ui-screens-reference)
4. [Complete Data Flow](#4-complete-data-flow)
5. [User Journey 1: Initial Setup](#5-user-journey-1-initial-setup)
6. [User Journey 2: Monitoring Live Data](#6-user-journey-2-monitoring-live-data)
7. [User Journey 3: Prediction Deep Dive](#7-user-journey-3-prediction-deep-dive)
8. [User Journey 4: Human Review (HITL)](#8-user-journey-4-human-review-hitl)
9. [User Journey 5: Evaluation & Learning](#9-user-journey-5-evaluation--learning)
10. [User Journey 6: Test Lab & Experimentation](#10-user-journey-6-test-lab--experimentation)
11. [User Journey 7: Analytics & Optimization](#11-user-journey-7-analytics--optimization)
12. [Background Processes](#12-background-processes)
13. [CRUD Operations Reference](#13-crud-operations-reference)
14. [Critical Test Scenarios](#14-critical-test-scenarios)
15. [Feature Checklists](#15-feature-checklists)
16. [Error Handling Tests](#16-error-handling-tests)
17. [API Testing (E2E)](#17-api-testing-e2e)

---

## 1. System Overview

The Prediction System is a multi-tiered AI forecasting engine that:
- **Crawls** external data sources (news, RSS, web pages)
- **Detects signals** from crawled content using LLM analysis
- **Aggregates signals** into predictors with confidence scores
- **Generates predictions** when threshold criteria are met
- **Evaluates outcomes** against actual results
- **Learns** from successes and failures to improve over time

### Core Data Flow
```
Universe → Target → Source → Crawl → Signal → Predictor → Prediction → Evaluation → Learning
```

### Key Entities
| Entity | Description |
|--------|-------------|
| **Universe** | Analysis domain (stocks, crypto, elections, polymarket) |
| **Target** | Specific asset/symbol to predict (AAPL, BTC, etc.) |
| **Source** | Data feed URL (news site, RSS, API) |
| **Signal** | Raw detected event/insight from crawled content |
| **Predictor** | AI assessment of a signal (direction, strength) |
| **Prediction** | Final forecast output with confidence |
| **Evaluation** | Accuracy scoring after outcome known |
| **Learning** | Improvement rule applied to future predictions |

---

## 2. Getting Started

### Prerequisites
1. API server running on `localhost:6100`
2. Supabase database with prediction schema
3. Web app running on `localhost:6101` (or configured port)
4. Finance organization exists with prediction agents
5. Valid test user credentials

### Test User Credentials
```
Email: golfergeek.user@orchestratorai.io
Password: GolferGeek123!
Organization: finance
```

### Quick Start Commands
```bash
# Start API server
cd apps/api
npm run dev

# Start Web app (in another terminal)
cd apps/web
npm run dev

# Run E2E tests
cd apps/api
npx jest --config testing/test/jest-e2e.json prediction-runner
```

---

## 3. UI Screens Reference

### Navigation Structure
```
/prediction/                    → Main Dashboard
/prediction/universes           → Universe Management
/prediction/targets/:id         → Target Detail
/prediction/predictions/:id     → Prediction Detail
/prediction/sources             → Source Crawl Status
/prediction/analysts            → Analyst Management
/prediction/review-queue        → Human Review Queue
/prediction/learning-queue      → Learning Approval Queue
/prediction/learnings           → Active Learnings
/prediction/learning-promotion  → Learning Promotion
/prediction/missed-opportunities→ Missed Opportunity Analysis
/prediction/analytics           → Analytics Dashboard
/prediction/backtest            → Historical Backtesting
/prediction/test-lab            → Test Data Generator
/prediction/alerts              → System Alerts
/prediction/tool-wishlist       → Feature Requests
```

### Screen Details

#### Main Dashboard (`/prediction/`)
**Purpose**: Real-time overview of all prediction activity
**What to Look For**:
- Active predictions count and status breakdown
- Recent activity feed (signals, predictions, evaluations)
- LLM tier agreement statistics
- Quick filters by universe/status/direction

**Test Actions**:
- [ ] Verify prediction cards display correctly
- [ ] Test domain filter dropdown
- [ ] Test status filter (active/resolved/expired)
- [ ] Verify activity feed updates in real-time
- [ ] Click through to prediction detail

#### Universe Management (`/prediction/universes`)
**Purpose**: Create and configure prediction universes (analysis domains)
**What to Look For**:
- List of universes with domain badges
- Create/Edit modal with all fields
- Active/inactive status toggle
- LLM configuration section
- Threshold settings

**Test Actions**:
- [ ] Create new universe with each domain type
- [ ] Edit universe name, description
- [ ] Configure LLM tiers (gold/silver/bronze)
- [ ] Set prediction thresholds
- [ ] Delete universe and verify cascade

#### Target Detail (`/prediction/targets/:id`)
**Purpose**: View individual target (symbol) with all related data
**What to Look For**:
- Target info card (symbol, type, status)
- Sources configured for this target
- Recent predictions list
- Performance metrics
- Signal activity

**Test Actions**:
- [ ] Navigate from universe → target
- [ ] View all sources for target
- [ ] See recent prediction history
- [ ] Check performance statistics

#### Prediction Detail (`/prediction/predictions/:id`)
**Purpose**: Deep dive into single prediction with full explainability
**What to Look For**:
- Prediction summary (direction, confidence, timeframe)
- **Snapshot tab**: All contributing predictors, signals, analyst assessments
- **Deep Dive tab**: Complete lineage back to source articles
- Status timeline (active → resolved → evaluated)
- Evaluation scores if resolved

**Test Actions**:
- [ ] Click on any prediction from dashboard
- [ ] Review snapshot data completeness
- [ ] Follow deep dive to original source articles
- [ ] Check evaluation scores after resolution

#### Source Crawl Status (`/prediction/sources`)
**Purpose**: Monitor health of all data sources
**What to Look For**:
- Source list with last crawl timestamp
- Success/failure rates
- Crawl frequency indicator
- Active/inactive status

**Test Actions**:
- [ ] Verify crawl timestamps update
- [ ] Check for failed crawls
- [ ] Test manual crawl trigger
- [ ] Review error messages for failures

#### Analyst Management (`/prediction/analysts`)
**Purpose**: Configure AI analyst personas that evaluate signals
**What to Look For**:
- System analysts (bullish, bearish, neutral)
- Custom analysts by scope level
- Weight and tier instruction settings
- Enable/disable toggle

**Test Actions**:
- [ ] View default system analysts
- [ ] Create custom analyst with perspective
- [ ] Adjust analyst weight
- [ ] Configure tier instructions
- [ ] Disable analyst and verify impact

#### Review Queue (`/prediction/review-queue`)
**Purpose**: Human-in-the-loop review of uncertain signals
**What to Look For**:
- Signals with confidence 0.4-0.7
- Signal content and source URL
- LLM preliminary assessment
- Approve/Reject/Modify buttons

**Test Actions**:
- [ ] Review pending signals
- [ ] Approve signal as-is
- [ ] Reject invalid signal
- [ ] Modify with strength override
- [ ] Add learning note
- [ ] Verify approved signal creates predictor

#### Learning Queue (`/prediction/learning-queue`)
**Purpose**: Review AI-suggested improvements
**What to Look For**:
- Pending learning suggestions
- Source (evaluation, missed opportunity)
- Suggested rule/pattern/adjustment
- Approve/Reject/Modify buttons

**Test Actions**:
- [ ] Review suggested learnings
- [ ] Approve learning
- [ ] Reject with reason
- [ ] Modify learning before approval

#### Learnings Management (`/prediction/learnings`)
**Purpose**: Browse and manage active learning rules
**What to Look For**:
- Learning list by scope
- Type badges (rule, pattern, threshold, avoid)
- Active/superseded/disabled status
- Version history

**Test Actions**:
- [ ] List learnings by scope filter
- [ ] Edit learning details
- [ ] Supersede with new version
- [ ] Disable learning
- [ ] View version history

#### Learning Promotion (`/prediction/learning-promotion`)
**Purpose**: Promote learnings up the scope hierarchy
**What to Look For**:
- Current scope level
- Target promotion scope
- Impact preview
- Confirm promotion

**Test Actions**:
- [ ] Promote target learning → universe
- [ ] Promote universe learning → domain
- [ ] Verify learning applies at new scope

#### Missed Opportunities (`/prediction/missed-opportunities`)
**Purpose**: Find significant moves that weren't predicted
**What to Look For**:
- Unpredicted price moves list
- Move percentage and date
- Root cause analysis
- Suggested improvements

**Test Actions**:
- [ ] Run detection scan
- [ ] View missed move details
- [ ] Review root cause analysis
- [ ] Accept suggested learnings

#### Analytics Dashboard (`/prediction/analytics`)
**Purpose**: Performance metrics and insights
**What to Look For**:
- Prediction accuracy over time
- Accuracy by target
- Accuracy by strategy
- Signal quality metrics
- Analyst performance comparison

**Test Actions**:
- [ ] Review accuracy metrics
- [ ] Filter by date range
- [ ] Compare targets performance
- [ ] Identify best/worst performers

#### Backtest View (`/prediction/backtest`)
**Purpose**: Test predictions against historical data
**What to Look For**:
- Date range selector
- Target selection
- Accuracy metrics
- Comparison charts

**Test Actions**:
- [ ] Select historical date range
- [ ] Run backtest
- [ ] Review accuracy results
- [ ] Compare with live performance

#### Test Lab (`/prediction/test-lab`)
**Purpose**: Generate synthetic test data
**What to Look For**:
- Test scenario creator
- Synthetic article generator
- Price data generator
- Target mirror creator

**Test Actions**:
- [ ] Create test scenario
- [ ] Generate synthetic articles
- [ ] Create price movement data
- [ ] Create T_ mirror target

#### Alerts View (`/prediction/alerts`)
**Purpose**: System alerts and notifications
**What to Look For**:
- Alert list by severity
- Alert type (crawl failure, threshold breach, anomaly)
- Timestamp and source
- Acknowledge/dismiss options

**Test Actions**:
- [ ] View active alerts
- [ ] Acknowledge alerts
- [ ] Verify alert generation triggers

---

## 4. Complete Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         UNIVERSE (Analysis Domain)                       │
│  Domains: stocks | crypto | elections | polymarket                      │
│  Config: LLM tiers, thresholds, notification settings                   │
└────────────────────────────────────┬────────────────────────────────────┘
                                     ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                      TARGET (Symbol/Asset to Predict)                    │
│  Examples: AAPL, GOOGL, BTC, ETH, Election-2028                         │
│  Config: context, metadata, LLM override                                │
│  T_ prefix = Test target (isolated from production analytics)           │
└────────────────────────────────────┬────────────────────────────────────┘
                                     ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                       SOURCE (Data Feed Configuration)                   │
│  Types: web | rss | api                                                 │
│  Scopes: runner | domain | universe | target                            │
│  Frequencies: 5 | 10 | 15 | 30 | 60 minutes                            │
│  Config: crawlConfig, authConfig (bearer/api_key/basic)                │
└────────────────────────────────────┬────────────────────────────────────┘
                                     ↓
┌─────────────────────────────────────────────────────────────────────────┐
│              CRAWL (SourceCrawlerRunner - Scheduled)                     │
│  Schedule: Every 5/10/15/30/60 min based on source frequency           │
│  Service: FirecrawlService → HTML parsing, JS rendering                │
│  Protection: BackpressureService (max 10 concurrent, rate limits)      │
│  Output: Raw content → SignalDetectionService                          │
└────────────────────────────────────┬────────────────────────────────────┘
                                     ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    SIGNAL (Detected Event/Insight)                       │
│  Created by: SignalDetectionService (LLM analysis of crawled content)  │
│  Fields: content, direction, urgency, confidence, url, fingerprint     │
│  Deduplication: content_hash prevents duplicates                       │
│  Status: pending → processing → rejected | used                        │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ HITL BRANCH: Confidence 0.4-0.7 → Review Queue                  │   │
│  │ Human decides: approve | reject | modify (strength override)    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────┬────────────────────────────────────┘
                                     ↓
┌─────────────────────────────────────────────────────────────────────────┐
│              TIER 1: SIGNAL PROCESSING (BatchSignalProcessorRunner)      │
│  Schedule: Every 15 minutes                                             │
│  Process: Signal → AnalystEnsembleService → Individual assessments     │
│  Fast Path: confidence >= 0.90 → Immediate predictor creation          │
│  LLM: claude-sonnet (silver tier for signal processing)                │
│  Usage: LlmUsageLimiterService enforces daily/monthly caps             │
│  Output: PREDICTORS                                                     │
└────────────────────────────────────┬────────────────────────────────────┘
                                     ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                      PREDICTOR (AI Signal Assessment)                    │
│  Created by: AnalystEnsembleService                                    │
│  Fields: direction, strength (0-1), confidence, analyst_slug           │
│  TTL: Expires after predictor_ttl_hours (default 24h)                  │
│  Multiple predictors aggregate for prediction threshold check          │
└────────────────────────────────────┬────────────────────────────────────┘
                                     ↓
┌─────────────────────────────────────────────────────────────────────────┐
│         THRESHOLD CHECK (BatchPredictionGeneratorRunner)                 │
│  Schedule: Every 30 minutes                                             │
│  Thresholds:                                                           │
│    • min_predictors (default: 2) - Minimum predictors required         │
│    • min_combined_strength (default: 0.3) - Total strength threshold   │
│    • min_direction_consensus (default: 0.6) - Agreement percentage     │
│    • predictor_ttl_hours (default: 24) - How long predictors valid     │
│  If thresholds MET → Generate prediction                               │
│  If thresholds NOT MET → Wait for more signals                         │
└────────────────────────────────────┬────────────────────────────────────┘
                                     ↓
┌─────────────────────────────────────────────────────────────────────────┐
│            TIER 2+3: LLM ENSEMBLE (During Prediction Generation)         │
│  Gold Tier: claude-opus-4-5 (best model, high confidence)              │
│  Silver Tier: claude-sonnet-4 (balanced model)                         │
│  Bronze Tier: claude-haiku (fast model, lower confidence)              │
│                                                                         │
│  Process: Each tier votes on direction + confidence                    │
│  Consensus: Weighted combination of all tier votes                     │
│  Output: Final direction, confidence, reasoning                        │
└────────────────────────────────────┬────────────────────────────────────┘
                                     ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    PREDICTION (System Output/Forecast)                   │
│  Fields:                                                                │
│    • targetId - What we're predicting                                  │
│    • direction - up | down | neutral                                   │
│    • magnitude - Expected % change (optional)                          │
│    • confidence - 0.0 to 1.0                                          │
│    • timeframeHours - Prediction window (default 24h)                  │
│    • expires_at - When prediction becomes stale                        │
│    • status - active | resolved | evaluated | expired                  │
│                                                                         │
│  Snapshot: Complete reasoning chain preserved for explainability       │
│    - All contributing predictors                                       │
│    - All contributing signals                                          │
│    - All analyst assessments                                           │
│    - Applied learnings                                                 │
│    - LLM tier votes and reasoning                                      │
└────────────────────────────────────┬────────────────────────────────────┘
                                     ↓
┌─────────────────────────────────────────────────────────────────────────┐
│              OUTCOME TRACKING (OutcomeTrackingRunner)                    │
│  Schedule: Every 15 minutes                                             │
│  Process:                                                               │
│    1. Capture current price/value for active predictions               │
│    2. Store as TARGET_SNAPSHOT                                         │
│    3. When timeframe ends: Calculate outcome_value (% change)          │
│    4. Update prediction status: active → resolved                      │
│    5. Mark expired predictions (past expires_at)                       │
└────────────────────────────────────┬────────────────────────────────────┘
                                     ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                   EVALUATION (EvaluationRunner)                          │
│  Schedule: Every 1 hour                                                 │
│  Scores (0.0 to 1.0):                                                  │
│    • directionScore - Was up/down correct? (binary: 0 or 1)           │
│    • magnitudeScore - How close to actual % change?                   │
│    • timingScore - How close to actual timing?                        │
│    • overallScore - Composite accuracy metric                         │
│                                                                         │
│  Manual Override: Human can correct any score with reason              │
│  Output: Evaluation record + Learning suggestions to queue             │
└────────────────────────────────────┬────────────────────────────────────┘
                                     ↓
┌─────────────────────────────────────────────────────────────────────────┐
│           MISSED OPPORTUNITY SCAN (MissedOpportunityScannerRunner)       │
│  Schedule: Every 4 hours                                                │
│  Detection: Price moves > threshold% without prediction coverage       │
│  Analysis: Why was move missed?                                        │
│    - Not enough signals (source gap)                                   │
│    - Signals rejected (threshold too high)                             │
│    - Wrong direction predicted (analyst miscalibration)                │
│  Output: Suggested learnings + source additions                        │
└────────────────────────────────────┬────────────────────────────────────┘
                                     ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    LEARNING FEEDBACK LOOP                                │
│  Sources:                                                               │
│    1. Human - Manual entry via Learning Management UI                  │
│    2. Evaluation - Auto-generated from low accuracy patterns           │
│    3. Missed Opportunity - Root cause analysis suggestions             │
│                                                                         │
│  Types:                                                                 │
│    • rule - Explicit rule ("ignore signals about rumors")              │
│    • pattern - Pattern to watch ("morning signals more reliable")      │
│    • weight_adjustment - Analyst weight change                         │
│    • threshold - Modify prediction thresholds                          │
│    • avoid - Explicit exclusion rule                                   │
│                                                                         │
│  Scopes (inheritance hierarchy):                                       │
│    runner → domain → universe → target                                 │
│    (target inherits all higher-level learnings)                        │
│                                                                         │
│  Status: active | superseded | disabled                                │
│  Versioning: Supersede creates new version, preserves history          │
│                                                                         │
│  Application: Learnings affect next prediction generation cycle        │
│    - Analyst weights modified                                          │
│    - Signal filtering rules applied                                    │
│    - Threshold adjustments made                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 5. User Journey 1: Initial Setup

**Goal**: Configure the system from scratch to get first prediction

### Step 1: Create a Universe
**Screen**: Universe Management (`/prediction/universes`)
**Actions**:
1. Click "Create Universe" button
2. Fill in:
   - **Name**: "US Tech Stocks 2026"
   - **Domain**: stocks (select from dropdown)
   - **Description**: "Predictions for US technology sector stocks"
3. Configure LLM Tiers:
   - Gold: anthropic / claude-opus-4-5-20250514
   - Silver: anthropic / claude-sonnet-4-20250514
   - Bronze: anthropic / claude-haiku (optional)
4. Set Thresholds:
   - min_predictors: 2
   - min_combined_strength: 0.3
   - min_direction_consensus: 0.6
5. Click "Create"

**Expected Result**: Universe appears in list with "Active" status

**Validation Checklist**:
- [ ] Universe shows in list
- [ ] Domain badge displays correctly
- [ ] LLM config saved (verify in edit modal)
- [ ] Thresholds saved correctly

### Step 2: Add Targets
**Screen**: Universe Management → "Add Target" or Target Management
**Actions**:
1. Select your universe
2. Click "Add Target"
3. Fill in:
   - **Symbol**: AAPL
   - **Name**: Apple Inc.
   - **Type**: stock
   - **Context**: "Consumer electronics and software giant. Watch for product launches, earnings, and supply chain news."
4. Repeat for other symbols (GOOGL, MSFT, NVDA)

**Expected Result**: Targets appear under universe

**Validation Checklist**:
- [ ] Target shows in universe view
- [ ] Symbol and name display correctly
- [ ] Context saved (verify in edit)
- [ ] Target type badge correct

### Step 3: Configure Sources
**Screen**: Source Management or Target Detail
**Actions**:
1. Navigate to target (AAPL)
2. Click "Add Source"
3. Fill in:
   - **Name**: TechCrunch Apple Feed
   - **URL**: https://techcrunch.com/tag/apple/feed/
   - **Type**: rss
   - **Scope**: target
   - **Crawl Frequency**: 15 minutes
4. Click "Test Crawl" to preview
5. If preview looks good, click "Save"
6. Add additional sources as needed

**Expected Result**: Source appears in target's source list

**Validation Checklist**:
- [ ] Source shows in target view
- [ ] Test crawl returns content
- [ ] Crawl frequency displays correctly
- [ ] Source marked as active

### Step 4: Wait for First Signals
**Screen**: Prediction Dashboard (`/prediction/`)
**Timeline**:
- After 15 minutes: First crawl should complete
- Check "Activity Feed" for crawl events
- Look for "Signal detected" entries

**Expected Result**: Signals appear in activity feed

**Validation Checklist**:
- [ ] Crawl completed event appears
- [ ] Signals detected (if news available)
- [ ] Signal count increases over time

### Step 5: Monitor for First Prediction
**Screen**: Prediction Dashboard
**Timeline**:
- After 30 minutes (BatchPredictionGenerator cycle): Check for predictions
- Requires: At least 2 predictors with threshold met

**Expected Result**: First prediction card appears on dashboard

**Validation Checklist**:
- [ ] Prediction card shows direction (up/down)
- [ ] Confidence percentage displays
- [ ] Target symbol correct
- [ ] Click through to detail works

---

## 6. User Journey 2: Monitoring Live Data

**Goal**: Understand the live data flow and system health

### Monitor Crawl Activity
**Screen**: Source Crawl Status (`/prediction/sources`)
**What to Watch**:
- Last crawl timestamp (should update per frequency)
- Success/failure indicators
- Error messages for failed crawls

**Test Actions**:
- [ ] Verify all sources show recent crawl times
- [ ] Check for any failed sources
- [ ] Review error details for failures
- [ ] Verify crawl frequency is being honored

### Monitor Signal Flow
**Screen**: Prediction Dashboard → Activity Feed
**What to Watch**:
- "Signal detected" events with timestamp
- Signal direction indicators
- Signal confidence levels

**Test Actions**:
- [ ] Activity feed updates automatically
- [ ] Signals appear after crawl completes
- [ ] Signal count matches expected volume

### Monitor Predictor Creation
**Screen**: Prediction Dashboard → Activity Feed
**What to Watch**:
- "Predictor created" events
- Which signals became predictors
- Analyst attribution

**Test Actions**:
- [ ] Predictors created from high-confidence signals
- [ ] Analyst slug shows in predictor details
- [ ] Strength score assigned

### Monitor Prediction Generation
**Screen**: Prediction Dashboard
**What to Watch**:
- New prediction cards appearing
- Threshold met indicators
- LLM tier agreement stats

**Test Actions**:
- [ ] Predictions appear when thresholds met
- [ ] Direction consensus displayed
- [ ] Confidence calculated correctly

### Check System Alerts
**Screen**: Alerts View (`/prediction/alerts`)
**What to Watch**:
- Crawl failure alerts
- Rate limit warnings
- Anomaly detections

**Test Actions**:
- [ ] Alerts generated for failures
- [ ] Severity levels appropriate
- [ ] Acknowledge clears alert

---

## 7. User Journey 3: Prediction Deep Dive

**Goal**: Understand a prediction's full reasoning chain

### View Prediction Summary
**Screen**: Prediction Detail (`/prediction/predictions/:id`)
**Location**: Click any prediction card from dashboard
**What to See**:
- Direction: UP / DOWN / NEUTRAL with confidence %
- Timeframe: "24 hours" or configured window
- Status: Active / Resolved / Evaluated / Expired
- Target: Symbol being predicted

**Test Actions**:
- [ ] Direction displays correctly
- [ ] Confidence percentage accurate
- [ ] Timeframe matches configuration
- [ ] Status updates over time

### View Snapshot (Explainability)
**Screen**: Prediction Detail → Snapshot Tab
**What to See**:
- **Contributing Predictors**: All predictors that triggered this prediction
- **Signals**: Original signals that became predictors
- **Analyst Assessments**: Each analyst's vote and reasoning
- **Learnings Applied**: Any active learnings that affected generation
- **LLM Tier Votes**: Gold/Silver/Bronze model votes

**Test Actions**:
- [ ] All predictors listed with strength scores
- [ ] Signals traceable to source URLs
- [ ] Analyst assessments show perspectives
- [ ] Applied learnings visible
- [ ] LLM tier breakdown available

### View Deep Dive (Full Lineage)
**Screen**: Prediction Detail → Deep Dive Tab
**What to See**:
- Complete chain: Prediction → Predictors → Signals → Source Articles
- Original article content (snippet)
- Source URLs (clickable)
- Timestamps at each step

**Test Actions**:
- [ ] Can trace back to original source
- [ ] Source URLs are clickable
- [ ] Article content preview available
- [ ] Timeline shows processing steps

### View Evaluation (After Resolution)
**Screen**: Prediction Detail → Evaluation Section
**Timing**: Available after prediction timeframe ends
**What to See**:
- **Direction Score**: 1.0 (correct) or 0.0 (incorrect)
- **Magnitude Score**: How close to actual % change
- **Timing Score**: How close to actual timing
- **Overall Score**: Composite accuracy

**Test Actions**:
- [ ] Scores appear after resolution
- [ ] Direction correctness accurate
- [ ] Magnitude comparison reasonable
- [ ] Override option available

---

## 8. User Journey 4: Human Review (HITL)

**Goal**: Review uncertain signals that need human judgment

### Access Review Queue
**Screen**: Review Queue (`/prediction/review-queue`)
**What to See**:
- List of pending signals (confidence 0.4-0.7)
- Signal content preview
- Source URL
- LLM preliminary assessment
- Timestamp

**Test Actions**:
- [ ] Only 0.4-0.7 confidence signals appear
- [ ] Content preview readable
- [ ] Source link works

### Review Individual Signal
**Screen**: Review Queue → Signal Detail
**What to See**:
- Full signal content
- Source article context
- LLM reasoning for uncertainty
- Current confidence score

**Test Actions**:
- [ ] Full content visible
- [ ] LLM reasoning explains uncertainty
- [ ] Context helps decision making

### Make Review Decision

#### Option A: Approve
**Action**: Click "Approve"
**Effect**: Signal becomes predictor with original confidence
**Test**:
- [ ] Signal disappears from queue
- [ ] Predictor created
- [ ] May trigger prediction if threshold met

#### Option B: Reject
**Action**: Click "Reject"
**Effect**: Signal marked rejected, won't create predictor
**Test**:
- [ ] Signal disappears from queue
- [ ] No predictor created
- [ ] Signal status = "rejected"

#### Option C: Modify
**Action**: Click "Modify" → Set strength override
**Effect**: Signal becomes predictor with your specified strength
**Fields**:
- Strength Override: 0.0 to 1.0
- Notes: Why this adjustment?
- Learning Note: (optional) Capture insight for future

**Test**:
- [ ] Predictor created with override strength
- [ ] Notes saved with decision
- [ ] Learning note queued if provided

---

## 9. User Journey 5: Evaluation & Learning

**Goal**: Improve system based on prediction outcomes

### View Resolved Predictions
**Screen**: Prediction Dashboard with "Resolved" filter
**What to See**:
- Predictions past their timeframe
- Actual outcome vs prediction
- Preliminary evaluation scores

**Test Actions**:
- [ ] Filter shows only resolved predictions
- [ ] Outcome value displayed
- [ ] Scores calculated

### Review Evaluation Details
**Screen**: Prediction Detail → Evaluation Section
**What to See**:
- Direction Score: Was direction correct?
- Magnitude Score: How close to actual %?
- Timing Score: How close to timing?
- Overall Score: Composite

**Test Actions**:
- [ ] All scores between 0 and 1
- [ ] Scores match intuitive assessment
- [ ] Calculation logic visible

### Override Evaluation (If Needed)
**Screen**: Prediction Detail → Evaluation → Override
**When**: Auto-evaluation seems incorrect (data quality issues, etc.)
**Fields**:
- Score to override (direction/magnitude/timing/overall)
- New value (0.0 to 1.0, or boolean for direction)
- Reason (required, min 10 characters)

**Test Actions**:
- [ ] Override changes displayed score
- [ ] Reason is required
- [ ] Audit trail captures override

### Review Learning Queue
**Screen**: Learning Queue (`/prediction/learning-queue`)
**What to See**:
- AI-suggested learnings from evaluation
- Source: evaluation | missed_opportunity
- Suggested type: rule | pattern | weight_adjustment | threshold | avoid

**Test Actions**:
- [ ] Suggestions appear after low-accuracy evaluations
- [ ] Suggestion logic is reasonable
- [ ] Source correctly attributed

### Approve/Reject Learnings
**Actions**:
1. **Approve**: Learning becomes active, affects future predictions
2. **Reject**: Learning discarded
3. **Modify**: Edit learning before approving

**Test Actions**:
- [ ] Approved learnings appear in Learnings Management
- [ ] Rejected learnings removed from queue
- [ ] Modified learnings save correctly

### Manage Active Learnings
**Screen**: Learnings Management (`/prediction/learnings`)
**Actions**:
- View all active learnings
- Filter by scope (runner/domain/universe/target)
- Edit learning details
- Supersede with new version
- Disable learning

**Test Actions**:
- [ ] All active learnings listed
- [ ] Scope filter works
- [ ] Edit saves changes
- [ ] Supersede creates version chain
- [ ] Disable removes from active application

### Promote Learnings
**Screen**: Learning Promotion (`/prediction/learning-promotion`)
**Purpose**: Apply target learning to broader scope
**Example**: Learning for AAPL → Apply to all stocks
**Promotion Path**: target → universe → domain → runner

**Test Actions**:
- [ ] Select learning to promote
- [ ] Choose target scope
- [ ] Verify learning appears at new scope
- [ ] Verify cascade to lower scopes

---

## 10. User Journey 6: Test Lab & Experimentation

**Goal**: Test system behavior with synthetic data

### Access Test Lab
**Screen**: Test Lab (`/prediction/test-lab`)
**Purpose**: Generate controlled test data without affecting production

### Create Test Scenario
**What**: Define a test case (e.g., "AAPL bullish news scenario")
**Fields**:
- Name: "AAPL Q1 Earnings Beat"
- Target Symbol: T_AAPL (T_ prefix for test)
- Scenario Config: market_condition, expected_outcome
- Duration: 24 hours

**Test Actions**:
- [ ] Scenario created successfully
- [ ] T_ prefix target isolated from production
- [ ] Scenario appears in list

### Generate Synthetic Articles
**What**: Create fake news articles for signal testing
**Fields**:
- Scenario: Select from list
- Title: "Apple Reports Record Q1 Revenue"
- Content: Bullish article content
- Sentiment: bullish/bearish/neutral

**Test Actions**:
- [ ] Article created
- [ ] Shows in test articles list
- [ ] Triggers signal when crawled

### Generate Price Data
**What**: Create historical price points for outcome testing
**Fields**:
- Symbol: T_AAPL
- Date range
- Price sequence

**Test Actions**:
- [ ] Price data created
- [ ] Available for outcome tracking
- [ ] Evaluation can compare against

### Create Target Mirror
**What**: Copy production target for isolated testing
**Result**: T_AAPL mirrors AAPL but isolated from production analytics

**Test Actions**:
- [ ] Mirror created with T_ prefix
- [ ] Production analytics exclude T_ targets
- [ ] Test analytics include T_ targets

### Run Backtest
**Screen**: Backtest View (`/prediction/backtest`)
**What**: Test prediction logic against historical data
**Fields**:
- Date range: Jan 1, 2025 - Dec 31, 2025
- Targets: Select targets
- Run

**Test Actions**:
- [ ] Backtest completes
- [ ] Accuracy metrics displayed
- [ ] Compare with live performance

---

## 11. User Journey 7: Analytics & Optimization

**Goal**: Analyze system performance and optimize

### View Analytics Dashboard
**Screen**: Analytics Dashboard (`/prediction/analytics`)
**Sections**:

#### Overall Accuracy
- Total predictions made
- Accuracy rate (direction correct %)
- Trend over time

**Test Actions**:
- [ ] Accuracy rate calculation correct
- [ ] Time series chart renders
- [ ] Filter by date range works

#### Accuracy by Target
- Per-target accuracy breakdown
- Best/worst performers
- Volume by target

**Test Actions**:
- [ ] All targets listed
- [ ] Sort by accuracy works
- [ ] Volume counts accurate

#### Accuracy by Strategy
- Per-strategy accuracy breakdown
- Strategy comparison

**Test Actions**:
- [ ] All strategies listed
- [ ] Comparison metrics useful

#### Signal Quality
- Signal volume over time
- Rejection rate
- Source contribution

**Test Actions**:
- [ ] Signal counts accurate
- [ ] Rejection rates by source
- [ ] High-quality sources identified

#### Analyst Performance
- Per-analyst accuracy
- Weight effectiveness
- Recommendation: Adjust weights

**Test Actions**:
- [ ] All analysts listed
- [ ] Performance breakdown useful
- [ ] Recommendations actionable

### Identify Missed Opportunities
**Screen**: Missed Opportunities (`/prediction/missed-opportunities`)
**What to See**:
- Significant price moves without prediction
- Root cause analysis
- Suggested improvements

**Test Actions**:
- [ ] Missed moves detected
- [ ] Root cause makes sense
- [ ] Suggestions are actionable

### Optimize Based on Data
**Actions Based on Analytics**:
1. Low accuracy analyst → Reduce weight or disable
2. High-volume low-quality source → Disable
3. Missed opportunities → Add sources
4. High accuracy target → Increase prediction frequency

---

## 12. Background Processes

These run automatically. Verify they're working:

| Runner | Schedule | Verification |
|--------|----------|--------------|
| **SourceCrawlerRunner** | Every 5/10/15/30/60 min | Check crawl timestamps in Source Status |
| **BatchSignalProcessorRunner** | Every 15 min | Signals transition to predictors |
| **BatchPredictionGeneratorRunner** | Every 30 min | Predictions appear when thresholds met |
| **OutcomeTrackingRunner** | Every 15 min | Predictions resolve after timeframe |
| **EvaluationRunner** | Every 1 hour | Resolved predictions get scores |
| **MissedOpportunityScannerRunner** | Every 4 hours | Missed opportunities detected |
| **ExpirationRunner** | Periodic | Expired data cleaned up |

### How to Verify Runners

**SourceCrawlerRunner**:
- Go to Source Crawl Status
- Verify "Last Crawl" timestamps update
- Check for consistent intervals

**BatchSignalProcessorRunner**:
- Create signal manually (test article)
- Wait 15 minutes
- Verify predictor created

**BatchPredictionGeneratorRunner**:
- Have 2+ predictors for target
- Wait 30 minutes
- Verify prediction generated

**OutcomeTrackingRunner**:
- Wait for prediction timeframe to end
- Verify status changes to "resolved"
- Verify outcome_value captured

**EvaluationRunner**:
- After prediction resolved
- Wait 1 hour
- Verify evaluation scores appear

**MissedOpportunityScannerRunner**:
- Check Missed Opportunities screen
- Verify significant moves detected
- Review root cause analysis

---

## 13. CRUD Operations Reference

### Universe
| Operation | API Action | Required Fields | Notes |
|-----------|------------|-----------------|-------|
| List | universes.list | - | Supports pagination, domain filter |
| Get | universes.get | id | Full details with config |
| Create | universes.create | name, domain | Also: description, agentSlug, llmConfig, thresholds |
| Update | universes.update | id | Any field can be updated |
| Delete | universes.delete | id | Cascades to targets, sources, predictions |

### Target
| Operation | API Action | Required Fields | Notes |
|-----------|------------|-----------------|-------|
| List | targets.list | universeId | Must specify universe |
| Get | targets.get | id | Includes effective LLM config |
| Create | targets.create | universeId, symbol, name, targetType | T_ prefix = test target |
| Update | targets.update | id | Any field except symbol |
| Delete | targets.delete | id | Cascades to sources, predictions |

### Source
| Operation | API Action | Required Fields | Notes |
|-----------|------------|-----------------|-------|
| List | sources.list | - | Filter by scope, type |
| Get | sources.get | id | Full config details |
| Create | sources.create | name, url, sourceType, scopeLevel | Also: targetId/universeId based on scope |
| Update | sources.update | id | Any field |
| Delete | sources.delete | id | Historical signals preserved |
| Test Crawl | sources.testCrawl | url | Preview only, no persist |

### Signal (Read-Only)
| Operation | API Action | Required Fields | Notes |
|-----------|------------|-----------------|-------|
| List | signals.list | targetId | Filter by disposition, includeTest |
| Get | signals.get | id | Full signal details |

### Prediction
| Operation | API Action | Required Fields | Notes |
|-----------|------------|-----------------|-------|
| List | predictions.list | - | Filter by target, status, direction, date |
| Get | predictions.get | id | Basic prediction data |
| Get Snapshot | predictions.getSnapshot | id | Full explainability data |
| Get Deep Dive | predictions.getDeepDive | id | Complete lineage |
| Compare | predictions.compare | ids[] | 2-10 predictions |

### Evaluation
| Operation | API Action | Required Fields | Notes |
|-----------|------------|-----------------|-------|
| List | evaluations.list | - | Filter by target, date, scores |
| Get | evaluations.get | id | Full evaluation details |
| Override | evaluations.override | id, overrideType, value, reason | Manual correction |

### Learning
| Operation | API Action | Required Fields | Notes |
|-----------|------------|-----------------|-------|
| List | learnings.list | - | Filter by scope, type, status |
| Get | learnings.get | id | Full learning details |
| Create | learnings.create | title, learningType, scopeLevel | Manual learning entry |
| Update | learnings.update | id | Any field |
| Supersede | learnings.supersede | id, newVersion | Versioning |

### Analyst
| Operation | API Action | Required Fields | Notes |
|-----------|------------|-----------------|-------|
| List | analysts.list | - | Filter by scope, domain |
| Get | analysts.get | id | Full analyst config |
| Create | analysts.create | slug, name, scope_level, perspective | Custom analyst |
| Update | analysts.update | id | Any field |
| Delete | analysts.delete | id | Soft delete (disable) |

### Review Queue
| Operation | API Action | Required Fields | Notes |
|-----------|------------|-----------------|-------|
| List | review-queue.list | - | Filter by target, date |
| Get | review-queue.get | id | Full signal for review |
| Respond | review-queue.respond | reviewId, decision | approve/reject/modify |

### Learning Queue
| Operation | API Action | Required Fields | Notes |
|-----------|------------|-----------------|-------|
| List | learning-queue.list | - | Pending suggestions |
| Get | learning-queue.get | id | Full suggestion |
| Approve | learning-queue.approve | id | Accept suggestion |
| Reject | learning-queue.reject | id | Discard suggestion |
| Modify | learning-queue.modify | id, changes | Edit before approve |

---

## 14. Critical Test Scenarios

### Scenario 1: Signal to Prediction Happy Path
**Setup**: Universe + Target + Source configured
**Steps**:
1. Wait for source crawl (15 min)
2. Verify signals created
3. Wait for signal processing (15 min)
4. Verify predictors created
5. Wait for prediction generation (30 min)
6. Verify prediction generated (if threshold met)
7. View prediction snapshot
8. Verify full lineage visible

**Expected**: Complete flow from crawl to prediction

### Scenario 2: HITL Review Flow
**Setup**: Signal with confidence 0.5 exists
**Steps**:
1. Signal appears in Review Queue
2. Open signal detail
3. Review content and assessment
4. Approve signal
5. Verify predictor created
6. Check if triggers prediction

**Expected**: Human decision affects prediction generation

### Scenario 3: Threshold Not Met
**Setup**: Only 1 predictor for target (threshold requires 2)
**Steps**:
1. Verify 1 predictor exists
2. Wait for prediction generation cycle
3. Verify NO prediction generated
4. Add second predictor (via new signal)
5. Wait for next cycle
6. Verify prediction NOW generated

**Expected**: Thresholds properly enforced

### Scenario 4: Evaluation and Learning
**Setup**: Prediction that resolved incorrectly
**Steps**:
1. Wait for prediction to resolve
2. Wait for evaluation (1 hour)
3. Verify direction score = 0 (wrong)
4. Check Learning Queue for suggestion
5. Approve learning
6. Verify learning active
7. Generate new prediction
8. Verify learning applied

**Expected**: System learns from mistakes

### Scenario 5: Learning Promotion
**Setup**: Target-level learning exists
**Steps**:
1. Create learning for specific target
2. Open Learning Promotion
3. Promote to universe level
4. Verify learning appears at universe scope
5. Create new target in universe
6. Verify learning inherited

**Expected**: Learnings cascade correctly

### Scenario 6: Missed Opportunity Detection
**Setup**: Significant price move without prediction
**Steps**:
1. Create price movement data (via Test Lab)
2. Ensure no prediction for that timeframe
3. Wait for missed opportunity scan
4. Verify missed opportunity detected
5. Review root cause analysis
6. Accept suggested learning

**Expected**: System identifies gaps

### Scenario 7: Manual Evaluation Override
**Setup**: Prediction with incorrect auto-evaluation
**Steps**:
1. Find resolved prediction with evaluation
2. Determine evaluation is incorrect
3. Click Override
4. Select score to override
5. Enter new value
6. Provide reason (min 10 chars)
7. Verify override saved
8. Check audit trail

**Expected**: Manual correction possible with audit

### Scenario 8: T_ Test Target Isolation
**Setup**: Production target + T_ mirror
**Steps**:
1. Create T_AAPL as mirror of AAPL
2. Generate test data for T_AAPL
3. View analytics WITHOUT includeTest
4. Verify T_AAPL excluded
5. View analytics WITH includeTest
6. Verify T_AAPL included

**Expected**: Test data isolated from production

### Scenario 9: LLM Tier Disagreement
**Setup**: Signal that causes tier disagreement
**Steps**:
1. Create ambiguous signal
2. Wait for prediction generation
3. View prediction snapshot
4. Check LLM tier votes
5. Verify Gold and Bronze disagree
6. Verify consensus calculation correct

**Expected**: Tier voting works correctly

### Scenario 10: Backpressure Under Load
**Setup**: Many sources configured
**Steps**:
1. Configure 15+ sources
2. Set all to 5-minute frequency
3. Monitor crawl activity
4. Verify rate limiting kicks in
5. Check no source failures due to overload

**Expected**: System handles load gracefully

---

## 15. Feature Checklists

### Universe Management
- [ ] Create universe with all required fields
- [ ] Create universe for each domain type (stocks, crypto, elections, polymarket)
- [ ] Update universe name, description
- [ ] Update LLM configuration
- [ ] Update thresholds
- [ ] Delete universe (verify cascade to targets)
- [ ] List universes with pagination (create 25+)
- [ ] Filter universes by domain
- [ ] Filter universes by active status
- [ ] Validation: Reject missing name
- [ ] Validation: Reject invalid domain

### Target Management
- [ ] Create target with all required fields
- [ ] Create target for each type (stock, crypto, election, polymarket)
- [ ] Update target name, context
- [ ] Update target metadata
- [ ] Delete target (verify cascade)
- [ ] List targets (requires universeId)
- [ ] Validation: Reject missing universeId
- [ ] Validation: Reject missing symbol
- [ ] T_ prefix target created correctly
- [ ] T_ target marked as test

### Source Management
- [ ] Create source at target scope
- [ ] Create source at universe scope
- [ ] Create source at domain scope
- [ ] Create source at runner scope
- [ ] Test crawl before saving
- [ ] Create source for each type (web, rss, api)
- [ ] Create source for each frequency (5, 10, 15, 30, 60)
- [ ] Update source URL
- [ ] Update crawl frequency
- [ ] Delete source
- [ ] Verify historical signals preserved after delete
- [ ] Validation: Reject invalid URL
- [ ] Validation: Reject invalid frequency

### Signal Processing
- [ ] Signals appear after crawl
- [ ] Signal list filters by target
- [ ] Signal list filters by disposition
- [ ] Signal list pagination works
- [ ] Signal detail shows full content
- [ ] Signal fingerprint prevents duplicates
- [ ] High confidence signals (0.9+) fast-path
- [ ] Medium confidence signals (0.4-0.7) → Review Queue
- [ ] Low confidence signals (< 0.4) rejected

### Prediction Generation
- [ ] Prediction created when threshold met
- [ ] Prediction NOT created when threshold not met
- [ ] Prediction includes correct direction
- [ ] Prediction includes correct confidence
- [ ] Prediction includes correct timeframe
- [ ] Prediction snapshot complete
- [ ] Prediction deep dive shows lineage
- [ ] Prediction comparison works (2-10)
- [ ] Validation: Compare rejects < 2 IDs
- [ ] Validation: Compare rejects > 10 IDs

### Evaluation
- [ ] Auto-evaluation runs after resolution
- [ ] Direction score calculated correctly
- [ ] Magnitude score calculated correctly
- [ ] Timing score calculated correctly
- [ ] Overall score calculated correctly
- [ ] Manual override for direction works
- [ ] Manual override for magnitude works
- [ ] Manual override for timing works
- [ ] Manual override for overall works
- [ ] Validation: Override requires reason
- [ ] Validation: Override reason min 10 chars
- [ ] Audit trail captures override

### Learning System
- [ ] Create learning (rule type)
- [ ] Create learning (pattern type)
- [ ] Create learning (weight_adjustment type)
- [ ] Create learning (threshold type)
- [ ] Create learning (avoid type)
- [ ] Learning at runner scope
- [ ] Learning at domain scope
- [ ] Learning at universe scope
- [ ] Learning at target scope
- [ ] Supersede creates new version
- [ ] Version history preserved
- [ ] Disable learning works
- [ ] Promotion target → universe
- [ ] Promotion universe → domain
- [ ] Promotion domain → runner

### Review Queue
- [ ] Only 0.4-0.7 confidence signals appear
- [ ] Approve creates predictor
- [ ] Reject prevents predictor
- [ ] Modify with strength override works
- [ ] Learning note captured
- [ ] Queue updates after decision

### Learning Queue
- [ ] Suggestions appear from evaluation
- [ ] Suggestions appear from missed opportunities
- [ ] Approve adds to active learnings
- [ ] Reject removes from queue
- [ ] Modify before approve works

### Missed Opportunities
- [ ] Detection finds unpredicted moves
- [ ] Filter by move percentage works
- [ ] Filter by date range works
- [ ] Analysis identifies root cause
- [ ] Suggested learnings reasonable

### Analytics
- [ ] Overall accuracy calculation correct
- [ ] Accuracy by target breakdown
- [ ] Accuracy by strategy breakdown
- [ ] Signal quality metrics
- [ ] Analyst performance metrics
- [ ] Date range filter works

### Test Lab
- [ ] Create test scenario
- [ ] Create synthetic article
- [ ] Create price data
- [ ] Create target mirror (T_ prefix)
- [ ] Backtest runs successfully

### System Health
- [ ] Source crawl status accurate
- [ ] Alerts generated for failures
- [ ] Alerts acknowledgeable
- [ ] Background runners executing

---

## 16. Error Handling Tests

### Validation Errors (400)
- [ ] Missing required field → Clear error message
- [ ] Invalid field value → Specific validation error
- [ ] Invalid enum value → Lists valid options

### Not Found (404)
- [ ] Get non-existent universe → "Universe not found"
- [ ] Get non-existent target → "Target not found"
- [ ] Get non-existent prediction → "Prediction not found"

### Authorization (403)
- [ ] Access other org's data → Forbidden
- [ ] Modify without permission → Forbidden

### Server Errors (500)
- [ ] Database unavailable → Graceful error message
- [ ] LLM API unavailable → Degraded mode or error

### Rate Limiting
- [ ] Too many requests → 429 with retry-after
- [ ] LLM usage exceeded → Clear usage limit message

---

## 17. API Testing (E2E)

### Run All E2E Tests
```bash
cd apps/api
npx jest --config testing/test/jest-e2e.json prediction-runner
```

### Run Specific Test Suites
```bash
# Full pipeline proof
npx jest --config testing/test/jest-e2e.json prediction-runner-full-pipeline-proof

# CRUD operations
npx jest --config testing/test/jest-e2e.json prediction-runner-analyst-crud

# Review queue
npx jest --config testing/test/jest-e2e.json prediction-runner-review-queue

# Camel case conversion
npx jest --config testing/test/jest-e2e.json prediction-runner-camel-case
```

### Run Playwright UI Tests
```bash
cd apps/web
npx playwright test tests/e2e/specs/prediction-agent/
```

---

## Quick Reference Card

### Essential URLs
| Screen | URL |
|--------|-----|
| Main Dashboard | `/prediction/` |
| Universe Management | `/prediction/universes` |
| Review Queue | `/prediction/review-queue` |
| Learning Queue | `/prediction/learning-queue` |
| Analytics | `/prediction/analytics` |
| Test Lab | `/prediction/test-lab` |
| Alerts | `/prediction/alerts` |

### Key Thresholds
| Threshold | Default | Purpose |
|-----------|---------|---------|
| min_predictors | 2 | Minimum predictors for prediction |
| min_combined_strength | 0.3 | Total strength required |
| min_direction_consensus | 0.6 | Agreement percentage |
| predictor_ttl_hours | 24 | How long predictors valid |
| HITL confidence range | 0.4-0.7 | Signals needing human review |
| Fast path threshold | 0.9 | Auto-approve signals |

### Background Schedules
| Runner | Schedule |
|--------|----------|
| Source Crawler | 5/10/15/30/60 min |
| Signal Processor | 15 min |
| Prediction Generator | 30 min |
| Outcome Tracking | 15 min |
| Evaluation | 1 hour |
| Missed Opportunity | 4 hours |

---

*Document generated for Prediction System Sprints 0-7*
*For questions, refer to the PRD or contact the development team*
