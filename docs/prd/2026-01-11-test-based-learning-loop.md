# Test-Based Learning Loop PRD

**Date:** January 11, 2026
**Status:** Draft
**Author:** Architecture Discussion

---

## Table of Contents

1. [Overview](#1-overview)
2. [Definitions & Invariants](#2-definitions--invariants)
3. [Problem Statement](#3-problem-statement)
4. [Solution Architecture](#4-solution-architecture)
5. [Real↔Test Instrument Mapping](#5-realtest-instrument-mapping)
6. [Test Data Isolation](#6-test-data-isolation)
7. [Test Input Infrastructure](#7-test-input-infrastructure)
8. [Scenario Run Semantics](#8-scenario-run-semantics)
9. [Test-Based Learning Accelerator](#9-test-based-learning-accelerator)
10. [Backtesting Specification](#10-backtesting-specification)
11. [Safety & Access Control](#11-safety--access-control)
12. [Versioning & Traceability](#12-versioning--traceability)
13. [Data Lifecycle & Retention](#13-data-lifecycle--retention)
14. [Observability Split](#14-observability-split)
15. [Schema Changes](#15-schema-changes)
16. [Implementation Phases](#16-implementation-phases)
17. [Test Scenario Examples](#17-test-scenario-examples)
18. [API Specifications](#18-api-specifications)
19. [UI Considerations](#19-ui-considerations)
20. [Testing Strategy](#20-testing-strategy)

---

## 1. Overview

### 1.1 Purpose

Create a controlled test environment for the prediction system that enables:
- High-velocity learning without waiting for real market events
- AI-generated test scenarios based on real-world learnings
- Complete isolation between test and production data
- Safe experimentation with predictor hypotheses
- Accelerated refinement of context files and learnings

### 1.2 Core Insight

**Real world teaches you *what* to learn** (the gaps, misses, surprises).
**Test world is *where* you actually learn it** (controlled, repeatable, high velocity).

The real world acts as a **curriculum designer**. The test world is the **classroom**.

### 1.3 Goals

1. **Isolation**: Test data never affects real predictions or climate
2. **Acceleration**: Run hundreds of test scenarios while waiting for one real event
3. **Control**: Manipulate test inputs (prices, news, signals) at will
4. **Learning Loop**: Generate new test scenarios from real-world learnings
5. **Validation**: Test predictors in isolation before promoting to production

### 1.4 Non-Goals

- Replacing real-world learning entirely
- Automated promotion of test learnings to production (always requires review)
- Real-time test scenario generation during market hours

---

## 2. Definitions & Invariants

### 2.1 Glossary

| Term | Definition |
|------|------------|
| **Target** | What we're predicting about. A stock, crypto, election, or polymarket contract. Has a `symbol` (e.g., `AAPL`, `BTC-USD`). |
| **Instrument** | Synonym for target. Used interchangeably. |
| **Symbol** | The unique identifier for a target within its domain (e.g., `AAPL` for stocks, `BTC-USD` for crypto). |
| **Test Target** | A target with `T_` prefix (e.g., `T_AAPL`). Used exclusively for test scenarios. |
| **Mirror Target** | A test target that mirrors a real target's characteristics (e.g., `T_AAPL` mirrors `AAPL`). |
| **Source** | An input feed for signals (RSS, API, web scrape, or DB-backed test content). Can be `is_test=true` or `is_test=false`. |
| **Synthetic Article** | A test article stored in `prediction.test_articles`, either AI-generated or manually created. Replaces external RSS/Firecrawl for test scenarios. |
| **Signal** | Raw event extracted from a source. Represents something that happened (news, price move, filing). |
| **Predictor** | A validated signal assessed as meaningful, with direction, strength, and confidence. |
| **Prediction** | An actual forecast generated when enough predictors accumulate for a target. |
| **Learning** | A piece of knowledge (rule, pattern, weight adjustment) extracted from outcomes. |
| **Scenario** | A bundled test configuration: test targets, articles, prices, and expected outcome. |
| **Scenario Variation** | A modified version of a scenario (e.g., different sentiment strength, timing). |
| **Scenario Run** | A single execution of a scenario, producing signals → predictors → predictions. |
| **Test Mode** | A UI/API context filter showing only test data (`is_test=true`). |
| **Test Data** | Any record with `is_test=true`. Cannot affect production outcomes. |
| **Production Data** | Any record with `is_test=false`. The "real" system. |
| **Promotion** | The process of converting a test learning to production (`is_test=false`). |

### 2.2 System Invariants

These invariants MUST hold at all times. Violations should trigger alerts.

| ID | Invariant | Enforcement |
|----|-----------|-------------|
| **INV-01** | Production API endpoints MUST exclude `is_test=true` by default (fail-closed). | API middleware |
| **INV-02** | Signals from `is_test=true` sources MUST have `is_test=true`. | DB trigger |
| **INV-03** | Predictors from `is_test=true` signals MUST have `is_test=true`. | DB trigger |
| **INV-04** | `is_test=true` predictors can ONLY affect `T_` prefixed targets. | DB trigger |
| **INV-05** | Production climate/sentiment queries MUST filter `is_test=false`. | Query templates |
| **INV-06** | Production accuracy metrics MUST exclude `is_test=true` predictions. | Metric queries |
| **INV-07** | Learning promotion MUST be a human-approved, audited action. | Workflow + audit log |
| **INV-08** | Test targets MUST have `T_` prefix. | DB constraint on targets |
| **INV-09** | A promoted learning becomes `is_test=false`; original test learning remains for traceability. | Promotion workflow |
| **INV-10** | Scenario runs MUST record full version info (scenario version, context version, pipeline revision). | scenario_runs table |
| **INV-11** | Every real target MUST have a corresponding `T_` test mirror created automatically. | DB trigger on targets |

### 2.3 Data Flow Rules

```
Source (is_test) → Signal (inherits is_test) → Predictor (inherits is_test) → Prediction (inherits is_test)
                                                                                         ↓
                                                                            Evaluation (inherits is_test)
                                                                                         ↓
                                                                              Learning (inherits is_test)
```

**Rule**: The `is_test` flag propagates downstream and CANNOT be downgraded (test→prod) except through explicit promotion workflow.

---

## 3. Problem Statement

### 3.1 Current Limitations

The existing prediction system learns only from real-world events:
- **Slow feedback**: Must wait for actual market movements, news events
- **Limited scenarios**: Only see what actually happens
- **No edge cases**: Can't test "what if" scenarios
- **Expensive mistakes**: Learning from real misses affects real users

### 3.2 The Learning Bottleneck

```
Real Event → Prediction → Outcome → Learning → Context Update
     ↑                                              |
     └──────────── SLOW (days/weeks) ──────────────┘
```

We need a faster loop:

```
Test Scenario → Prediction → Simulated Outcome → Learning → Validate
      ↑                                                        |
      └─────────────── FAST (minutes/hours) ───────────────────┘
```

### 3.3 The Cross-Contamination Risk

Without proper isolation, test data could:
- Pollute real climate/sentiment calculations
- Create predictors that affect real predictions
- Inject test learnings into production context
- Skew accuracy metrics with synthetic outcomes

---

## 4. Solution Architecture

### 4.1 The Hybrid Approach

Use the **same prediction pipeline** with **test-aware isolation**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA SOURCES                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  REAL SOURCES (is_test=false)          TEST SOURCES (is_test=true)         │
│  ┌─────────────────────┐               ┌─────────────────────┐             │
│  │ Polygon API         │               │ DB Test Price Data    │             │
│  │ Real RSS feeds      │               │ DB Synthetic Articles │             │
│  │ Firecrawl (real)    │               │ (RSS/Firecrawl-equiv) │             │
│  └──────────┬──────────┘               └──────────┬──────────┘             │
│             │                                     │                         │
│             ▼                                     ▼                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    SIGNAL POOL (is_test flag)                        │   │
│  │    Real signals: is_test=false    Test signals: is_test=true        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│             │                                     │                         │
│             ▼                                     ▼                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    SAME PREDICTION PIPELINE                          │   │
│  │                  (evaluates with is_test awareness)                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│             │                                     │                         │
│             ▼                                     ▼                         │
│  ┌─────────────────────┐               ┌─────────────────────┐             │
│  │ REAL PREDICTORS     │               │ TEST PREDICTORS     │             │
│  │ is_test=false       │               │ is_test=true        │             │
│  │ → Real targets only │               │ → Test targets only │             │
│  └──────────┬──────────┘               └──────────┬──────────┘             │
│             │                                     │                         │
│             ▼                                     ▼                         │
│  ┌─────────────────────┐               ┌─────────────────────┐             │
│  │ REAL PREDICTIONS    │               │ TEST PREDICTIONS    │             │
│  │ is_test=false       │               │ is_test=true        │             │
│  └──────────┬──────────┘               └──────────┬──────────┘             │
│             │                                     │                         │
│             ▼                                     ▼                         │
│  ┌─────────────────────┐               ┌─────────────────────┐             │
│  │ REAL LEARNINGS      │               │ TEST LEARNINGS      │             │
│  │ is_test=false       │               │ is_test=true        │             │
│  │ (sparse, valuable)  │               │ (rapid iteration)   │             │
│  └─────────────────────┘               └──────────┬──────────┘             │
│                                                   │                         │
│                                                   ▼                         │
│                                        ┌─────────────────────┐             │
│                                        │ PROMOTE TO PRODUCTION│             │
│                                        │ (human review)       │             │
│                                        └─────────────────────┘             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Target Naming Convention

Test targets use a `T_` prefix:
- `T_AAPL` (test Apple)
- `T_BTC` (test Bitcoin)
- `T_TRUMP` (test political figure for cross-cutting scenarios)
- `T_SPY` (test market index)

This makes test data immediately identifiable throughout the system.

### 4.3 The Firewall: Signal Propagation

The critical isolation point is **signal creation**:

```
Test Article about "T_AAPL breakthrough"
    → Signal extracted
    → FIREWALL: Source is_test=true, so signal gets is_test=true
    → Signal can ONLY create predictors for T_AAPL
    → CANNOT affect real AAPL climate or predictors
```

---

## 5. Real↔Test Instrument Mapping

### 5.1 Mirror Target Model

Every test target (`T_AAPL`) can optionally **mirror** a real target (`AAPL`). Mirroring provides:
- Inherited metadata (domain, target_type, default context)
- Baseline price data seeding
- Reference for scenario generation from real events

### 5.2 Mirror Mapping Table

```sql
-- =============================================================================
-- TEST TARGET MIRRORS TABLE
-- =============================================================================

CREATE TABLE prediction.test_target_mirrors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Test target (must be T_ prefixed)
  test_target_id UUID NOT NULL REFERENCES prediction.targets(id) ON DELETE CASCADE,

  -- Real target it mirrors (must NOT be T_ prefixed)
  real_target_id UUID NOT NULL REFERENCES prediction.targets(id) ON DELETE CASCADE,

  -- Inheritance config
  inherit_metadata BOOLEAN NOT NULL DEFAULT true,
  inherit_context BOOLEAN NOT NULL DEFAULT true,

  -- Sync config (for price/event seeding)
  auto_sync_prices BOOLEAN NOT NULL DEFAULT false,
  price_sync_delay_hours INTEGER DEFAULT 24,  -- How far behind real prices to sync

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  UNIQUE(test_target_id),  -- A test target can only mirror one real target
  UNIQUE(real_target_id, test_target_id)  -- Explicit pair uniqueness
);

-- Enforce T_ prefix on test target
CREATE OR REPLACE FUNCTION prediction.enforce_mirror_prefixes()
RETURNS TRIGGER AS $$
DECLARE
  test_symbol TEXT;
  real_symbol TEXT;
BEGIN
  SELECT symbol INTO test_symbol FROM prediction.targets WHERE id = NEW.test_target_id;
  SELECT symbol INTO real_symbol FROM prediction.targets WHERE id = NEW.real_target_id;

  IF test_symbol NOT LIKE 'T_%' THEN
    RAISE EXCEPTION 'Test target must have T_ prefix, got: %', test_symbol;
  END IF;

  IF real_symbol LIKE 'T_%' THEN
    RAISE EXCEPTION 'Real target must NOT have T_ prefix, got: %', real_symbol;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_mirror_prefixes
  BEFORE INSERT OR UPDATE ON prediction.test_target_mirrors
  FOR EACH ROW
  EXECUTE FUNCTION prediction.enforce_mirror_prefixes();

-- =============================================================================
-- AUTO-CREATE TEST MIRROR ON TARGET CREATION
-- =============================================================================
-- When a real target is created (symbol NOT starting with T_),
-- automatically create its test mirror (T_<symbol>) and link them.

CREATE OR REPLACE FUNCTION prediction.auto_create_test_mirror()
RETURNS TRIGGER AS $$
DECLARE
  test_target_id UUID;
  test_symbol TEXT;
BEGIN
  -- Only process real targets (not T_ prefixed)
  IF NEW.symbol LIKE 'T_%' THEN
    RETURN NEW;
  END IF;

  -- Build test symbol
  test_symbol := 'T_' || NEW.symbol;

  -- Check if test target already exists
  SELECT id INTO test_target_id FROM prediction.targets WHERE symbol = test_symbol;

  -- Create test target if it doesn't exist
  IF test_target_id IS NULL THEN
    INSERT INTO prediction.targets (
      universe_id,
      symbol,
      name,
      domain,
      target_type,
      metadata,
      is_active
    ) VALUES (
      NEW.universe_id,
      test_symbol,
      'Test: ' || NEW.name,
      NEW.domain,
      NEW.target_type,
      NEW.metadata || '{"is_test_mirror": true}'::jsonb,
      true
    )
    RETURNING id INTO test_target_id;
  END IF;

  -- Create mirror link if it doesn't exist
  INSERT INTO prediction.test_target_mirrors (
    test_target_id,
    real_target_id,
    inherit_metadata,
    inherit_context,
    is_active
  ) VALUES (
    test_target_id,
    NEW.id,
    true,
    true,
    true
  )
  ON CONFLICT (test_target_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_create_test_mirror
  AFTER INSERT ON prediction.targets
  FOR EACH ROW
  EXECUTE FUNCTION prediction.auto_create_test_mirror();

-- Comment
COMMENT ON FUNCTION prediction.auto_create_test_mirror() IS
  'Automatically creates T_<symbol> test target when a real target is added';
```

### 5.3 Mirror Creation Policies

| Policy | Description |
|--------|-------------|
| **Auto-mirror on target creation** | When a real target is added (e.g., GOOGL), system automatically creates T_GOOGL and links them |
| **Manual** | Admin explicitly creates T_AAPL and links to AAPL (for special cases) |
| **Auto-mirror on demand** | When creating a scenario for AAPL, system auto-creates T_AAPL if not exists |
| **Batch mirror** | Admin can batch-create mirrors for all targets in a universe |

**Default behavior**: Auto-mirror on target creation is the **default**. Every real instrument gets a test mirror automatically.

### 5.4 Mirror Lifecycle

```
Real Target (AAPL) exists
        │
        ▼
┌───────────────────────┐
│ Create Test Target    │
│ (T_AAPL)             │
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│ Create Mirror Link    │
│ T_AAPL → AAPL        │
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│ Inherit Metadata      │
│ (domain, type, etc.)  │
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│ Optionally Sync       │
│ Delayed Prices        │
└───────────────────────┘
```

### 5.5 Scenario Generation from Real Events

When a real-world miss or evaluation generates a learning:

```typescript
interface ScenarioFromRealEvent {
  // The real event
  source_real_target_id: string;  // e.g., AAPL
  source_event_type: 'missed_opportunity' | 'evaluation';
  source_event_id: string;

  // Auto-mapped test target
  test_target_id: string;  // e.g., T_AAPL (created or found via mirror)

  // Generated scenario
  scenario: {
    // Articles rewritten to reference T_AAPL instead of AAPL
    test_articles: TestArticle[];
    // Price movements mapped to T_AAPL
    test_prices: TestPriceData[];
    // Expected outcome from real event
    expected_outcome: ExpectedOutcome;
  };
}
```

The system:
1. Finds or creates the mirror test target (`T_AAPL` for `AAPL`)
2. Rewrites article content to replace `AAPL` → `T_AAPL`
3. Maps historical prices to test price data
4. Creates scenario with the real event's outcome as expected result

---

## 6. Test Data Isolation

### 6.1 Isolation Rules

| Layer | Rule |
|-------|------|
| **Sources** | `is_test=true` sources only generate `is_test=true` signals |
| **Signals** | `is_test=true` signals only create `is_test=true` predictors |
| **Predictors** | `is_test=true` predictors only affect `T_` prefixed targets |
| **Predictions** | `is_test=true` predictions excluded from real accuracy metrics |
| **Learnings** | `is_test=true` learnings require promotion to apply to real targets |
| **Climate** | Climate calculations filter by `is_test` flag |

### 6.2 Cross-Cutting Predictor Handling

Problem: A test article about "T_TRUMP announces tariffs" could generate a market-wide predictor.

Solution: **Test predictors are quarantined by default**

```
Test Article: "T_TRUMP announces tariffs on China"
    → Predictor: "tariff_announcement → negative_equities"
    → is_test=true automatically
    → Only applies to: T_AAPL, T_MSFT, T_SPY (test targets)
    → Does NOT apply to: AAPL, MSFT, SPY (real targets)
```

When a test predictor is validated and promoted to production, it becomes `is_test=false` and can affect real targets.

### 6.3 Query Patterns

All production queries must filter:

```sql
-- Production predictions
SELECT * FROM prediction.predictions
WHERE is_test = false;

-- Production climate calculation
SELECT * FROM prediction.signals
WHERE is_test = false
AND detected_at > NOW() - INTERVAL '24 hours';

-- Test predictions (for analysis)
SELECT * FROM prediction.predictions
WHERE is_test = true;
```

---

## 7. Test Input Infrastructure

### 7.1 Test Sources

Test sources are marked with `is_test=true` and are **DB-backed synthetic inputs**. We do **not** rely on mock external URLs (RSS/Firecrawl/price endpoints) for the core test learning loop.

In test mode:
- "RSS" and "Firecrawl" are modeled as **content records stored in our database** (e.g., `prediction.test_articles`)
- "Price feeds" are modeled as **time-series records stored in our database** (e.g., `prediction.test_price_data`)
- The existing ingestion/prediction pipeline processes these inputs with `is_test=true` isolation and `scenario_run_id` lineage

#### 7.1.1 Test Price Data (DB-backed)

```typescript
// Test price data structure (stored in DB and/or created via API)
interface TestPriceData {
  symbol: string;        // "T_AAPL"
  price: number;         // 185.50
  simulated_at: string;  // ISO 8601
  volume?: number;
  metadata?: Record<string, any>;
}
```

This enables:
- Setting arbitrary prices for test targets
- Simulating price movements over time
- Creating specific scenarios (gaps, spikes, crashes)

#### 7.1.2 Synthetic Articles (RSS/Firecrawl-equivalent, DB-backed)

```sql
-- Test "DB source" concept (implementation may vary based on existing sources schema)
INSERT INTO prediction.sources (
  scope_level, domain, name, source_type, url,
  is_test, is_active
) VALUES (
  'domain', 'stocks',
  'Test Stock Synthetic Articles',
  'test_db',
  'db://prediction.test_articles?domain=stocks',
  true,
  true
);
```

Synthetic articles are stored (and optionally AI-generated) in `prediction.test_articles` and:
- Reference `T_` prefixed targets
- Test specific scenarios (earnings beats, scandals, regulatory news)
- Are clearly marked as synthetic

There is no need for a dedicated "test RSS URL" or "test Firecrawl URL" in the core design—test content lives in the testing database and is processed as `is_test=true`.

#### 7.1.3 Test Source Types

The `source_type` field in `prediction.sources` distinguishes how data is ingested:

| source_type | Real/Test | Description |
|-------------|-----------|-------------|
| `rss` | Real | External RSS feed URL |
| `web` | Real | External web scrape via Firecrawl |
| `api` | Real | External API (Polygon, etc.) |
| `twitter_search` | Real | Twitter/X search API |
| `test_db` | Test only | DB-backed synthetic content |

For test scenarios:
- A `test_db` source reads from `prediction.test_articles`
- Price tools detect `T_` prefix and read from `prediction.test_price_data`
- No external network calls for test data

### 7.2 Test Data Management UI

A dedicated UI for managing test data:

1. **Test Targets**: Create/manage `T_` prefixed targets
2. **Test Prices**: Set and manipulate test instrument prices
3. **Test Articles**: Create AI-generated or manual test articles
4. **Test Scenarios**: Bundle related test data into scenarios

### 7.3 AI-Generated Test Content

Test articles can be generated by AI based on:
- Real-world event patterns
- Specific scenarios to test
- Edge cases and ambiguous language

```typescript
interface TestArticleRequest {
  target_symbols: string[];
  scenario_type: 'earnings_beat' | 'earnings_miss' | 'scandal' | 'regulatory' | 'acquisition' | 'custom';
  sentiment: 'bullish' | 'bearish' | 'neutral' | 'mixed';
  strength: 'strong' | 'moderate' | 'weak';
  custom_prompt?: string;
}
```

---

## 8. Scenario Run Semantics

### 8.1 Time Model

Scenario configurations use **relative time notation** that must be resolved to actual timestamps at execution time.

#### 8.1.1 Relative Time Format

```
T           = scenario execution start time (anchor)
T-1d        = 1 day before anchor
T+2h        = 2 hours after anchor
T+30m       = 30 minutes after anchor
T-4h30m     = 4 hours 30 minutes before anchor
```

#### 8.1.2 Time Resolution Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| **Real-time** | `T` = `NOW()` at execution start | Interactive testing, live demos |
| **Backdated** | `T` = specified historical timestamp | Reproducible tests, regression |
| **Accelerated** | Time progresses faster than real-time | Stress testing, bulk scenarios |

### 8.2 Scenario Execution Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SCENARIO EXECUTION                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. INITIALIZATION                                                          │
│     ├── Resolve scenario config (version, parameters)                       │
│     ├── Create scenario_run record                                          │
│     ├── Set anchor time (T)                                                │
│     └── Record context versions (predictors, learnings, pipeline)           │
│                                                                             │
│  2. DATA INJECTION                                                          │
│     ├── Inject test prices at resolved timestamps                           │
│     ├── Inject test articles at resolved timestamps                         │
│     └── Wait for signal processing OR use isolated runner                   │
│                                                                             │
│  3. PIPELINE EXECUTION                                                      │
│     ├── Source crawl picks up test articles                                 │
│     ├── Signals created (is_test=true)                                      │
│     ├── Predictors created (is_test=true)                                   │
│     └── Predictions generated (is_test=true)                                │
│                                                                             │
│  4. OUTCOME INJECTION                                                       │
│     ├── Inject outcome price at T+outcome_time                              │
│     └── Trigger evaluation                                                  │
│                                                                             │
│  5. EVALUATION                                                              │
│     ├── Compare prediction vs outcome                                       │
│     ├── Score accuracy                                                      │
│     └── Generate learnings (is_test=true)                                   │
│                                                                             │
│  6. RECORDING                                                               │
│     ├── Update scenario_run with results                                    │
│     └── Link all generated artifacts                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.3 Unified Runner Architecture

There is **no separate test runner**. The same pipeline processes both real and test data:

```
Scheduled Job (every 10-20 min)
        │
        ├── Process RSS sources (is_test=false)
        │       → External RSS feeds
        │       → Create real signals
        │
        ├── Process RSS sources (is_test=true, source_type='test_db')
        │       → Read from prediction.test_articles
        │       → Create test signals (is_test=true)
        │
        ├── Process Firecrawl sources (is_test=false)
        │       → External web scraping
        │       → Create real signals
        │
        ├── Process test_db sources (is_test=true)
        │       → Read from prediction.test_articles
        │       → Create test signals (is_test=true)
        │
        └── Price updates
                ├── Real targets → External APIs (Polygon, etc.)
                └── Test targets (T_ prefix) → prediction.test_price_data
```

**Key principle**: Same tools, same pipeline, different data sources based on `is_test` flag.

| Aspect | Real Data | Test Data |
|--------|-----------|-----------|
| **Price tools** | Call Polygon/external APIs | Read from `test_price_data` |
| **News sources** | RSS feeds, Firecrawl | `test_db` source → `test_articles` table |
| **Signal creation** | `is_test=false` | `is_test=true` |
| **Pipeline processing** | Same | Same |
| **Evaluation** | Same | Same |
| **Learning generation** | Same | Same |

The only difference is **where the data comes from** and the `is_test` flag that propagates through.

### 8.4 Deterministic Replay

For reproducibility, scenario runs must be replayable with identical results.

Requirements:
- **Fixed random seeds**: Any LLM sampling uses recorded seed
- **Frozen context**: Use context version from original run
- **Timestamp pinning**: Use exact timestamps from original run
- **Pipeline version lock**: Record and enforce pipeline revision

```typescript
interface DeterministicRunConfig {
  // Original run to replay
  source_run_id: string;

  // What to replay
  use_original_timestamps: boolean;
  use_original_context_version: boolean;
  use_original_llm_seed: boolean;

  // Allow differences for comparison
  allow_context_diff: boolean;  // Compare with current context
  allow_pipeline_diff: boolean; // Compare with current pipeline
}
```

---

## 9. Test-Based Learning Accelerator

### 9.1 The Learning Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         REAL WORLD (Curriculum Designer)                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Real event happens → Real prediction (hit or miss)                        │
│                               │                                             │
│                               ▼                                             │
│                    "Why did we miss that?"                                  │
│                    "What pattern is here?"                                  │
│                               │                                             │
│                               ▼                                             │
│           ┌───────────────────────────────────────┐                        │
│           │     CREATE TEST SCENARIO              │                        │
│           │     from the real learning            │                        │
│           └───────────────────────────────────────┘                        │
│                               │                                             │
└───────────────────────────────┼─────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TEST WORLD (Classroom)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Run test scenario → Generate variations                                   │
│         │              "What if stronger language?"                        │
│         │              "What if mixed signals?"                            │
│         │              "What if delayed?"                                  │
│         ▼                                                                   │
│  Refine understanding through rapid iteration                              │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │          VALIDATE TEST LEARNINGS                                     │   │
│  │          (run against test predictions, check outcomes)              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │          UPDATE CONTEXT FILES                                        │   │
│  │          (from validated test learnings, not raw real-world)        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│         │                                                                   │
│         ▼                                                                   │
│  Better predictors (is_test=true initially)                                │
│         │                                                                   │
│         ▼                                                                   │
│  Validate against real outcomes (backtest)                                 │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │          PROMOTE TO PRODUCTION                                       │   │
│  │          (human review, is_test=false)                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 Key Principle: Context Updates via Tests

**Context updates come from validated test learnings, not directly from real-world reactions.**

This prevents:
- Knee-jerk context updates from single real events
- Overfitting to recent real data
- Untested hypotheses going into production context

### 9.3 Test Scenario Generation from Learnings

When a real-world learning is captured (from evaluation or missed opportunity):

```typescript
interface TestScenarioFromLearning {
  source_learning_id: string;
  source_type: 'evaluation' | 'missed_opportunity';

  // Generated test scenario
  scenario: {
    name: string;
    description: string;
    test_targets: string[];      // T_AAPL, T_BTC, etc.
    test_articles: TestArticle[];
    test_prices: TestPriceData[];
    expected_outcome: {
      direction: 'up' | 'down' | 'flat';
      magnitude?: 'small' | 'medium' | 'large';
    };
  };

  // Variations to test
  variations: {
    name: string;
    modifications: Record<string, any>;
  }[];
}
```

### 9.4 Learning Promotion Workflow

```
Test Learning (is_test=true)
        │
        ▼
┌───────────────────────┐
│ Validation Criteria   │
│ - Applied N times     │
│ - Success rate > X%   │
│ - No false positives  │
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│ Human Review Queue    │
│ - Review reasoning    │
│ - Check edge cases    │
│ - Approve/Reject      │
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│ Promote to Production │
│ - is_test = false     │
│ - Applies to real     │
└───────────────────────┘
```

---

## 10. Backtesting Specification

### 10.1 Purpose

Backtesting validates test learnings against historical real-world data before promotion to production.

### 10.2 Backtesting Process

```
Test Learning (is_test=true, validated in test environment)
        │
        ▼
┌───────────────────────┐
│ SELECT BACKTEST WINDOW│
│ - Start date          │
│ - End date            │
│ - Target symbols      │
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│ GATHER HISTORICAL DATA│
│ - Real signals        │
│ - Real predictions    │
│ - Real outcomes       │
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│ APPLY LEARNING        │
│ (hypothetically)      │
│ - What would have     │
│   changed?            │
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│ SCORE IMPROVEMENT     │
│ - Accuracy delta      │
│ - False positive rate │
│ - Coverage change     │
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│ PASS/FAIL CRITERIA    │
│ - Min accuracy lift   │
│ - Max FP increase     │
│ - Min sample size     │
└───────────────────────┘
```

### 10.3 Backtest Configuration

```typescript
interface BacktestConfig {
  // Learning to test
  learning_id: string;

  // Time window
  start_date: string;  // ISO 8601
  end_date: string;    // ISO 8601

  // Scope
  target_symbols?: string[];  // Specific targets, or all in domain
  domain?: string;            // 'stocks', 'crypto', etc.

  // Pass/fail criteria
  criteria: {
    min_accuracy_lift: number;       // e.g., 0.02 (2% improvement)
    max_false_positive_increase: number;  // e.g., 0.05 (5% max increase)
    min_sample_size: number;         // e.g., 50 predictions
    min_statistical_significance: number;  // e.g., 0.95 (95% confidence)
  };
}
```

### 10.4 Backtest Results

```typescript
interface BacktestResult {
  backtest_id: string;
  learning_id: string;
  config: BacktestConfig;

  // Results
  passed: boolean;

  metrics: {
    baseline_accuracy: number;
    with_learning_accuracy: number;
    accuracy_lift: number;

    baseline_false_positive_rate: number;
    with_learning_false_positive_rate: number;
    false_positive_delta: number;

    predictions_affected: number;
    predictions_improved: number;
    predictions_degraded: number;

    statistical_significance: number;
  };

  // Sample details
  sample_predictions: Array<{
    prediction_id: string;
    original_outcome: 'correct' | 'incorrect';
    with_learning_outcome: 'correct' | 'incorrect';
    change: 'improved' | 'degraded' | 'unchanged';
  }>;

  // Execution metadata
  executed_at: string;
  execution_time_ms: number;
}
```

### 10.5 Backtest Data Sources

| Data | Source | Notes |
|------|--------|-------|
| Historical signals | `prediction.signals WHERE is_test=false` | Real signals only |
| Historical predictions | `prediction.predictions WHERE is_test=false` | Real predictions only |
| Historical outcomes | `prediction.evaluations WHERE is_test=false` | Resolved predictions |
| Historical prices | `prediction.target_snapshots WHERE is_test=false` | Real price history |

---

## 11. Safety & Access Control

### 11.1 Role-Based Access Control (RBAC)

| Role | Create Test Data | Run Scenarios | View Test Results | Promote Learnings | Admin |
|------|-----------------|---------------|-------------------|-------------------|-------|
| **Viewer** | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Tester** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Analyst** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Reviewer** | ✅ | ✅ | ✅ | ✅ (approve only) | ❌ |
| **Admin** | ✅ | ✅ | ✅ | ✅ | ✅ |

### 11.2 Fail-Closed Defaults

All production endpoints MUST exclude test data by default. This is enforced at multiple levels:

#### 11.2.1 API Middleware

```typescript
// Production API middleware
function productionDataFilter(req, res, next) {
  // Default: exclude test data
  req.query.is_test = req.query.is_test ?? false;

  // Explicit test mode requires permission
  if (req.query.is_test === true) {
    if (!req.user.permissions.includes('view_test_data')) {
      return res.status(403).json({ error: 'Test data access denied' });
    }
  }

  next();
}
```

#### 11.2.2 Database Views (Optional)

```sql
-- Production-safe view
CREATE VIEW prediction.v_production_predictions AS
SELECT * FROM prediction.predictions
WHERE is_test = false;

-- Test-only view
CREATE VIEW prediction.v_test_predictions AS
SELECT * FROM prediction.predictions
WHERE is_test = true;
```

### 11.3 Audit Logging

All test-related actions must be logged for traceability.

```sql
CREATE TABLE prediction.test_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who
  user_id UUID NOT NULL,
  user_email TEXT NOT NULL,

  -- What
  action TEXT NOT NULL,  -- 'create_scenario', 'run_scenario', 'promote_learning', etc.
  resource_type TEXT NOT NULL,  -- 'test_scenario', 'test_article', 'learning', etc.
  resource_id UUID NOT NULL,

  -- Details
  details JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- When
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CHECK (action IN (
    'create_scenario', 'update_scenario', 'delete_scenario', 'run_scenario',
    'create_article', 'generate_article', 'delete_article',
    'create_price_data', 'delete_price_data',
    'promote_learning', 'reject_learning',
    'create_mirror', 'delete_mirror',
    'backtest_learning'
  ))
);

CREATE INDEX idx_test_audit_log_user ON prediction.test_audit_log(user_id);
CREATE INDEX idx_test_audit_log_action ON prediction.test_audit_log(action);
CREATE INDEX idx_test_audit_log_resource ON prediction.test_audit_log(resource_type, resource_id);
CREATE INDEX idx_test_audit_log_created ON prediction.test_audit_log(created_at DESC);
```

### 11.4 Promotion Workflow Boundaries

Learning promotion MUST follow this workflow:

```
1. VALIDATION GATE
   - Learning has been applied N+ times in test
   - Success rate exceeds threshold
   - No unexpected side effects

2. BACKTEST GATE
   - Backtest completed successfully
   - Accuracy improvement confirmed
   - Statistical significance achieved

3. REVIEW GATE
   - Reviewer with 'promote_learning' permission
   - Reviewer is NOT the learning creator
   - Reviewer notes required

4. PROMOTION
   - Audit log entry created
   - Original test learning preserved (is_test=true)
   - New production learning created (is_test=false)
   - Link maintained for traceability
```

### 11.5 AI Article Generation Safety

AI-generated test articles must:
- Clearly reference only `T_` prefixed targets
- Include metadata marking them as synthetic
- Be reviewed before use in high-stakes scenarios
- Not contain real company names without `T_` prefix

```typescript
interface ArticleGenerationGuardrails {
  // Required: all target references must be T_ prefixed
  enforce_test_prefix: boolean;  // Always true

  // Watermarking
  include_synthetic_marker: boolean;  // Always true
  marker_text: string;  // "[SYNTHETIC TEST ARTICLE]"

  // Content filtering
  block_real_entity_names: boolean;  // Block "Apple" without "T_"
  allowed_entity_pattern: RegExp;  // /^T_[A-Z]+$/
}
```

---

## 12. Versioning & Traceability

### 12.1 Version Tracking Requirements

Every scenario run must record:

| What | Why |
|------|-----|
| **Scenario version** | Know exactly which scenario config was used |
| **Context version** | Track which learnings/rules were active |
| **Pipeline revision** | Identify code changes affecting behavior |
| **LLM model versions** | Track model behavior changes |
| **Generation seed** | Enable deterministic replay |

### 12.2 Scenario Runs Table

```sql
CREATE TABLE prediction.scenario_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Scenario
  scenario_id UUID NOT NULL REFERENCES prediction.test_scenarios(id) ON DELETE CASCADE,
  scenario_version INTEGER NOT NULL,  -- Scenario version at time of run
  scenario_config_snapshot JSONB NOT NULL,  -- Full config at time of run

  -- Variation (if any)
  variation_name TEXT,
  variation_config JSONB,

  -- Execution context
  anchor_time TIMESTAMPTZ NOT NULL,  -- T value for relative times
  time_mode TEXT NOT NULL,  -- 'real-time', 'backdated', 'accelerated'
  runner_type TEXT NOT NULL,  -- 'shared', 'isolated', 'inline'

  -- Version tracking
  context_version JSONB NOT NULL,  -- { "learnings_hash": "...", "predictors_hash": "..." }
  pipeline_revision TEXT NOT NULL,  -- Git commit or build ID
  llm_models JSONB NOT NULL,  -- { "signal_eval": "claude-3-sonnet", "predictor_gen": "..." }
  llm_seed INTEGER,  -- For deterministic replay

  -- Results
  status TEXT NOT NULL DEFAULT 'running',  -- 'running', 'completed', 'failed', 'cancelled'
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Generated artifacts (linked by run_id)
  signals_created INTEGER DEFAULT 0,
  predictors_created INTEGER DEFAULT 0,
  predictions_created INTEGER DEFAULT 0,
  learnings_created INTEGER DEFAULT 0,

  -- Outcome
  result JSONB,  -- { "expected": {...}, "actual": {...}, "score": 0.85 }
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CHECK (time_mode IN ('real-time', 'backdated', 'accelerated')),
  CHECK (runner_type IN ('shared', 'isolated', 'inline')),
  CHECK (status IN ('running', 'completed', 'failed', 'cancelled'))
);

CREATE INDEX idx_scenario_runs_scenario ON prediction.scenario_runs(scenario_id);
CREATE INDEX idx_scenario_runs_status ON prediction.scenario_runs(status);
CREATE INDEX idx_scenario_runs_started ON prediction.scenario_runs(started_at DESC);
CREATE INDEX idx_scenario_runs_pipeline ON prediction.scenario_runs(pipeline_revision);
```

### 12.3 Artifact Linking

All test artifacts link back to their scenario run:

```sql
-- Add run_id to test-generated records
ALTER TABLE prediction.signals ADD COLUMN scenario_run_id UUID REFERENCES prediction.scenario_runs(id);
ALTER TABLE prediction.predictors ADD COLUMN scenario_run_id UUID REFERENCES prediction.scenario_runs(id);
ALTER TABLE prediction.predictions ADD COLUMN scenario_run_id UUID REFERENCES prediction.scenario_runs(id);
ALTER TABLE prediction.learnings ADD COLUMN scenario_run_id UUID REFERENCES prediction.scenario_runs(id);

-- Indexes for run-based queries
CREATE INDEX idx_signals_run ON prediction.signals(scenario_run_id) WHERE scenario_run_id IS NOT NULL;
CREATE INDEX idx_predictors_run ON prediction.predictors(scenario_run_id) WHERE scenario_run_id IS NOT NULL;
CREATE INDEX idx_predictions_run ON prediction.predictions(scenario_run_id) WHERE scenario_run_id IS NOT NULL;
CREATE INDEX idx_learnings_run ON prediction.learnings(scenario_run_id) WHERE scenario_run_id IS NOT NULL;
```

### 12.4 Learning Lineage

Track the full path from real event → test scenario → test learning → promoted learning:

```sql
CREATE TABLE prediction.learning_lineage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The promoted learning
  promoted_learning_id UUID NOT NULL REFERENCES prediction.learnings(id),

  -- Source test learning
  source_test_learning_id UUID NOT NULL REFERENCES prediction.learnings(id),

  -- Scenario that generated it
  scenario_run_id UUID NOT NULL REFERENCES prediction.scenario_runs(id),

  -- Original real-world event (if any)
  source_missed_opportunity_id UUID REFERENCES prediction.missed_opportunities(id),
  source_evaluation_id UUID REFERENCES prediction.evaluations(id),

  -- Backtest that validated it
  backtest_id UUID,
  backtest_result JSONB,

  -- Promotion metadata
  promoted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  promoted_by_user_id UUID NOT NULL,
  promotion_notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_learning_lineage_promoted ON prediction.learning_lineage(promoted_learning_id);
CREATE INDEX idx_learning_lineage_source ON prediction.learning_lineage(source_test_learning_id);
CREATE INDEX idx_learning_lineage_run ON prediction.learning_lineage(scenario_run_id);
```

---

## 13. Data Lifecycle & Retention

### 13.1 Retention Policies

Test data can accumulate rapidly. Define clear retention policies:

| Data Type | Default Retention | Archival | Notes |
|-----------|------------------|----------|-------|
| **Test Articles** | 90 days | Archive after 90d | Can regenerate from prompts |
| **Test Price Data** | 30 days | Delete after 30d | Ephemeral by nature |
| **Scenario Runs** | 180 days | Archive after 180d | Keep for reproducibility |
| **Test Signals** | 30 days | Delete after 30d | High volume, low value |
| **Test Predictors** | 60 days | Delete after 60d | Linked to signals |
| **Test Predictions** | 90 days | Archive after 90d | Valuable for analysis |
| **Test Learnings** | Indefinite | Never delete | Core value |
| **Test Evaluations** | 90 days | Archive after 90d | Linked to predictions |
| **Audit Logs** | 1 year | Archive after 1y | Compliance requirement |

### 13.2 Cleanup Jobs

```sql
-- Daily cleanup job (run via cron)

-- Delete old test price data
DELETE FROM prediction.test_price_data
WHERE created_at < NOW() - INTERVAL '30 days';

-- Delete old test signals (not linked to active scenarios)
DELETE FROM prediction.signals
WHERE is_test = true
  AND created_at < NOW() - INTERVAL '30 days'
  AND scenario_run_id NOT IN (
    SELECT id FROM prediction.scenario_runs WHERE status = 'running'
  );

-- Archive old scenario runs
UPDATE prediction.scenario_runs
SET status = 'archived'
WHERE status = 'completed'
  AND completed_at < NOW() - INTERVAL '180 days';
```

### 13.3 Index Optimization

Ensure `is_test` indexes support efficient production queries:

```sql
-- Partial indexes for production queries (exclude test data)
CREATE INDEX idx_signals_production ON prediction.signals(target_id, detected_at)
WHERE is_test = false;

CREATE INDEX idx_predictors_production ON prediction.predictors(target_id, status)
WHERE is_test = false;

CREATE INDEX idx_predictions_production ON prediction.predictions(target_id, status)
WHERE is_test = false;
```

### 13.4 Storage Monitoring

Track test data volume to prevent unbounded growth:

```sql
-- Storage monitoring view
CREATE VIEW prediction.v_test_data_stats AS
SELECT
  'test_articles' as table_name,
  COUNT(*) as row_count,
  pg_size_pretty(pg_total_relation_size('prediction.test_articles')) as size
FROM prediction.test_articles
UNION ALL
SELECT
  'test_price_data',
  COUNT(*),
  pg_size_pretty(pg_total_relation_size('prediction.test_price_data'))
FROM prediction.test_price_data
UNION ALL
SELECT
  'scenario_runs',
  COUNT(*),
  pg_size_pretty(pg_total_relation_size('prediction.scenario_runs'))
FROM prediction.scenario_runs
UNION ALL
SELECT
  'test_signals',
  COUNT(*),
  NULL
FROM prediction.signals WHERE is_test = true
UNION ALL
SELECT
  'test_predictions',
  COUNT(*),
  NULL
FROM prediction.predictions WHERE is_test = true;
```

---

## 14. Observability Split

### 14.1 Metrics Partitioning

All prediction metrics MUST be partitioned by `is_test`:

| Metric | Production | Test | Combined |
|--------|------------|------|----------|
| Prediction accuracy | ✅ Primary | ✅ Separate | ❌ Never |
| Signal volume | ✅ Primary | ✅ Separate | ✅ For capacity |
| Predictor hit rate | ✅ Primary | ✅ Separate | ❌ Never |
| Learning velocity | ✅ Primary | ✅ Separate | ❌ Never |
| Climate sentiment | ✅ Primary | ✅ Separate | ❌ Never |
| API latency | ✅ Combined | ✅ Combined | ✅ Combined |
| Error rates | ✅ Combined | ✅ Combined | ✅ Combined |

### 14.2 Dashboard Requirements

#### 14.2.1 Production Dashboard (Default)

- MUST filter `is_test=false` for all prediction metrics
- MUST NOT show test data without explicit toggle
- SHOULD show "Production Only" indicator

#### 14.2.2 Test Dashboard

- Shows only `is_test=true` data
- Includes scenario execution metrics
- Learning iteration velocity
- Test-to-production promotion funnel

#### 14.2.3 Admin Dashboard

- Can toggle between production/test/combined
- Storage utilization by test data
- Retention policy compliance
- Audit log summary

### 14.3 Tagging Requirements

All metrics MUST include `is_test` tag:

```typescript
// Example: Prometheus metrics
prediction_accuracy_total{domain="stocks", is_test="false"} 0.72
prediction_accuracy_total{domain="stocks", is_test="true"} 0.68

signal_volume_total{source_type="rss", is_test="false"} 1523
signal_volume_total{source_type="rss", is_test="true"} 4891

learning_created_total{type="pattern", is_test="false"} 12
learning_created_total{type="pattern", is_test="true"} 156
```

### 14.4 Alerting Rules

| Alert | Production | Test | Notes |
|-------|------------|------|-------|
| Accuracy drop | ✅ Page | ❌ No | Only production matters |
| High error rate | ✅ Page | ✅ Warn | Infrastructure issue |
| Storage threshold | ✅ Warn | ✅ Page | Test data can explode |
| Stale test data | ❌ No | ✅ Warn | Cleanup needed |
| Promotion queue backlog | ✅ Warn | ✅ Warn | Review bottleneck |

---

## 15. Schema Changes

### 15.1 Tables Requiring `is_test` Column

| Table | Column | Default | Index |
|-------|--------|---------|-------|
| `prediction.sources` | `is_test BOOLEAN NOT NULL DEFAULT false` | `false` | Yes |
| `prediction.signals` | `is_test BOOLEAN NOT NULL DEFAULT false` | `false` | Yes |
| `prediction.predictors` | `is_test BOOLEAN NOT NULL DEFAULT false` | `false` | Yes |
| `prediction.predictions` | `is_test BOOLEAN NOT NULL DEFAULT false` | `false` | Yes |
| `prediction.evaluations` | `is_test BOOLEAN NOT NULL DEFAULT false` | `false` | Yes |
| `prediction.learnings` | `is_test BOOLEAN NOT NULL DEFAULT false` | `false` | Yes |
| `prediction.learning_queue` | `is_test BOOLEAN NOT NULL DEFAULT false` | `false` | Yes |
| `prediction.missed_opportunities` | `is_test BOOLEAN NOT NULL DEFAULT false` | `false` | Yes |
| `prediction.target_snapshots` | `is_test BOOLEAN NOT NULL DEFAULT false` | `false` | Yes |

### 15.2 Migration: Add is_test Column

```sql
-- =============================================================================
-- MIGRATION: Add is_test flag to all prediction tables
-- =============================================================================

-- Sources
ALTER TABLE prediction.sources
ADD COLUMN is_test BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX idx_prediction_sources_is_test ON prediction.sources(is_test);

-- Signals
ALTER TABLE prediction.signals
ADD COLUMN is_test BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX idx_prediction_signals_is_test ON prediction.signals(is_test);

-- Predictors
ALTER TABLE prediction.predictors
ADD COLUMN is_test BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX idx_prediction_predictors_is_test ON prediction.predictors(is_test);

-- Predictions
ALTER TABLE prediction.predictions
ADD COLUMN is_test BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX idx_prediction_predictions_is_test ON prediction.predictions(is_test);

-- Evaluations
ALTER TABLE prediction.evaluations
ADD COLUMN is_test BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX idx_prediction_evaluations_is_test ON prediction.evaluations(is_test);

-- Learnings
ALTER TABLE prediction.learnings
ADD COLUMN is_test BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX idx_prediction_learnings_is_test ON prediction.learnings(is_test);

-- Learning Queue
ALTER TABLE prediction.learning_queue
ADD COLUMN is_test BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX idx_prediction_learning_queue_is_test ON prediction.learning_queue(is_test);

-- Missed Opportunities
ALTER TABLE prediction.missed_opportunities
ADD COLUMN is_test BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX idx_prediction_missed_is_test ON prediction.missed_opportunities(is_test);

-- Target Snapshots
ALTER TABLE prediction.target_snapshots
ADD COLUMN is_test BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX idx_prediction_target_snapshots_is_test ON prediction.target_snapshots(is_test);

-- Comments
COMMENT ON COLUMN prediction.sources.is_test IS 'Test source - generates test signals only';
COMMENT ON COLUMN prediction.signals.is_test IS 'Test signal - inherited from source';
COMMENT ON COLUMN prediction.predictors.is_test IS 'Test predictor - only affects test targets';
COMMENT ON COLUMN prediction.predictions.is_test IS 'Test prediction - excluded from real metrics';
COMMENT ON COLUMN prediction.evaluations.is_test IS 'Test evaluation - for test predictions';
COMMENT ON COLUMN prediction.learnings.is_test IS 'Test learning - requires promotion for production';
COMMENT ON COLUMN prediction.learning_queue.is_test IS 'Test learning queue item';
COMMENT ON COLUMN prediction.missed_opportunities.is_test IS 'Test missed opportunity';
COMMENT ON COLUMN prediction.target_snapshots.is_test IS 'Test target snapshot';
```

### 15.3 New Tables

#### 15.3.1 Test Scenarios Table

```sql
-- =============================================================================
-- TEST SCENARIOS TABLE
-- =============================================================================

CREATE TABLE prediction.test_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Scenario metadata
  name TEXT NOT NULL,
  description TEXT,

  -- Source (optional - if created from learning)
  source_learning_id UUID REFERENCES prediction.learnings(id) ON DELETE SET NULL,
  source_evaluation_id UUID REFERENCES prediction.evaluations(id) ON DELETE SET NULL,
  source_missed_opportunity_id UUID REFERENCES prediction.missed_opportunities(id) ON DELETE SET NULL,

  -- Scenario type
  scenario_type TEXT NOT NULL,  -- 'earnings', 'news', 'regulatory', 'macro', 'technical', 'custom'

  -- Configuration
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- {
  --   "test_targets": ["T_AAPL", "T_MSFT"],
  --   "price_movements": [...],
  --   "articles": [...],
  --   "expected_outcome": { "direction": "up", "magnitude": "medium" }
  -- }

  -- Execution tracking
  times_run INTEGER NOT NULL DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  last_run_result JSONB,

  -- Status
  status TEXT NOT NULL DEFAULT 'draft',  -- 'draft', 'active', 'archived'

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CHECK (scenario_type IN ('earnings', 'news', 'regulatory', 'macro', 'technical', 'custom')),
  CHECK (status IN ('draft', 'active', 'archived'))
);

-- Indexes
CREATE INDEX idx_test_scenarios_source_learning ON prediction.test_scenarios(source_learning_id) WHERE source_learning_id IS NOT NULL;
CREATE INDEX idx_test_scenarios_type ON prediction.test_scenarios(scenario_type);
CREATE INDEX idx_test_scenarios_status ON prediction.test_scenarios(status);
CREATE INDEX idx_test_scenarios_created ON prediction.test_scenarios(created_at DESC);
CREATE INDEX idx_test_scenarios_config ON prediction.test_scenarios USING GIN(config);

-- Trigger
CREATE TRIGGER set_test_scenarios_updated_at
  BEFORE UPDATE ON prediction.test_scenarios
  FOR EACH ROW
  EXECUTE FUNCTION prediction.set_updated_at();

-- Comments
COMMENT ON TABLE prediction.test_scenarios IS 'Reusable test scenarios for accelerated learning';
COMMENT ON COLUMN prediction.test_scenarios.source_learning_id IS 'Learning that inspired this scenario';
COMMENT ON COLUMN prediction.test_scenarios.config IS 'Full scenario configuration including targets, articles, prices';
```

#### 15.3.2 Test Articles Table

```sql
-- =============================================================================
-- TEST ARTICLES TABLE
-- =============================================================================

CREATE TABLE prediction.test_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Scenario (optional)
  scenario_id UUID REFERENCES prediction.test_scenarios(id) ON DELETE CASCADE,

  -- Article content
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,

  -- Targets referenced
  target_symbols TEXT[] NOT NULL,  -- ["T_AAPL", "T_MSFT"]

  -- Sentiment metadata
  intended_sentiment TEXT NOT NULL,  -- 'bullish', 'bearish', 'neutral', 'mixed'
  intended_strength TEXT NOT NULL,  -- 'strong', 'moderate', 'weak'

  -- Generation metadata
  generated_by TEXT NOT NULL DEFAULT 'manual',  -- 'manual', 'ai', 'template'
  generation_prompt TEXT,

  -- Publication simulation
  simulated_published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  simulated_source_name TEXT NOT NULL DEFAULT 'Test News Source',

  -- Usage tracking
  times_used INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CHECK (intended_sentiment IN ('bullish', 'bearish', 'neutral', 'mixed')),
  CHECK (intended_strength IN ('strong', 'moderate', 'weak')),
  CHECK (generated_by IN ('manual', 'ai', 'template'))
);

-- Indexes
CREATE INDEX idx_test_articles_scenario ON prediction.test_articles(scenario_id) WHERE scenario_id IS NOT NULL;
CREATE INDEX idx_test_articles_targets ON prediction.test_articles USING GIN(target_symbols);
CREATE INDEX idx_test_articles_sentiment ON prediction.test_articles(intended_sentiment);
CREATE INDEX idx_test_articles_created ON prediction.test_articles(created_at DESC);

-- Trigger
CREATE TRIGGER set_test_articles_updated_at
  BEFORE UPDATE ON prediction.test_articles
  FOR EACH ROW
  EXECUTE FUNCTION prediction.set_updated_at();

-- Comments
COMMENT ON TABLE prediction.test_articles IS 'AI-generated or manual test articles for scenarios';
COMMENT ON COLUMN prediction.test_articles.target_symbols IS 'T_ prefixed target symbols this article mentions';
COMMENT ON COLUMN prediction.test_articles.intended_sentiment IS 'Expected sentiment the system should detect';
```

#### 15.3.3 Test Price Data Table

```sql
-- =============================================================================
-- TEST PRICE DATA TABLE
-- =============================================================================

CREATE TABLE prediction.test_price_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Scenario (optional)
  scenario_id UUID REFERENCES prediction.test_scenarios(id) ON DELETE CASCADE,

  -- Target (must be T_ prefixed)
  symbol TEXT NOT NULL,

  -- Price data
  price NUMERIC(20,8) NOT NULL,
  volume NUMERIC(20,2),

  -- Timing
  simulated_at TIMESTAMPTZ NOT NULL,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CHECK (symbol LIKE 'T_%')  -- Enforce T_ prefix
);

-- Indexes
CREATE INDEX idx_test_price_data_scenario ON prediction.test_price_data(scenario_id) WHERE scenario_id IS NOT NULL;
CREATE INDEX idx_test_price_data_symbol ON prediction.test_price_data(symbol);
CREATE INDEX idx_test_price_data_simulated ON prediction.test_price_data(simulated_at DESC);
CREATE INDEX idx_test_price_data_symbol_time ON prediction.test_price_data(symbol, simulated_at DESC);

-- Comments
COMMENT ON TABLE prediction.test_price_data IS 'Simulated price data for test targets';
COMMENT ON COLUMN prediction.test_price_data.symbol IS 'T_ prefixed test target symbol';
```

### 15.4 Enforcement Triggers

```sql
-- =============================================================================
-- TRIGGER: Enforce is_test propagation from source to signal
-- =============================================================================

CREATE OR REPLACE FUNCTION prediction.enforce_signal_is_test()
RETURNS TRIGGER AS $$
DECLARE
  source_is_test BOOLEAN;
BEGIN
  -- Get source's is_test status
  SELECT is_test INTO source_is_test
  FROM prediction.sources
  WHERE id = NEW.source_id;

  -- Signal must inherit is_test from source
  IF source_is_test = true AND NEW.is_test = false THEN
    RAISE EXCEPTION 'Signals from test sources must have is_test=true';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_signal_is_test
  BEFORE INSERT OR UPDATE ON prediction.signals
  FOR EACH ROW
  EXECUTE FUNCTION prediction.enforce_signal_is_test();

-- =============================================================================
-- TRIGGER: Enforce is_test propagation from signal to predictor
-- =============================================================================

CREATE OR REPLACE FUNCTION prediction.enforce_predictor_is_test()
RETURNS TRIGGER AS $$
DECLARE
  signal_is_test BOOLEAN;
BEGIN
  -- Get signal's is_test status
  SELECT is_test INTO signal_is_test
  FROM prediction.signals
  WHERE id = NEW.signal_id;

  -- Predictor must inherit is_test from signal
  IF signal_is_test = true AND NEW.is_test = false THEN
    RAISE EXCEPTION 'Predictors from test signals must have is_test=true';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_predictor_is_test
  BEFORE INSERT OR UPDATE ON prediction.predictors
  FOR EACH ROW
  EXECUTE FUNCTION prediction.enforce_predictor_is_test();

-- =============================================================================
-- TRIGGER: Enforce test predictors only affect test targets
-- =============================================================================

CREATE OR REPLACE FUNCTION prediction.enforce_test_target_isolation()
RETURNS TRIGGER AS $$
DECLARE
  target_symbol TEXT;
BEGIN
  -- Get target symbol
  SELECT symbol INTO target_symbol
  FROM prediction.targets
  WHERE id = NEW.target_id;

  -- Test predictors can only affect T_ targets
  IF NEW.is_test = true AND target_symbol NOT LIKE 'T_%' THEN
    RAISE EXCEPTION 'Test predictors can only affect T_ prefixed targets, got: %', target_symbol;
  END IF;

  -- Non-test predictors should not affect T_ targets (warning, not error)
  IF NEW.is_test = false AND target_symbol LIKE 'T_%' THEN
    RAISE WARNING 'Non-test predictor affecting test target: %', target_symbol;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_test_target_isolation
  BEFORE INSERT OR UPDATE ON prediction.predictors
  FOR EACH ROW
  EXECUTE FUNCTION prediction.enforce_test_target_isolation();
```

---

## 16. Implementation Phases

### Phase 1: Schema Foundation

1. Add `is_test` column to all prediction tables
2. Create indexes for `is_test` filtering
3. Add enforcement triggers for test data isolation
4. Create test scenario, test articles, and test price data tables
5. Create `test_target_mirrors` table with auto-creation trigger
6. Backfill: Create `T_` mirrors for all existing real targets

### Phase 2: Test Input Infrastructure

1. Implement DB-backed ingestion for synthetic test articles (`prediction.test_articles`)
2. Implement DB-backed ingestion for test price data (`prediction.test_price_data`)
3. Modify price/crypto tools to detect `T_` prefix and route to `test_price_data` instead of external APIs
4. Create `test_db` source type handler that reads from `test_articles` table
5. Ensure scenario runner can inject records and drive processing (`scenario_run_id` linkage)
6. Ensure all ingestion paths correctly propagate `is_test=true` and cannot leak into production

### Phase 3: Test Data Management UI

1. Test targets management (CRUD for `T_` prefixed targets)
2. Test price manipulation interface
3. Test article creation/generation interface
4. Test scenario builder

### Phase 4: Test Scenario Generation

1. AI-powered test article generation from prompts
2. Automatic scenario generation from missed opportunities
3. Automatic scenario generation from evaluations
4. Scenario variation generator

### Phase 5: Learning Promotion Workflow

1. Test learning validation metrics
2. Learning promotion queue
3. Human review interface for test learnings
4. Promotion to production workflow

### Phase 6: Analytics & Insights

1. Test vs. production accuracy comparison
2. Learning velocity metrics
3. Scenario effectiveness tracking
4. Test-to-production promotion rate

---

## 17. Test Scenario Examples

### 17.1 Earnings Beat Scenario

```json
{
  "name": "T_AAPL Earnings Beat - Strong",
  "scenario_type": "earnings",
  "config": {
    "test_targets": ["T_AAPL"],
    "articles": [
      {
        "title": "T_AAPL Reports Record Q4 Earnings, Beats Estimates by 15%",
        "sentiment": "bullish",
        "strength": "strong"
      }
    ],
    "price_movements": [
      { "symbol": "T_AAPL", "price": 185.00, "time": "T-1d" },
      { "symbol": "T_AAPL", "price": 195.50, "time": "T+1h" },
      { "symbol": "T_AAPL", "price": 198.25, "time": "T+1d" }
    ],
    "expected_outcome": {
      "direction": "up",
      "magnitude": "medium"
    }
  }
}
```

### 17.2 Cross-Market Regulatory Scenario

```json
{
  "name": "T_TRUMP Tariff Announcement",
  "scenario_type": "regulatory",
  "config": {
    "test_targets": ["T_SPY", "T_AAPL", "T_MSFT"],
    "articles": [
      {
        "title": "T_TRUMP Administration Announces 25% Tariffs on Tech Imports",
        "sentiment": "bearish",
        "strength": "strong",
        "affects_climate": true
      }
    ],
    "price_movements": [
      { "symbol": "T_SPY", "price": 450.00, "time": "T-1h" },
      { "symbol": "T_SPY", "price": 442.50, "time": "T+2h" },
      { "symbol": "T_AAPL", "price": 185.00, "time": "T-1h" },
      { "symbol": "T_AAPL", "price": 178.00, "time": "T+2h" }
    ],
    "expected_outcome": {
      "direction": "down",
      "magnitude": "medium"
    }
  }
}
```

### 17.3 Mixed Signals Scenario

```json
{
  "name": "T_BTC Mixed Regulatory News",
  "scenario_type": "regulatory",
  "config": {
    "test_targets": ["T_BTC"],
    "articles": [
      {
        "title": "SEC Approves New Crypto ETF, But Warns of Increased Oversight",
        "sentiment": "mixed",
        "strength": "moderate"
      },
      {
        "title": "Major Bank Announces T_BTC Custody Services",
        "sentiment": "bullish",
        "strength": "moderate"
      }
    ],
    "price_movements": [
      { "symbol": "T_BTC", "price": 45000.00, "time": "T-1h" },
      { "symbol": "T_BTC", "price": 46500.00, "time": "T+4h" },
      { "symbol": "T_BTC", "price": 45800.00, "time": "T+1d" }
    ],
    "expected_outcome": {
      "direction": "up",
      "magnitude": "small"
    }
  }
}
```

### 17.4 Scenario Catalog (Required Coverage)

The scenarios below define the minimum **intent coverage** for the end-to-end learning loop. Each scenario must be runnable via:
- DB-backed synthetic inputs (`prediction.test_articles`, `prediction.test_price_data`)
- Unified runner pipeline (no separate test runner)
- Full artifact lineage (`scenario_run_id`) and promotion gating

Each scenario includes required **variations** (timing shifts, sentiment ambiguity, conflicting inputs) to prevent overfitting.

| ID | Scenario | Goal / What It Proves | Targets | Required Variations |
|----|----------|------------------------|---------|---------------------|
| **SCN-001** | Earnings beat (single target) | Basic: synthetic article → signal → predictor → prediction → evaluation | `T_AAPL` | V1: weaker language, V2: delayed outcome, V3: “beats but guides down” mixed |
| **SCN-002** | Earnings miss (single target) | Negative case symmetry and threshold tuning | `T_AAPL` | V1: euphemisms (“soft quarter”), V2: negation (“not as bad”) |
| **SCN-003** | Cross-market macro shock | Cross-target propagation stays within `T_` universe | `T_SPY`, `T_AAPL`, `T_MSFT` | V1: multi-article sequence, V2: conflicting follow-up (“talks resume”) |
| **SCN-004** | Mixed news (same target) | System handles contradictory signals without brittle behavior | `T_BTC` | V1: reverse ordering of articles, V2: add neutral third article |
| **SCN-005** | Ambiguous language | Guard against false confidence on hedged text | `T_AAPL` | V1: speculation (“may”, “rumor”), V2: sarcasm/quotes, V3: conditional clauses |
| **SCN-006** | Entity collision / ticker ambiguity | Disambiguation: avoid extracting predictors for wrong target | `T_META`, `T_M` (or similar) | V1: acronym overlap, V2: “Apple” as fruit vs company |
| **SCN-007** | Noisy irrelevant news | Ensure irrelevant articles do not create strong predictors | `T_AAPL` | V1: celebrity gossip with “Apple” mention, V2: unrelated macro filler |
| **SCN-008** | Price-only scenario | Pure price-move signal path works with DB price data | `T_AAPL` | V1: spike then mean reversion, V2: gap down then recovery |
| **SCN-009** | Multi-target single article | Single synthetic article mentions multiple targets; correct attribution | `T_AAPL`, `T_MSFT` | V1: unequal strength per target, V2: shared macro cause |
| **SCN-010** | Scheduled-job ingestion | Unified runner picks up `test_db` content via cron path | any `T_` | V1: multiple test_db sources, V2: large batch (N=100 articles) |
| **SCN-011** | Leakage attempt (hard fail) | Any reference to real symbols must not create prod artifacts | `T_AAPL` + accidental `AAPL` mention | V1: content contains both `AAPL` and `T_AAPL`, V2: hidden/obfuscated “AAPL” |
| **SCN-012** | Promotion gate happy path | Validated test learning → backtest pass → reviewer promotes | any | V1: reviewer != author, V2: missing notes blocks promotion |
| **SCN-013** | Promotion gate rejection | Backtest fail OR validation fail prevents promotion | any | V1: low sample size, V2: FP increase too high |
| **SCN-014** | Mirror auto-creation | Adding a real target creates its `T_` mirror automatically | real symbol | V1: duplicate insert, V2: metadata inheritance rules |

**Scenario pass criteria (minimum)**
- Scenario run completes and produces a `scenario_runs` row with linked artifacts.
- All generated artifacts have `is_test=true` and correct `scenario_run_id`.
- No production views/metrics include these artifacts without explicit, authorized test mode.

---

## 18. API Specifications

### 18.1 Test Scenario Endpoints

```typescript
// Create test scenario
POST /api/prediction/test-scenarios
{
  name: string;
  description?: string;
  scenario_type: 'earnings' | 'news' | 'regulatory' | 'macro' | 'technical' | 'custom';
  config: TestScenarioConfig;
}

// Run test scenario
POST /api/prediction/test-scenarios/:id/run
{
  variations?: Record<string, any>;  // Optional modifications
}

// Generate scenario from learning
POST /api/prediction/test-scenarios/from-learning
{
  learning_id: string;
  include_variations?: boolean;
}

// Generate scenario from missed opportunity
POST /api/prediction/test-scenarios/from-missed
{
  missed_opportunity_id: string;
  include_variations?: boolean;
}
```

### 18.2 Test Article Endpoints

```typescript
// Create test article (manual)
POST /api/prediction/test-articles
{
  title: string;
  content: string;
  target_symbols: string[];
  intended_sentiment: 'bullish' | 'bearish' | 'neutral' | 'mixed';
  intended_strength: 'strong' | 'moderate' | 'weak';
}

// Generate test article (AI)
POST /api/prediction/test-articles/generate
{
  target_symbols: string[];
  scenario_type: string;
  sentiment: 'bullish' | 'bearish' | 'neutral' | 'mixed';
  strength: 'strong' | 'moderate' | 'weak';
  custom_prompt?: string;
}
```

### 18.3 Test Price Endpoints

```typescript
// Set test price
POST /api/prediction/test-prices
{
  symbol: string;  // Must be T_ prefixed
  price: number;
  volume?: number;
  simulated_at?: string;  // Defaults to now
}

// Bulk set test prices (for scenario)
POST /api/prediction/test-prices/bulk
{
  prices: Array<{
    symbol: string;
    price: number;
    simulated_at: string;
  }>;
}
```

### 18.4 Learning Promotion Endpoints

```typescript
// Get test learnings ready for promotion
GET /api/prediction/learnings/promotion-candidates
{
  min_times_applied?: number;
  min_success_rate?: number;
}

// Promote learning to production
POST /api/prediction/learnings/:id/promote
{
  reviewer_notes?: string;
}
```

---

## 19. UI Considerations

### 19.1 Test Mode Indicator

All UI screens should clearly indicate when viewing/working with test data:
- Visual badge: "TEST MODE" in orange/yellow
- Filter toggle: "Show Test Data" / "Production Only"
- Clear labeling of `T_` targets

### 19.2 Test Scenario Builder

Dedicated interface for creating test scenarios:
1. Select test targets
2. Create/select test articles
3. Define price movements timeline
4. Set expected outcomes
5. Run scenario and view results

### 19.3 Learning Promotion Queue

Dashboard for reviewing test learnings:
1. List of promotion candidates
2. Validation metrics for each
3. Test prediction history
4. Approve/Reject actions
5. Notes field for reviewer

### 19.4 Test vs. Production Analytics

Side-by-side comparison:
- Test prediction accuracy vs. production
- Learning velocity (test vs. real)
- Predictor discovery rate
- Context update frequency

### 19.5 Screen Map (Web App)

These screens are the minimum UI surface area required to satisfy the workflow end-to-end. Each screen must support:
- Clear **TEST MODE** indicator when viewing test data
- RBAC gating per Section 11
- Drill-down by `scenario_run_id` for traceability

| Screen ID | Name | Primary Users | Purpose |
|----------|------|---------------|---------|
| **SCR-001** | Test Control Center | Tester, Analyst, Reviewer, Admin | Entry point for test workflows and quick status |
| **SCR-002** | Targets & Mirrors | Admin | View real targets and their `T_` mirrors; verify auto-creation |
| **SCR-003** | Synthetic Articles Library | Tester, Analyst | Create/generate/edit synthetic articles; enforce guardrails |
| **SCR-004** | Test Price Timeline | Tester, Analyst | Create/edit test price series for `T_` targets |
| **SCR-005** | Scenario Builder | Tester, Analyst | Assemble scenario from targets + articles + prices + expected outcome |
| **SCR-006** | Scenario Run Detail | Tester, Analyst, Reviewer | View run status/results, artifacts, and evaluation |
| **SCR-007** | Learnings: Validation & Promotion | Reviewer, Admin | Promotion candidates, validation metrics, approve/reject |
| **SCR-008** | Backtests | Reviewer, Admin | Configure/run backtests and view results |
| **SCR-009** | Audit Log | Admin | Trace “who did what” across scenario creation/runs/promotions |
| **SCR-010** | Analytics Split | Analyst, Admin | Test vs prod metrics split; scenario effectiveness |

### 19.6 Screen Specifications (Acceptance Criteria)

#### SCR-001: Test Control Center

- **Must show**
  - Count of scenarios by status (draft/active)
  - Recent scenario runs (last N) with status (running/completed/failed) and links
  - Promotion queue backlog count
  - Storage/retention warnings (from v_test_data_stats or equivalent)
- **Must allow**
  - Quick action: “Create Scenario”, “Run Scenario”, “View Promotion Queue”
- **Must enforce**
  - Users without `view_test_data` never see test content

#### SCR-005: Scenario Builder

- **Inputs**
  - Select test targets (must be `T_` prefixed)
  - Attach synthetic articles (or create inline)
  - Define price movements (relative time: `T-1d`, `T+2h`, etc.)
  - Expected outcome (direction, magnitude, outcome time)
- **Validation**
  - Blocks save/run if any target lacks `T_` prefix
  - Blocks save/run if any article lacks synthetic marker or contains real symbols
  - Shows computed timeline after time resolution
- **Actions**
  - Save as draft/active, run now (creates scenario_run)

#### SCR-006: Scenario Run Detail

- **Must show**
  - Run metadata: `scenario_version`, `anchor_time`, `time_mode`, `runner_type`, `pipeline_revision`
  - Expected vs actual outcome
  - Links/tables for signals, predictors, predictions, evaluations, learnings created
  - Any violations (e.g., blocked leakage) surfaced as errors
- **Must allow**
  - Replay run (deterministic replay config)
  - Compare run vs another run (same scenario, different variation)

#### SCR-007: Learnings: Validation & Promotion

- **Must show**
  - Candidate list from `GET /api/prediction/learnings/promotion-candidates`
  - Validation metrics + backtest status
  - Lineage: source scenario run + (optional) source real event
- **Must enforce**
  - Reviewer must not be the learning author
  - Reviewer notes required
  - Promotion creates a new production learning; original test learning preserved

#### SCR-009: Audit Log

- **Must show**
  - Filter by action (create_scenario/run_scenario/promote_learning/etc.)
  - Filter by resource (scenario, run, learning)
  - Exportable view for compliance reviews

---

## 20. Testing Strategy

### 20.1 Principles

- **Fail closed**: production views/endpoints must exclude `is_test=true` unless explicitly authorized
- **Test the invariants**: treat INV-01..INV-11 as first-class test targets
- **Prefer end-to-end coverage**: validate the full loop (scenario → run → artifacts → evaluation → learning → promotion gates)

### 20.2 Backend / API Testing

- **Unit tests**: services for scenario creation, injection, validation metrics, and promotion gates
- **DB tests**: verify triggers/constraints for `is_test` propagation and `T_` isolation rules
- **API E2E tests**: exercise scenario run + promotion flows under RBAC, including audit logging

### 20.3 Frontend Testing

- **Unit/component tests**: Test Mode indicator, toggles, form validation, and RBAC-driven UI behavior
- **Contract tests**: stable request/response shapes for scenario runs, promotion queue, and analytics split

### 20.4 End-to-End Testing

Core journeys:
- Create scenario → run → view results
- Generate synthetic test article → ensure synthetic marker + `T_` enforcement
- Review + promote learning (role gated) → confirm lineage + audit log entry
- Regression: production views never show `is_test=true` artifacts by default

### 20.4.1 Playwright E2E (Primary)

**Playwright is the primary end-to-end test framework** for the web app.

- **Config file**: `apps/web/playwright.config.ts`
- **Test location**: `apps/web/tests/e2e/**`
- **Default base URL**: `http://localhost:6101` (set by Playwright config; override with `BASE_URL`)

Run commands:

```bash
# From repo root
cd apps/web
npm run build:check

# Run Playwright E2E tests (uses webServer: npm run dev:http)
npx playwright test

# Or (override base URL)
BASE_URL=http://localhost:6101 npx playwright test
```

**Initial Playwright test suite (must-have)**

1. **Test Mode UI isolation**
   - Verify the UI defaults to production-only view
   - Enable test mode (authorized user) and verify the TEST MODE indicator appears
   - Disable test mode and confirm test-only artifacts are no longer visible

2. **Scenario authoring + run happy path**
   - Create a test scenario for a mirrored target (`T_AAPL`)
   - Run scenario
   - Confirm a scenario run result is displayed and linked artifacts are visible

3. **Synthetic article guardrails**
   - Create/generate a synthetic article
   - Validate it includes the synthetic marker and only references `T_` targets

4. **Promotion queue (RBAC + audit)**
   - As Reviewer/Admin, view promotion candidates
   - Promote a learning and confirm reviewer notes required
   - Confirm audit/lineage details are visible in the UI

5. **Regression: production safety**
   - Confirm production screens never show `is_test=true` results without an explicit, authorized toggle

**Notes**
- Cypress may remain useful for component tests, but **Playwright is the single source of truth for E2E** for this initiative.

### 20.4.2 Playwright Test Matrix (Minimum Required)

Each Playwright test should map to a screen + scenario ID(s) + invariants.

| Playwright ID | What it tests | Screens | Scenarios | Invariants |
|--------------|---------------|---------|-----------|------------|
| **PW-001** | Test mode default is production-only | SCR-001, SCR-010 | N/A | INV-01 |
| **PW-002** | Enable test mode (authorized) shows TEST MODE banner | SCR-001 | N/A | INV-01 |
| **PW-003** | Scenario builder blocks non-`T_` targets | SCR-005 | SCN-011 | INV-08 |
| **PW-004** | Create/run scenario happy path and view artifacts | SCR-005, SCR-006 | SCN-001 | INV-02..INV-04, INV-10 |
| **PW-005** | Synthetic article guardrails enforced | SCR-003, SCR-005 | SCN-011 | INV-08 |
| **PW-006** | Promotion queue RBAC + required notes | SCR-007 | SCN-012 | INV-07, INV-09 |
| **PW-007** | Backtest gating blocks promotion on fail | SCR-008, SCR-007 | SCN-013 | INV-07 |
| **PW-008** | Audit log records scenario run + promotion | SCR-009 | SCN-012 | INV-07 |
| **PW-009** | Mirror exists for real target (visibility check) | SCR-002 | SCN-014 | INV-11 |

### 20.5 User / Acceptance Tests

Short, repeatable checklists for:
- Scenario authoring usability (speed, clarity, error messages)
- Trust & safety (no leakage, clear labeling, auditability)
- Reviewer workflow (promotion gating + backtest gating)

### 20.6 Claude Code Extension Testing

The Claude Code VS Code extension will be the primary tool for interactive user acceptance testing. This provides:

**Advantages:**
- Natural language interaction for scenario creation and validation
- Real-time feedback during test runs
- Easy exploration of test results and learnings
- Guided workflows for promotion review

**Test Workflows via Claude Code:**

1. **Scenario Creation Flow**
   ```
   User: "Create a test scenario for T_AAPL with an earnings beat article"
   Claude: [Creates scenario via API, shows config, asks for adjustments]
   User: "Run it and show me the results"
   Claude: [Triggers scenario run, monitors status, displays outcomes]
   ```

2. **Learning Review Flow**
   ```
   User: "Show me test learnings ready for promotion"
   Claude: [Queries promotion-candidates endpoint, displays with metrics]
   User: "What's the backtest result for learning X?"
   Claude: [Fetches backtest, explains results, recommends action]
   ```

3. **Invariant Validation Flow**
   ```
   User: "Verify that production endpoints don't show test data"
   Claude: [Queries both modes, compares, confirms isolation]
   ```

**Scripted Test Sessions:**
- Create reusable Claude Code prompts that walk through key test journeys
- Record transcripts for regression and documentation
- Use for demos and stakeholder reviews

#### 20.6.1 Claude Code (Chrome extension) UI Test Harness

We will use the **Claude Code Chrome extension** to drive the UI directly, acting as a “human-in-the-loop automation layer”:
- Navigate to screens (SCR-001..SCR-010)
- Fill forms and submit actions (create articles, scenarios, runs, promotions)
- Capture evidence (IDs, visible UI text, screenshots) into saved transcripts

This complements Playwright:
- **Playwright**: deterministic automated regression
- **Claude Code Chrome**: fast interactive “build the test cases while exploring the product” + acceptance

##### Required capabilities (minimum)

| Capability | Requirement |
|-----------|-------------|
| Navigation | Open app, visit routes, and confirm correct page via sentinel UI elements |
| Interaction | Type, click, select, add rows to tables (prices/articles), submit forms |
| Verification | Read page content and extract IDs (`scenario_id`, `scenario_run_id`, `learning_id`) |
| Evidence | Capture a transcript containing steps + copied UI evidence; attach screenshots when possible |
| RBAC awareness | Attempt actions as different roles and assert correct allow/deny behavior |

#### 20.6.2 Screen Route Map (Required for Claude Chrome + Playwright)

Each screen MUST have a stable route so that tests can navigate directly without relying on brittle menu clicks.

**Route conventions**
- All test UI routes live under `/test/*`
- Detail pages use stable URL params for IDs (`:scenarioId`, `:runId`, etc.)

| Screen | Route | Sentinel UI elements (Claude must confirm) |
|--------|-------|-------------------------------------------|
| SCR-001 Test Control Center | `/test` | Header “Test Control Center”; TEST MODE toggle; recent runs list |
| SCR-002 Targets & Mirrors | `/test/targets` | Header “Targets & Mirrors”; table with Real + T_ symbols |
| SCR-003 Synthetic Articles Library | `/test/articles` | Header “Synthetic Articles”; “Create Article” button |
| SCR-004 Test Price Timeline | `/test/prices` | Header “Test Prices”; timeline/table editor for `T_` symbols |
| SCR-005 Scenario Builder | `/test/scenarios/new` | Header “Scenario Builder”; Save + Run buttons |
| SCR-006 Scenario Run Detail | `/test/runs/:runId` | Header “Scenario Run”; run status pill; shows `scenario_run_id` |
| SCR-007 Learnings: Validation & Promotion | `/test/learnings/promotion` | Header “Promotion Candidates”; reviewer notes input |
| SCR-008 Backtests | `/test/backtests` | Header “Backtests”; create/run backtest CTA |
| SCR-009 Audit Log | `/test/audit` | Header “Test Audit Log”; filters (action/resource) |
| SCR-010 Analytics Split | `/test/analytics` | Header “Test vs Production”; side-by-side metrics |

**Hard requirement**: if a screen is renamed, the sentinel elements must remain stable or tests must be updated in the same change.

#### 20.6.3 Claude Chrome “User Test Script” Template

Each scripted session must be saved as a transcript and include:
- The PW test ID(s) covered (PW-xxx)
- The scenario ID(s) used (SCN-xxx)
- The invariants asserted (INV-xx)
- The IDs created during the session (`scenario_id`, `scenario_run_id`, `learning_id`)
- Pass/fail result with evidence

Template:

1. **Open**: Go to SCR-001 (`/test`). Confirm sentinel UI.
2. **Set Mode**: Ensure test mode is ON (authorized user) and the TEST MODE badge is visible.
3. **Create Inputs**:
   - Go to SCR-003 (`/test/articles`) and create a synthetic article for the chosen SCN-xxx.
   - Go to SCR-004 (`/test/prices`) and create a minimal price timeline if required.
4. **Create Scenario**:
   - Go to SCR-005 (`/test/scenarios/new`), assemble scenario, save, and capture `scenario_id`.
5. **Run Scenario**:
   - Click Run; capture `scenario_run_id`.
   - Navigate to SCR-006 (`/test/runs/:runId`) and confirm run completes.
6. **Verify Artifacts**:
   - Confirm expected artifacts exist and all are `is_test=true`.
   - Confirm no production-only screens show these artifacts when test mode is off.
7. **Promotion Flow (if applicable)**:
   - Go to SCR-007 (`/test/learnings/promotion`), find the learning, and attempt promote.
   - Assert gates (notes required, reviewer != author, backtest gating) and capture outcomes.
8. **Audit Evidence**:
   - Go to SCR-009 (`/test/audit`), filter for your run/promotion, and capture evidence.
9. **Record Outcome**:
   - Summarize PASS/FAIL and attach key UI evidence (IDs + screenshots/quoted text).

#### 20.6.4 Claude Chrome Scripts Mapped to PW Tests

| PW Test | Claude Chrome Script Focus |
|--------|-----------------------------|
| PW-001/002 | Navigate to SCR-001; verify default prod-only view; toggle test mode (RBAC) |
| PW-004 | Full SCN-001 happy path: article + prices + scenario + run + run detail verification |
| PW-006/007 | Promotion workflow: candidates → backtest → promote/reject with RBAC and notes |
| PW-008 | Audit proof: confirm audit events for run + promotion are visible and filterable |

### 20.7 Definition of Done (Workflow Complete)

The prediction test-based learning loop is considered complete when:
- All scenarios SCN-001..SCN-014 can be executed end-to-end.
- All Playwright tests PW-001..PW-009 are green in CI (or in the standard test run).
- All invariants INV-01..INV-11 have at least one automated test (DB/API/Playwright).
- A Reviewer can promote a learning only after validation + backtest gates, and the UI shows full lineage and audit trail.

---

## Appendix A: Environment Variables

```bash
# Test Infrastructure
TEST_MODE_ENABLED=true
TEST_INPUT_MODE=db  # DB-backed synthetic inputs (no external test URLs)

# Test Defaults
TEST_TARGET_PREFIX=T_
TEST_ARTICLE_GENERATION_MODEL=claude-3-haiku
```

---

## Appendix B: Related Documents

- [Prediction System Detailed PRD](./2026-01-08-prediction-system-detailed.md)
- [Financial Asset Predictor](./2026-01-10-financial-asset-predictor.md)
