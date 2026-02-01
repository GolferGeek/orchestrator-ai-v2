# PRD: Stock Predictor Enhancements

**Document ID:** PRD-2026-02-01-STOCK-PREDICTOR
**Created:** 2026-02-01
**Author:** GolferGeek + Claude
**Status:** Draft
**Branch:** `feature/stock-predictor`

---

## Executive Summary

Enhance the stock prediction system to provide a more actionable, accurate, and educational trading experience. This PRD addresses five key areas: fixing overly-flat predictions, enabling prediction-to-position workflow, portfolio visibility, agent portfolio comparison, and a comprehensive audit/learning system.

---

## Problem Statement

### Current Issues

1. **Too Many Flat Predictions**: The majority of predictions return as "flat" rather than directional (up/down), making the system less useful for trading decisions.

2. **Aggregated Predictions Lose Signal**: When multiple analysts disagree (aggressive bullish + conservative bearish), the ensemble averages to "neutral" - losing valuable individual perspectives.

3. **Buy Flow Unclear**: UI components exist (`TakePositionModal.vue`) but the user cannot easily click on a prediction and buy it.

3. **Portfolio Visibility**: User cannot easily see their $100k simulated portfolio, positions, and P&L in a clear dashboard.

4. **Agent Comparison Missing**: Multiple analyst personalities make predictions, but there's no way to compare their portfolio performance side-by-side.

5. **Learning Loop Incomplete**: While evaluation exists, there's no daily audit workflow with AI-assisted analysis and user feedback to create actionable learnings.

---

## Goals

| Goal | Success Metric |
|------|----------------|
| Reduce flat predictions | < 30% of predictions are flat (currently ~80%) |
| Enable one-click buying | User can buy a prediction in ≤ 2 clicks |
| Clear portfolio view | User sees balance, positions, P&L on single page |
| Agent comparison | Compare ≥ 3 agent portfolios side-by-side |
| Daily audit workflow | Complete audit of previous day in < 15 minutes |

---

## Non-Goals

- Real broker integration (paper trading only)
- Mobile app support
- Multi-user collaboration features
- Options or derivatives trading
- Real-time streaming prices (polling is sufficient)

---

## Technical Context

### What Already Exists

| Component | Status | Location |
|-----------|--------|----------|
| Prediction generation | ✅ Complete | `prediction-generation.service.ts` |
| LLM ensemble | ✅ Complete | `analyst-ensemble.service.ts` |
| Position service | ✅ Complete | `user-position.service.ts` |
| Portfolio tracking | ✅ Complete | `TradingDashboard.vue` |
| Analyst system | ✅ Complete | 6 seeded analysts with perspectives |
| Evaluation service | ✅ Complete | `evaluation.service.ts` |
| Learning system | ✅ Complete | `learning-promotion.service.ts` |
| Missed opportunities | ✅ Complete | `MissedOpportunityScanner` |

### Key Insight: Baseline Predictions

The system intentionally creates "flat" baseline predictions via `baseline-prediction.service.ts` for ALL instruments. This enables missed opportunity detection. The issue is the **real predictions** (from analyst ensemble) are also returning flat too often.

### Current LLM Configuration

```env
DEFAULT_LLM_PROVIDER=ollama
DEFAULT_LLM_MODEL=qwen3:8b
DEFAULT_RESEARCH_PROVIDER=google
DEFAULT_RESEARCH_MODEL=gemini-2.0-flash-001
```

Predictions should use Gemini Flash, not local Ollama.

---

## Phase 1: Fix Flat Predictions & Model Configuration

**Duration:** 1-2 hours
**Priority:** P0 - Blocking other work

### 1.1 Verify Gemini Flash Usage

**Task:** Ensure prediction generation uses `gemini-2.0-flash-001` not local Ollama.

**Files to check:**
- `apps/api/src/prediction-runner/services/prediction-generation.service.ts`
- `apps/api/src/prediction-runner/services/analyst-ensemble.service.ts`
- LLM tier resolution logic

**Acceptance Criteria:**
- [ ] Predictions logged with `provider: google, model: gemini-2.0-flash-001`
- [ ] No Ollama calls during prediction generation

### 1.2 Tune Direction Thresholds

**Task:** Make predictions more aggressive (up/down) rather than defaulting to flat.

**Investigation:**
1. Check confidence thresholds that trigger flat vs directional
2. Review analyst ensemble aggregation logic
3. Check if neutral votes override directional votes

**Potential fixes:**
- Lower confidence threshold for directional predictions
- Weight directional votes higher in ensemble
- Require explicit "flat" consensus rather than defaulting to flat

**Acceptance Criteria:**
- [ ] < 30% of real predictions (non-baseline) are flat
- [ ] Direction distribution roughly matches market movements
- [ ] Confidence scores reflect actual certainty

### 1.3 Add Direction Logging

**Task:** Add observability to understand why predictions go flat.

**Log points:**
- Individual analyst votes (direction + confidence)
- Ensemble aggregation result
- Final direction decision with reasoning

**Acceptance Criteria:**
- [ ] Can trace any prediction back to analyst votes
- [ ] Can identify which analysts voted flat

---

## Phase 1.5: Per-Analyst Predictions (NEW - Critical)

**Duration:** 3-4 hours
**Priority:** P0 - Required for meaningful agent portfolios

### Problem

Current system aggregates all analyst opinions into ONE prediction. When analysts disagree:
- Aggressive analyst: bullish (0.85)
- Conservative analyst: bearish (0.70)
- Result: neutral (loses both signals!)

### Solution

Create **multiple predictions per signal** - one for each active analyst:

```
Signal: "Tesla revenue up 30%"
       ↓
┌─────────────────────────────────────────────────┐
│ technical-tina     → UP   (0.80) - breakout     │
│ fundamental-fred   → UP   (0.75) - growth       │
│ contrarian-carl    → DOWN (0.55) - overbought   │
│ sentiment-sally    → UP   (0.65) - buzz         │
│ ─────────────────────────────────────────────── │
│ arbitrator         → UP   (0.72) - 3/4 bullish  │
└─────────────────────────────────────────────────┘
```

### 1.5.1 Modify Prediction Generation

**Task:** Change from aggregated to per-analyst predictions.

**Files:**
- `prediction-generation.service.ts` - Create prediction per analyst
- `analyst-ensemble.service.ts` - Return individual assessments, not just aggregate

**New Flow:**
1. Signal triggers prediction generation
2. Each active analyst assesses independently
3. Create one prediction per analyst
4. Optionally create "arbitrator" prediction that synthesizes

**Database:**
- `predictions.analyst_slug` field already exists - use it
- Add `predictions.is_arbitrator` boolean (optional)

### 1.5.2 Add Arbitrator Analyst

**Task:** Create special analyst that sees all other opinions and makes final call.

**Arbitrator prompt:**
```
You are the Arbitrator. You see all analyst opinions below:

- Technical Tina: bullish (0.80) - "breakout pattern forming"
- Fundamental Fred: bullish (0.75) - "strong revenue growth"
- Contrarian Carl: bearish (0.55) - "market overreaction"

Synthesize these opinions. Consider:
1. Consensus (3/4 bullish)
2. Conviction strength (Tina strongest)
3. Contrarian view validity

Make your final call.
```

### 1.5.3 Update Prediction Queries

**Task:** Update queries to handle multiple predictions per target.

**Changes:**
- `getPredictionsForTarget()` - Returns array of predictions
- UI grouping by analyst
- Portfolio tracking per analyst

### Acceptance Criteria

- [x] Each active analyst creates own prediction *(Implemented 2026-02-01)*
- [x] Predictions linked to specific analyst via `analyst_slug` *(Implemented 2026-02-01)*
- [x] Arbitrator prediction created as synthesis *(Implemented 2026-02-01)*
- [ ] UI shows multiple predictions per target
- [ ] Agent portfolios can now track actual performance

### Implementation Notes (2026-02-01)

**Files Modified:**
- `apps/api/supabase/migrations/20260201000001_add_analyst_slug_to_predictions.sql` - Added `analyst_slug` and `is_arbitrator` columns
- `apps/api/src/prediction-runner/interfaces/prediction.interface.ts` - Added `analyst_slug` and `is_arbitrator` to interfaces
- `apps/api/src/prediction-runner/services/prediction-generation.service.ts` - Refactored `generatePrediction()` to create per-analyst predictions

**New Methods:**
- `createAnalystPrediction()` - Creates a prediction for a specific analyst
- `createArbitratorPrediction()` - Creates the synthesized arbitrator prediction
- `mapAnalystDirection()` - Maps analyst direction to prediction direction

**Flow:**
1. Signal triggers prediction generation
2. `runEnsemble()` returns individual `assessments[]` + `aggregated`
3. For each assessment: `createAnalystPrediction()` creates prediction with `analyst_slug` set
4. `createArbitratorPrediction()` creates prediction with `analyst_slug='arbitrator'` and `is_arbitrator=true`
5. Predictors consumed, linked to arbitrator prediction
6. Observability event includes all analyst predictions

---

## Phase 2: Buy Prediction Flow

**Duration:** 2-3 hours
**Priority:** P1

### 2.1 Audit Existing Buy Flow

**Task:** Trace the existing flow from prediction card to position creation.

**Components:**
- `PredictionCard.vue` - Does it have a buy button?
- `TakePositionModal.vue` - Is it wired up?
- `prediction.handler.ts` - `use` action for creating positions

**Questions to answer:**
- Where is the buy button?
- What happens when clicked?
- Is the modal opening?
- Is the API being called?

### 2.2 Wire Up Buy Button

**Task:** Ensure clicking a prediction opens position modal and creates position.

**Flow:**
```
PredictionCard → [Buy Button] → TakePositionModal → UserPositionService → Position Created
```

**Acceptance Criteria:**
- [ ] Each prediction card has visible "Buy" or "Take Position" button
- [ ] Clicking opens modal with position sizing
- [ ] Confirming creates position in database
- [ ] Position appears in user portfolio immediately

### 2.3 Position Sizing UI

**Task:** Show recommended position size based on risk parameters.

**Display:**
- Recommended quantity based on 2% risk rule
- Entry price (current market)
- Stop loss (from prediction)
- Target price (from prediction)
- Risk/reward ratio

**Acceptance Criteria:**
- [ ] User sees recommended size before confirming
- [ ] User can override quantity
- [ ] Risk/reward displayed clearly

---

## Phase 3: User Portfolio Dashboard

**Duration:** 2-3 hours
**Priority:** P1

### 3.1 Portfolio Summary Card

**Task:** Create/enhance portfolio summary view.

**Display:**
- Starting balance: $100,000
- Current balance: (starting + realized P&L)
- Unrealized P&L: (from open positions)
- Total value: (balance + unrealized)
- Win rate: X%
- Total trades: N

**Location:** Top of `TradingDashboard.vue` or new `PortfolioSummary.vue`

### 3.2 Open Positions Table

**Task:** Show all open positions with live P&L.

**Columns:**
| Symbol | Direction | Qty | Entry | Current | P&L | P&L % | Actions |
|--------|-----------|-----|-------|---------|-----|-------|---------|

**Actions:**
- Close position (manual)
- View prediction that created it

**Acceptance Criteria:**
- [ ] All open positions visible
- [ ] Current prices fetched (can be on-demand refresh)
- [ ] P&L calculated correctly
- [ ] Can close position manually

### 3.3 Closed Positions History

**Task:** Show historical closed positions.

**Columns:**
| Symbol | Direction | Entry | Exit | P&L | P&L % | Duration | Prediction |

**Acceptance Criteria:**
- [ ] All closed positions visible
- [ ] Sortable by date, P&L, symbol
- [ ] Can filter by win/loss

---

## Phase 4: Agent Portfolio Comparison

**Duration:** 3-4 hours
**Priority:** P2

### 4.1 Agent Portfolio Cards

**Task:** Show each analyst's portfolio performance.

**For each analyst:**
- Name and perspective summary
- Portfolio value
- Win rate
- Total P&L
- Number of predictions made
- Best/worst trade

**Analysts to show:**
- Technical Analyst
- Sentiment Analyst
- Fundamental Analyst
- DeFi Analyst (crypto only)
- Risk Assessor
- Contrarian Analyst

### 4.2 Comparison Table

**Task:** Side-by-side comparison of analyst performance.

**Columns:**
| Analyst | Predictions | Win Rate | Avg P&L | Total P&L | Sharpe |

**Features:**
- Sort by any column
- Filter by time period (7d, 30d, 90d, all)
- Highlight best/worst performers

### 4.3 Agent Portfolio Drill-Down

**Task:** Click analyst to see their full portfolio.

**View:**
- All positions taken based on their predictions
- Performance over time chart
- Recent predictions with outcomes

**Acceptance Criteria:**
- [ ] Can compare ≥ 3 agents side-by-side
- [ ] Can drill into any agent's full history
- [ ] Performance metrics accurate

---

## Phase 5: Daily Audit & Learning System

**Duration:** 4-6 hours
**Priority:** P2

### 5.1 Previous Day Audit Dashboard

**Task:** Create daily audit view showing all predictions from previous day.

**Sections:**
1. **Predictions Made** - All predictions generated yesterday
2. **Predictions Resolved** - Outcomes determined
3. **Missed Opportunities** - Significant moves without predictions
4. **Evaluation Summary** - Accuracy metrics

**For each prediction:**
- Symbol, direction, confidence
- Outcome (correct/incorrect)
- P&L if position taken
- AI evaluation score

### 5.2 AI Evaluation Chat

**Task:** Enable conversation with AI about specific predictions.

**Flow:**
1. User clicks "Analyze" on a prediction
2. AI provides initial evaluation
3. User can ask follow-up questions
4. Conversation stored for learning

**Questions AI can answer:**
- "Why did we predict up when it went down?"
- "What signals did we miss?"
- "How should we adjust for this pattern?"

### 5.3 Learning Creation Interface

**Task:** Create learnings from audit conversations.

**Flow:**
1. AI suggests learning from evaluation
2. User can edit/approve learning
3. Learning marked as `is_test=true`
4. Learning applied to test predictions
5. User promotes to production if effective

**Learning types:**
- `rule` - New rule to follow
- `pattern` - Pattern to recognize
- `weight_adjustment` - Change analyst weight
- `threshold` - Adjust confidence threshold
- `avoid` - Pattern to avoid

### 5.4 Test Data Generation

**Task:** Generate test predictions with/without learning applied.

**Flow:**
1. Select learning to test
2. Run backtesting on historical data
3. Compare accuracy with/without learning
4. Show improvement metrics

### 5.5 Context File Updates

**Task:** When learning is promoted, update relevant context files.

**Files that may need updates:**
- Analyst perspectives (`tier_instructions`)
- Domain-specific rules
- Universe-specific patterns
- Target-specific adjustments

**Acceptance Criteria:**
- [ ] Can complete full audit in < 15 minutes
- [ ] AI provides actionable insights
- [ ] Learnings can be tested before promotion
- [ ] Context updates tracked and versioned

---

## Data Model Additions

### No New Tables Required

The existing schema supports all features:
- `prediction.predictions` - predictions
- `prediction.evaluations` - evaluation scores
- `prediction.learnings` - learning records
- `prediction.user_portfolios` - user portfolios
- `prediction.user_positions` - user positions
- `prediction.analyst_positions` - analyst positions
- `prediction.missed_opportunities` - missed opportunities

### Potential View Additions

```sql
-- Daily audit summary view
CREATE VIEW prediction.daily_audit_summary AS
SELECT
  date_trunc('day', created_at) as audit_date,
  count(*) as total_predictions,
  count(*) FILTER (WHERE status = 'resolved') as resolved,
  count(*) FILTER (WHERE direction = 'flat') as flat_predictions,
  avg(evaluation_score) as avg_score
FROM prediction.predictions
GROUP BY 1;

-- Agent performance comparison view
CREATE VIEW prediction.analyst_performance_summary AS
SELECT
  analyst_slug,
  count(*) as total_predictions,
  avg(CASE WHEN direction_correct THEN 1.0 ELSE 0.0 END) as win_rate,
  sum(realized_pnl) as total_pnl
FROM prediction.analyst_positions ap
JOIN prediction.evaluations e ON ap.prediction_id = e.prediction_id
GROUP BY 1;
```

---

## API Endpoints

### Existing (verify working)
- `POST /prediction/use` - Create position from prediction
- `GET /prediction/portfolio` - Get user portfolio
- `GET /prediction/positions` - Get user positions

### May Need
- `GET /prediction/audit/daily?date=YYYY-MM-DD` - Daily audit summary
- `GET /prediction/analysts/comparison` - Agent comparison data
- `POST /prediction/learning/test` - Test a learning
- `POST /prediction/learning/promote` - Promote learning to production

---

## UI Components

### New Components
- `DailyAuditDashboard.vue` - Phase 5.1
- `PredictionEvaluationChat.vue` - Phase 5.2
- `LearningCreator.vue` - Phase 5.3
- `AgentComparisonTable.vue` - Phase 4.2

### Enhanced Components
- `PredictionCard.vue` - Add buy button
- `TradingDashboard.vue` - Enhance portfolio display
- `PortfolioDetail.vue` - Add agent comparison

---

## Testing Strategy

### Phase 1 Testing
- [ ] Generate 10 predictions, verify < 30% flat
- [ ] Check logs for Gemini Flash usage
- [ ] Verify direction distribution

### Phase 2 Testing
- [ ] Click buy on prediction, verify position created
- [ ] Check position appears in portfolio
- [ ] Verify position sizing calculation

### Phase 3 Testing
- [ ] Verify portfolio balance correct
- [ ] Open/close positions, verify P&L
- [ ] Check historical positions accurate

### Phase 4 Testing
- [ ] Compare 3+ agents, verify data accurate
- [ ] Drill into agent, verify positions correct
- [ ] Sort/filter works

### Phase 5 Testing
- [ ] Complete daily audit workflow
- [ ] Create learning from evaluation
- [ ] Test learning, verify backtest works
- [ ] Promote learning, verify applied

---

## Rollout Plan

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1 | 1-2 hours | None |
| Phase 2 | 2-3 hours | Phase 1 |
| Phase 3 | 2-3 hours | Phase 2 |
| Phase 4 | 3-4 hours | Phase 3 |
| Phase 5 | 4-6 hours | Phase 4 |

**Total estimated time:** 12-18 hours

---

## Open Questions

1. **Position sizing**: Should we enforce the 2% risk rule or allow override?
2. **Agent portfolios**: Should agents have their own $100k or share one pool?
3. **Learning approval**: Should all learnings require human approval or can high-confidence AI suggestions auto-promote?
4. **Audit frequency**: Daily audit or continuous?

---

## Appendix: File References

### Core Services
- `/apps/api/src/prediction-runner/services/prediction-generation.service.ts`
- `/apps/api/src/prediction-runner/services/analyst-ensemble.service.ts`
- `/apps/api/src/prediction-runner/services/user-position.service.ts`
- `/apps/api/src/prediction-runner/services/evaluation.service.ts`
- `/apps/api/src/prediction-runner/services/learning-promotion.service.ts`

### Web UI
- `/apps/web/src/views/prediction/TradingDashboard.vue`
- `/apps/web/src/views/prediction/PredictionDashboard.vue`
- `/apps/web/src/components/prediction/TakePositionModal.vue`
- `/apps/web/src/components/prediction/PredictionCard.vue`

### Database
- `prediction.predictions`
- `prediction.user_portfolios`
- `prediction.user_positions`
- `prediction.analyst_positions`
- `prediction.evaluations`
- `prediction.learnings`
