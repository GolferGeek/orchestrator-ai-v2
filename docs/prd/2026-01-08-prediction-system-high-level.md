# Prediction System Redesign - High-Level PRD

**Date:** January 8, 2026
**Status:** Draft
**Author:** Architecture Discussion

---

## Executive Summary

A comprehensive redesign of the prediction system that introduces a multi-tier signal processing pipeline, configurable AI analysts with personality-based perspectives, multi-LLM evaluation, human-in-the-loop learning, and full prediction explainability. The system supports multiple domains (stocks, crypto, elections, polymarket) with domain-agnostic terminology and user-configurable investment strategies.

---

## Key Concepts Overview

### 1. Terminology Shift: Instruments → Targets

**Problem:** "Instrument" is finance-specific and doesn't translate to elections, sports, or other prediction domains.

**Solution:** Rename to "Target" - a domain-agnostic term that works everywhere:
- Stock target: AAPL
- Election target: "2026 Georgia Senate Race"
- Polymarket target: "Will X happen by Y date?"

---

### 2. Signals → Predictors → Predictions Pipeline

**Problem:** Current system conflates raw events with predictions. No intermediate validation layer.

**Solution:** Three-stage pipeline:

| Stage | What It Is | Example |
|-------|-----------|---------|
| **Signal** | Raw event from a source | "Foxconn reports 12% revenue growth" |
| **Predictor** | Validated signal that matters | Signal + AI assessment: "This is bullish for AAPL, strength 7" |
| **Prediction** | Actual forecast when enough predictors accumulate | "AAPL UP 3.5% in 5-7 days, 71% confidence" |

Signals accumulate → Some become predictors → Predictors accumulate → Threshold met → Prediction generated.

---

### 3. Six-Tier Processing Architecture

| Tier | Name | Function |
|------|------|----------|
| **Tier 1** | Signal Detection | Evaluate raw events: "Is this a thing?" |
| **Tier 2** | Predictor Management | Accumulate predictors, check thresholds |
| **Tier 3** | Prediction Generation | Generate predictions when threshold met |
| **Tier 4** | Outcome Tracking | Monitor predictions against actual prices |
| **Tier 5** | Evaluation & Learning | Score outcomes, generate learnings |
| **Tier 6** | Missed Opportunity Detection | Find moves we should have predicted |

---

### 4. Hierarchical Context System

Contexts exist at multiple levels, with inheritance and override:

```
Runner Context (global defaults)
    ↓
Domain Context (stocks, crypto, elections)
    ↓
Universe Context (user's agent/portfolio)
    ↓
Target Context (specific stock/asset)
    ↓
Analyst Context (individual AI personality)
```

Each level can define rules for each tier. Lower levels inherit from and can override higher levels.

---

### 5. AI Analysts (Personalities)

**Problem:** One-size-fits-all AI evaluation misses nuanced perspectives.

**Solution:** Multiple AI "analysts" with different perspectives evaluate each decision:

- **Base Analyst** - Balanced, objective evaluation
- **Technical Tina** - Chart patterns, indicators, price action
- **Fundamental Fred** - Earnings, valuations, cash flow
- **Supply Chain Steve** - Target-specific specialist (e.g., AAPL supply chain)
- **Conservative Carl** - High threshold, cautious
- **Contrarian Chris** - Fades consensus, looks for overreactions

Analysts are defined at any level (runner, domain, universe, target) and inherited downward.

---

### 6. Multi-LLM Tier Evaluation

**Problem:** Single LLM may have blind spots or biases.

**Solution:** Run evaluations through multiple LLM tiers in parallel:

| Tier | Models | Cost | Use Case |
|------|--------|------|----------|
| **Gold** | Opus 4.5, GPT-4o | $$$ | Complex analysis, high-stakes |
| **Silver** | Sonnet, GPT-4o-mini | $$ | Standard evaluation |
| **Bronze** | Ollama, Llama 3 | $ | High-volume screening |

Users see color-coded results showing where LLMs agree/disagree. Disagreement itself is valuable signal. Users can enable/disable tiers per processing tier per target.

---

### 7. Asynchronous Human-in-the-Loop

**Problem:** Traditional HITL requires interrupt/checkpoint/resume complexity.

**Solution:** Async review queue - system doesn't stop, humans review when available:

- Signals with confidence 0.4-0.7 go to review queue
- Human approves/rejects/modifies whenever they can
- Response moves item to appropriate pool + updates learnings
- No blocking, no state management, no timeouts

---

### 8. Unified Learning System

**Problem:** Learnings need to go to different places (target, analyst, domain, etc.).

**Solution:** Single learning system that can update any context level:

- AI suggests learnings from evaluations and missed opportunities
- Human reviews and decides WHERE the learning applies
- Learning types: rules, patterns, weight adjustments, thresholds, things to avoid
- Both human-authored and AI-detected patterns tracked separately

---

### 9. Investment Strategies

**Problem:** Different users have different risk tolerances and investment philosophies.

**Solution:** Pre-built strategy templates that configure the entire system:

| Strategy | Risk | Thresholds | Analysts Boosted |
|----------|------|------------|------------------|
| **Aggressive** | High | Lower (more predictions) | Momentum, Technical |
| **Balanced** | Medium | Default | All equal |
| **Conservative** | Low | Higher (fewer, stronger) | Fundamental, Conservative |
| **Contrarian** | Medium | Custom | Contrarian, Sentiment |
| **Technical** | Medium | Custom | Technical, Chart patterns |

Users assign a strategy per universe. Strategy = pre-configured analyst weights + thresholds.

---

### 10. URL-Based Source Monitoring (Firecrawl)

**Problem:** Building custom integrations for every news source is slow and inflexible.

**Solution:** Users add URLs, system crawls them with Firecrawl:

- Any URL can be a source (news sites, blogs, Twitter, Reddit, SEC filings)
- User configures frequency (5 min to 1 hour)
- Firecrawl extracts content, AI creates signals
- Replaces most custom news tools

**Still need APIs for:** Real-time prices, technical indicators, options flow.

---

### 11. Dual-Path Signal Processing

**Problem:** Urgent signals (CEO resignation, earnings surprise) need immediate action, but most signals can batch.

**Solution:** Two processing paths:

| Path | Trigger | Speed | Process |
|------|---------|-------|---------|
| **Fast Path** | Urgent signal (confidence ≥0.90) | Seconds | Signal → Predictor → Prediction → Notify immediately |
| **Batch Path** | Normal signals | Minutes | Accumulate → Batch evaluate every 15-30 min |

Cron jobs: Crawlers run at various frequencies. Batch evaluators run every 15-30 min. Urgent signals bypass everything.

---

### 12. Prediction Explainability

**Problem:** Users can't understand why a prediction was made.

**Solution:** Full transparency - click any prediction to see everything:

- All signals that became predictors
- Signals considered but rejected (and why)
- Each analyst's individual assessment
- Each LLM tier's assessment
- Learnings that were applied
- Threshold evaluation details
- Complete timeline

Stored as a snapshot at prediction time.

---

### 13. Missed Opportunity Analysis

**Problem:** We miss moves and don't learn why.

**Solution:** Retroactive research when we miss:

1. Detect significant moves we didn't predict
2. AI researches what actually caused the move (web search)
3. Identify source gaps ("The Information broke this story - we don't monitor them")
4. Review signals we had but didn't act on
5. Reconstruct "what we should have done"
6. Generate learnings and tool/source suggestions

Creates a tool wishlist showing which new sources would have helped.

---

### 14. Aggregation Strategies

**Problem:** Multiple analysts and LLMs produce multiple opinions. How to combine?

**Solution:** Configurable aggregation per tier:

| Tier | Recommended Strategy |
|------|---------------------|
| Signal → Predictor | Weighted majority (>50% weighted "yes") |
| Predictor strength | Weighted average |
| Prediction generation | Weighted ensemble with disagreement flag |
| Evaluation | Score both ensemble AND individuals |
| Missed detection | ANY analyst would have caught → learning opportunity |

---

## Data Model Summary

### Core Tables

| Table | Purpose |
|-------|---------|
| `prediction_universes` | Agent scope, strategy assignment |
| `prediction_targets` | What we predict (stocks, elections, etc.) |
| `prediction_sources` | URLs to crawl for signals |
| `prediction_signals` | Raw events from sources |
| `prediction_predictors` | Validated signals with strength/direction |
| `prediction_predictions` | Actual forecasts |
| `prediction_snapshots` | Full state at prediction time (explainability) |
| `prediction_evaluations` | Outcome scoring |
| `prediction_missed_opportunities` | Moves we didn't predict + analysis |

### Configuration Tables

| Table | Purpose |
|-------|---------|
| `prediction_analysts` | AI personalities with perspectives |
| `prediction_analyst_overrides` | Per-universe/target analyst adjustments |
| `prediction_strategies` | Investment philosophy templates |
| `prediction_llm_config` | Which LLM tiers enabled where |
| `prediction_learnings` | All learnings at all levels |
| `prediction_learning_queue` | Pending human review |
| `prediction_review_queue` | Signals needing human review |
| `prediction_tool_requests` | Wishlist for new sources/capabilities |

---

## Key User Journeys

### 1. New User Setup
1. Create universe (e.g., "My Tech Stocks")
2. Choose strategy (Aggressive/Balanced/Conservative/etc.)
3. Add targets (AAPL, GOOGL, MSFT)
4. Add sources (URLs to monitor)
5. System starts generating predictions

### 2. Daily Usage
1. See predictions on dashboard (color-coded by LLM agreement)
2. Click prediction to see full breakdown
3. Review queue items when available
4. Check resolved predictions and learnings

### 3. Learning Loop
1. Prediction resolves (hit or miss)
2. AI suggests learnings
3. User reviews, picks where to apply
4. System improves over time

### 4. Missed Opportunity
1. System detects big move we missed
2. AI researches what caused it
3. User sees source gaps and suggestions
4. User adds new sources or learnings

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Prediction accuracy (direction) | >65% |
| Missed opportunity rate | <20% of significant moves |
| Time to prediction (urgent path) | <30 seconds |
| Time to prediction (batch path) | <30 minutes |
| User engagement with review queue | >50% items reviewed within 24h |
| Learning application rate | >30% of AI suggestions approved |

---

## Implementation Phases

| Phase | Focus | Key Deliverables |
|-------|-------|------------------|
| **Phase 1** | Core Pipeline | Signals, Predictors, Predictions, basic evaluation |
| **Phase 2** | Analysts & LLM Tiers | Multi-analyst, multi-LLM evaluation |
| **Phase 3** | Learning System | Learnings, review queue, context updates |
| **Phase 4** | Explainability | Prediction snapshots, full breakdown UI |
| **Phase 5** | Missed Opportunities | Detection, research, source suggestions |
| **Phase 6** | Strategies & Polish | Investment strategies, user customization |

---

## Open Questions

1. **Analyst creation UI** - How much guidance do users need to create effective custom analysts?
2. **Source authentication** - How to handle paywalled sources (The Information, etc.)?
3. **Cost management** - How to help users understand/control LLM costs?
4. **Cross-target signals** - How to handle signals that affect multiple targets (Fed announcements)?
5. **Strategy backtesting** - Should users be able to backtest strategies against historical data?
