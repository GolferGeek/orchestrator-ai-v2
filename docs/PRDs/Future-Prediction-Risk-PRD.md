# Future Prediction & Risk Architecture (v3)

**Status:** Future Vision
**Target:** v3 (Post v2 Launch)
**Created:** 2026-02-03

## Executive Summary

Unify the prediction and risk systems into a single **Market Intelligence System** that reads articles once, creates universal predictors, and serves both prediction and risk outputs. This eliminates duplicate article processing, creates consistency across systems, and provides a foundation for future intelligence-based features.

## Current State (v2) - The Problem

### Wasteful Duplication
```
Articles (Same Sources)
    ├─→ Prediction System: Reads articles → Creates signals per target
    └─→ Risk System: Reads articles → Creates subject/dimension pairs

Result: Same articles analyzed twice, double LLM costs
```

### Architecture Issues
1. **Article Processing:** Same articles read by both systems
2. **Signal Explosion:** 11 articles × 5 targets = 55 signals (should be 11-20)
3. **Inconsistency:** Risk and prediction can have conflicting views
4. **Inefficiency:** Double LLM calls, double database writes
5. **Maintenance:** Two separate pipelines to maintain

## Vision (v3) - Unified Market Intelligence

### Core Insight
**Predictors are the universal unit of market intelligence** - they work for both predictions AND risk analysis.

### Unified Architecture
```
Articles (Crawled Once)
    ↓
Mark as READ ✓
    ↓
Market Intelligence Engine (Single Analysis)
    ↓
Create PREDICTORS (Universal Unit)
    ├─→ Prediction System
    │   └─→ Aggregate predictors → Predictions
    │       (with market psychology layer)
    └─→ Risk System
        └─→ Aggregate predictors → Risk Analysis
            (with blue/red visualization)
```

## The Universal Predictor

### Structure
```typescript
interface Predictor {
  // Identity
  id: string;
  article_id: string;
  instrument: string;      // NVDA, TSLA, AAPL, etc.
  dimension: string;       // Competition, Supply Chain, Regulation, etc.
  timestamp: Date;

  // Fundamental Analysis (Used by BOTH systems)
  fundamental_impact: {
    direction: "positive" | "negative" | "neutral";
    magnitude: "low" | "medium" | "high" | "critical";
    confidence: number;     // 0-1
    reasoning: string;
    key_factors: string[];
  };

  // Market Psychology (Used by Prediction ONLY)
  market_psychology: {
    trader_reaction: "bullish" | "bearish" | "neutral";
    sentiment_strength: "weak" | "moderate" | "strong";
    narrative_fit: "hot_narrative" | "neutral" | "contrarian";
    timing_sensitivity: "immediate" | "delayed" | "negligible";
    volatility_potential: "low" | "medium" | "explosive";
    expected_magnitude: number;  // Expected % move
    reasoning: string;
  };

  // Metadata
  urgency: "normal" | "important" | "critical";  // For weighting
  source_quality: number;  // Article credibility score
}
```

## Key Architectural Principles

### 1. Read Once, Use Twice
- Articles analyzed exactly once
- Predictors serve both systems
- Single source of truth

### 2. Momentum & Weighting
**Risk and predictions are accumulated state, not point-in-time.**

```
Risk/Prediction State = Large accumulated mass (100+ articles over time)
New Predictor = Small delta (1-5% of total mass)

Update Formula:
New_State = (Old_State × α) + (New_Predictors × β)

Where: α >> β (existing state dominates)

Example:
- α = 0.90 (existing carries 90% weight)
- β = 0.10 (new predictors get 10%)

Exception - Black Swan Events:
- Urgency: CRITICAL
- β = 0.40 (can dramatically shift state)
```

### 3. Fundamental vs Market Psychology

**Risk Analysis = Fundamental Reality**
- "What IS the competitive threat?"
- Based on facts, evidence, capabilities
- Rational, stable
- Uses: `fundamental_impact` only

**Market Prediction = Market Psychology**
- "How will TRADERS react?"
- Based on psychology, sentiment, narrative
- Can be irrational, volatile
- Uses: `fundamental_impact` + `market_psychology`

**Example:**
```
News: "AMD chip delayed 6 months"

Fundamental Impact:
└─ NVDA/Competition risk: High → Moderate
└─ Magnitude: Medium positive

Market Psychology:
└─ Trader reaction: BULLISH (strong)
└─ Why: Relief rally, removes overhang
└─ Expected move: +8-12% (psychology amplifies fundamentals)
└─ Narrative: "NVDA dominance secure for another year"

Result:
- Risk: Slight improvement (+5% fundamental strength)
- Prediction: Significant bullish move (+10% expected)
```

## Schema Design

### Unified Schema Option 1: Single Schema
```
Schema: market_intelligence

Tables:
├── articles (crawled, marked as read)
├── predictors (universal unit)
├── predictions (aggregated from predictors)
├── subject_dimension_pairs (aggregated from predictors)
└── predictor_aggregation_state (momentum tracking)
```

### Unified Schema Option 2: Shared Core
```
Schema: prediction
├── articles (shared)
├── predictors (shared)
├── predictions
└── prediction_state

Schema: risk
├── (references prediction.articles)
├── (references prediction.predictors)
├── subject_dimension_pairs
└── risk_state
```

## Processing Flow

### Article Ingestion (Once!)
```typescript
1. Crawl Articles
   └─ Mark as unprocessed

2. Market Intelligence Engine
   FOR each unread article:
     └─ Analyze for ALL instruments/dimensions
     └─ Create Predictors (0-N per article)
     └─ Mark article as READ

   Note: Create predictors ONLY if relevant
   - Not all articles create predictors
   - One article might create 1-5 predictors (different instruments)
   - Never create duplicate predictors per instrument
```

### Example: One Article, Multiple Predictors
```
Article: "AMD announces new AI chip, NVIDIA responds with price cuts"

Predictors Created:
1. NVDA/Competition
   - Fundamental: Negative, High magnitude
   - Psychology: Bearish, strong sentiment

2. AMD/Competition
   - Fundamental: Positive, High magnitude
   - Psychology: Bullish, explosive potential

3. TSLA/Supply_Chain
   - Fundamental: Positive, Low magnitude (cheaper AI chips)
   - Psychology: Neutral (market won't care)
```

### Prediction System Processing
```typescript
1. Get New Predictors (since last run)
   └─ Filter by instrument

2. Load Existing Prediction State
   └─ Current risk landscape (accumulated)
   └─ Current market context
   └─ Previous predictions

3. Analyst Ensemble (unchanged from v2)
   └─ Each analyst evaluates predictors + existing state
   └─ Considers market_psychology layer
   └─ Creates assessment

4. Arbitrator
   └─ Aggregates analyst assessments
   └─ Weighted by existing state (momentum)
   └─ Creates prediction

5. Update Prediction State
   └─ Store new accumulated state
```

### Risk System Processing
```typescript
1. Get New Predictors (since last run)
   └─ All instruments, all dimensions

2. Load Existing Risk State
   └─ Current subject/dimension pairs
   └─ Historical risk levels

3. Aggregate Predictors by Subject/Dimension
   └─ Group: All NVDA/Competition predictors
   └─ Use fundamental_impact only (ignore psychology)

4. Update Risk Levels (Weighted)
   └─ Existing_Risk × 0.90 + New_Predictors × 0.10
   └─ Detect changes (blue/red)
   └─ Track trends over time

5. Update Risk State
   └─ Store new accumulated state
```

## Benefits

### 1. Efficiency
- **50% reduction in LLM calls** (read once vs twice)
- **80% reduction in signals** (11 vs 55 for same articles)
- Single analysis pipeline to maintain

### 2. Consistency
- Same fundamental analysis for both systems
- Risk and predictions use same underlying data
- Conflicts eliminated

### 3. Extensibility
Future systems can consume predictors:
- Portfolio optimization
- Alert system
- Research reports
- Backtesting engine

### 4. Transparency
Clear lineage: Article → Predictor → Risk/Prediction
Easy to audit and explain

## Migration Strategy (v2 → v3)

### Phase 1: Data Model (1-2 weeks)
1. Create unified predictor table
2. Add fundamental_impact + market_psychology fields
3. Add state tracking tables
4. Keep existing tables for fallback

### Phase 2: Article Processing (2-3 weeks)
1. Build unified article analyzer
2. Create predictor generation engine
3. Test against existing data
4. Parallel run with v2 for validation

### Phase 3: Prediction System (2 weeks)
1. Update to consume predictors (not signals)
2. Add market psychology layer
3. Implement momentum/weighting
4. Migrate existing predictions

### Phase 4: Risk System (1-2 weeks)
1. Update to consume predictors
2. Implement momentum/weighting
3. Migrate existing risk analysis
4. Validate blue/red detection

### Phase 5: Deprecate Old Systems (1 week)
1. Switch to unified system
2. Archive old tables
3. Monitor for issues
4. Remove duplicate processing

**Total: 7-10 weeks**

## Success Metrics

### Efficiency
- [ ] LLM call reduction: >50%
- [ ] Signal count reduction: >70%
- [ ] Processing time reduction: >40%

### Quality
- [ ] Prediction accuracy: Same or better
- [ ] Risk detection accuracy: Same or better
- [ ] False positive rate: <5%

### System Health
- [ ] Predictor creation rate: 2-5 per article (not 5+ per target)
- [ ] State persistence: 100% (no data loss)
- [ ] Consistency: Risk and prediction align on fundamentals

## Open Questions

1. **Predictor Relevance Filtering:** How do we determine if an article is relevant to an instrument?
   - Keyword matching?
   - Embedding similarity?
   - LLM-based relevance scoring?

2. **State Decay:** How do we age out old predictors?
   - Time-based decay?
   - Event-based invalidation?
   - Manual review?

3. **Black Swan Detection:** How do we identify critical urgency predictors?
   - Automated urgency scoring?
   - Human review for critical events?
   - Hybrid approach?

4. **Market Psychology Modeling:** How sophisticated should the psychology layer be?
   - Rule-based (hot narratives, sentiment keywords)?
   - ML-based (sentiment models, market regime detection)?
   - LLM-based (contextual understanding)?

## Future Enhancements (v4+)

1. **Real-time Processing:** Stream predictors as articles arrive
2. **Confidence Calibration:** Track predictor accuracy, adjust weights
3. **Cross-instrument Analysis:** Sector rotation, correlation plays
4. **Narrative Tracking:** Identify and track market narratives over time
5. **Backtesting Engine:** Validate predictor quality against historical data

## Conclusion

The unified Market Intelligence System represents a fundamental rethinking of how we process market information. By treating predictors as the universal unit of intelligence and applying momentum-based aggregation, we create a more efficient, consistent, and extensible foundation for both prediction and risk analysis.

This is the natural evolution from v2's separate systems to v3's unified intelligence platform.

---

**Next Steps:**
1. Review and refine this PRD
2. Complete v2 launch
3. Schedule v3 planning session
4. Begin technical design for unified predictor system
