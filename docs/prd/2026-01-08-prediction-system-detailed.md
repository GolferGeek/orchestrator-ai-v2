# Prediction System Redesign - Detailed PRD

**Date:** January 8, 2026
**Status:** Draft
**Author:** Architecture Discussion

---

## Table of Contents

1. [Overview](#1-overview)
2. [Terminology](#2-terminology)
3. [Architecture](#3-architecture)
   - 3.4 [Processing Flow](#34-processing-flow)
   - 3.5 [Integration with Existing Architecture](#35-integration-with-existing-architecture)
4. [Database Schema](#4-database-schema)
   - 4.4 [Data Validation Rules](#44-data-validation-rules)
   - 4.5 [Row Level Security Policies](#45-row-level-security-policies)
5. [Processing Pipeline](#5-processing-pipeline)
   - 5.6 [Error Handling & Retry Logic](#56-error-handling--retry-logic)
   - 5.7 [Edge Cases & Race Conditions](#57-edge-cases--race-conditions)
6. [AI Analysts System](#6-ai-analysts-system)
7. [Multi-LLM Evaluation](#7-multi-llm-evaluation)
8. [Human-in-the-Loop](#8-human-in-the-loop)
9. [Learning System](#9-learning-system)
10. [Source Management](#10-source-management)
    - 10.4 [Source Crawling Schedule & Triggers](#104-source-crawling-schedule--triggers)
    - 10.5 [Signal Creation & Deduplication](#105-signal-creation--deduplication)
11. [Investment Strategies](#11-investment-strategies)
    - 11.4 [Target Snapshot Creation](#114-target-snapshot-creation)
12. [Explainability](#12-explainability)
13. [Missed Opportunity Analysis](#13-missed-opportunity-analysis)
14. [Cron Jobs & Scheduling](#14-cron-jobs--scheduling)
15. [Notifications & Streaming](#15-notifications--streaming)
16. [UI Specifications](#16-ui-specifications)
17. [API Specifications](#17-api-specifications)
    - 17.3 [A2A Protocol Integration](#173-a2a-protocol-integration)
18. [Migration from Existing Prediction System](#18-migration-from-existing-prediction-system)
19. [User Guidance & Onboarding](#19-user-guidance--onboarding)
20. [LLM Cost Tracking](#20-llm-cost-tracking)
21. [Competitive Differentiation](#21-competitive-differentiation)
22. [Performance & Scalability Requirements](#22-performance--scalability-requirements)
23. [Cost Management & Limits](#23-cost-management--limits)

---

## 1. Overview

### 1.1 Purpose

Redesign the prediction system to support:
- Multi-domain predictions (stocks, crypto, elections, polymarket)
- Multi-perspective AI evaluation (analysts/personalities)
- Multi-LLM comparison (Gold/Silver/Bronze tiers)
- Continuous learning with human oversight
- Full prediction transparency and explainability
- User-configurable investment strategies

### 1.2 Goals

1. **Accuracy**: Improve prediction accuracy through ensemble evaluation
2. **Transparency**: Users understand exactly why predictions were made
3. **Adaptability**: System learns from outcomes and user feedback
4. **Flexibility**: Support different domains and investment philosophies
5. **Scalability**: Handle many targets and sources efficiently

### 1.3 Non-Goals

- Real-time trading execution
- Portfolio management
- Tax reporting
- Direct brokerage integration

---

## 2. Terminology

### 2.1 Core Terms

| Term | Definition |
|------|------------|
| **Target** | What we're predicting about (replaces "instrument"). A stock, crypto, election, polymarket contract. |
| **Signal** | Raw event from a source. May or may not be meaningful. |
| **Predictor** | A validated signal that has been assessed as meaningful, with strength and direction. |
| **Prediction** | An actual forecast generated when enough predictors accumulate. |
| **Universe** | A user's collection of targets, associated with one agent. |
| **Domain** | Category of targets: stocks, crypto, elections, polymarket. |
| **Analyst** | An AI personality with a specific perspective and expertise. |
| **Strategy** | An investment philosophy that configures thresholds and analyst weights. |
| **Learning** | A piece of knowledge extracted from outcomes that improves future predictions. |

### 2.2 Signal Dispositions

| Disposition | Meaning |
|-------------|---------|
| `pending` | Just arrived, not yet evaluated |
| `promoted` | Became a predictor |
| `queued_for_review` | Needs human review (confidence 0.4-0.7) |
| `discarded` | Not a predictor |
| `expired` | Too old, never processed |

### 2.3 Predictor Statuses

| Status | Meaning |
|--------|---------|
| `active` | Available for prediction generation |
| `consumed` | Used in a prediction |
| `expired` | Too old to use |
| `invalidated` | Manually invalidated |

### 2.4 Prediction Statuses

| Status | Meaning |
|--------|---------|
| `active` | Waiting for resolution |
| `resolved` | Outcome determined |
| `expired` | Timeframe passed without clear resolution |
| `cancelled` | Manually cancelled |

---

## 3. Architecture

### 3.1 System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA SOURCES                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STRUCTURED (APIs)                    UNSTRUCTURED (Firecrawl)             │
│  ┌─────────────────────┐              ┌─────────────────────┐              │
│  │ Polygon (prices)    │              │ User-defined URLs   │              │
│  │ CoinGecko (crypto)  │              │ News sites, blogs   │              │
│  │ Technical calc      │              │ SEC filings         │              │
│  │ Options flow        │              │ Social media        │              │
│  └──────────┬──────────┘              └──────────┬──────────┘              │
│             │                                    │                          │
│             └────────────────┬───────────────────┘                          │
│                              │                                              │
│                              ▼                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         SIGNAL POOL                                   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                              │                                              │
│              ┌───────────────┼───────────────┐                             │
│              ▼               ▼               ▼                              │
│         ┌────────┐     ┌──────────┐    ┌─────────┐                        │
│         │ URGENT │     │ NOTABLE  │    │ ROUTINE │                        │
│         │ (≥0.90)│     │ (≥0.70)  │    │ (<0.70) │                        │
│         └───┬────┘     └────┬─────┘    └────┬────┘                        │
│             │               │               │                              │
│             │               ▼               ▼                              │
│             │         ┌──────────────────────────┐                         │
│             │         │    PREDICTOR POOL        │                         │
│             │         └────────────┬─────────────┘                         │
│             │                      │                                        │
│             │    ┌─────────────────┴─────────────────┐                     │
│             │    │     THRESHOLD CHECK (batch)       │                     │
│             │    └─────────────────┬─────────────────┘                     │
│             │                      │                                        │
│             ▼                      ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    PREDICTION GENERATION                             │   │
│  │           (Multi-analyst, Multi-LLM evaluation)                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    OUTCOME TRACKING                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                EVALUATION & LEARNING                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │              MISSED OPPORTUNITY DETECTION                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    CONTEXT UPDATES                                   │   │
│  │            (Learnings → Review → Apply)                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Context Hierarchy

```
Runner Level (global)
├── Default thresholds, rules, learnings
├── System analysts (Base Analyst)
└── Applies to: Everything

Domain Level (stocks, crypto, elections, polymarket)
├── Domain-specific thresholds, rules, learnings
├── Domain analysts (Technical Tina for stocks)
└── Applies to: All targets in domain

Universe Level (user's agent)
├── User's custom thresholds, rules, learnings
├── User's custom analysts
├── Strategy assignment
└── Applies to: All targets in this universe

Target Level (specific asset)
├── Target-specific thresholds, rules, learnings
├── Target-specific analysts (Supply Chain Steve for AAPL)
└── Applies to: Just this target

Analyst Level (individual personality)
├── Analyst's perspective and instructions
├── Analyst's learned patterns
└── Applies to: This analyst's evaluations
```

### 3.3 Processing Tiers

| Tier | Name | AI Involved | Contexts Read |
|------|------|-------------|---------------|
| 1 | Signal Detection | Yes | Target, Domain, Runner |
| 2 | Predictor Management | Optional (conflicts) | Target, Universe |
| 3 | Prediction Generation | Yes | All levels |
| 4 | Outcome Tracking | No | — |
| 5 | Evaluation | Yes | All levels |
| 6 | Missed Opportunity | Yes | All levels |

### 3.4 Processing Flow

The prediction system processes data through a sequential pipeline:

```
1. Source Crawling (Scheduled)
   └─> Creates Signals (raw events)

2. Signal Detection (Tier 1)
   └─> AI evaluates if signal is meaningful
   └─> Creates Predictors (validated signals)

3. Predictor Management (Tier 2)
   └─> Checks if enough predictors accumulated
   └─> Resolves conflicts between predictors

4. Prediction Generation (Tier 3)
   └─> Multi-analyst, multi-LLM evaluation
   └─> Creates Prediction with explainability snapshot

5. Outcome Tracking (Tier 4)
   └─> Monitors target value changes
   └─> Resolves predictions when outcome determined

6. Evaluation (Tier 5)
   └─> Scores prediction accuracy
   └─> Generates learnings from outcomes

7. Missed Opportunity Analysis (Tier 6)
   └─> Detects significant moves not predicted
   └─> Retroactively researches causes
   └─> Suggests source/tool improvements
```

**Fast Path**: Signals with urgency ≥0.90 skip batch processing and go directly to prediction generation.

**Batch Processing**: Lower urgency signals are processed in batches every 15-30 minutes.

### 3.5 Integration with Existing Architecture

The prediction system **MUST** integrate with existing Orchestrator AI infrastructure rather than creating parallel systems.

#### 3.5.1 ExecutionContext Usage

**All LLM calls** MUST use ExecutionContext (not custom context objects). ExecutionContext is the "capsule" that flows through the entire system.

```typescript
interface ExecutionContext {
  orgSlug: string;           // Organization identifier
  userId: string;            // User identifier
  conversationId: string;    // Conversation identifier
  taskId: string;            // Task identifier (created per prediction)
  planId: string;            // NIL_UUID if no plan
  deliverableId: string;     // NIL_UUID if no deliverable
  agentSlug: string;         // Which analyst/agent is running
  agentType: string;         // 'context' for analysts
  provider: string;          // LLM provider ('anthropic', 'openai', 'ollama')
  model: string;             // LLM model identifier
}
```

**Key Principles**:
- ExecutionContext is created by frontend, flows through system unchanged
- Backend only mutates: `taskId`, `deliverableId`, `planId` when first created
- Uses NIL_UUID (`'00000000-0000-0000-0000-000000000000'`) for non-existent entities
- For multi-LLM evaluation: Create separate ExecutionContext instances per LLM tier, but maintain same `taskId`/`conversationId` for correlation
- Cost tracking happens automatically via LLMService → LLMPricingService using ExecutionContext

```typescript
// Example: Creating tier-specific ExecutionContext for multi-LLM evaluation
async function createTierContext(
  baseContext: ExecutionContext,
  tier: 'gold' | 'silver' | 'bronze',
  analyst: Analyst,
  options: { universeId: string; stage: 'signal_detection' | 'prediction' | 'evaluation' | 'miss_analysis' }
): ExecutionContext {
  // NOTE: Tier resolution MUST come from explicit configuration (agent metadata / universe / target).
  // If a provider/model cannot be resolved unambiguously, resolveTier MUST throw (no silent defaults).
  const tierModel = await llmTierResolver.resolveTier(tier, undefined, options.universeId);
  return {
    ...baseContext,                          // Preserve taskId, conversationId, planId/deliverableId, etc.
    provider: tierModel.provider,            // Override provider for tier
    model: tierModel.model,                  // Override model for tier
    // For internal LLM calls, agentSlug MAY be set to the analyst slug for attribution.
    // IMPORTANT: Do not use tier contexts for task routing; only for internal LLM call tracing.
    agentSlug: analyst.slug,
    agentType: 'context'
  };
}
```

#### 3.5.2 Observability & Streaming

**Use ObservabilityEventsService.emit()** for all progress updates (not custom WebSocket).

**Use existing SSE endpoint**: `GET /agent-to-agent/:orgSlug/:agentSlug/tasks/:taskId/stream`

```typescript
// Emit progress during signal processing
observabilityService.emit({
  context: executionContext,
  hook_event_type: 'agent.stream.chunk',
  message: `Evaluating signal ${signal.id} with ${analysts.length} analysts`,
  step: 'signal_detection',
  progress: 10,
  metadata: {
    type: 'prediction_progress',
    signalId: signal.id,
    targetId: target.id,
    tier: 'signal_detection'
  }
});

// Event types to emit:
// - agent.stream.chunk: Signal processing, predictor creation, prediction generation
// - agent.stream.complete: Prediction finalized
// - agent.stream.error: Processing failures
```

**Progress Metadata Schema**:
```typescript
interface PredictionProgressMetadata {
  type: 'prediction_progress';
  signalId?: string;
  predictorId?: string;
  predictionId?: string;
  targetId: string;
  tier: 'signal_detection' | 'predictor_management' | 'prediction_generation' | 'evaluation';
  llmTier?: 'gold' | 'silver' | 'bronze';
  analystSlug?: string;
}
```

#### 3.5.3 A2A Protocol Compliance

Prediction analysts **MUST** be registered as A2A agents in `public.agents` table.

**Transport Types Requirement**: All A2A requests/responses MUST use types from `@orchestrator-ai/transport-types`:

```typescript
// ✅ CORRECT: Use transport types
import {
  A2ATaskRequest,
  A2ATaskSuccessResponse,
  A2ATaskErrorResponse,
  TaskRequestParams,
  TaskResponse,
  ExecutionContext,
  AgentTaskMode
} from '@orchestrator-ai/transport-types';

// ❌ WRONG: Custom request/response structures
// Do NOT create custom A2A request/response types
// Do NOT deviate from transport types structure
```

**Required Structure**:
- All requests: `A2ATaskRequest` with `jsonrpc: "2.0"`, `method`, `id`, `params: TaskRequestParams`
- All success responses: `A2ATaskSuccessResponse` with `jsonrpc: "2.0"`, `id`, `result: TaskResponse`
- All error responses: `A2ATaskErrorResponse` with `jsonrpc: "2.0"`, `id`, `error: { code, message, data? }`
- `params.context: ExecutionContext` is REQUIRED in all requests
- `params.mode: AgentTaskMode` is REQUIRED in all requests
- `params.userMessage: string` is REQUIRED (can be empty string)
- `result.payload: { content: any, metadata: Record<string, any> }` is REQUIRED in all responses

Each analyst has its own agent record:
```sql
INSERT INTO public.agents (
  slug,
  organization_slug,
  name,
  agent_type,
  llm_config,
  metadata
) VALUES (
  'technical-tina',
  ARRAY['global'],  -- Available to all orgs, or specific org slugs
  'Technical Tina',
  'context',        -- Analysts are LLM-based context agents
  '{"provider": "anthropic", "model": "claude-sonnet-4-20250514"}',
  '{
    "runnerConfig": {
      "analystType": "domain",
      "domain": "stocks",
      "activeTiers": ["signal_detection", "prediction", "evaluation"],
      "defaultWeight": 1.0
    }
  }'
);
```

**Benefits of A2A registration**:
- Analysts can be invoked via A2A protocol: `POST /agent-to-agent/:orgSlug/:analyst-slug/tasks`
- Proper observability and cost tracking per analyst
- Agent discovery via `GET /agent-to-agent/.well-known/hierarchy`
- **Type safety**: Use `@orchestrator-ai/transport-types` for all A2A requests/responses

**Transport Types Usage**:
```typescript
// Backend implementation MUST use transport types
import {
  A2ATaskRequest,
  A2ATaskSuccessResponse,
  TaskRequestParams,
  TaskResponse,
  ExecutionContext
} from '@orchestrator-ai/transport-types';

// Controller validates request structure matches A2ATaskRequest
// Service returns TaskResponse structure
// Response is wrapped in A2ATaskSuccessResponse
```
- Consistent authentication and authorization

#### 3.5.4 LLM Tier Mapping to Existing Infrastructure

**DO NOT CREATE** `prediction_llm_tiers` table. **USE existing** `llm_models` table with `model_tier` column.

**Tier Mapping**:
| Prediction Tier | `llm_models.model_tier` | Example Model |
|-----------------|-------------------------|---------------|
| Gold | `flagship` | `claude-opus-4-5-20251101` |
| Silver | `standard` | `claude-sonnet-4-20250514` |
| Bronze | `economy` or `local` | `llama3.3` (Ollama) |

**Database VIEW** (see Section 4 for full definition):
```sql
-- prediction.llm_tier_mapping maps llm_models.model_tier to prediction tiers:
-- flagship -> gold, standard -> silver, economy/local -> bronze
-- Full CREATE VIEW statement in Section 4.3 (LLM Tier Mapping)
```

**Tier Resolution Service**:
```typescript
interface LLMTierResolver {
  /**
   * Resolve Gold/Silver/Bronze tier to actual provider/model
   * Uses llm_models table with model_tier mapping
   */
  resolveTier(
    tier: 'gold' | 'silver' | 'bronze',
    provider?: string,         // Optional: filter by provider
    universeId?: string        // Optional: check universe-specific config
  ): Promise<{ provider: string; model: string; pricing: PricingInfo }>;
}
```

#### 3.5.5 Agent Metadata Configuration

LLM tier combinations stored in `public.agents.metadata` for each prediction agent:

```json
{
  "runnerConfig": {
    "universeId": "uuid-of-linked-universe",
    "llmTiers": {
      "signal_detection": {
        "gold": {"provider": "anthropic", "model": "claude-opus-4-5-20251101", "enabled": false},
        "silver": {"provider": "anthropic", "model": "claude-sonnet-4-20250514", "enabled": true},
        "bronze": {"provider": "ollama", "model": "llama3.3", "enabled": true}
      },
      "prediction": {
        "gold": {"provider": "anthropic", "model": "claude-opus-4-5-20251101", "enabled": true},
        "silver": {"provider": "anthropic", "model": "claude-sonnet-4-20250514", "enabled": true},
        "bronze": {"enabled": false}
      },
      "evaluation": {
        "gold": {"enabled": true},
        "silver": {"enabled": true},
        "bronze": {"enabled": false}
      }
    }
  }
}
```

**Resolution Priority**:
1. Target-level `llm_config_override` (most specific)
2. Universe-level `llm_config`
3. Agent metadata `runnerConfig.llmTiers`
4. Default tier mapping from `public.llm_models` table (**only if explicitly enabled**; otherwise the system MUST error)

#### 3.5.6 Cost Tracking Integration

All LLM calls automatically tracked via existing infrastructure:
- **LLMService** → **LLMPricingService** → **llm_usage** table
- ExecutionContext.taskId used for correlation
- Costs calculated from `llm_models.pricing_info_json`

**Per-Prediction Cost Query**:
```sql
SELECT
  SUM(cost) as total_cost,
  COUNT(*) as llm_calls,
  jsonb_object_agg(
    lm.model_tier,
    jsonb_build_object('cost', SUM(lu.cost), 'calls', COUNT(*))
  ) as costs_by_tier
FROM public.llm_usage lu
JOIN public.llm_models lm ON (lu.provider = lm.provider_name AND lu.model = lm.model_name)
WHERE lu.task_id = 'prediction-task-id'
GROUP BY lu.task_id;
```

---

## 4. Database Schema

### 4.1 Core Tables

**IMPORTANT**: All tables are created in the `prediction` schema, not `public`.

```sql
-- Create schema
CREATE SCHEMA IF NOT EXISTS prediction;

-- ============================================
-- UNIVERSES (Agent scope)
-- ============================================
CREATE TABLE prediction.universes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Multi-tenant (uses organization_slug like agents table)
  organization_slug TEXT NOT NULL REFERENCES public.organizations(slug),

  -- Link to prediction agent in public.agents
  agent_slug TEXT REFERENCES public.agents(slug),

  -- Identity
  name TEXT NOT NULL,
  description TEXT,

  -- Domain type with validation
  domain TEXT NOT NULL CHECK (domain IN ('stocks', 'crypto', 'elections', 'polymarket')),

  -- Strategy
  strategy_id UUID REFERENCES prediction.strategies(id),

  -- Default thresholds (can be overridden per target)
  default_signal_confidence_threshold DECIMAL(3,2) DEFAULT 0.70
    CHECK (default_signal_confidence_threshold BETWEEN 0.00 AND 1.00),
  default_prediction_threshold JSONB DEFAULT '{
    "min_predictors": 2,
    "min_combined_strength": 12,
    "min_direction_consensus": 0.60
  }',

  -- LLM tier configuration (which tiers are enabled for which processing stages)
  -- References llm_models via prediction.llm_tier_mapping view
  llm_config JSONB DEFAULT '{
    "signal_detection": {"gold": false, "silver": true, "bronze": true},
    "prediction": {"gold": true, "silver": true, "bronze": false},
    "evaluation": {"gold": true, "silver": true, "bronze": false},
    "miss_analysis": {"gold": true, "silver": false, "bronze": false}
  }',

  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Universe name must be unique within organization
  UNIQUE(organization_slug, name)
);

CREATE INDEX idx_universes_org ON prediction.universes(organization_slug);
CREATE INDEX idx_universes_agent ON prediction.universes(agent_slug);
CREATE INDEX idx_universes_active ON prediction.universes(is_active) WHERE is_active = true;

-- ============================================
-- TARGETS (What we predict about)
-- ============================================
CREATE TABLE prediction.targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  universe_id UUID NOT NULL REFERENCES prediction.universes(id) ON DELETE CASCADE,

  -- Identity
  symbol TEXT,                -- 'AAPL', 'BTC', null for elections
  name TEXT NOT NULL,         -- 'Apple Inc', 'Bitcoin', 'Georgia Senate 2026'
  external_id TEXT,           -- Polymarket contract ID, etc.

  -- Target type MUST match universe domain (enforced by trigger)
  -- IMPORTANT: Universe uses plural domain label `elections`, but target_type uses singular `election`.
  -- This is intentional and enforced via trigger mapping below.
  target_type TEXT NOT NULL CHECK (target_type IN ('stock', 'crypto', 'election', 'polymarket')),

  -- ===========================================
  -- CONTEXT: Target-specific knowledge for LLM
  -- ===========================================
  -- This is the primary way to provide target-specific context to analysts.
  -- Stored as markdown text, injected into analyst prompts.
  -- Examples:
  --   Stock: "Apple Inc (AAPL) - Consumer electronics and services. Key drivers: iPhone sales, Services revenue, China market."
  --   Crypto: "Bitcoin (BTC) - Store of value narrative. Watch: ETF flows, halving cycles, macro correlation."
  --   Election: "Georgia Senate 2026 - Incumbent: Jon Ossoff (D). Key factors: suburban turnout, Black voter engagement."
  context TEXT,

  -- Context metadata for management
  context_updated_at TIMESTAMPTZ,
  context_updated_by UUID REFERENCES public.users(id),

  -- Structured context supplements (optional, for tools)
  context_metadata JSONB DEFAULT '{}'::jsonb,
  -- {
  --   "sector": "technology",
  --   "marketCap": "large",
  --   "competitors": ["MSFT", "GOOGL"],
  --   "keyMetrics": ["iPhone units", "Services revenue"],
  --   "newsKeywords": ["apple", "iphone", "tim cook"],
  --   "dataSourcePriority": ["yahoo-finance", "sec-filings", "earnings-whispers"]
  -- }

  -- Override thresholds (null = use universe defaults)
  signal_confidence_threshold DECIMAL(3,2)
    CHECK (signal_confidence_threshold IS NULL OR signal_confidence_threshold BETWEEN 0.00 AND 1.00),
  prediction_threshold JSONB,

  -- Override LLM config (null = use universe defaults)
  llm_config_override JSONB,

  -- Tracking
  is_active BOOLEAN DEFAULT true,
  last_signal_at TIMESTAMPTZ,
  last_prediction_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Target name must be unique within universe
  UNIQUE(universe_id, name),
  -- Symbol must be unique within universe (if provided)
  UNIQUE(universe_id, symbol)
);

-- ============================================
-- DOMAIN ↔ TARGET_TYPE ENFORCEMENT (Trigger)
-- ============================================
-- Universe.domain → Target.target_type mapping:
-- - 'stocks'     → 'stock'
-- - 'crypto'     → 'crypto'
-- - 'elections'  → 'election'
-- - 'polymarket' → 'polymarket'
--
-- Additionally enforce required identity fields by type:
-- - stock/crypto: symbol is required
-- - election:     symbol MUST be NULL (use name for human-readable identity)
-- - polymarket:   external_id is required (contract id), symbol MAY be NULL
CREATE OR REPLACE FUNCTION prediction.enforce_target_domain_type()
RETURNS TRIGGER AS $$
DECLARE
  u_domain TEXT;
BEGIN
  SELECT domain INTO u_domain
  FROM prediction.universes
  WHERE id = NEW.universe_id;

  IF u_domain IS NULL THEN
    RAISE EXCEPTION 'Universe % not found for target', NEW.universe_id;
  END IF;

  -- Domain ↔ type compatibility
  IF NOT (
    (u_domain = 'stocks' AND NEW.target_type = 'stock') OR
    (u_domain = 'crypto' AND NEW.target_type = 'crypto') OR
    (u_domain = 'elections' AND NEW.target_type = 'election') OR
    (u_domain = 'polymarket' AND NEW.target_type = 'polymarket')
  ) THEN
    RAISE EXCEPTION 'Target type % is not compatible with universe domain %', NEW.target_type, u_domain;
  END IF;

  -- Required identity fields by target_type
  IF NEW.target_type IN ('stock', 'crypto') AND NEW.symbol IS NULL THEN
    RAISE EXCEPTION 'symbol is required for target_type %', NEW.target_type;
  END IF;

  IF NEW.target_type = 'election' AND NEW.symbol IS NOT NULL THEN
    RAISE EXCEPTION 'symbol must be NULL for target_type election';
  END IF;

  IF NEW.target_type = 'polymarket' AND NEW.external_id IS NULL THEN
    RAISE EXCEPTION 'external_id is required for target_type polymarket';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_target_domain_type ON prediction.targets;
CREATE TRIGGER trg_enforce_target_domain_type
BEFORE INSERT OR UPDATE ON prediction.targets
FOR EACH ROW EXECUTE FUNCTION prediction.enforce_target_domain_type();

CREATE INDEX idx_targets_universe ON prediction.targets(universe_id);
CREATE INDEX idx_targets_symbol ON prediction.targets(symbol) WHERE symbol IS NOT NULL;
CREATE INDEX idx_targets_active ON prediction.targets(is_active) WHERE is_active = true;
CREATE INDEX idx_targets_context_search ON prediction.targets USING gin(to_tsvector('english', context)) WHERE context IS NOT NULL;

-- ============================================
-- SOURCES (URLs to crawl)
-- ============================================
CREATE TABLE prediction.sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Scope
  scope_level TEXT NOT NULL
    CHECK (scope_level IN ('runner', 'domain', 'universe', 'target')),
  -- 'runner', 'domain', 'universe', 'target'
  domain TEXT,
  universe_id UUID REFERENCES prediction.universes(id),
  target_id UUID REFERENCES prediction.targets(id),

  -- Source definition
  name TEXT NOT NULL,
  url TEXT NOT NULL CHECK (url ~ '^https?://'),  -- Must be valid HTTP(S) URL
  source_type TEXT DEFAULT 'web' CHECK (source_type IN ('web', 'rss', 'twitter_search', 'api')),

  -- Crawl settings
  frequency_minutes INTEGER DEFAULT 15
    CHECK (frequency_minutes >= 5 AND frequency_minutes <= 1440),  -- 5 min to 24 hours
  crawl_config JSONB DEFAULT '{}',
  relevance_filter TEXT,                -- Keywords to filter

  -- Authentication for paywalled sources
  auth_config JSONB,
  -- {
  --   "type": "none" | "basic" | "cookie" | "api_key" | "bearer",
  --   "credentials_encrypted": "...",    -- AES-256 encrypted credentials
  --   "credential_hint": "user: j***@email.com"  -- Masked hint for UI
  -- }

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_crawl_at TIMESTAMPTZ,
  last_crawl_status TEXT,
  last_error TEXT,

  -- Stats
  total_crawls INTEGER DEFAULT 0,
  signals_generated INTEGER DEFAULT 0,
  predictors_generated INTEGER DEFAULT 0,

  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_source_scope CHECK (
    (scope_level = 'runner' AND domain IS NULL AND universe_id IS NULL AND target_id IS NULL) OR
    (scope_level = 'domain' AND domain IS NOT NULL AND universe_id IS NULL AND target_id IS NULL) OR
    (scope_level = 'universe' AND universe_id IS NOT NULL AND target_id IS NULL) OR
    (scope_level = 'target' AND target_id IS NOT NULL AND universe_id IS NULL)
  )
);

-- Sources indexes for common query patterns
CREATE INDEX idx_sources_scope_active ON prediction.sources(scope_level, is_active) WHERE is_active = true;
CREATE INDEX idx_sources_universe ON prediction.sources(universe_id) WHERE universe_id IS NOT NULL;
CREATE INDEX idx_sources_target ON prediction.sources(target_id) WHERE target_id IS NOT NULL;
CREATE INDEX idx_sources_crawl_schedule ON prediction.sources(frequency_minutes, last_crawl_at) WHERE is_active = true;

-- ============================================
-- SIGNALS (Raw events)
-- ============================================
CREATE TABLE prediction.signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id UUID REFERENCES prediction.targets(id) ON DELETE CASCADE,
  source_id UUID REFERENCES prediction.sources(id),

  -- What happened
  signal_type TEXT NOT NULL,            -- 'news', 'price', 'technical', 'sentiment', 'regulatory'
  source_name TEXT,
  source_url TEXT,
  raw_content JSONB NOT NULL,
  summary TEXT,

  -- Quick evaluation (for routing)
  urgency TEXT DEFAULT 'routine',       -- 'urgent', 'notable', 'routine'

  -- Optional direction hint (sentiment-based; enforced by trigger via target domain)
  direction TEXT,

  -- Full AI assessment (filled by batch or fast path)
  ai_is_predictor BOOLEAN,
  ai_confidence DECIMAL(3,2),
  ai_reasoning TEXT,

  -- Disposition
  disposition TEXT NOT NULL DEFAULT 'pending'
    CHECK (disposition IN ('pending', 'queued_for_review', 'promoted', 'discarded', 'expired')),
  -- 'pending', 'queued_for_review', 'promoted', 'discarded', 'expired'

  processing_path TEXT,                 -- 'fast', 'batch', 'review'
  promoted_to_predictor_id UUID,

  -- Race condition handling (for concurrent processing)
  processing_started_at TIMESTAMPTZ,
  processing_worker TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX idx_signals_pending ON prediction.signals(target_id, created_at)
  WHERE disposition = 'pending';
CREATE INDEX idx_signals_target ON prediction.signals(target_id, created_at DESC);

-- ============================================
-- PREDICTORS (Validated signals)
-- ============================================
CREATE TABLE prediction.predictors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id UUID REFERENCES prediction.targets(id) ON DELETE CASCADE,
  signal_id UUID REFERENCES prediction.signals(id),

  -- The predictor content
  predictor_type TEXT NOT NULL,         -- 'news', 'price_move', 'technical', 'sentiment'
  summary TEXT NOT NULL,
  direction TEXT,                       -- Sentiment-based (enforced by trigger via target domain)
  strength INTEGER NOT NULL CHECK (strength BETWEEN 1 AND 10),

  -- Source tracking
  source TEXT,                          -- 'ai_confident', 'human_reviewed', 'fast_path'

  -- Lifecycle
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'consumed', 'expired', 'invalidated')),
  -- 'active', 'consumed', 'expired', 'invalidated'
  consumed_by_prediction_id UUID,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ
);

CREATE INDEX idx_predictors_active ON prediction.predictors(target_id)
  WHERE status = 'active';

-- ============================================
-- PREDICTIONS (Actual forecasts)
-- ============================================
CREATE TABLE prediction.predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id UUID REFERENCES prediction.targets(id) ON DELETE CASCADE,

  -- Correlation to A2A execution (ExecutionContext.taskId that created this prediction)
  -- Used for cost reporting (llm_usage.task_id) and streaming correlation
  task_id UUID NOT NULL,

  -- The prediction
  prediction_type TEXT NOT NULL,        -- 'direction', 'magnitude', 'binary', 'range'
  direction TEXT,                       -- Outcome-based (enforced by trigger via target domain)
  magnitude DECIMAL(10,4),
  magnitude_unit TEXT,                  -- 'percent', 'dollars', 'points'
  confidence DECIMAL(3,2),

  -- Timeframe
  timeframe_type TEXT,                  -- 'hours', 'days', 'by_date', 'by_event'
  timeframe_value INTEGER,
  target_date TIMESTAMPTZ,

  -- Reasoning
  reasoning TEXT,
  predictor_ids UUID[],

  -- Trigger
  trigger_type TEXT,                    -- 'urgent_signal', 'batch_threshold', 'manual'
  trigger_signal_id UUID,

  -- Baseline
  baseline_value DECIMAL(20,8),
  baseline_captured_at TIMESTAMPTZ,

  -- Status
  status TEXT DEFAULT 'active'
    CHECK (status IN ('pending', 'active', 'resolved', 'expired', 'cancelled')),
  -- 'pending', 'active', 'resolved', 'expired', 'cancelled'

  -- Outcome
  outcome_value DECIMAL(20,8),
  outcome_direction TEXT,
  outcome_captured_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_predictions_active ON prediction.predictions(target_id, status)
  WHERE status = 'active';
CREATE INDEX idx_predictions_created ON prediction.predictions(target_id, created_at DESC);
CREATE INDEX idx_predictions_resolved ON prediction.predictions(target_id, status, resolved_at DESC)
  WHERE status = 'resolved';
CREATE INDEX idx_predictions_task ON prediction.predictions(task_id);

-- ============================================
-- PREDICTION SNAPSHOTS (Explainability)
-- ============================================
CREATE TABLE prediction.snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id UUID REFERENCES prediction.predictions(id) UNIQUE,

  -- Full state capture
  predictors JSONB NOT NULL,
  rejected_signals JSONB,
  analyst_predictions JSONB NOT NULL,
  llm_ensemble JSONB NOT NULL,
  learnings_applied JSONB NOT NULL,
  threshold_evaluation JSONB NOT NULL,
  timeline JSONB,

  -- Config at time
  llm_config JSONB,
  analyst_config JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Snapshot index (prediction_id is already UNIQUE, so no additional index needed)

-- ============================================
-- EVALUATIONS (Outcome scoring)
-- ============================================
CREATE TABLE prediction.evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id UUID REFERENCES prediction.predictions(id),

  -- Scoring
  direction_correct BOOLEAN,
  magnitude_accuracy DECIMAL(5,4),
  timing_accuracy DECIMAL(5,4),
  overall_score DECIMAL(5,4),

  -- Analysis
  evaluation_reasoning TEXT,
  what_worked TEXT,
  what_missed TEXT,

  -- Per-analyst scores
  analyst_scores JSONB,
  -- { "analyst_id": { "direction_correct": true, "contribution": 0.85 } }

  -- Learning outputs
  suggested_learnings JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Evaluation indexes
CREATE INDEX idx_evaluations_prediction ON prediction.evaluations(prediction_id);
CREATE INDEX idx_evaluations_direction ON prediction.evaluations(direction_correct) WHERE direction_correct IS NOT NULL;

-- ============================================
-- MISSED OPPORTUNITIES
-- ============================================
CREATE TABLE prediction.missed_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id UUID REFERENCES prediction.targets(id),

  -- The move
  move_direction TEXT NOT NULL,
  move_magnitude DECIMAL(10,4) NOT NULL,
  move_start_value DECIMAL(20,8),
  move_end_value DECIMAL(20,8),
  move_start_at TIMESTAMPTZ NOT NULL,
  move_end_at TIMESTAMPTZ NOT NULL,

  -- Detection
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  detection_method TEXT,

  -- Analysis
  analysis_status TEXT DEFAULT 'pending'
    CHECK (analysis_status IN ('pending', 'researching', 'complete')),
  -- 'pending', 'researching', 'complete'

  -- Retroactive research
  discovered_drivers JSONB,
  signals_we_had JSONB,
  source_gaps JSONB,
  reconstructed_prediction JSONB,

  -- AI analysis
  miss_reason TEXT,
  ai_analysis TEXT,

  -- Suggestions
  suggested_learnings JSONB,
  suggested_tools JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  analyzed_at TIMESTAMPTZ
);

-- ============================================
-- TARGET SNAPSHOTS (Price history for miss detection)
-- ============================================
CREATE TABLE prediction.target_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id UUID REFERENCES prediction.targets(id),

  value DECIMAL(20,8) NOT NULL,
  value_type TEXT DEFAULT 'price',
  source TEXT,

  captured_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_snapshots_target_time ON prediction.target_snapshots(target_id, captured_at DESC);
```

### 4.2 Configuration Tables

```sql
-- ============================================
-- ANALYSTS (AI personalities)
-- ============================================
CREATE TABLE prediction.analysts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,

  -- Scope
  scope_level TEXT NOT NULL,            -- 'runner', 'domain', 'universe', 'target'
  domain TEXT,
  universe_id UUID REFERENCES prediction.universes(id),
  target_id UUID REFERENCES prediction.targets(id),

  -- Which tiers
  active_tiers TEXT[] NOT NULL DEFAULT ARRAY[
    'signal_detection', 'prediction', 'evaluation', 'miss_analysis'
  ],

  -- Weight
  default_weight DECIMAL(3,2) DEFAULT 1.0,

  -- The analyst's brain (stored in table, not files)
  perspective TEXT NOT NULL,
  tier_instructions JSONB NOT NULL DEFAULT '{}',
  learned_patterns JSONB DEFAULT '{"human": [], "ai": []}',
  calibration JSONB DEFAULT '{}',

  -- Metadata
  analyst_type TEXT NOT NULL DEFAULT 'user', -- 'system', 'domain', 'user'
  created_by UUID REFERENCES public.users(id),
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_analyst_scope CHECK (
    (scope_level = 'runner' AND domain IS NULL AND universe_id IS NULL AND target_id IS NULL) OR
    (scope_level = 'domain' AND domain IS NOT NULL AND universe_id IS NULL AND target_id IS NULL) OR
    (scope_level = 'universe' AND universe_id IS NOT NULL AND target_id IS NULL) OR
    (scope_level = 'target' AND target_id IS NOT NULL)
  )
);

CREATE INDEX idx_analysts_scope ON prediction.analysts(scope_level, domain, universe_id, target_id);

-- ============================================
-- ANALYST OVERRIDES (per-universe/target adjustments)
-- ============================================
CREATE TABLE prediction.analyst_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Where (scope_level: 'universe' or 'target')
  scope_level TEXT NOT NULL,
  universe_id UUID REFERENCES prediction.universes(id),
  target_id UUID REFERENCES prediction.targets(id),

  -- Which analyst
  analyst_id UUID REFERENCES prediction.analysts(id) NOT NULL,

  -- Overrides
  is_disabled BOOLEAN DEFAULT false,
  weight_override DECIMAL(3,2),
  active_tiers_override TEXT[],
  llm_tiers_override JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(scope_level, universe_id, target_id, analyst_id),

  -- Validate scope_level has correct FK set
  CONSTRAINT valid_override_scope CHECK (
    (scope_level = 'universe' AND universe_id IS NOT NULL AND target_id IS NULL) OR
    (scope_level = 'target' AND target_id IS NOT NULL AND universe_id IS NULL)
  )
);

-- ============================================
-- STRATEGIES (Investment philosophies)
-- ============================================
CREATE TABLE prediction.strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,

  -- Scope
  scope TEXT DEFAULT 'system',          -- 'system', 'user'
  created_by UUID REFERENCES public.users(id),

  -- Parameters
  parameters JSONB NOT NULL,
  analyst_config JSONB NOT NULL,
  threshold_overrides JSONB,
  notification_config JSONB,

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- LLM TIER MAPPING VIEW (Uses existing llm_models table)
-- ============================================
-- DO NOT create prediction_llm_tiers table!
-- Instead, map prediction tiers to existing llm_models.model_tier

CREATE VIEW prediction.llm_tier_mapping AS
SELECT
  CASE
    WHEN model_tier = 'flagship' THEN 'gold'
    WHEN model_tier = 'standard' THEN 'silver'
    WHEN model_tier IN ('economy', 'local') THEN 'bronze'
  END as prediction_tier,
  model_name,
  provider_name,
  display_name,
  pricing_info_json,
  context_window,
  max_output_tokens,
  is_local
FROM public.llm_models
WHERE is_active = true
  AND model_tier IN ('flagship', 'standard', 'economy', 'local');

-- Default tier models (can be overridden per universe/agent)
COMMENT ON VIEW prediction.llm_tier_mapping IS '
  Maps prediction tiers (gold/silver/bronze) to actual LLM models.
  - Gold: flagship tier (e.g., claude-opus-4-5)
  - Silver: standard tier (e.g., claude-sonnet-4)
  - Bronze: economy/local tier (e.g., llama3.3 via Ollama)

  Cost tracking uses llm_models.pricing_info_json automatically.
';

-- ============================================
-- LEARNINGS
-- ============================================
CREATE TABLE prediction.learnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Scope
  scope_level TEXT NOT NULL
    CHECK (scope_level IN ('runner', 'domain', 'universe', 'target', 'analyst')),
  domain TEXT,
  universe_id UUID REFERENCES prediction.universes(id),
  target_id UUID REFERENCES prediction.targets(id),
  analyst_id UUID REFERENCES prediction.analysts(id),

  -- Which tier
  tier TEXT,

  -- Content
  learning_type TEXT NOT NULL,          -- 'pattern', 'rule', 'weight_adjustment', 'threshold', 'avoid'
  content TEXT NOT NULL,

  -- Source
  source_type TEXT NOT NULL,            -- 'human', 'ai_suggested', 'ai_approved'
  confidence DECIMAL(3,2),
  evidence_count INTEGER,

  -- Trigger
  triggered_by_type TEXT,
  triggered_by_id UUID,

  -- Status
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'superseded')),
  superseded_by UUID REFERENCES prediction.learnings(id),

  -- Audit
  created_by UUID REFERENCES public.users(id),
  reviewed_by UUID REFERENCES public.users(id),
  reviewed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,

  CONSTRAINT valid_learning_scope CHECK (
    (scope_level = 'runner' AND domain IS NULL AND universe_id IS NULL AND target_id IS NULL AND analyst_id IS NULL) OR
    (scope_level = 'domain' AND domain IS NOT NULL AND universe_id IS NULL AND target_id IS NULL AND analyst_id IS NULL) OR
    (scope_level = 'universe' AND universe_id IS NOT NULL AND target_id IS NULL AND analyst_id IS NULL) OR
    (scope_level = 'target' AND target_id IS NOT NULL AND universe_id IS NULL AND analyst_id IS NULL) OR
    (scope_level = 'analyst' AND analyst_id IS NOT NULL)
  ),

  CONSTRAINT valid_learning_supersession CHECK (
    (status = 'superseded' AND superseded_by IS NOT NULL) OR
    (status <> 'superseded' AND superseded_by IS NULL)
  )
);

CREATE INDEX idx_learnings_scope ON prediction.learnings(scope_level, domain, universe_id, target_id, analyst_id);
CREATE INDEX idx_learnings_active ON prediction.learnings(status) WHERE status = 'active';

-- ============================================
-- LEARNING QUEUE (Pending review)
-- ============================================
CREATE TABLE prediction.learning_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source
  source_type TEXT NOT NULL,
  source_id UUID,

  -- Suggestion
  suggested_scope_level TEXT NOT NULL
    CHECK (suggested_scope_level IN ('runner', 'domain', 'universe', 'target', 'analyst')),
  suggested_domain TEXT,
  suggested_universe_id UUID,
  suggested_target_id UUID,
  suggested_analyst_id UUID,
  suggested_tier TEXT,
  suggested_learning_type TEXT NOT NULL,
  suggested_content TEXT NOT NULL,
  ai_reasoning TEXT,
  ai_confidence DECIMAL(3,2),

  -- Context
  context JSONB NOT NULL,

  -- Decision
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  final_scope_level TEXT
    CHECK (final_scope_level IS NULL OR final_scope_level IN ('runner', 'domain', 'universe', 'target', 'analyst')),
  final_domain TEXT,
  final_universe_id UUID,
  final_target_id UUID,
  final_analyst_id UUID,
  final_tier TEXT,
  final_content TEXT,

  learning_id UUID REFERENCES prediction.learnings(id),

  reviewed_by UUID REFERENCES public.users(id),
  reviewed_at TIMESTAMPTZ,
  reviewer_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,

  CONSTRAINT valid_learning_queue_suggested_scope CHECK (
    (suggested_scope_level = 'runner' AND suggested_domain IS NULL AND suggested_universe_id IS NULL AND suggested_target_id IS NULL AND suggested_analyst_id IS NULL) OR
    (suggested_scope_level = 'domain' AND suggested_domain IS NOT NULL AND suggested_universe_id IS NULL AND suggested_target_id IS NULL AND suggested_analyst_id IS NULL) OR
    (suggested_scope_level = 'universe' AND suggested_universe_id IS NOT NULL AND suggested_target_id IS NULL AND suggested_domain IS NULL AND suggested_analyst_id IS NULL) OR
    (suggested_scope_level = 'target' AND suggested_target_id IS NOT NULL AND suggested_universe_id IS NULL AND suggested_domain IS NULL AND suggested_analyst_id IS NULL) OR
    (suggested_scope_level = 'analyst' AND suggested_analyst_id IS NOT NULL)
  ),

  CONSTRAINT valid_learning_queue_final_scope CHECK (
    final_scope_level IS NULL OR (
      (final_scope_level = 'runner' AND final_domain IS NULL AND final_universe_id IS NULL AND final_target_id IS NULL AND final_analyst_id IS NULL) OR
      (final_scope_level = 'domain' AND final_domain IS NOT NULL AND final_universe_id IS NULL AND final_target_id IS NULL AND final_analyst_id IS NULL) OR
      (final_scope_level = 'universe' AND final_universe_id IS NOT NULL AND final_target_id IS NULL AND final_domain IS NULL AND final_analyst_id IS NULL) OR
      (final_scope_level = 'target' AND final_target_id IS NOT NULL AND final_universe_id IS NULL AND final_domain IS NULL AND final_analyst_id IS NULL) OR
      (final_scope_level = 'analyst' AND final_analyst_id IS NOT NULL)
    )
  ),

  CONSTRAINT valid_learning_queue_status_fields CHECK (
    -- Pending: no reviewer + no finalization
    (status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL AND final_scope_level IS NULL AND learning_id IS NULL) OR

    -- Approved: must be fully finalized and linked to created learning
    (status = 'approved' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND final_scope_level IS NOT NULL AND final_content IS NOT NULL AND learning_id IS NOT NULL) OR

    -- Rejected: must be reviewed; no learning created
    (status = 'rejected' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND learning_id IS NULL)
  )
);

-- ============================================
-- REVIEW QUEUE (Signals needing human review)
-- ============================================
CREATE TABLE prediction.review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What
  review_type TEXT NOT NULL
    CHECK (review_type IN ('signal', 'predictor_conflict', 'prediction', 'evaluation')),
  -- 'signal', 'predictor_conflict', 'prediction', 'evaluation'
  signal_id UUID REFERENCES prediction.signals(id),
  target_id UUID REFERENCES prediction.targets(id),

  -- Context
  payload JSONB NOT NULL,
  ai_assessment JSONB,
  ai_confidence DECIMAL(3,2),
  question TEXT,

  -- Decision
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'responded', 'expired')),
  human_decision TEXT,
  human_note TEXT,
  human_strength_override INTEGER
    CHECK (human_strength_override IS NULL OR human_strength_override BETWEEN 1 AND 10),

  reviewed_by UUID REFERENCES public.users(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,

  CONSTRAINT valid_review_queue_status_decision CHECK (
    (status = 'pending' AND human_decision IS NULL AND responded_at IS NULL) OR
    (status = 'responded' AND human_decision IS NOT NULL AND responded_at IS NOT NULL) OR
    (status = 'expired')
  ),

  CONSTRAINT valid_review_queue_reference CHECK (
    -- Signal review MUST point to a specific signal AND target
    (review_type = 'signal' AND signal_id IS NOT NULL AND target_id IS NOT NULL) OR

    -- Other review types must at least be scoped to a target
    (review_type IN ('predictor_conflict', 'prediction', 'evaluation') AND target_id IS NOT NULL)
  )
);

-- ============================================
-- TOOL REQUESTS (Source wishlist)
-- ============================================
CREATE TABLE prediction.tool_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  universe_id UUID REFERENCES prediction.universes(id),
  requested_by UUID REFERENCES public.users(id),

  tool_type TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  tool_description TEXT,

  triggered_by_miss_id UUID REFERENCES prediction.missed_opportunities(id),
  rationale TEXT,
  estimated_value TEXT,
  estimated_cost TEXT,
  cost_type TEXT,

  status TEXT DEFAULT 'wishlist'
    CHECK (status IN ('wishlist', 'planned', 'in_progress', 'done', 'rejected')),
  tool_id UUID,
  implemented_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ANALYST ASSESSMENTS (Per-analyst, per-LLM tracking)
-- ============================================
CREATE TABLE prediction.analyst_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  analyst_id UUID NOT NULL REFERENCES prediction.analysts(id),

  -- Processing stage (not LLM tier)
  tier TEXT NOT NULL
    CHECK (tier IN ('signal_detection', 'prediction', 'evaluation', 'miss_analysis')),

  -- What this assessment is about
  reference_type TEXT NOT NULL
    CHECK (reference_type IN ('signal', 'predictor', 'prediction', 'evaluation', 'missed_opportunity')),
  reference_id UUID NOT NULL,

  -- LLM tier used for this assessment (gold/silver/bronze)
  llm_tier TEXT NOT NULL
    CHECK (llm_tier IN ('gold', 'silver', 'bronze')),

  -- Source-of-truth tracking for tokens/cost/duration (no duplication)
  llm_usage_id UUID NOT NULL REFERENCES public.llm_usage(id),

  assessment JSONB NOT NULL,
  confidence DECIMAL(3,2),
  reasoning TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_assessments_reference ON prediction.analyst_assessments(reference_type, reference_id);

-- ============================================
-- SOURCE CRAWLS (Crawl history)
-- ============================================
CREATE TABLE prediction.source_crawls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES prediction.sources(id),

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'success', 'error')),
  error_message TEXT,

  items_found INTEGER DEFAULT 0,
  new_items INTEGER DEFAULT 0,
  signals_created INTEGER DEFAULT 0,
  signal_ids UUID[],

  duration_ms INTEGER,
  crawled_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SOURCE SEEN ITEMS (Deduplication)
-- ============================================
CREATE TABLE prediction.source_seen_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES prediction.sources(id),

  content_hash TEXT NOT NULL,
  url TEXT,
  title TEXT,

  first_seen_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(source_id, content_hash)
);
```

### 4.3 Functions

```sql
-- ============================================
-- GET ACTIVE ANALYSTS FOR A TARGET
-- ============================================
CREATE OR REPLACE FUNCTION get_active_analysts(
  p_target_id UUID,
  p_tier TEXT DEFAULT NULL
)
RETURNS TABLE (
  analyst_id UUID,
  name TEXT,
  slug TEXT,
  scope_level TEXT,
  perspective TEXT,
  tier_instructions JSONB,
  learned_patterns JSONB,
  effective_weight DECIMAL,
  effective_tiers TEXT[],
  effective_llm_tiers JSONB
) AS $$
DECLARE
  v_universe_id UUID;
  v_domain TEXT;
BEGIN
  SELECT t.universe_id, u.domain
  INTO v_universe_id, v_domain
  FROM prediction.targets t
  JOIN prediction.universes u ON t.universe_id = u.id
  WHERE t.id = p_target_id;

  RETURN QUERY
  WITH applicable_analysts AS (
    SELECT a.*, 'runner' as source_level FROM prediction.analysts a
    WHERE a.scope_level = 'runner' AND a.is_active = true
    UNION ALL
    SELECT a.*, 'domain' as source_level FROM prediction.analysts a
    WHERE a.scope_level = 'domain' AND a.domain = v_domain AND a.is_active = true
    UNION ALL
    SELECT a.*, 'universe' as source_level FROM prediction.analysts a
    WHERE a.scope_level = 'universe' AND a.universe_id = v_universe_id AND a.is_active = true
    UNION ALL
    SELECT a.*, 'target' as source_level FROM prediction.analysts a
    WHERE a.scope_level = 'target' AND a.target_id = p_target_id AND a.is_active = true
  ),
  -- Get overrides: target-level takes precedence over universe-level
  target_overrides AS (
    SELECT * FROM prediction.analyst_overrides
    WHERE target_id = p_target_id AND scope_level = 'target'
  ),
  universe_overrides AS (
    SELECT * FROM prediction.analyst_overrides
    WHERE universe_id = v_universe_id AND scope_level = 'universe'
  ),
  with_overrides AS (
    SELECT
      a.id as analyst_id,
      a.name,
      a.slug,
      a.scope_level,
      a.perspective,
      a.tier_instructions,
      a.learned_patterns,
      -- Target override takes precedence, then universe override, then default
      COALESCE(t_ovr.weight_override, u_ovr.weight_override, a.default_weight) as effective_weight,
      COALESCE(t_ovr.active_tiers_override, u_ovr.active_tiers_override, a.active_tiers) as effective_tiers,
      COALESCE(t_ovr.llm_tiers_override, u_ovr.llm_tiers_override) as effective_llm_tiers,
      COALESCE(t_ovr.is_disabled, u_ovr.is_disabled, false) as is_disabled
    FROM applicable_analysts a
    LEFT JOIN target_overrides t_ovr ON t_ovr.analyst_id = a.id
    LEFT JOIN universe_overrides u_ovr ON u_ovr.analyst_id = a.id
  )
  SELECT
    w.analyst_id, w.name, w.slug, w.scope_level, w.perspective,
    w.tier_instructions, w.learned_patterns, w.effective_weight,
    w.effective_tiers, w.effective_llm_tiers
  FROM with_overrides w
  WHERE w.is_disabled = false
    AND (p_tier IS NULL OR p_tier = ANY(w.effective_tiers));

  -- Edge case: If no analysts found, return system base analyst
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      a.id, a.name, a.slug, a.scope_level, a.perspective,
      a.tier_instructions, a.learned_patterns, a.default_weight,
      a.active_tiers, NULL::JSONB
    FROM prediction.analysts a
    WHERE a.scope_level = 'runner'
      AND a.slug = 'base-analyst'
      AND a.is_active = true
    LIMIT 1;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- GET ACTIVE LEARNINGS FOR A CONTEXT
-- ============================================
CREATE OR REPLACE FUNCTION get_active_learnings(
  p_target_id UUID,
  p_tier TEXT DEFAULT NULL,
  p_analyst_id UUID DEFAULT NULL
)
RETURNS TABLE (
  learning_id UUID,
  scope_level TEXT,
  learning_type TEXT,
  content TEXT,
  source_type TEXT,
  confidence DECIMAL
) AS $$
DECLARE
  v_universe_id UUID;
  v_domain TEXT;
BEGIN
  SELECT t.universe_id, u.domain
  INTO v_universe_id, v_domain
  FROM prediction.targets t
  JOIN prediction.universes u ON t.universe_id = u.id
  WHERE t.id = p_target_id;

  RETURN QUERY
  SELECT
    l.id, l.scope_level, l.learning_type, l.content, l.source_type, l.confidence
  FROM prediction.learnings l
  WHERE l.status = 'active'
    AND (l.tier IS NULL OR l.tier = p_tier)
    AND (
      (l.scope_level = 'runner')
      OR (l.scope_level = 'domain' AND l.domain = v_domain)
      OR (l.scope_level = 'universe' AND l.universe_id = v_universe_id)
      OR (l.scope_level = 'target' AND l.target_id = p_target_id)
      OR (l.scope_level = 'analyst' AND l.analyst_id = p_analyst_id)
    )
  ORDER BY
    CASE l.scope_level
      WHEN 'runner' THEN 1
      WHEN 'domain' THEN 2
      WHEN 'universe' THEN 3
      WHEN 'target' THEN 4
      WHEN 'analyst' THEN 5
    END,
    l.created_at DESC;
END;
$$ LANGUAGE plpgsql;
```

### 4.4 Data Validation Rules

#### 4.4.1 Value Ranges and Constraints

| Field | Type | Range | Notes |
|-------|------|-------|-------|
| `confidence` | DECIMAL(3,2) | 0.00 - 1.00 | Probability, not percentage |
| `strength` | INTEGER | 1 - 10 | Signal/predictor strength |
| `weight` | DECIMAL(3,2) | 0.00 - 5.00 | Analyst weight multiplier |
| `magnitude` | DECIMAL(10,4) | > 0 | Price movement (percent or absolute) |

#### 4.4.2 Direction Values by Domain

**Important**: Direction terminology differs between signals/predictors and predictions:
- **Signals/Predictors** use sentiment-based values: `bullish`, `bearish`, `neutral` (what analysts detect)
- **Predictions** use outcome-based values: `up`, `down`, `flat` (what we forecast will happen)

This distinction is intentional: analysts express sentiment/bias, while predictions express measurable expected outcomes.

| Entity | Domain | Valid Direction Values | Notes |
|--------|--------|------------------------|-------|
| **Signals/Predictors** | `stocks` | `bullish`, `bearish`, `neutral` | Analyst sentiment |
| **Signals/Predictors** | `crypto` | `bullish`, `bearish`, `neutral` | Analyst sentiment |
| **Signals/Predictors** | `elections` | `for`, `against`, `tossup` | Candidate support |
| **Signals/Predictors** | `polymarket` | `yes`, `no`, `uncertain` | Contract sentiment |
| **Predictions** | `stocks` | `up`, `down`, `flat` | Price outcome |
| **Predictions** | `crypto` | `up`, `down`, `flat` | Price outcome |
| **Predictions** | `elections` | `for`, `against`, `tossup` | Election outcome |
| **Predictions** | `polymarket` | `yes`, `no`, `uncertain` | Contract resolution |

**Direction Mapping** (signal → prediction):
```typescript
function mapSentimentToOutcome(direction: string): string {
  const mapping: Record<string, string> = {
    'bullish': 'up',
    'bearish': 'down',
    'neutral': 'flat',
    // elections and polymarket use same values
    'for': 'for',
    'against': 'against',
    'tossup': 'tossup',
    'yes': 'yes',
    'no': 'no',
    'uncertain': 'uncertain'
  };
  const mapped = mapping[direction];
  if (!mapped) {
    throw new Error(`Unsupported direction '${direction}'. Direction MUST be validated; no silent fallbacks.`);
  }
  return mapped;
}
```

**Validation Function**:
```sql
CREATE OR REPLACE FUNCTION prediction.validate_direction(
  p_entity TEXT,   -- 'signal' | 'predictor' | 'prediction'
  p_domain TEXT,
  p_direction TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN CASE p_domain
    WHEN 'stocks' THEN CASE p_entity
      WHEN 'signal' THEN p_direction IN ('bullish', 'bearish', 'neutral')
      WHEN 'predictor' THEN p_direction IN ('bullish', 'bearish', 'neutral')
      WHEN 'prediction' THEN p_direction IN ('up', 'down', 'flat')
      ELSE FALSE
    END
    WHEN 'crypto' THEN CASE p_entity
      WHEN 'signal' THEN p_direction IN ('bullish', 'bearish', 'neutral')
      WHEN 'predictor' THEN p_direction IN ('bullish', 'bearish', 'neutral')
      WHEN 'prediction' THEN p_direction IN ('up', 'down', 'flat')
      ELSE FALSE
    END
    WHEN 'elections' THEN p_direction IN ('for', 'against', 'tossup')
    WHEN 'polymarket' THEN p_direction IN ('yes', 'no', 'uncertain')
    ELSE FALSE
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

**Enforcement Trigger (Recommended)**:
Because `domain` is derived from `target_id` → `universe.domain`, direction validation is enforced via triggers on tables that store direction fields.

```sql
CREATE OR REPLACE FUNCTION prediction.enforce_direction_by_target_domain(
  p_entity TEXT,          -- 'signal' | 'predictor' | 'prediction'
  p_target_id UUID,
  p_direction TEXT
) RETURNS VOID AS $$
DECLARE
  u_domain TEXT;
BEGIN
  IF p_direction IS NULL THEN
    RETURN;
  END IF;

  SELECT u.domain INTO u_domain
  FROM prediction.targets t
  JOIN prediction.universes u ON t.universe_id = u.id
  WHERE t.id = p_target_id;

  IF u_domain IS NULL THEN
    RAISE EXCEPTION 'Target % not found for direction validation', p_target_id;
  END IF;

  IF NOT prediction.validate_direction(p_entity, u_domain, p_direction) THEN
    RAISE EXCEPTION 'Invalid direction % for entity % in domain %', p_direction, p_entity, u_domain;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION prediction.trg_enforce_signal_direction()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM prediction.enforce_direction_by_target_domain('signal', NEW.target_id, NEW.direction);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION prediction.trg_enforce_predictor_direction()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM prediction.enforce_direction_by_target_domain('predictor', NEW.target_id, NEW.direction);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION prediction.trg_enforce_prediction_direction()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM prediction.enforce_direction_by_target_domain('prediction', NEW.target_id, NEW.direction);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_signal_direction ON prediction.signals;
CREATE TRIGGER trg_enforce_signal_direction
BEFORE INSERT OR UPDATE ON prediction.signals
FOR EACH ROW EXECUTE FUNCTION prediction.trg_enforce_signal_direction();

DROP TRIGGER IF EXISTS trg_enforce_predictor_direction ON prediction.predictors;
CREATE TRIGGER trg_enforce_predictor_direction
BEFORE INSERT OR UPDATE ON prediction.predictors
FOR EACH ROW EXECUTE FUNCTION prediction.trg_enforce_predictor_direction();

DROP TRIGGER IF EXISTS trg_enforce_prediction_direction ON prediction.predictions;
CREATE TRIGGER trg_enforce_prediction_direction
BEFORE INSERT OR UPDATE ON prediction.predictions
FOR EACH ROW EXECUTE FUNCTION prediction.trg_enforce_prediction_direction();
```

#### 4.4.3 Timeframe Units

Valid values for `timeframe_type`:
- `hours` - Short-term (value: 1-72)
- `days` - Medium-term (value: 1-30)
- `weeks` - Long-term (value: 1-12)
- `by_date` - Specific date (target_date required)
- `by_event` - Event-triggered (external_id required)

#### 4.4.4 Status Transitions

**Prediction Status Transitions**:
```
pending ──► active ──► resolved
                  │
                  └──► expired
                  │
                  └──► cancelled
```

Valid transitions enforced by trigger:
- `pending` → `active`: When threshold met
- `active` → `resolved`: When outcome captured
- `active` → `expired`: When timeframe passed
- `active` → `cancelled`: Manual cancellation only

**Predictor Status Transitions**:
```
active ──► consumed ──► (terminal)
      │
      └──► expired
      │
      └──► invalidated
```

**Enforcement Trigger (Recommended)**:
Like direction validation, status transition rules are enforced via triggers to prevent invalid transitions.

```sql
CREATE OR REPLACE FUNCTION prediction.enforce_prediction_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Prediction transitions
  IF TG_TABLE_NAME = 'predictions' THEN
    IF NOT (
      (OLD.status = 'pending' AND NEW.status = 'active') OR
      (OLD.status = 'active' AND NEW.status IN ('resolved', 'expired', 'cancelled'))
    ) THEN
      RAISE EXCEPTION 'Invalid prediction status transition: % -> %', OLD.status, NEW.status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prediction_status_transition ON prediction.predictions;
CREATE TRIGGER trg_prediction_status_transition
BEFORE UPDATE ON prediction.predictions
FOR EACH ROW EXECUTE FUNCTION prediction.enforce_prediction_status_transition();

CREATE OR REPLACE FUNCTION prediction.enforce_predictor_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Predictor transitions
  IF NOT (
    (OLD.status = 'active' AND NEW.status IN ('consumed', 'expired', 'invalidated'))
  ) THEN
    RAISE EXCEPTION 'Invalid predictor status transition: % -> %', OLD.status, NEW.status;
  END IF;

  -- Enforce audit fields when transitioning to 'consumed'
  IF NEW.status = 'consumed' THEN
    IF NEW.consumed_by_prediction_id IS NULL THEN
      RAISE EXCEPTION 'consumed_by_prediction_id is required when status is consumed';
    END IF;
    -- Auto-set consumed_at if not provided
    IF NEW.consumed_at IS NULL THEN
      NEW.consumed_at := NOW();
    END IF;
  END IF;

  -- Auto-set expires_at for expired status
  IF NEW.status = 'expired' AND NEW.expires_at IS NULL THEN
    NEW.expires_at := NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_predictor_status_transition ON prediction.predictors;
CREATE TRIGGER trg_predictor_status_transition
BEFORE UPDATE ON prediction.predictors
FOR EACH ROW EXECUTE FUNCTION prediction.enforce_predictor_status_transition();
```

### 4.5 Row Level Security Policies

All prediction tables use RLS for multi-tenant security.

```sql
-- Enable RLS on all tables
ALTER TABLE prediction.universes ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction.targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction.signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction.predictors ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction.predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction.analysts ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction.learnings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- UNIVERSES POLICIES
-- ============================================
-- Users can only see universes in their organization
CREATE POLICY universes_org_read ON prediction.universes
  FOR SELECT
  USING (
    organization_slug IN (
      -- Uses existing RBAC function (source of truth)
      SELECT organization_slug FROM public.rbac_get_user_organizations(auth.uid())
    )
  );

-- Only org admins can create/update universes
CREATE POLICY universes_org_write ON prediction.universes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.rbac_user_org_roles uor
      JOIN public.rbac_roles r ON r.id = uor.role_id
      WHERE uor.user_id = auth.uid()
        AND (uor.organization_slug = organization_slug OR uor.organization_slug = '*')
        AND r.name IN ('admin', 'super-admin')
    )
  );

-- ============================================
-- TARGETS POLICIES
-- ============================================
-- Inherit from universe access
CREATE POLICY targets_universe_read ON prediction.targets
  FOR SELECT
  USING (
    universe_id IN (
      SELECT id
      FROM prediction.universes
      WHERE organization_slug IN (
        SELECT organization_slug FROM public.rbac_get_user_organizations(auth.uid())
      )
    )
  );

-- ============================================
-- SIGNALS, PREDICTORS, PREDICTIONS
-- ============================================
-- Follow target access
CREATE POLICY signals_target_read ON prediction.signals
  FOR SELECT
  USING (target_id IN (SELECT id FROM prediction.targets));

CREATE POLICY predictors_target_read ON prediction.predictors
  FOR SELECT
  USING (target_id IN (SELECT id FROM prediction.targets));

CREATE POLICY predictions_target_read ON prediction.predictions
  FOR SELECT
  USING (target_id IN (SELECT id FROM prediction.targets));

-- ============================================
-- ANALYSTS POLICIES
-- ============================================
-- System/domain analysts visible to all
-- Universe analysts visible to org members
-- Target analysts follow target access
CREATE POLICY analysts_read ON prediction.analysts
  FOR SELECT
  USING (
    scope_level IN ('runner', 'domain')
    OR (scope_level = 'universe' AND universe_id IN (
      SELECT id FROM prediction.universes
    ))
    OR (scope_level = 'target' AND target_id IN (
      SELECT id FROM prediction.targets
    ))
  );

-- ============================================
-- LEARNINGS POLICIES
-- ============================================
-- Runner/domain learnings: read-only for all, admin-write
-- Universe/target learnings: org access
CREATE POLICY learnings_read ON prediction.learnings
  FOR SELECT
  USING (
    scope_level IN ('runner', 'domain')
    OR (scope_level = 'universe' AND universe_id IN (
      SELECT id FROM prediction.universes
    ))
    OR (scope_level = 'target' AND target_id IN (
      SELECT id FROM prediction.targets
    ))
    OR (scope_level = 'analyst' AND analyst_id IN (
      SELECT id FROM prediction.analysts
    ))
  );

-- Users can create learnings at universe/target level
CREATE POLICY learnings_create ON prediction.learnings
  FOR INSERT
  WITH CHECK (
    scope_level IN ('universe', 'target', 'analyst')
    AND created_by = auth.uid()
  );

-- ============================================
-- ADDITIONAL TABLES RLS
-- ============================================
-- Enable RLS on remaining tables
ALTER TABLE prediction.sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction.evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction.snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction.analyst_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction.strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction.tool_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction.learning_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction.review_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction.source_crawls ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction.source_seen_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction.missed_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction.target_snapshots ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SOURCES POLICIES
-- ============================================
-- Sources follow scope hierarchy (like analysts)
CREATE POLICY sources_read ON prediction.sources
  FOR SELECT
  USING (
    scope_level IN ('runner', 'domain')
    OR (scope_level = 'universe' AND universe_id IN (
      SELECT id FROM prediction.universes
    ))
    OR (scope_level = 'target' AND target_id IN (
      SELECT id FROM prediction.targets
    ))
  );

CREATE POLICY sources_write ON prediction.sources
  FOR ALL
  USING (
    (scope_level = 'universe' AND universe_id IN (
      SELECT id FROM prediction.universes
    ))
    OR (scope_level = 'target' AND target_id IN (
      SELECT id FROM prediction.targets
    ))
  );

-- ============================================
-- EVALUATIONS POLICIES
-- ============================================
-- Follow prediction access
CREATE POLICY evaluations_read ON prediction.evaluations
  FOR SELECT
  USING (prediction_id IN (SELECT id FROM prediction.predictions));

-- ============================================
-- SNAPSHOTS POLICIES
-- ============================================
-- Follow prediction access
CREATE POLICY snapshots_read ON prediction.snapshots
  FOR SELECT
  USING (prediction_id IN (SELECT id FROM prediction.predictions));

-- ============================================
-- ANALYST OVERRIDES POLICIES
-- ============================================
-- Follow universe/target access
CREATE POLICY analyst_overrides_read ON prediction.analyst_overrides
  FOR SELECT
  USING (
    (scope_level = 'universe' AND universe_id IN (
      SELECT id FROM prediction.universes
    ))
    OR (scope_level = 'target' AND target_id IN (
      SELECT id FROM prediction.targets
    ))
  );

CREATE POLICY analyst_overrides_write ON prediction.analyst_overrides
  FOR ALL
  USING (
    (scope_level = 'universe' AND universe_id IN (
      SELECT id FROM prediction.universes
    ))
    OR (scope_level = 'target' AND target_id IN (
      SELECT id FROM prediction.targets
    ))
  );

-- ============================================
-- STRATEGIES POLICIES
-- ============================================
-- System strategies visible to all, user strategies to owner
CREATE POLICY strategies_read ON prediction.strategies
  FOR SELECT
  USING (
    scope = 'system'
    OR created_by = auth.uid()
  );

CREATE POLICY strategies_write ON prediction.strategies
  FOR ALL
  USING (
    scope = 'user' AND created_by = auth.uid()
  );

-- ============================================
-- TOOL REQUESTS POLICIES
-- ============================================
-- Tool requests are scoped to a universe (not a prediction row)
CREATE POLICY tool_requests_read ON prediction.tool_requests
  FOR SELECT
  USING (
    universe_id IN (
      SELECT id FROM prediction.universes
      WHERE organization_slug IN (
        SELECT organization_slug FROM public.rbac_get_user_organizations(auth.uid())
      )
    )
  );

-- ============================================
-- QUEUES POLICIES (learning_queue, review_queue)
-- ============================================
-- Learning queue is linked indirectly to universe/target via suggested/final IDs.
-- For MVP, allow org members to read queue items if they reference a universe/target they can access.
CREATE POLICY learning_queue_read ON prediction.learning_queue
  FOR SELECT
  USING (
    (suggested_universe_id IS NOT NULL AND suggested_universe_id IN (
      SELECT id FROM prediction.universes
      WHERE organization_slug IN (
        SELECT organization_slug FROM public.rbac_get_user_organizations(auth.uid())
      )
    ))
    OR (final_universe_id IS NOT NULL AND final_universe_id IN (
      SELECT id FROM prediction.universes
      WHERE organization_slug IN (
        SELECT organization_slug FROM public.rbac_get_user_organizations(auth.uid())
      )
    ))
    OR (suggested_target_id IS NOT NULL AND suggested_target_id IN (SELECT id FROM prediction.targets))
    OR (final_target_id IS NOT NULL AND final_target_id IN (SELECT id FROM prediction.targets))
  );

CREATE POLICY review_queue_read ON prediction.review_queue
  FOR SELECT
  USING (signal_id IN (SELECT id FROM prediction.signals));

-- ============================================
-- SOURCE CRAWLS & SEEN ITEMS POLICIES
-- ============================================
-- Follow source access
CREATE POLICY source_crawls_read ON prediction.source_crawls
  FOR SELECT
  USING (source_id IN (SELECT id FROM prediction.sources));

CREATE POLICY source_seen_items_read ON prediction.source_seen_items
  FOR SELECT
  USING (source_id IN (SELECT id FROM prediction.sources));

-- ============================================
-- MISSED OPPORTUNITIES POLICIES
-- ============================================
-- Follow target access
CREATE POLICY missed_opportunities_read ON prediction.missed_opportunities
  FOR SELECT
  USING (target_id IN (SELECT id FROM prediction.targets));

-- ============================================
-- TARGET SNAPSHOTS POLICIES
-- ============================================
-- Follow target access
CREATE POLICY target_snapshots_read ON prediction.target_snapshots
  FOR SELECT
  USING (target_id IN (SELECT id FROM prediction.targets));

-- ============================================
-- WRITE POLICIES FOR CORE TABLES
-- ============================================
-- Targets: org members can write
CREATE POLICY targets_write ON prediction.targets
  FOR ALL
  USING (universe_id IN (SELECT id FROM prediction.universes));

-- Signals: system creates, users read-only
CREATE POLICY signals_system_write ON prediction.signals
  FOR INSERT
  WITH CHECK (true);  -- System/background jobs create signals

-- Predictors: system creates, users read-only
CREATE POLICY predictors_system_write ON prediction.predictors
  FOR INSERT
  WITH CHECK (true);  -- System/background jobs create predictors

-- Predictions: system creates, users read-only
CREATE POLICY predictions_system_write ON prediction.predictions
  FOR INSERT
  WITH CHECK (true);  -- System/background jobs create predictions
```

---

## 5. Processing Pipeline

**CRITICAL**: All processing functions receive `ExecutionContext` and use it for LLM calls, observability, and cost tracking.

> **Note on Code Examples**: The TypeScript code in this section is **pseudocode** illustrating the intended logic and interfaces. Implementation requires the following utility layer functions (to be implemented in `apps/api/src/prediction/utils/`):
> - `getTarget(targetId)` - Fetch target with universe info
> - `getUniverseForTarget(targetId)` - Get universe containing target
> - `getEffectiveThresholds(target)` - Merge universe/target threshold configs
> - `getActivePredictors(targetId)` - Get non-expired predictors
> - `createSignal(targetId, data)` - Insert signal record
> - `checkCrossSourceDuplicate(signal)` - Deduplication check
> - `dedupeItems(items)` - Filter duplicate items from crawl
> - `markItemSeen(sourceId, hash)` - Record seen content hash
> - `getAllowTierDowngrade(universe)` - Check if tier downgrade permitted

### 5.1 Tier 1: Signal Detection

```typescript
interface SignalDetectionInput {
  context: ExecutionContext;     // REQUIRED: ExecutionContext for all LLM calls
  signal: Signal;
  target: Target;
  analysts: Analyst[];
  learnings: Learning[];
  llmConfig: LLMConfig;
}

interface SignalDetectionOutput {
  isPredictor: boolean | null;  // null = needs review
  confidence: number;
  strength: number;
  direction: 'bullish' | 'bearish' | 'neutral';
  urgency: 'urgent' | 'notable' | 'routine';
  reasoning: string;
  analystAssessments: AnalystAssessment[];
  llmAssessments: LLMAssessment[];
}

async function detectSignal(input: SignalDetectionInput): Promise<SignalDetectionOutput> {
  const { context, signal, target, analysts, learnings, llmConfig } = input;

  // Emit progress via ObservabilityEventsService
  observabilityService.emit({
    context,
    hook_event_type: 'agent.stream.chunk',
    message: `Detecting signal ${signal.id} for ${target.name}`,
    step: 'signal_detection',
    progress: 10,
    metadata: { type: 'prediction_progress', signalId: signal.id, targetId: target.id, tier: 'signal_detection' }
  });

  // Run each analyst on each enabled LLM tier with ExecutionContext
  const assessments = await runAnalystEnsemble(
    context,                    // Pass context for LLM service cost tracking
    analysts,
    llmConfig,
    'signal_detection',
    { signal, target, learnings }
  );

  // Aggregate assessments
  const aggregated = aggregateSignalAssessments(assessments, target);

  // Determine urgency
  const urgency = determineUrgency(signal, aggregated);

  // Emit completion
  observabilityService.emit({
    context,
    hook_event_type: 'agent.stream.chunk',
    message: `Signal detection complete: ${aggregated.isPredictor ? 'promoted' : 'discarded'}`,
    step: 'signal_detection',
    progress: 100,
    metadata: { type: 'prediction_progress', signalId: signal.id, result: aggregated.isPredictor }
  });

  return {
    ...aggregated,
    urgency,
    analystAssessments: assessments.byAnalyst,
    llmAssessments: assessments.byLLM
  };
}

// Helper: Create tier-specific context for multi-LLM evaluation
async function createTierContext(
  baseContext: ExecutionContext,
  tier: 'gold' | 'silver' | 'bronze',
  analystSlug: string,
  options: { universeId: string; stage: 'signal_detection' | 'prediction' | 'evaluation' | 'miss_analysis' }
): Promise<ExecutionContext> {
  // NOTE: Tier resolution MUST come from explicit configuration (agent metadata / universe / target).
  // If a provider/model cannot be resolved unambiguously, resolveTier MUST throw (no silent defaults).
  const tierModel = await llmTierResolver.resolveTier(tier, undefined, options.universeId);
  return {
    ...baseContext,                          // Preserve taskId, conversationId, planId/deliverableId, etc.
    provider: tierModel.provider,            // Override provider for tier
    model: tierModel.model,                  // Override model for tier
    agentSlug: analystSlug,                  // Attribute internal LLM calls to the analyst agent
    agentType: 'context'                     // Analysts are context agents
  };
}
```

### 5.2 Tier 2: Predictor Management

#### 5.2.1 Predictor Expiration

Predictors expire based on universe-level TTL configuration:

```typescript
interface PredictorExpirationConfig {
  ttlHours: number;  // Default: 24 hours
  expireOnPrediction: boolean;  // Expire when used in prediction
}

async function expireOldPredictors(targetId: string): Promise<number> {
  const universe = await getUniverseForTarget(targetId);
  if (universe.predictorTtlHours == null) {
    throw new Error('Universe predictor TTL must be configured (predictorTtlHours). No silent default.');
  }
  const ttlHours = universe.predictorTtlHours;

  const result = await db.query(`
    UPDATE prediction.predictors
    SET status = 'expired', expires_at = NOW()
    WHERE target_id = $1
      AND status = 'active'
      AND created_at < NOW() - make_interval(hours => $2)
    RETURNING id
  `, [targetId, ttlHours]);

  return result.rows.length;
}

async function getActivePredictors(targetId: string): Promise<Predictor[]> {
  // First, expire old predictors
  await expireOldPredictors(targetId);

  // Then return active predictors
  return await db.query(`
    SELECT * FROM prediction.predictors
    WHERE target_id = $1
      AND status = 'active'
    ORDER BY created_at DESC
  `, [targetId]);
}
```

**Expiration Rules**:
- Predictors expire after TTL (default 24 hours, configurable per universe)
- Predictors marked as `consumed` when used in a prediction (don't expire, but can't be reused)
- Expired predictors are excluded from threshold evaluation
- Expiration happens automatically before threshold checks

#### 5.2.2 Threshold Evaluation

```typescript
interface ThresholdEvaluation {
  shouldPredict: boolean;
  predictors: Predictor[];
  combinedStrength: number;
  thresholdMet: {
    minPredictors: { required: number; actual: number; met: boolean };
    minStrength: { required: number; actual: number; met: boolean };
    directionConsensus: { required: number; actual: number; met: boolean };
  };
}

async function evaluateThreshold(targetId: string): Promise<ThresholdEvaluation> {
  const target = await getTarget(targetId);
  
  // Expire old predictors first
  await expireOldPredictors(targetId);
  
  const predictors = await getActivePredictors(targetId);
  const thresholds = getEffectiveThresholds(target);

  // Handle edge case: No active predictors
  if (predictors.length === 0) {
    return {
      shouldPredict: false,
      predictors: [],
      combinedStrength: 0,
      thresholdMet: {
        minPredictors: { required: thresholds.minPredictors, actual: 0, met: false },
        minStrength: { required: thresholds.minStrength, actual: 0, met: false },
        directionConsensus: { required: thresholds.minConsensus, actual: 0, met: false }
      }
    };
  }

  const combinedStrength = predictors.reduce((sum, p) => sum + p.strength, 0);
  const directions = predictors.map(p => p.direction);
  const consensus = calculateConsensus(directions);

  return {
    shouldPredict:
      predictors.length >= thresholds.minPredictors &&
      combinedStrength >= thresholds.minStrength &&
      consensus >= thresholds.minConsensus,
    predictors,
    combinedStrength,
    thresholdMet: {
      minPredictors: {
        required: thresholds.minPredictors,
        actual: predictors.length,
        met: predictors.length >= thresholds.minPredictors
      },
      minStrength: {
        required: thresholds.minStrength,
        actual: combinedStrength,
        met: combinedStrength >= thresholds.minStrength
      },
      directionConsensus: {
        required: thresholds.minConsensus,
        actual: consensus,
        met: consensus >= thresholds.minConsensus
      }
    }
  };
}
```

### 5.3 Tier 3: Prediction Generation

**CRITICAL**: All prediction generation MUST use ExecutionContext for cost tracking and observability.

```typescript
interface PredictionInput {
  context: ExecutionContext;     // REQUIRED: ExecutionContext for all LLM calls
  target: Target;
  predictors: Predictor[];
  analysts: Analyst[];
  learnings: Learning[];
  llmConfig: LLMConfig;
  baseline: { value: number; capturedAt: Date };
}

interface PredictionOutput {
  prediction: {
    direction: 'up' | 'down' | 'flat';
    magnitude: number;
    confidence: number;
    timeframe: { value: number; unit: string };
    reasoning: string;
  };
  ensemble: {
    gold?: PredictionResult;
    silver?: PredictionResult;
    bronze?: PredictionResult;
    agreementScore: number;
    divergences: string[];
  };
  analystBreakdown: AnalystPrediction[];
}

async function generatePrediction(input: PredictionInput): Promise<PredictionOutput> {
  const { context, target, predictors, analysts, learnings, llmConfig, baseline } = input;

  // Emit progress
  observabilityService.emit({
    context,
    hook_event_type: 'agent.stream.chunk',
    message: `Generating prediction for ${target.name} with ${predictors.length} predictors`,
    step: 'prediction_generation',
    progress: 10,
    metadata: { type: 'prediction_progress', targetId: target.id, tier: 'prediction_generation' }
  });

  // Run each analyst on each enabled LLM tier with ExecutionContext
  const assessments = await runAnalystEnsemble(
    context,                    // Pass ExecutionContext for cost tracking
    analysts,
    llmConfig,
    'prediction',
    { target, predictors, learnings, baseline }
  );

  // Aggregate into final prediction
  const prediction = aggregatePredictions(assessments, analysts);

  // Calculate LLM tier agreement
  const ensemble = calculateLLMEnsemble(assessments);

  // Emit completion
  observabilityService.emit({
    context,
    hook_event_type: 'agent.stream.complete',
    message: `Prediction generated: ${prediction.direction} ${prediction.magnitude}%`,
    metadata: {
      type: 'prediction_complete',
      predictionId: prediction.id,
      direction: prediction.direction,
      confidence: prediction.confidence
    }
  });

  return {
    prediction,
    ensemble,
    analystBreakdown: assessments.byAnalyst
  };
}
```

### 5.4 Fast Path Processing

```typescript
async function processFastPath(signal: Signal, evaluation: SignalDetectionOutput) {
  if (evaluation.urgency !== 'urgent') return;

  // 1. Create predictor immediately
  const predictor = await createPredictor({
    signal_id: signal.id,
    target_id: signal.target_id,
    strength: evaluation.strength,
    direction: evaluation.direction,
    source: 'fast_path'
  });

  // 2. Generate prediction immediately
  const prediction = await generatePrediction({
    target_id: signal.target_id,
    predictors: [predictor],
    trigger: 'urgent_signal',
    trigger_signal_id: signal.id
  });

  // 3. Create snapshot for explainability
  await createPredictionSnapshot(prediction);

  // 4. Notify user
  await notifyUser({
    type: 'urgent_prediction',
    prediction,
    signal
  });
}
```

### 5.5 Batch Processing

**CRITICAL**: Batch processing creates ExecutionContext for each operation to enable cost tracking.

```typescript
// Signal → Predictor (every 15 min)
async function batchSignalToPredictor() {
  const signals = await getPendingSignals();

  for (const signal of signals) {
    // Create ExecutionContext for this signal processing
    const context = await createExecutionContext({
      orgSlug: await getOrgSlugForTarget(signal.target_id),
      userId: 'system',  // Batch jobs run as system
      agentSlug: await getAgentSlugForTarget(signal.target_id),
      provider: 'anthropic',  // Default, will be overridden per tier
      model: 'claude-sonnet-4-20250514'  // Default, will be overridden per tier
    });

    const target = await getTarget(signal.target_id);
    const analysts = await getActiveAnalystsForTarget(signal.target_id);
    const learnings = await getActiveLearningsForTarget(signal.target_id);
    const llmConfig = await getLLMConfigForTarget(signal.target_id);

    const evaluation = await detectSignal({
      context,  // Pass ExecutionContext
      signal,
      target,
      analysts,
      learnings,
      llmConfig
    });

    if (evaluation.isPredictor && evaluation.confidence >= getThreshold(signal.target_id)) {
      await promoteToPredictor(signal, evaluation);
    } else if (evaluation.confidence >= 0.4 && evaluation.confidence < 0.7) {
      await queueForReview(signal, evaluation);
    } else {
      await discardSignal(signal, 'below_threshold');
    }
  }
}

// Predictor → Prediction (every 30 min)
async function batchPredictorToPrediction() {
  const targets = await getTargetsWithActivePredictors();

  for (const target of targets) {
    const evaluation = await evaluateThreshold(target.id);

    if (evaluation.shouldPredict) {
      const activePrediction = await getActivePrediction(target.id);

      if (!activePrediction) {
        // Create ExecutionContext for prediction generation
        const context = await createExecutionContext({
          orgSlug: await getOrgSlugForTarget(target.id),
          userId: 'system',
          agentSlug: await getAgentSlugForTarget(target.id),
          provider: 'anthropic',
          model: 'claude-sonnet-4-20250514'
        });

        const analysts = await getActiveAnalystsForTarget(target.id);
        const learnings = await getActiveLearningsForTarget(target.id);
        const llmConfig = await getLLMConfigForTarget(target.id);
        const baseline = await capturePredictionBaseline(target.id);

        await generateAndSavePrediction({
          context,  // Pass ExecutionContext
          target,
          predictors: evaluation.predictors,
          analysts,
          learnings,
          llmConfig,
          baseline
        });
      }
    }
  }
}
```

### 5.6 Error Handling & Retry Logic

All LLM calls must handle failures gracefully with appropriate retry strategies.

#### 5.6.1 Retry Configuration

```typescript
interface RetryConfig {
  maxRetries: number;           // Default: 3
  initialDelayMs: number;       // Default: 1000
  maxDelayMs: number;           // Default: 30000
  backoffMultiplier: number;    // Default: 2
  retryableErrors: string[];    // Error types to retry
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryableErrors: [
    'rate_limit_exceeded',
    'service_unavailable',
    'timeout',
    'connection_error',
    'overloaded'
  ]
};
```

#### 5.6.2 LLM Call Wrapper

```typescript
async function withRetry<T>(
  context: ExecutionContext,
  operation: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error;
  let delay = config.initialDelayMs;

  for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Log attempt failure
      observabilityService.emit({
        context,
        hook_event_type: 'agent.stream.error',
        message: `LLM call failed (attempt ${attempt}/${config.maxRetries + 1}): ${error.message}`,
        metadata: { attempt, error: error.code, willRetry: attempt <= config.maxRetries }
      });

      // Check if retryable
      if (!config.retryableErrors.includes(error.code) || attempt > config.maxRetries) {
        throw error;
      }

      // Exponential backoff
      await sleep(Math.min(delay, config.maxDelayMs));
      delay *= config.backoffMultiplier;
    }
  }

  throw lastError;
}
```

#### 5.6.3 Tier Downgrade Strategy (Explicitly Configured)

If a higher tier fails, the system MAY downgrade to lower tiers **only if explicitly enabled** in universe/agent config.

**No silent fallbacks**: If downgrade is not enabled, the system MUST fail fast with a clear error and surface it via SSE.

```typescript
async function callWithTierDowngrade<T>(
  context: ExecutionContext,
  tiers: ('gold' | 'silver' | 'bronze')[],
  operation: (tierContext: ExecutionContext) => Promise<T>
): Promise<{ result: T; usedTier: string }> {
  // Explicit configuration gate (no hidden defaults)
  const allowDowngrade = await getAllowTierDowngrade(context);
  if (!allowDowngrade) {
    throw new Error('Tier downgrade is disabled by configuration');
  }

  for (const tier of tiers) {
    try {
      const tierContext = await createTierContext(context, tier, context.agentSlug);
      const result = await withRetry(tierContext, () => operation(tierContext));
      return { result, usedTier: tier };
    } catch (error) {
      observabilityService.emit({
        context,
        hook_event_type: 'agent.stream.chunk',
        message: `Tier ${tier} failed, trying next tier`,
        metadata: { failedTier: tier, error: error.message }
      });
      // Continue to next tier
    }
  }

  throw new Error('All explicitly enabled LLM tiers failed');
}
```

#### 5.6.4 Graceful Degradation

| Failure Scenario | Behavior |
|------------------|----------|
| All LLM tiers fail | Queue signal for later, keep `prediction.signals.disposition = 'pending'` (or introduce `pending_retry` ONLY if added to DB enum + UI contract) |
| Gold tier fails | If (and only if) tier downgrade is explicitly enabled: try the next explicitly enabled tier(s) |
| Single analyst fails | Continue with remaining analysts, note incomplete |
| API rate limit | Exponential backoff, queue remaining work |
| Database error | Retry with circuit breaker, alert on repeated failure |

### 5.7 Edge Cases & Race Conditions

#### 5.7.1 Concurrent Signal Processing

**Problem**: Same signal processed by multiple workers

**Solution**: Use advisory locks or atomic updates

```sql
-- Claim signals atomically
UPDATE prediction.signals
SET processing_started_at = NOW(),
    processing_worker = $worker_id
WHERE id IN (
  SELECT id FROM prediction.signals
  WHERE disposition = 'pending'
    AND processing_started_at IS NULL
  ORDER BY urgency DESC, created_at ASC
  LIMIT 10
  FOR UPDATE SKIP LOCKED
)
RETURNING *;
```

#### 5.7.2 Duplicate Predictions

**Problem**: Multiple predictions for same target in short window

**Solution**: Check for existing active predictions before creating

```typescript
async function createPredictionSafely(
  context: ExecutionContext,
  targetId: string,
  predictionData: PredictionData
): Promise<Prediction | null> {
  // Use database transaction with advisory lock
  return await db.transaction(async (tx) => {
    // Check for existing active prediction
    const existing = await tx.query(`
      SELECT id FROM prediction.predictions
      WHERE target_id = $1
        AND status = 'active'
        AND created_at > NOW() - INTERVAL '1 hour'
      FOR UPDATE
    `, [targetId]);

    if (existing.rows.length > 0) {
      // Already has recent prediction, skip
      return null;
    }

    // Create new prediction
    return await tx.insert(predictionData);
  });
}
```

#### 5.7.3 Stale Data Handling

| Data Type | Staleness Threshold | Action |
|-----------|---------------------|--------|
| Price baseline | 5 minutes | Refresh before prediction |
| Predictors | Universe TTL (default 24h) | Expire and exclude |
| Signals | Signal TTL (default 48h) | Auto-expire |
| Analyst context | Real-time | Always fetch fresh |

#### 5.7.4 Out-of-Order Events

**Problem**: Outcome received before prediction finalized

**Solution**: Use event sourcing with timestamps

```typescript
// All events include timestamp, process in order
interface PredictionEvent {
  id: string;
  predictionId: string;
  eventType: 'created' | 'updated' | 'outcome_received' | 'resolved';
  timestamp: Date;
  payload: Record<string, unknown>;
}

// Reconcile events on read
function reconcilePredictionState(events: PredictionEvent[]): PredictionState {
  return events
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    .reduce(applyEvent, initialState);
}
```

---

## 6. AI Analysts System

### 6.1 Analyst Structure

```typescript
interface Analyst {
  id: string;
  name: string;
  slug: string;
  scopeLevel: 'runner' | 'domain' | 'universe' | 'target';

  // What makes this analyst unique
  perspective: string;

  // Per-tier instructions
  tierInstructions: {
    signal_detection?: string;
    prediction?: string;
    evaluation?: string;
    miss_analysis?: string;
  };

  // Learned over time
  learnedPatterns: {
    human: LearnedPattern[];
    ai: LearnedPattern[];
  };

  // Performance tracking
  calibration: {
    signal_detection?: { accuracy: number; n: number };
    prediction?: { direction_accuracy: number; magnitude_accuracy: number; n: number };
    by_llm_tier?: Record<string, { accuracy: number; n: number }>;
  };

  // Weighting
  defaultWeight: number;
  activeTiers: string[];
}
```

### 6.2 System Analysts (Runner Level)

```typescript
const baseAnalyst: Analyst = {
  name: 'Base Analyst',
  slug: 'base-analyst',
  scopeLevel: 'runner',
  perspective: 'Balanced, objective financial analyst. Evaluate signals objectively based on evidence.',
  tierInstructions: {
    signal_detection: 'Evaluate if this event is material. Consider source reliability, news magnitude, relevance.',
    prediction: 'Generate prediction based on accumulated predictors. Be specific about direction, magnitude, timeframe.',
    evaluation: 'Analyze why prediction succeeded or failed. What signals were most useful?',
    miss_analysis: 'Identify what signals existed that we should have acted on.'
  }
};
```

### 6.3 Domain Analysts

#### 6.3.1 Stock Domain Analysts

```typescript
const technicalTina: Analyst = {
  name: 'Technical Tina',
  slug: 'technical-tina',
  scopeLevel: 'domain',
  domain: 'stocks',
  perspective: 'Focus on technical analysis - chart patterns, indicators, support/resistance. Price action tells the story.',
  tierInstructions: {
    signal_detection: 'Look for RSI extremes, MACD crossovers, volume spikes, breakouts, support/resistance tests.',
    prediction: 'Base predictions on technical setups. Identify key levels and patterns.',
    evaluation: 'Did technical signals correctly predict? What patterns should we weight differently?'
  },
  defaultWeight: 1.0
};

const fundamentalFred: Analyst = {
  name: 'Fundamental Fred',
  slug: 'fundamental-fred',
  scopeLevel: 'domain',
  domain: 'stocks',
  perspective: 'Focus on fundamentals - earnings, valuations, cash flow, competitive position.',
  tierInstructions: {
    signal_detection: 'Look for earnings surprises, guidance changes, margin trends, competitive developments.',
    prediction: 'Base predictions on fundamental thesis. Consider valuation and earnings trajectory.',
    evaluation: 'Did fundamental thesis play out? Were valuation signals accurate?'
  },
  defaultWeight: 1.0
};

const sentimentSally: Analyst = {
  name: 'Sentiment Sally',
  slug: 'sentiment-sally',
  scopeLevel: 'domain',
  domain: 'stocks',
  perspective: 'Focus on market sentiment - social media buzz, news tone, analyst sentiment shifts, retail vs institutional.',
  tierInstructions: {
    signal_detection: 'Analyze sentiment shift in news, social media, and analyst commentary. Detect fear/greed extremes.',
    prediction: 'Consider contrarian signals when sentiment extreme. Weight crowd psychology.',
    evaluation: 'Did sentiment correctly lead price? Were extreme readings actionable?'
  },
  defaultWeight: 0.8
};
```

#### 6.3.2 Crypto Domain Analysts

```typescript
const onChainOtto: Analyst = {
  name: 'On-Chain Otto',
  slug: 'on-chain-otto',
  scopeLevel: 'domain',
  domain: 'crypto',
  perspective: 'Focus on on-chain metrics - whale movements, exchange flows, active addresses, NVT ratio, MVRV.',
  tierInstructions: {
    signal_detection: 'Detect large wallet movements, exchange inflows/outflows, mining difficulty changes, hash rate shifts.',
    prediction: 'Base predictions on on-chain fundamentals. Whale accumulation/distribution patterns are key.',
    evaluation: 'Did on-chain signals predict price? Which metrics were most accurate?'
  },
  defaultWeight: 1.0
};

const defiDiana: Analyst = {
  name: 'DeFi Diana',
  slug: 'defi-diana',
  scopeLevel: 'domain',
  domain: 'crypto',
  perspective: 'Focus on DeFi metrics - TVL changes, yield farming flows, lending rates, liquidation risks.',
  tierInstructions: {
    signal_detection: 'Monitor TVL changes, borrowing rates, liquidation cascades, protocol upgrades, and hack reports.',
    prediction: 'Assess DeFi health and capital flows. Protocol risks and opportunities.',
    evaluation: 'Did DeFi signals correctly predict? Were protocol events properly weighted?'
  },
  defaultWeight: 0.9
};

const cryptoSentimentSam: Analyst = {
  name: 'Crypto Sentiment Sam',
  slug: 'crypto-sentiment-sam',
  scopeLevel: 'domain',
  domain: 'crypto',
  perspective: 'Focus on crypto-specific sentiment - CT (Crypto Twitter), Fear & Greed Index, funding rates, open interest.',
  tierInstructions: {
    signal_detection: 'Monitor funding rates, OI changes, liquidation levels, CT sentiment, and Fear & Greed extremes.',
    prediction: 'Crypto sentiment often leads price. Funding rate extremes are powerful contrarian signals.',
    evaluation: 'Did sentiment/funding extremes predict reversals? What thresholds worked best?'
  },
  defaultWeight: 0.9
};

const regulatoryRachel: Analyst = {
  name: 'Regulatory Rachel',
  slug: 'regulatory-rachel',
  scopeLevel: 'domain',
  domain: 'crypto',
  perspective: 'Focus on regulatory developments - SEC actions, legislative proposals, global crypto regulations, ETF decisions.',
  tierInstructions: {
    signal_detection: 'Track SEC filings, congressional hearings, international regulations, and enforcement actions.',
    prediction: 'Regulatory news drives major moves. Assess likelihood and market expectations.',
    evaluation: 'Did regulatory signals predict correctly? Were market expectations properly priced?'
  },
  defaultWeight: 1.0
};
```

#### 6.3.3 Elections Domain Analysts

```typescript
const pollingPaul: Analyst = {
  name: 'Polling Paul',
  slug: 'polling-paul',
  scopeLevel: 'domain',
  domain: 'elections',
  perspective: 'Focus on polling data - aggregate polls, pollster quality ratings, trend analysis, demographic breakdowns.',
  tierInstructions: {
    signal_detection: 'Track polling shifts, pollster releases, aggregate changes, and demographic movement.',
    prediction: 'Weight polls by quality and recency. Watch for systematic bias patterns.',
    evaluation: 'How accurate were polling-based predictions? Which pollsters performed best?'
  },
  defaultWeight: 1.0
};

const modelingMike: Analyst = {
  name: 'Modeling Mike',
  slug: 'modeling-mike',
  scopeLevel: 'domain',
  domain: 'elections',
  perspective: 'Focus on election models - 538-style aggregations, fundamentals, economic indicators, historical patterns.',
  tierInstructions: {
    signal_detection: 'Monitor model updates, fundamental indicator changes, and historical analog shifts.',
    prediction: 'Combine polling with fundamentals. Economic indicators matter for incumbents.',
    evaluation: 'Did models correctly predict outcomes? What fundamentals were underweighted?'
  },
  defaultWeight: 1.0
};

const groundGameGina: Analyst = {
  name: 'Ground Game Gina',
  slug: 'ground-game-gina',
  scopeLevel: 'domain',
  domain: 'elections',
  perspective: 'Focus on campaign dynamics - fundraising, endorsements, ground game, early voting data, campaign events.',
  tierInstructions: {
    signal_detection: 'Track fundraising reports, endorsement shifts, early voting patterns, and ground game metrics.',
    prediction: 'Campaign dynamics can shift races. Money and organization matter in close races.',
    evaluation: 'Did campaign signals predict shifts? Were ground game metrics accurate?'
  },
  defaultWeight: 0.8
};
```

#### 6.3.4 Polymarket Domain Analysts

```typescript
const probabilityPete: Analyst = {
  name: 'Probability Pete',
  slug: 'probability-pete',
  scopeLevel: 'domain',
  domain: 'polymarket',
  perspective: 'Focus on market efficiency - price movements, volume patterns, large bets, market microstructure.',
  tierInstructions: {
    signal_detection: 'Track large position changes, unusual volume, price/volume divergences, whale activity.',
    prediction: 'Polymarket prices reflect collective wisdom but can be inefficient. Look for mispricing.',
    evaluation: 'Were market prices accurate predictions? Where did markets misprice?'
  },
  defaultWeight: 1.0
};

const newsNancyPoly: Analyst = {
  name: 'News Nancy (Polymarket)',
  slug: 'news-nancy-poly',
  scopeLevel: 'domain',
  domain: 'polymarket',
  perspective: 'Focus on news events driving contract outcomes - breaking news, official announcements, authoritative sources.',
  tierInstructions: {
    signal_detection: 'Monitor news that directly impacts contract resolution. Track official sources and announcements.',
    prediction: 'News events resolve contracts. Assess probability of official announcements.',
    evaluation: 'Did news signals correctly predict resolution? What sources were most reliable?'
  },
  defaultWeight: 1.0
};

const contrarianCarl: Analyst = {
  name: 'Contrarian Carl',
  slug: 'contrarian-carl',
  scopeLevel: 'domain',
  domain: 'polymarket',
  perspective: 'Focus on contrarian opportunities - extreme prices (near 0 or 100), narrative vs reality gaps, crowd overreaction.',
  tierInstructions: {
    signal_detection: 'Identify extreme prices that may be overreactions. Look for narrative/reality disconnects.',
    prediction: 'Extreme prices often mean extreme opportunity. But verify the contrarian thesis.',
    evaluation: 'Did contrarian positions pay off? What price extremes were actionable?'
  },
  defaultWeight: 0.7
};

const resolutionRick: Analyst = {
  name: 'Resolution Rick',
  slug: 'resolution-rick',
  scopeLevel: 'domain',
  domain: 'polymarket',
  perspective: 'Focus on resolution mechanics - exact contract terms, resolution criteria, potential disputes, edge cases.',
  tierInstructions: {
    signal_detection: 'Analyze contract resolution terms precisely. Identify ambiguous clauses or edge cases.',
    prediction: 'Exact resolution criteria matter. Market may misprice resolution technicalities.',
    evaluation: 'Were resolution predictions accurate? What technicalities affected outcomes?'
  },
  defaultWeight: 0.9
};
```

#### 6.3.5 Analyst Registration (A2A)

All domain analysts must be registered in `public.agents` for A2A compliance:

```sql
-- Example: Register crypto analysts as A2A agents
INSERT INTO public.agents (slug, organization_slug, name, agent_type, llm_config, metadata)
VALUES
  ('on-chain-otto', ARRAY['global'], 'On-Chain Otto', 'context',
   '{"provider": "anthropic", "model": "claude-sonnet-4-20250514"}',
   '{"runnerConfig": {"analystType": "domain", "domain": "crypto", "activeTiers": ["signal_detection", "prediction", "evaluation"], "defaultWeight": 1.0}}'),

  ('defi-diana', ARRAY['global'], 'DeFi Diana', 'context',
   '{"provider": "anthropic", "model": "claude-sonnet-4-20250514"}',
   '{"runnerConfig": {"analystType": "domain", "domain": "crypto", "activeTiers": ["signal_detection", "prediction", "evaluation"], "defaultWeight": 0.9}}'),

  ('crypto-sentiment-sam', ARRAY['global'], 'Crypto Sentiment Sam', 'context',
   '{"provider": "anthropic", "model": "claude-sonnet-4-20250514"}',
   '{"runnerConfig": {"analystType": "domain", "domain": "crypto", "activeTiers": ["signal_detection", "prediction", "evaluation"], "defaultWeight": 0.9}}'),

  ('regulatory-rachel', ARRAY['global'], 'Regulatory Rachel', 'context',
   '{"provider": "anthropic", "model": "claude-sonnet-4-20250514"}',
   '{"runnerConfig": {"analystType": "domain", "domain": "crypto", "activeTiers": ["signal_detection", "prediction", "evaluation"], "defaultWeight": 1.0}}');
```

### 6.4 Building Analyst Prompts

```typescript
interface PromptContext {
  analyst: Analyst;
  tier: string;
  target: Target;           // NEW: Includes target.context
  learnings: Learning[];
  input: any;
}

function buildAnalystPrompt(ctx: PromptContext): string {
  const { analyst, tier, target, learnings, input } = ctx;

  const rules = learnings.filter(l => l.learning_type === 'rule');
  const patterns = learnings.filter(l => l.learning_type === 'pattern');
  const avoids = learnings.filter(l => l.learning_type === 'avoid');

  return `
# Role: ${analyst.name}
${analyst.perspective}

# Task: ${tier}
${analyst.tierInstructions[tier]}

# Target: ${target.name} (${target.symbol})
${target.context || 'No additional context available.'}

# Rules (must follow)
${rules.map(r => `- ${r.content}`).join('\n')}

# Patterns (consider these)
${patterns.map(p => `- ${p.content}${p.source_type === 'ai' ? ` (n=${p.evidence_count})` : ''}`).join('\n')}

# Things to Avoid
${avoids.map(a => `- ${a.content}`).join('\n')}

# Learned Patterns from Experience
${analyst.learnedPatterns.human.map(p => `- ${p.pattern}`).join('\n')}
${analyst.learnedPatterns.ai.map(p => `- ${p.pattern} (confidence: ${p.confidence})`).join('\n')}

# Input
${JSON.stringify(input, null, 2)}

# Your Assessment
Provide your analysis following the task instructions above.
`;
}
```

**CRITICAL**: The `target.context` field from the `prediction.targets` table is injected directly into every analyst prompt. This is how per-target knowledge is provided to the LLM. See Section 4.1 for the context column definition and Section 18.6 for context templates.

---

## 7. Multi-LLM Evaluation

### 7.1 LLM Tier Configuration

```typescript
interface LLMTier {
  name: 'gold' | 'silver' | 'bronze';
  displayName: string;
  colorCode: string;
  provider: string;
  model: string;
  costPer1kInput: number;
  costPer1kOutput: number;
}

const llmTiers: LLMTier[] = [
  {
    name: 'gold',
    displayName: 'Premium',
    colorCode: '#FFD700',
    provider: 'anthropic',
    model: 'claude-opus-4-5-20251101',
    costPer1kInput: 0.015,
    costPer1kOutput: 0.075
  },
  {
    name: 'silver',
    displayName: 'Balanced',
    colorCode: '#C0C0C0',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015
  },
  {
    name: 'bronze',
    displayName: 'Local',
    colorCode: '#CD7F32',
    provider: 'ollama',
    model: 'llama3.3',
    costPer1kInput: 0,
    costPer1kOutput: 0
  }
];
```

### 7.2 Running Multi-LLM Evaluation

**CRITICAL**: All LLM calls MUST use ExecutionContext for cost tracking and observability.

```typescript
async function runAnalystEnsemble(
  context: ExecutionContext,  // REQUIRED: ExecutionContext for cost tracking
  analysts: Analyst[],
  llmConfig: LLMConfig,
  tier: string,
  input: any
): Promise<EnsembleResult> {
  const assessments: Assessment[] = [];

  for (const analyst of analysts) {
    const analystLlmConfig = analyst.llmTiersOverride ?? llmConfig;

    for (const llmTier of ['gold', 'silver', 'bronze'] as const) {
      if (!analystLlmConfig[tier]?.[llmTier]) continue;

      // Create tier-specific ExecutionContext
      const tierContext = await createTierContext(context, llmTier, analyst.slug);

      const prompt = buildAnalystPrompt({
        analyst,
        tier,
        target: input.target,
        learnings: input.learnings,
        input,
      });

      // Use LLMService with ExecutionContext (automatic cost tracking)
      const result = await llmService.generateResponse(
        tierContext,
        buildSystemPrompt(analyst, tier),
        prompt,
        {
          executionContext: tierContext,
          schema: getOutputSchema(tier),
        }
      );

      assessments.push({
        analystId: analyst.id,
        analystName: analyst.name,
        llmTier,
        executionContext: tierContext,  // Store for correlation
        ...result
      });
    }
  }

  return {
    assessments,
    byAnalyst: groupBy(assessments, 'analystId'),
    byLLM: groupBy(assessments, 'llmTier')
  };
}
```

### 7.3 Aggregation Strategies

```typescript
type AggregationStrategy =
  | 'weighted_majority'
  | 'weighted_average'
  | 'weighted_ensemble'
  | 'highest_confidence'
  | 'unanimous';

function aggregateSignalAssessments(
  assessments: Assessment[],
  strategy: AggregationStrategy = 'weighted_majority'
): AggregatedResult {
  switch (strategy) {
    case 'weighted_majority':
      const yesWeight = assessments
        .filter(a => a.isPredictor)
        .reduce((sum, a) => sum + a.weight, 0);
      const totalWeight = assessments.reduce((sum, a) => sum + a.weight, 0);
      return {
        isPredictor: yesWeight / totalWeight > 0.5,
        confidence: yesWeight / totalWeight,
        ...
      };

    case 'weighted_average':
      // For numeric values like strength
      ...

    case 'weighted_ensemble':
      // For predictions - weighted average with disagreement tracking
      ...
  }
}
```

---

## 8. Human-in-the-Loop

### 8.1 Review Queue Flow

```
Signal arrives
      │
      ▼
Quick evaluate confidence
      │
      ├─── ≥0.70 ──────► Promote to predictor
      │
      ├─── 0.40-0.69 ──► Add to review queue
      │
      └─── <0.40 ──────► Discard


Review Queue
      │
      ▼
Human reviews (async, no blocking)
      │
      ├─── Approve ────► Create predictor + optional learning
      │
      ├─── Reject ─────► Discard + optional learning
      │
      └─── Modify ─────► Create predictor with changes + learning
```

### 8.2 Review Queue Item Structure

```typescript
interface ReviewQueueItem {
  id: string;
  reviewType: 'signal' | 'predictor_conflict' | 'prediction' | 'evaluation';
  signalId?: string;
  targetId: string;

  // What AI thought
  payload: {
    event: any;
    summary: string;
  };
  aiAssessment: {
    isPredictor: boolean | null;
    confidence: number;
    reasoning: string;
  };
  question: string;

  // Human response
  status: 'pending' | 'approved' | 'rejected' | 'modified';
  humanDecision?: string;
  humanNote?: string;  // Gets added to learnings if provided
  humanStrengthOverride?: number;

  createdAt: Date;
  expiresAt?: Date;
}
```

### 8.3 Processing Human Response

```typescript
async function handleReviewResponse(reviewId: string, response: HumanResponse) {
  const review = await getReview(reviewId);

  // Update review record
  await updateReview(reviewId, {
    status: response.decision,
    humanNote: response.note,
    humanStrengthOverride: response.strengthOverride,
    respondedAt: new Date()
  });

  // If approved/modified, create predictor
  if (response.decision === 'approved' || response.decision === 'modified') {
    await createPredictor({
      signalId: review.signalId,
      targetId: review.targetId,
      strength: response.strengthOverride ?? review.aiAssessment.suggestedStrength,
      direction: review.aiAssessment.direction,
      source: 'human_reviewed'
    });
  }

  // If note provided, create learning
  if (response.note) {
    await queueLearningForReview({
      suggestedScopeLevel: 'target',
      suggestedTargetId: review.targetId,
      suggestedContent: response.note,
      sourceType: 'review_queue',
      sourceId: reviewId
    });
  }

  // Check if we now have enough predictors
  await evaluateThreshold(review.targetId);
}
```

---

## 9. Learning System

### 9.1 Learning Types

| Type | Description | Example |
|------|-------------|---------|
| `rule` | Must always/never do | "Ignore analyst price targets" |
| `pattern` | Observed correlation | "Foxconn revenue leads AAPL by 6-8 weeks" |
| `weight_adjustment` | Change importance | "Weight supply chain news 2x for AAPL" |
| `threshold` | Change sensitivity | "Lower confidence threshold to 0.5 for supply chain" |
| `avoid` | Thing to not do | "Don't treat Tim Cook interviews as predictors" |

### 9.2 Learning Sources

| Source | Description |
|--------|-------------|
| `human` | User directly added |
| `ai_suggested` | AI proposed, pending review |
| `ai_approved` | AI proposed, human approved |

### 9.3 Learning Application

```typescript
async function gatherLearnings(
  targetId: string,
  tier: string,
  analystId?: string
): Promise<Learning[]> {
  return db.query(`
    SELECT * FROM get_active_learnings($1, $2, $3)
  `, [targetId, tier, analystId]);
}

// Learnings are gathered at execution time and injected into prompts
// More specific learnings (target > universe > domain > runner) take precedence
```

### 9.4 Learning Generation from Evaluation

```typescript
async function generateLearningsFromEvaluation(evaluation: Evaluation): Promise<Learning[]> {
  const prediction = await getPrediction(evaluation.predictionId);
  const predictors = await getPredictors(prediction.predictorIds);

  // Ask AI to suggest learnings
  const suggestions = await llmGenerateLearnings({
    prediction,
    predictors,
    outcome: evaluation,
    context: await loadTargetContext(prediction.targetId)
  });

  // Queue each suggestion for human review
  for (const suggestion of suggestions) {
    await createLearningQueueItem({
      sourceType: 'evaluation',
      sourceId: evaluation.id,
      ...suggestion
    });
  }

  return suggestions;
}
```

---

## 10. Source Management

### 10.1 Firecrawl Integration

```typescript
interface CrawlConfig {
  selector?: string;      // CSS selector for content
  waitFor?: string;       // Wait for element (JS pages)
  extractLinks?: boolean; // Follow links to full articles
  maxDepth?: number;
}

async function crawlSource(source: Source) {
  try {
    // Validate URL before crawling
    if (!isValidUrl(source.url)) {
      throw new Error(`Invalid URL: ${source.url}`);
    }

    // Record crawl start
    const crawlRecord = await db.query(`
      INSERT INTO prediction.source_crawls
      (source_id, status, crawled_at)
      VALUES ($1, 'in_progress', NOW())
      RETURNING id
    `, [source.id]);

    const crawlId = crawlRecord.rows[0].id;
    const startTime = Date.now();

    // Crawl with Firecrawl
  const result = await firecrawl.scrape(source.url, {
    formats: ['markdown', 'links'],
    ...source.crawlConfig
  });

  // Extract items
  const items = extractItems(result, source);

  // Filter by relevance
  const relevantItems = source.relevanceFilter
    ? filterByKeywords(items, source.relevanceFilter)
    : items;

    // Dedupe (includes cross-source check)
    const newItems: SignalItem[] = [];
    for (const item of relevantItems) {
      const isDuplicate = await checkCrossSourceDuplicate(item, source.target_id || source.universe_id);
      if (!isDuplicate) {
        const deduped = await dedupeItems(source.id, [item]);
        newItems.push(...deduped);
      }
    }

    // Create signals for matching targets
    let signalsCreated = 0;
    const targets = await getTargetsForSource(source);
    
  for (const item of newItems) {
    await markItemSeen(source.id, item);

    for (const target of targets) {
      await createSignal({
        targetId: target.id,
        sourceId: source.id,
        signalType: 'news',
        sourceName: source.name,
        sourceUrl: item.url,
        rawContent: item,
        summary: item.title
      });
        signalsCreated++;
      }
    }

    // Update crawl record
    await db.query(`
      UPDATE prediction.source_crawls
      SET 
        status = 'success',
        items_found = $1,
        new_items = $2,
        signals_created = $3,
        signal_ids = $4,
        duration_ms = $5
      WHERE id = $6
    `, [
      items.length,
      newItems.length,
      signalsCreated,
      [], // Optional: collect created signal IDs for deeper debugging
      Date.now() - startTime,
      crawlId
    ]);

    // Update source stats
    await db.query(`
      UPDATE prediction.sources
      SET 
        last_crawl_at = NOW(),
        last_crawl_status = 'success',
        last_error = NULL,
        total_crawls = total_crawls + 1,
        signals_generated = signals_generated + $1
      WHERE id = $2
    `, [signalsCreated, source.id]);

  } catch (error) {
    // Record crawl failure
    await db.query(`
      UPDATE prediction.source_crawls
      SET 
        status = 'error',
        error_message = $1
      WHERE id = $2
    `, [error.message, crawlId]);

    await db.query(`
      UPDATE prediction.sources
      SET 
        last_crawl_at = NOW(),
        last_crawl_status = 'error',
        last_error = $1,
        total_crawls = total_crawls + 1
      WHERE id = $2
    `, [error.message, source.id]);

    throw error;
  }
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
```

### 10.2 Source Types

| Type | Description | Example |
|------|-------------|---------|
| `web` | General web page | News sites, blogs |
| `rss` | RSS feed | Publication feeds |
| `twitter_search` | Twitter search URL | `twitter.com/search?q=$AAPL` |
| `api` | Structured API (keep existing) | Polygon prices |

### 10.3 What Stays as API

```typescript
// These still need dedicated API integrations
const structuredDataTools = [
  'stock-price',        // Polygon
  'crypto-price',       // CoinGecko
  'technical-analysis', // Calculated
  'options-flow'        // Unusual Whales (if added)
];

// Everything else becomes URL-based
```

### 10.4 Source Crawling Schedule & Triggers

#### 10.4.1 Crawl Frequency Matching

Sources are matched to cron jobs based on `frequency_minutes`:

| Frequency | Cron Schedule | Use Case |
|-----------|--------------|----------|
| 5 minutes | `*/5 * * * *` | Breaking news, urgent sources |
| 10 minutes | `*/10 * * * *` | High-priority news sources |
| 15 minutes | `*/15 * * * *` | Standard news sources (default) |
| 30 minutes | `*/30 * * * *` | Low-priority sources |
| 60 minutes | `0 * * * *` | Hourly sources (blogs, RSS) |

**Frequency Validation**:
- Minimum: 5 minutes (to avoid rate limiting)
- Maximum: 1440 minutes (24 hours)
- Invalid frequencies default to 15 minutes

#### 10.4.2 Crawl Trigger Logic

```typescript
interface CrawlTrigger {
  sourceId: string;
  triggerType: 'scheduled' | 'manual' | 'retry';
  scheduledAt: Date;
  retryCount?: number;
}

async function shouldCrawlSource(source: Source): Promise<boolean> {
  // Check if source is active
  if (!source.is_active) return false;

  // Check if enough time has passed since last crawl
  const timeSinceLastCrawl = Date.now() - (source.last_crawl_at?.getTime() || 0);
  const requiredInterval = source.frequency_minutes * 60 * 1000;

  if (timeSinceLastCrawl < requiredInterval) {
    return false;  // Too soon
  }

  // Check if source is in retry backoff period
  if (source.last_crawl_status === 'error' && source.last_error) {
    const retryBackoff = calculateRetryBackoff(source.total_crawls);
    const timeSinceError = Date.now() - (source.last_crawl_at?.getTime() || 0);
    if (timeSinceError < retryBackoff) {
      return false;  // Still in backoff
    }
  }

  return true;
}

function calculateRetryBackoff(failureCount: number): number {
  // Exponential backoff: 1min, 5min, 15min, 30min, 60min (max)
  const backoffs = [60000, 300000, 900000, 1800000, 3600000];
  return backoffs[Math.min(failureCount, backoffs.length - 1)];
}
```

#### 10.4.3 Crawl Failure Handling

| Failure Type | Retry Logic | Max Retries | Action After Max |
|--------------|-------------|-------------|-------------------|
| Network timeout | Exponential backoff | 3 | Mark source as `error`, notify user |
| Firecrawl API error | Exponential backoff | 3 | Mark source as `error`, notify user |
| Authentication failure | Immediate retry | 1 | Mark source as `auth_error`, notify user |
| Rate limit | Wait for reset window | 1 | Reschedule for next window |
| Invalid URL | No retry | 0 | Mark source as `invalid`, disable |

**Error Status Tracking**:
```sql
-- Update source status on failure
UPDATE prediction.sources
SET 
  last_crawl_status = 'error',
  last_error = $error_message,
  total_crawls = total_crawls + 1
WHERE id = $source_id;
```

### 10.5 Signal Creation & Deduplication

#### 10.5.1 Content Hash Calculation

Signals are deduplicated using content hashes:

```typescript
import crypto from 'crypto';

interface SignalItem {
  url: string;
  title: string;
  content: string;
  publishedAt?: Date;
}

function calculateContentHash(item: SignalItem): string {
  // Normalize content for hashing
  const normalized = {
    url: normalizeUrl(item.url),
    title: item.title.trim().toLowerCase(),
    content: normalizeContent(item.content)
  };

  // Create hash from normalized content
  const hashInput = `${normalized.url}|${normalized.title}|${normalized.content}`;
  return crypto.createHash('sha256').update(hashInput).digest('hex');
}

function normalizeUrl(url: string): string {
  // Remove query parameters, fragments, trailing slashes
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.replace(/\/$/, '');
  } catch {
    return url;
  }
}

function normalizeContent(content: string): string {
  // Remove whitespace, normalize unicode, limit length
  return content
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // Remove diacritics
    .substring(0, 1000)  // Limit to first 1000 chars
    .toLowerCase();
}
```

#### 10.5.2 Deduplication Logic

```typescript
async function dedupeItems(
  sourceId: string,
  items: SignalItem[]
): Promise<SignalItem[]> {
  const newItems: SignalItem[] = [];

  for (const item of items) {
    const contentHash = calculateContentHash(item);

    // Check if we've seen this content before
    const seen = await db.query(`
      SELECT id FROM prediction.source_seen_items
      WHERE source_id = $1 AND content_hash = $2
    `, [sourceId, contentHash]);

    if (seen.rows.length === 0) {
      // New item - mark as seen and include
      await db.query(`
        INSERT INTO prediction.source_seen_items
        (source_id, content_hash, url, title, first_seen_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (source_id, content_hash) DO NOTHING
      `, [sourceId, contentHash, item.url, item.title]);

      newItems.push(item);
    }
  }

  return newItems;
}
```

#### 10.5.3 Cross-Source Deduplication

**Problem**: Same content may appear in multiple sources (e.g., Reuters and Bloomberg both report same news).

**Solution**: Optional cross-source deduplication for high-confidence matches:

```typescript
async function checkCrossSourceDuplicate(
  item: SignalItem,
  targetId: string
): Promise<boolean> {
  // Only check recent signals (last 24 hours) for same target
  const recentSignals = await db.query(`
    SELECT s.id, s.source_url, s.summary
    FROM prediction.signals s
    WHERE s.target_id = $1
      AND s.created_at > NOW() - INTERVAL '24 hours'
  `, [targetId]);

  const itemHash = calculateContentHash(item);

  for (const signal of recentSignals.rows) {
    // Compare content similarity (simple title match for now)
    if (normalizeTitle(item.title) === normalizeTitle(signal.summary)) {
      // High confidence duplicate - skip
      return true;
    }
  }

  return false;
}

function normalizeTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, '')  // Remove punctuation
    .replace(/\s+/g, ' ');
}
```

#### 10.5.4 Signal-to-Target Matching

```typescript
/**
 * Determine which targets should receive signals from a source
 */
async function getTargetsForSource(source: Source): Promise<Target[]> {
  // Scope-based matching
  switch (source.scope_level) {
    case 'runner':
      // All active targets (system-wide)
      return await db.query(`
        SELECT * FROM prediction.targets
        WHERE is_active = true
      `);

    case 'domain':
      // All targets in domain
      return await db.query(`
        SELECT t.* FROM prediction.targets t
        JOIN prediction.universes u ON t.universe_id = u.id
        WHERE u.domain = $1 AND t.is_active = true
      `, [source.domain]);

    case 'universe':
      // All targets in universe
      return await db.query(`
        SELECT * FROM prediction.targets
        WHERE universe_id = $1 AND is_active = true
      `, [source.universe_id]);

    case 'target':
      // Single target
      return await db.query(`
        SELECT * FROM prediction.targets
        WHERE id = $1 AND is_active = true
      `, [source.target_id]);

    default:
      return [];
  }
}

/**
 * Extract items from Firecrawl result based on source type
 */
function extractItems(
  firecrawlResult: FirecrawlResult,
  source: Source
): SignalItem[] {
  switch (source.source_type) {
    case 'web':
      // Extract from markdown content
      return extractFromMarkdown(firecrawlResult.markdown, source);

    case 'rss':
      // Extract from RSS feed structure
      return extractFromRSS(firecrawlResult.data, source);

    case 'twitter_search':
      // Extract tweets from search results
      return extractFromTwitter(firecrawlResult.data, source);

    default:
      return [];
  }
}

function extractFromMarkdown(
  markdown: string,
  source: Source
): SignalItem[] {
  // Parse markdown for article links and titles
  // Look for patterns like: [Title](url) or ## Title
  const items: SignalItem[] = [];
  
  // Extract links: [text](url)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  
  while ((match = linkRegex.exec(markdown)) !== null) {
    const title = match[1];
    const url = match[2];
    
    // Resolve relative URLs
    const absoluteUrl = url.startsWith('http') 
      ? url 
      : new URL(url, source.url).toString();
    
    items.push({
      url: absoluteUrl,
      title: title,
      content: markdown.substring(match.index, match.index + 500)  // Extract surrounding context
    });
  }
  
  return items;
}

/**
 * Mark item as seen in source_seen_items table
 */
async function markItemSeen(
  sourceId: string,
  item: SignalItem
): Promise<void> {
  const contentHash = calculateContentHash(item);
  
  await db.query(`
    INSERT INTO prediction.source_seen_items
    (source_id, content_hash, url, title, first_seen_at)
    VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT (source_id, content_hash) DO UPDATE SET
      first_seen_at = prediction.source_seen_items.first_seen_at
  `, [sourceId, contentHash, item.url, item.title]);
}
```

---

## 11. Investment Strategies

### 11.1 Strategy Structure

```typescript
interface Strategy {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;

  parameters: {
    riskTolerance: 'high' | 'medium' | 'low';
    timeframePreference: 'short' | 'medium' | 'long';
    confidenceThreshold: number;
    volatilityComfort: 'high' | 'medium' | 'low';
  };

  analystConfig: {
    analystWeights: Record<string, number>;
    disableAnalysts?: string[];
    addAnalysts?: string[];
  };

  thresholdOverrides: {
    signalToPredictor: number;
    minPredictors: number;
    minCombinedStrength: number;
  };

  notificationConfig: {
    urgentThreshold: number;
    notifyOnSignals: boolean;
    summaryFrequency: 'realtime' | 'daily' | 'weekly';
  };
}
```

### 11.2 Pre-Built Strategies

| Strategy | Risk | Thresholds | Analyst Weights |
|----------|------|------------|-----------------|
| Aggressive | High | Low (0.55, 1 pred, 6 str) | Technical +50%, Momentum +50%, Conservative -70% |
| Balanced | Medium | Default (0.70, 2 pred, 12 str) | All equal |
| Conservative | Low | High (0.80, 3 pred, 18 str) | Conservative +50%, Fundamental +50%, Momentum -70% |
| Contrarian | Medium | Custom | Contrarian +100%, Sentiment +50%, Momentum -70% |
| Technical | Medium | Custom | Technical +100%, Fundamental -80% |

### 11.3 Strategy Application

```typescript
function applyStrategy(universe: Universe): EffectiveConfig {
  const strategy = universe.strategy;

  return {
    // Thresholds
    signalConfidenceThreshold:
      strategy?.thresholdOverrides?.signalToPredictor ?? 0.70,
    minPredictors:
      strategy?.thresholdOverrides?.minPredictors ?? 2,
    minStrength:
      strategy?.thresholdOverrides?.minCombinedStrength ?? 12,

    // Analyst modifications
    analystWeights: strategy?.analystConfig?.analystWeights ?? {},
    disabledAnalysts: strategy?.analystConfig?.disableAnalysts ?? [],

    // Notifications
    notifications: strategy?.notificationConfig ?? defaultNotifications
  };
}
```

### 11.4 Target Snapshot Creation

Target snapshots capture the current value (price, odds, etc.) of a target at specific points in time. They are used for:
- Missed opportunity detection (comparing snapshots to detect moves)
- Prediction baseline capture (value at prediction time)
- Outcome resolution (value at resolution time)

#### 11.4.1 Snapshot Creation Triggers

Snapshots are created automatically in these scenarios:

| Trigger | Frequency | Purpose |
|---------|-----------|---------|
| **Prediction creation** | Per prediction | Baseline value for comparison |
| **Prediction resolution** | Per prediction | Outcome value for evaluation |
| **Scheduled capture** | Every 15 minutes | For missed opportunity detection |
| **Manual capture** | On-demand | User-initiated snapshots |

#### 11.4.2 Scheduled Snapshot Capture

```typescript
/**
 * Scheduled job: Capture snapshots for all active targets
 * Runs every 15 minutes via cron: */15 * * * *
 */
async function captureTargetSnapshots() {
  const targets = await db.query(`
    SELECT t.*, u.domain
    FROM prediction.targets t
    JOIN prediction.universes u ON t.universe_id = u.id
    WHERE t.is_active = true
  `);

  for (const target of targets.rows) {
    try {
      const value = await getCurrentValue(target);
      
      await db.query(`
        INSERT INTO prediction.target_snapshots
        (target_id, value, value_type, source, captured_at)
        VALUES ($1, $2, $3, $4, NOW())
      `, [
        target.id,
        value.value,
        value.type || 'price',
        value.source || 'scheduled'
      ]);
    } catch (error) {
      // Log error but continue with other targets
      logger.error(`Failed to capture snapshot for target ${target.id}: ${error.message}`);
    }
  }
}

/**
 * Get current value for a target based on domain
 */
async function getCurrentValue(target: Target): Promise<{
  value: number;
  type: string;
  source: string;
}> {
  switch (target.target_type) {
    case 'stock':
      // Use Yahoo Finance or Polygon API
      const stockQuote = await yahooFinance.quote(target.symbol);
      return {
        value: stockQuote.price,
        type: 'price',
        source: 'yahoo-finance'
      };

    case 'crypto':
      // Use CoinGecko API
      const cryptoPrice = await coinGecko.getPrice(target.symbol);
      return {
        value: cryptoPrice.usd,
        type: 'price',
        source: 'coingecko'
      };

    case 'polymarket':
      // Use Polymarket API
      const marketOdds = await polymarket.getOdds(target.external_id);
      return {
        value: marketOdds.yesPrice,  // Probability as decimal (0-1)
        type: 'probability',
        source: 'polymarket'
      };

    case 'election':
      // Use polling aggregator API
      const polling = await pollingAggregator.getLatest(target.external_id);
      return {
        value: polling.probability,  // Win probability
        type: 'probability',
        source: 'polling-aggregator'
      };

    default:
      throw new Error(`Unknown target type: ${target.target_type}`);
  }
}
```

#### 11.4.3 Snapshot Creation on Prediction

```typescript
/**
 * Capture baseline snapshot when creating a prediction
 */
async function capturePredictionBaseline(
  targetId: string,
  predictionId: string
): Promise<void> {
  const target = await getTarget(targetId);
  const currentValue = await getCurrentValue(target);

  // Store baseline in prediction record
  await db.query(`
    UPDATE prediction.predictions
    SET 
      baseline_value = $1,
      baseline_captured_at = NOW()
    WHERE id = $2
  `, [currentValue.value, predictionId]);

  // Also create snapshot record for historical tracking
  await db.query(`
    INSERT INTO prediction.target_snapshots
    (target_id, value, value_type, source, captured_at)
    VALUES ($1, $2, $3, $4, NOW())
  `, [targetId, currentValue.value, currentValue.type, 'prediction_baseline']);
}
```

#### 11.4.4 Snapshot Creation on Resolution

```typescript
/**
 * Capture outcome snapshot when resolving a prediction
 */
async function capturePredictionOutcome(
  predictionId: string
): Promise<void> {
  const prediction = await db.query(`
    SELECT target_id, timeframe_type, timeframe_value, target_date
    FROM prediction.predictions
    WHERE id = $1
  `, [predictionId]);

  const target = await getTarget(prediction.target_id);
  const currentValue = await getCurrentValue(target);

  // Determine if prediction timeframe has passed
  const isResolved = isPredictionResolved(prediction, currentValue);

  if (isResolved) {
    await db.query(`
      UPDATE prediction.predictions
      SET 
        outcome_value = $1,
        outcome_direction = $2,
        outcome_captured_at = NOW(),
        status = 'resolved',
        resolved_at = NOW()
      WHERE id = $3
    `, [
      currentValue.value,
      determineDirection(prediction.baseline_value, currentValue.value),
      predictionId
    ]);

    // Create snapshot for outcome
    await db.query(`
      INSERT INTO prediction.target_snapshots
      (target_id, value, value_type, source, captured_at)
      VALUES ($1, $2, $3, $4, NOW())
    `, [target.target_id, currentValue.value, currentValue.type, 'prediction_outcome']);
  }
}
```

#### 11.4.5 Snapshot Retention Policy

```sql
-- Keep snapshots for:
-- - Last 30 days: All snapshots
-- - 30-90 days: One per hour
-- - 90+ days: One per day

-- Cleanup job (runs daily)
DELETE FROM prediction.target_snapshots
WHERE captured_at < NOW() - INTERVAL '90 days'
  AND id NOT IN (
    -- Keep one snapshot per day for old data
    SELECT DISTINCT ON (target_id, DATE(captured_at))
      id
    FROM prediction.target_snapshots
    WHERE captured_at < NOW() - INTERVAL '30 days'
      AND captured_at >= NOW() - INTERVAL '90 days'
    ORDER BY target_id, DATE(captured_at), captured_at DESC
  );
```

#### 11.4.6 Error Handling

| Error Scenario | Handling |
|----------------|----------|
| API timeout | Retry once after 5 seconds, then skip |
| API rate limit | Wait for reset window, reschedule |
| Invalid symbol | Log error, mark target as `needs_attention` |
| API unavailable | Skip snapshot, retry on next cycle |
| Value parsing error | Log error, use last known value if available |

---

## 12. Explainability

### 12.1 Prediction Snapshot Structure

```typescript
interface PredictionSnapshot {
  predictionId: string;

  // Predictors that triggered this
  predictors: {
    id: string;
    type: string;
    summary: string;
    strength: number;
    direction: string;
    signalId: string;
    analystAssessments: {
      analystId: string;
      analystName: string;
      strength: number;
      reasoning: string;
    }[];
    llmAssessments: {
      tier: string;
      isPredictor: boolean;
      confidence: number;
      strength: number;
    }[];
  }[];

  // Signals considered but rejected
  rejectedSignals: {
    id: string;
    summary: string;
    rejectionReason: string;
    learningApplied?: string;
  }[];

  // Per-analyst predictions
  analystPredictions: {
    analystId: string;
    name: string;
    scopeLevel: string;
    weight: number;
    prediction: {
      direction: string;
      magnitude: number;
      confidence: number;
      reasoning: string;
    };
    llmTierPredictions: {
      tier: string;
      direction: string;
      magnitude: number;
      confidence: number;
      reasoning: string;
    }[];
  }[];

  // LLM tier ensemble
  llmEnsemble: {
    gold?: PredictionResult;
    silver?: PredictionResult;
    bronze?: PredictionResult;
    agreementScore: number;
    divergences: string[];
  };

  // Learnings applied
  learningsApplied: {
    id: string;
    scopeLevel: string;
    content: string;
    sourceType: string;
  }[];

  // Threshold evaluation
  thresholdEvaluation: {
    rules: {
      name: string;
      required: number;
      actual: number;
      passed: boolean;
    }[];
    triggeredAt: Date;
    previousPredictionId?: string;
  };

  // Timeline
  timeline: {
    timestamp: Date;
    event: string;
    details: any;
  }[];
}
```

### 12.2 Creating Snapshot

```typescript
async function createPredictionSnapshot(
  prediction: Prediction,
  context: PredictionContext
): Promise<PredictionSnapshot> {
  const snapshot: PredictionSnapshot = {
    predictionId: prediction.id,

    predictors: await enrichPredictors(context.predictors),
    rejectedSignals: await getRecentRejectedSignals(prediction.targetId),
    analystPredictions: context.analystAssessments,
    llmEnsemble: context.llmEnsemble,
    learningsApplied: context.learnings,
    thresholdEvaluation: context.thresholdEval,
    timeline: await buildTimeline(prediction.targetId, context)
  };

  await db.query(`
    INSERT INTO prediction.snapshots
    (prediction_id, predictors, rejected_signals, analyst_predictions, llm_ensemble, learnings_applied, threshold_evaluation, timeline, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
  `, [
    prediction.id,
    JSON.stringify(snapshot.predictors),
    JSON.stringify(snapshot.rejectedSignals),
    JSON.stringify(snapshot.analystPredictions),
    JSON.stringify(snapshot.llmEnsemble),
    JSON.stringify(snapshot.learningsApplied),
    JSON.stringify(snapshot.thresholdEvaluation),
    JSON.stringify(snapshot.timeline)
  ]);

  return snapshot;
}
```

---

## 13. Missed Opportunity Analysis

### 13.1 Detection

```typescript
async function detectMissedOpportunities() {
  const targets = await getActiveTargets();

  for (const target of targets) {
    const snapshots = await getRecentSnapshots(target.id, '24h');
    const moves = detectSignificantMoves(snapshots, target);

    for (const move of moves) {
      const hadPrediction = await findPredictionForMove(target.id, move);

      if (!hadPrediction) {
        await createMissedOpportunity(target, move);
        await queueMissAnalysis(target.id);
      }
    }
  }
}

function detectSignificantMoves(
  snapshots: Snapshot[],
  target: Target
): SignificantMove[] {
  const threshold = getSignificantMoveThreshold(target); // e.g., 3%
  const moves: SignificantMove[] = [];

  // Sliding window analysis
  for (let i = 0; i < snapshots.length - 1; i++) {
    for (let j = i + 1; j < snapshots.length; j++) {
      const pctChange = (snapshots[j].value - snapshots[i].value) / snapshots[i].value;

      if (Math.abs(pctChange) >= threshold) {
        moves.push({
          direction: pctChange > 0 ? 'up' : 'down',
          magnitude: Math.abs(pctChange) * 100,
          startValue: snapshots[i].value,
          endValue: snapshots[j].value,
          startAt: snapshots[i].capturedAt,
          endAt: snapshots[j].capturedAt
        });
      }
    }
  }

  return deduplicateMoves(moves);
}
```

### 13.2 Retroactive Research

```typescript
async function analyzeMissedOpportunity(missId: string) {
  const miss = await getMissedOpportunity(missId);
  const target = await getTarget(miss.targetId);

  // 1. Research what caused the move
  const drivers = await researchMoveDrivers(target, miss);

  // 2. Get signals we had
  const signalsWeHad = await getSignalsInWindow(
    target.id,
    subHours(miss.moveStartAt, 48),
    miss.moveStartAt
  );

  // 3. Analyze why we didn't act
  const signalAnalysis = await analyzeWhyWeDidntAct(signalsWeHad);

  // 4. Identify source gaps
  const sourceGaps = identifySourceGaps(drivers);

  // 5. Reconstruct hypothetical prediction
  const reconstructed = await reconstructPrediction(drivers, signalsWeHad, target);

  // 6. Generate learnings
  const learnings = await generateLearningsFromMiss(miss, drivers, signalAnalysis);

  // 7. Generate tool/source suggestions
  const toolSuggestions = generateToolSuggestions(sourceGaps);

  // Save analysis
  await updateMissedOpportunity(missId, {
    analysisStatus: 'complete',
    discoveredDrivers: drivers,
    signalsWeHad: signalAnalysis,
    sourceGaps,
    reconstructedPrediction: reconstructed,
    suggestedLearnings: learnings,
    suggestedTools: toolSuggestions,
    analyzedAt: new Date()
  });

  // Queue learnings and tool requests
  await queueLearningsForReview(learnings);
  await createToolRequests(toolSuggestions);
}
```

---

## 14. Cron Jobs & Scheduling

### 14.1 Schedule

| Cron | Job | Description |
|------|-----|-------------|
| `*/5 * * * *` | High-priority crawl | 5-minute sources |
| `*/10 * * * *` | Medium-priority crawl | 10-minute sources |
| `*/15 * * * *` | Standard crawl + Signal→Predictor batch | 15-minute sources |
| `*/30 * * * *` | Low-priority crawl + Predictor→Prediction batch | 30-minute sources |
| `0 * * * *` | Hourly crawl + Outcome check | Hourly sources, check predictions |
| `0 */4 * * *` | Missed opportunity scan | Find moves we missed |
| `0 0 * * *` | Daily evaluation | Score predictions, generate learnings |
| `0 0 * * 0` | Weekly cleanup | Archive old data, recalibrate |

### 14.2 Job Implementations

```typescript
// Source crawler
async function runSourceCrawler(frequency: number) {
  const sources = await db.query(`
    SELECT * FROM prediction.sources
    WHERE is_active = true
      AND frequency_minutes = $1
      AND (last_crawl_at IS NULL OR last_crawl_at < NOW() - make_interval(mins => $1))
    LIMIT 100
  `, [frequency]);

  await pMap(sources.rows, crawlSource, { concurrency: 5 });
}

// Outcome checker
async function checkOutcomes() {
  const predictions = await getActivePredictions();

  for (const prediction of predictions) {
    const currentValue = await getCurrentValue(prediction.targetId);

    if (isPredictionResolved(prediction, currentValue)) {
      await resolvePrediction(prediction, currentValue);
      await queueEvaluation(prediction.id);
    } else if (isPredictionExpired(prediction)) {
      await expirePrediction(prediction, currentValue);
      await queueEvaluation(prediction.id);
    }
  }
}
```

---

## 15. Notifications & Streaming

**CRITICAL**: Use existing `ObservabilityEventsService` for all streaming/notifications - do NOT create custom WebSocket infrastructure.

### 15.1 Streaming Architecture

All prediction events stream via the existing SSE infrastructure:

```
GET /agent-to-agent/:orgSlug/:agentSlug/tasks/:taskId/stream
```

**Event Types for Predictions**:

| Event Type | Description | Payload |
|------------|-------------|---------|
| `agent.stream.chunk` | Progress updates | `{ step, progress, message, metadata }` |
| `agent.stream.complete` | Prediction finalized | `{ predictionId, result }` |
| `agent.stream.error` | Processing error | `{ error, retryable }` |

### 15.2 Emitting Prediction Events

```typescript
// All prediction events use ObservabilityEventsService
import { ObservabilityEventsService } from '@/observability/observability-events.service';

class PredictionRunner {
  constructor(private observability: ObservabilityEventsService) {}

  async processSignal(context: ExecutionContext, signal: Signal) {
    // Emit start
    this.observability.emit({
      context,
      hook_event_type: 'agent.stream.chunk',
      message: `Processing signal for ${signal.targetName}`,
      step: 'signal_detection',
      progress: 0,
      metadata: {
        type: 'prediction_progress',
        signalId: signal.id,
        targetId: signal.targetId,
        tier: 'signal_detection'
      }
    });

    // ... processing ...

    // Emit prediction complete
    this.observability.emit({
      context,
      hook_event_type: 'agent.stream.complete',
      message: `Prediction generated: ${prediction.direction} ${prediction.magnitude}%`,
      metadata: {
        type: 'prediction_complete',
        predictionId: prediction.id,
        direction: prediction.direction,
        confidence: prediction.confidence
      }
    });
  }
}
```

### 15.3 Notification Types (Built on SSE)

| Type | SSE Event | Trigger | Client Action |
|------|-----------|---------|---------------|
| `urgent_prediction` | `agent.stream.complete` with `urgency: 'urgent'` | Fast path prediction | Show toast, optionally push |
| `new_prediction` | `agent.stream.complete` | Batch prediction | Update UI, queue for digest |
| `prediction_resolved` | `agent.stream.chunk` with `step: 'resolution'` | Outcome determined | Update prediction card |
| `review_pending` | `agent.stream.chunk` with `step: 'review_queued'` | Signal needs review | Badge review queue |
| `processing_error` | `agent.stream.error` | Processing failed | Show error, offer retry |

### 15.4 Client-Side Integration

```typescript
// Vue composable for prediction streaming
function usePredictionStream(orgSlug: string, agentSlug: string, taskId: string) {
  const predictionState = ref<PredictionState>({ status: 'pending', progress: 0 });

  const eventSource = new EventSource(
    `/agent-to-agent/${orgSlug}/${agentSlug}/tasks/${taskId}/stream`
  );

  eventSource.addEventListener('agent.stream.chunk', (event) => {
    const data = JSON.parse(event.data);
    if (data.metadata?.type === 'prediction_progress') {
      predictionState.value = {
        ...predictionState.value,
        progress: data.progress,
        step: data.step,
        message: data.message
      };
    }
  });

  eventSource.addEventListener('agent.stream.complete', (event) => {
    const data = JSON.parse(event.data);
    predictionState.value = {
      status: 'complete',
      progress: 100,
      prediction: data.metadata
    };
    eventSource.close();
  });

  eventSource.addEventListener('agent.stream.error', (event) => {
    const data = JSON.parse(event.data);
    predictionState.value = {
      status: 'error',
      error: data.error
    };
    eventSource.close();
  });

  return { predictionState };
}
```

### 15.5 Push Notifications (Optional Enhancement)

For urgent predictions, optionally send push notifications via external service:

```typescript
async function handleUrgentPrediction(
  context: ExecutionContext,
  prediction: Prediction
) {
  // 1. Always emit via ObservabilityEventsService (required)
  observability.emit({
    context,
    hook_event_type: 'agent.stream.complete',
    message: `URGENT: ${prediction.targetName} prediction`,
    metadata: { urgency: 'urgent', predictionId: prediction.id }
  });

  // 2. Optionally send push notification (based on user preferences)
  const userPrefs = await getUserNotificationPrefs(context.userId);
  if (userPrefs.pushEnabled && userPrefs.urgentPush) {
    await pushNotificationService.send({
      userId: context.userId,
      title: `Urgent: ${prediction.targetName}`,
      body: `${prediction.direction} ${prediction.magnitude}% (${prediction.confidence}% confidence)`,
      data: { predictionId: prediction.id }
    });
  }
}
```

### 15.6 Notification Preferences (Per Strategy)

```typescript
interface NotificationConfig {
  urgentThreshold: number;     // What confidence = urgent
  notifyOnSignals: boolean;    // Notify for notable signals
  notifyOnPredictions: boolean;
  notifyOnResolutions: boolean;
  summaryFrequency: 'realtime' | 'twice_daily' | 'daily' | 'weekly';
  // Push notifications optional enhancement
  push: {
    enabled: boolean;
    urgentOnly: boolean;
  };
}
```

---

## 16. UI Specifications

### 16.1 Key Screens

1. **Dashboard** - Active predictions, recent signals, review queue count
2. **Universe Management** - Create/edit universes, assign strategies
3. **Target Detail** - Predictions, predictors, signals for one target
4. **Prediction Detail** - Full explainability view (Section 12)
5. **Review Queue** - Pending human reviews
6. **Learnings** - Browse/add/edit learnings at all levels
7. **Analysts** - View/configure analysts
8. **Sources** - Manage URL sources
9. **Missed Opportunities** - Review misses and source gaps
10. **Tool Wishlist** - Requested new sources/capabilities

### 16.2 Prediction Card (Dashboard)

```
┌─────────────────────────────────────────────────┐
│ AAPL                                   Active   │
│ 📈 UP 3.5% ±1.8%                               │
│ Confidence: 71% │ 5-7 days │ 3 days left       │
│                                                 │
│ LLM Agreement:                                  │
│ 🟡 Gold   ⚪ Silver  🟤 Bronze                  │
│ ████████  ████████  ░░░░░░░░                   │
│ UP 3.2%   UP 4.1%   (disabled)                 │
│                                                 │
│ Based on 4 predictors │ 6 analysts agree       │
│                                    [Details →] │
└─────────────────────────────────────────────────┘
```

---

## 17. API Specifications

### 17.1 Core Endpoints

**Canonical Interface (NO REST DASHBOARD ENDPOINTS)**:

This system MUST expose prediction dashboard functionality **only** via A2A task endpoints (dashboard mode). RESTful dashboard endpoints (e.g. `/api/prediction/*`) MUST NOT exist in the final implementation.

```
# A2A Tasks (Dashboard Mode)
POST /agent-to-agent/:orgSlug/:agentSlug/tasks

# Streaming (SSE)
GET  /agent-to-agent/:orgSlug/:agentSlug/tasks/:taskId/stream

# Task Status (optional helper)
GET  /agent-to-agent/:orgSlug/:agentSlug/tasks/:taskId
```

**Deletion Requirement (No Tech Debt)**:
- Any REST controllers/routes created for prediction dashboard operations MUST be deleted (not deprecated).
- All frontend calls MUST be migrated to A2A dashboard-mode tasks.

**Mapping Principle**:
- What used to be “controller routing” by URL becomes “task routing” by `method` + `payload.action` under `mode = 'dashboard'`.
- The complete legacy REST → A2A action map is defined in **Section 18.12** and MUST be used as the deletion/coverage checklist.

#### 17.1.1 Request/Response Schemas

**Authentication**: All endpoints require authentication via:
- JWT token in `Authorization: Bearer <token>` header, OR
- Session cookie (for web clients)

**Common Query Parameters** (for list endpoints):
- `limit`: Number of items to return (default: 50, max: 100)
- `offset`: Pagination offset (default: 0)
- `sort`: Sort field (default: `created_at`)
- `order`: Sort order `asc` | `desc` (default: `desc`)
- `filter`: JSON filter object (domain-specific)

**Common Response Format**:
```typescript
interface ApiResponse<T> {
  data: T;
  pagination?: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
  meta?: {
    requestId: string;
    timestamp: string;
  };
}

interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta: {
    requestId: string;
    timestamp: string;
  };
}
```

**Example: Dashboard Load (batched)**:
```typescript
// POST /agent-to-agent/:orgSlug/:agentSlug/tasks
// Request (dashboard mode)
{
  "jsonrpc": "2.0",
  "method": "dashboard.load",
  "id": "request-1",
  "params": {
    "mode": "dashboard",
    "userMessage": "",
    "payload": {
      "action": "dashboard.load",
      "include": ["predictions", "targets", "review_queue", "cost_summary"],
      "predictions": { "status": "active", "limit": 25, "offset": 0 },
      "targets": { "limit": 25, "offset": 0 }
    }
  }
}

// Response (200 OK)
{
  "jsonrpc": "2.0",
  "id": "request-1",
  "result": {
    "success": true,
    "mode": "dashboard",
    "payload": {
      "content": {
        "predictions": [],
        "targets": [],
        "reviewQueue": { "pendingCount": 0 },
        "costSummary": { "monthToDate": 0 }
      },
      "metadata": { "requestType": "dashboard.load" }
    }
  }
}
```

**Example: Review Queue Response**:
```typescript
// POST /agent-to-agent/:orgSlug/:agentSlug/tasks
// Request (dashboard mode)
{
  "jsonrpc": "2.0",
  "method": "dashboard.review_queue.respond",
  "id": "request-2",
  "params": {
    "mode": "dashboard",
    "userMessage": "",
    "payload": {
      "action": "review_queue.respond",
      "reviewId": "review-uuid",
      "decision": "approved",
      "note": "This is a valid predictor",
      "strengthOverride": 7
    }
  }
}

// Response (200 OK)
{
  "jsonrpc": "2.0",
  "id": "request-2",
  "result": {
    "success": true,
    "mode": "dashboard",
    "payload": {
      "content": {
        "reviewId": "review-uuid",
        "status": "approved",
        "predictorCreated": true,
        "predictorId": "predictor-uuid",
        "learningQueued": false
      },
      "metadata": { "requestType": "review_queue.respond" }
    }
  }
}
```

**Error Responses**:
```typescript
// 400 Bad Request
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": {
      "field": "domain",
      "issue": "Domain must be one of: stocks, crypto, elections, polymarket"
    }
  }
}

// 401 Unauthorized
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}

// 403 Forbidden
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to access this resource"
  }
}

// 404 Not Found
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Universe not found"
  }
}

// 409 Conflict
{
  "error": {
    "code": "CONFLICT",
    "message": "A universe with this name already exists in your organization"
  }
}

// 500 Internal Server Error
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred",
    "details": {
      "requestId": "req-uuid"
    }
  }
}
```

### 17.2 Streaming Events (via ObservabilityEventsService)

**PROHIBITED**: Do not use a custom WebSocket. Use existing SSE streaming (see Section 15).

```typescript
// Use ObservabilityEventsService for all events
// Subscribe via: GET /agent-to-agent/:orgSlug/:agentSlug/tasks/:taskId/stream

// Event types emitted by prediction system:
interface PredictionStreamEvents {
  'agent.stream.chunk': {
    step: 'signal_detection' | 'predictor_creation' | 'prediction_generation' | 'evaluation';
    progress: number;
    message: string;
    metadata: PredictionProgressMetadata;
  };
  'agent.stream.complete': {
    metadata: {
      type: 'prediction_complete';
      predictionId: string;
      direction: string;
      confidence: number;
    };
  };
  'agent.stream.error': {
    error: string;
    retryable: boolean;
  };
}
```

### 17.3 A2A Protocol Integration

**CRITICAL**: Prediction agents MUST use transport types from `@orchestrator-ai/transport-types` for all A2A requests and responses.

**Transport Types Package**: `apps/transport-types/`
- Request types: `A2ATaskRequest`, `TaskRequestParams`
- Response types: `A2ATaskSuccessResponse`, `A2ATaskErrorResponse`, `TaskResponse`
- ExecutionContext: `ExecutionContext` (REQUIRED in all requests)

#### 17.3.0 Dashboard Mode (First-Class A2A Mode)

This prediction system is primarily a **dashboard-style agent** (not conversational chat, not plan/build). For correctness and long-term ecosystem interoperability, A2A calls MUST use a dedicated **dashboard mode**:

- `params.mode = 'dashboard'`
- `method = 'dashboard.<action>'` (recommended), or `method = 'dashboard'` with `params.payload.action`

**Transport Types Update Required (PRD requirement)**:
- Add `AgentTaskMode.DASHBOARD = 'dashboard'` to `apps/transport-types/shared/enums.ts`
- Add `apps/transport-types/modes/dashboard.types.ts` exporting:
  - `DashboardAction` (action union)
  - `DashboardModePayload` (payload shapes per action)
  - `DashboardRequestMetadata` / `DashboardResponseMetadata` (metadata contracts)
- Export the dashboard types from `apps/transport-types/index.ts`

**Dashboard Action Surface (Prediction Agent)**:
- `dashboard.load` (batched initial payload for dashboard home)
- `universes.list` | `universes.create` | `universes.get` | `universes.update` | `universes.delete`
- `targets.list` | `targets.create` | `targets.get` | `targets.update` | `targets.delete`
- `predictions.list` | `predictions.get` | `predictions.snapshot.get`
- `sources.list` | `sources.create` | `sources.update` | `sources.delete` | `sources.test_crawl`
- `review_queue.list` | `review_queue.respond`
- `learnings.list` | `learnings.create` | `learnings.update` | `learnings.delete`
- `learning_queue.list` | `learning_queue.respond`
- `analysts.list` | `analysts.create` | `analysts.update` | `analysts.delete`
- `strategies.list`
- `missed_opportunities.list` | `missed_opportunities.get`
- `tool_requests.list` | `tool_requests.create`

**Note**: These are **agent operations** exposed via A2A for consistency across internal/external clients. Internally, the backend may query DB/services directly; it does NOT need to spawn nested A2A calls.

#### 17.3.1 Agent Discovery

```
GET /agent-to-agent/.well-known/hierarchy
```

Returns prediction agents in hierarchy:

```json
{
  "agents": [
    {
      "slug": "us-tech-stocks-2025",
      "name": "US Tech Stocks 2025",
      "type": "context",
      "capabilities": ["prediction", "signal_detection", "evaluation"],
      "metadata": {
        "domain": "stocks",
        "universeId": "uuid-here"
      }
    },
    {
      "slug": "crypto-majors-2025",
      "name": "Crypto Majors 2025",
      "type": "context",
      "capabilities": ["prediction", "signal_detection", "evaluation"],
      "metadata": {
        "domain": "crypto",
        "universeId": "uuid-here"
      }
    }
  ]
}
```

#### 17.3.2 Create Prediction Task

**Endpoint**: `POST /agent-to-agent/:orgSlug/:agentSlug/tasks`

**Request Structure** (using `A2ATaskRequest` from transport types):

```typescript
import { A2ATaskRequest, ExecutionContext, AgentTaskMode } from '@orchestrator-ai/transport-types';

const request: A2ATaskRequest = {
  jsonrpc: "2.0",
  method: "dashboard.predictions.get", // Dashboard mode JSON-RPC method
  id: "request-1",
  params: {
    context: {
      orgSlug: "demo-org",
      userId: "user-uuid",
      conversationId: "conversation-uuid",
      taskId: "task-uuid",
      planId: "00000000-0000-0000-0000-000000000000",
      deliverableId: "00000000-0000-0000-0000-000000000000",
      agentSlug: "us-tech-stocks-2025",
      agentType: "context",
      provider: "anthropic",
      model: "claude-sonnet-4-20250514"
    } as ExecutionContext,
    mode: "dashboard" as AgentTaskMode,
    userMessage: "", // Dashboard requests may use empty userMessage
    payload: {
      action: "predictions.get",
      predictionId: "prediction-uuid"
    }
  }
};
```

**Response Structure** (using `A2ATaskSuccessResponse` from transport types):

```typescript
import { A2ATaskSuccessResponse } from '@orchestrator-ai/transport-types';

const response: A2ATaskSuccessResponse = {
  jsonrpc: "2.0",
  id: "request-1",
  result: {
    success: true,
    mode: "dashboard",
    payload: {
      content: {
        prediction: {
          id: "prediction-uuid",
          direction: "up",
          magnitude: 3.5,
          confidence: 0.71,
          timeframe: { value: 7, unit: "days" }
        },
        snapshot: { /* full explainability snapshot */ }
      },
      metadata: {
        taskId: "task-uuid",
        streamUrl: "/agent-to-agent/demo-org/us-tech-stocks-2025/tasks/task-uuid/stream",
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        usage: {
          inputTokens: 1500,
          outputTokens: 800
        }
      }
    },
    context: {
      // Updated ExecutionContext with taskId, conversationId
      orgSlug: "demo-org",
      userId: "user-uuid",
      conversationId: "conversation-uuid",
      taskId: "task-uuid",  // New task ID
      planId: "00000000-0000-0000-0000-000000000000",
      deliverableId: "00000000-0000-0000-0000-000000000000",
      agentSlug: "us-tech-stocks-2025",
      agentType: "context",
      provider: "anthropic",
      model: "claude-sonnet-4-20250514"
    }
  }
};
```

**Error Response** (using `A2ATaskErrorResponse` from transport types):

```typescript
import { A2ATaskErrorResponse, JsonRpcErrorCode } from '@orchestrator-ai/transport-types';

const errorResponse: A2ATaskErrorResponse = {
  jsonrpc: "2.0",
  id: "request-1",
  error: {
    code: JsonRpcErrorCode.InternalError,  // -32603
    message: "Failed to generate prediction: Target not found",
    data: {
      targetId: "uuid-of-target",
      errorCode: "TARGET_NOT_FOUND"
    }
  }
};
```

#### 17.3.3 Query Predictions

**Request** (using transport types):

```typescript
const queryRequest: A2ATaskRequest = {
  jsonrpc: "2.0",
  method: "dashboard.predictions.list",
  id: "request-2",
  params: {
    context: {
      orgSlug: "demo-org",
      userId: "user-uuid",
      conversationId: "conversation-uuid",
      taskId: "task-uuid-2",
      planId: "00000000-0000-0000-0000-000000000000",
      deliverableId: "00000000-0000-0000-0000-000000000000",
      agentSlug: "us-tech-stocks-2025",
      agentType: "context",
      provider: "anthropic",
      model: "claude-sonnet-4-20250514"
    } as ExecutionContext,
    mode: "dashboard" as AgentTaskMode,
    userMessage: "",
    payload: {
      action: "predictions.list",
      filters: { targetSymbol: "AAPL", status: "active" },
      limit: 50,
      offset: 0
    }
  }
};
```

**Response**:

```typescript
const queryResponse: A2ATaskSuccessResponse = {
  jsonrpc: "2.0",
  id: "request-2",
  result: {
    success: true,
    mode: "dashboard",
    payload: {
      content: {
        predictions: [
          {
            id: "prediction-uuid-1",
            targetSymbol: "AAPL",
            direction: "up",
            magnitude: 3.5,
            confidence: 0.71,
            status: "active"
          }
        ]
      },
      metadata: {
        count: 1,
        filters: { targetSymbol: "AAPL", status: "active" }
      }
    }
  }
};
```

#### 17.3.4 Get Task Result

**Endpoint**: `GET /agent-to-agent/:orgSlug/:agentSlug/tasks/:taskId`

**Response** (not JSON-RPC, direct task status):

```json
{
  "taskId": "task-uuid",
  "status": "completed",
  "result": {
    "prediction": {
      "id": "prediction-uuid",
      "direction": "up",
      "magnitude": 3.5,
      "confidence": 0.71,
      "timeframe": { "value": 7, "unit": "days" }
    },
    "snapshot": { /* full explainability snapshot */ }
  },
  "artifacts": [
    { "type": "prediction", "id": "prediction-uuid" }
  ]
}
```

**Note**: This endpoint returns task status directly, not wrapped in JSON-RPC. The actual A2A response is returned from the POST endpoint above.

#### 17.3.5 A2A Authentication

All A2A requests require authentication:

```typescript
// Header-based auth (API key)
headers: {
  'Authorization': 'Bearer <api-key>',
  'X-Organization-Slug': 'org-slug'
}

// Or cookie-based auth for web clients
// Session cookie automatically included
```

---

## 18. Migration from Existing Prediction System

### 18.1 Current State - Existing `predictions` Schema

The existing prediction system uses the `predictions` schema (plural) with these tables:

**Agent & Configuration:**
- `predictions.prediction_agents` - Agent configs (runner_type, instruments, risk_profile, etc.)

**Data Collection:**
- `predictions.datapoints` - Poll cycle collections (sources, claims, instruments, metadata)
- `predictions.runs` - Execution records (status, metrics, thread_id)

**Pipeline Results:**
- `predictions.triage_results` - Triage decisions per instrument bundle
- `predictions.specialist_analyses` - Specialist output (conclusion, confidence, analysis)
- `predictions.evaluator_challenges` - Red-team evaluation results

**Recommendations & Outcomes:**
- `predictions.recommendations` - Trading recommendations (action, confidence, sizing)
- `predictions.outcomes` - Evaluation of recommendation accuracy
- `predictions.recommendation_executions` - Execution tracking

**Learning Loop:**
- `predictions.postmortems` - Post-outcome analysis
- `predictions.missed_opportunities` - Significant moves not predicted
- `predictions.user_insights` - Human feedback
- `predictions.learning_conversations` - Learning session tracking
- `predictions.specialist_accuracy` - Calibration tracking

**Existing Services:**
- `PredictionDbService` - Store datapoints, claims, triage results
- `OutcomeEvaluationService` - Evaluate recommendation accuracy
- `PostmortemService` - Create learning records from outcomes
- `MissedOpportunityService` - Detect significant moves not predicted
- `LearningContextBuilderService` - Build context for LLM prompts
- `AgentContextUpdateService` - Apply learnings back to agent

### 18.2 New `prediction` Schema (Singular)

The new architecture introduces a `prediction` schema (singular) with:

**Hierarchical Structure:**
- `prediction.universes` - Groups of targets (replaces agent-level config)
- `prediction.targets` - What we predict about (WITH CONTEXT COLUMN)
- `prediction.signals` - Raw events from sources
- `prediction.predictors` - Validated signals with strength/direction
- `prediction.predictions` - Actual forecasts

**Multi-LLM & Multi-Analyst:**
- `prediction.analysts` - AI personalities with perspectives
- `prediction.llm_tier_mapping` - VIEW mapping to existing `llm_models`
- `prediction.analyst_assessments` - Per-analyst, per-LLM assessments

**Learning (Enhanced):**
- `prediction.learnings` - Scoped learnings (global/domain/target/predictor)
- `prediction.snapshots` - Full explainability snapshots
- `prediction.evaluations` - Post-resolution analysis

### 18.3 Schema Mapping: Old → New

| Old (`predictions.*`) | New (`prediction.*`) | Notes |
|-----------------------|----------------------|-------|
| `prediction_agents` | `universes` + agent metadata | Universe = agent's target collection |
| `prediction_agents.instruments` | `targets` table | Flat array → structured table with context |
| `datapoints` | `signals` + `predictors` | Claims become signals, validated claims become predictors |
| `runs` | Implicit in task/conversation flow | ExecutionContext tracks runs |
| `triage_results` | Signal `disposition` + `predictor_ids` | Triage integrated into signal processing |
| `specialist_analyses` | `analyst_assessments` | Specialists → Analysts, per-LLM tier |
| `evaluator_challenges` | `analyst_assessments` (evaluator role) | Evaluators are analyst type |
| `recommendations` | `predictions` | Recommendations → Predictions |
| `outcomes` | `evaluations` | Enhanced with accuracy scoring |
| `postmortems` | `learnings` | Auto-extracted to scoped learnings |
| `missed_opportunities` | `missed_opportunities` (new location) | Similar structure, new schema |
| `user_insights` | `learnings` (source: 'human') | Integrated into learning system |
| `specialist_accuracy` | Computed from `evaluations` | Query-time aggregation |

### 18.4 What Changes for Existing Agents

Existing prediction agents in `public.agents`:
- `us-tech-stocks-2025` - Stocks domain
- `crypto-majors-2025` - Crypto domain
- `polymarket-politics-2025` - Polymarket domain

**Current Architecture** (Legacy):
- Targets stored as flat array in `metadata.runnerConfig.instruments`: `["AAPL", "MSFT", "NVDA"]`
- No per-target context or configuration
- No structured target metadata

```json
// Current agent metadata structure
{
  "runnerConfig": {
    "runner": "stock-predictor",
    "instruments": ["AAPL", "MSFT", "NVDA", "GOOGL", "META", "AMZN", "TSLA"],
    "riskProfile": "moderate",
    "pollIntervalMs": 60000,
    "preFilterThresholds": { ... }
  }
}
```

**New Architecture**:
- Targets in `prediction.targets` table with full metadata
- Per-target context for LLM prompts
- Per-target threshold overrides
- Structured `context_metadata` for tools

### 18.5 Migration Strategy

#### Phase 1: Schema Migration (Non-Breaking)

1. Create `prediction` schema and all new tables
2. Keep existing agents running unchanged
3. Create universe and target records from agent metadata

```sql
-- Step 1: Create universes for existing agents
INSERT INTO prediction.universes (organization_slug, agent_slug, name, domain)
SELECT
  organization_slug[1],  -- First org in array
  slug,
  name,
  CASE
    WHEN slug LIKE '%stocks%' THEN 'stocks'
    WHEN slug LIKE '%crypto%' THEN 'crypto'
    WHEN slug LIKE '%polymarket%' THEN 'polymarket'
  END as domain
FROM public.agents
WHERE slug IN ('us-tech-stocks-2025', 'crypto-majors-2025', 'polymarket-politics-2025');

-- Step 2: Migrate instruments to targets table
-- This requires a function to extract from JSONB array
```

#### Phase 2: Instrument → Target Migration

Extract instruments from `metadata.runnerConfig.instruments` and create proper target records:

```typescript
/**
 * Migrate instruments from agent metadata to prediction.targets table
 */
async function migrateInstrumentsToTargets(agentSlug: string) {
  // 1. Get agent metadata
  const agent = await db.query(`
    SELECT id, slug, metadata
    FROM public.agents
    WHERE slug = $1
  `, [agentSlug]);

  const instruments = agent.metadata?.runnerConfig?.instruments || [];
  const domain = getDomainFromSlug(agentSlug);

  // 2. Get or create universe
  const universe = await db.query(`
    SELECT id FROM prediction.universes WHERE agent_slug = $1
  `, [agentSlug]);

  // 3. Create target for each instrument with default context
  for (const symbol of instruments) {
    const targetInfo = await enrichTargetInfo(symbol, domain);

    await db.query(`
      INSERT INTO prediction.targets (
        universe_id,
        symbol,
        name,
        target_type,
        context,
        context_metadata,
        is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, true)
      ON CONFLICT (universe_id, symbol) DO UPDATE SET
        name = EXCLUDED.name,
        context = COALESCE(prediction.targets.context, EXCLUDED.context),
        context_metadata = prediction.targets.context_metadata || EXCLUDED.context_metadata
    `, [
      universe.id,
      symbol,
      targetInfo.name,
      domain === 'stocks' ? 'stock' : domain,
      targetInfo.defaultContext,
      targetInfo.metadata
    ]);
  }
}

/**
 * Generate default context and metadata for a target
 */
async function enrichTargetInfo(symbol: string, domain: string): Promise<TargetInfo> {
  if (domain === 'stocks') {
    // Fetch from Yahoo Finance or similar
    const quote = await yahooFinance.quote(symbol);
    return {
      name: quote.longName || symbol,
      defaultContext: `${quote.longName} (${symbol}) - ${quote.sector || 'Unknown sector'}. ` +
        `Market cap: ${formatMarketCap(quote.marketCap)}. ` +
        `Industry: ${quote.industry || 'Unknown'}.`,
      metadata: {
        sector: quote.sector,
        industry: quote.industry,
        marketCap: categorizeMarketCap(quote.marketCap),
        exchange: quote.exchange
      }
    };
  } else if (domain === 'crypto') {
    // Fetch from CoinGecko
    const coin = await coingecko.getCoin(symbol.replace('-USD', '').toLowerCase());
    return {
      name: coin.name,
      defaultContext: `${coin.name} (${symbol}) - ${coin.description?.en?.slice(0, 200) || 'Cryptocurrency'}.`,
      metadata: {
        category: coin.categories?.[0],
        rank: coin.market_cap_rank
      }
    };
  }
  // ... handle other domains
}
```

#### Phase 3: Context Enrichment

After basic migration, enrich targets with detailed context:

```sql
-- Example: Update stock targets with richer context
UPDATE prediction.targets t
SET context = format(
  E'## %s (%s)\n\n' ||
  E'**Sector:** %s\n' ||
  E'**Industry:** %s\n' ||
  E'**Market Cap:** %s\n\n' ||
  E'### Key Drivers\n' ||
  E'- [Add specific drivers for this stock]\n\n' ||
  E'### Watch For\n' ||
  E'- Earnings reports\n' ||
  E'- Management guidance\n' ||
  E'- Sector trends',
  t.name,
  t.symbol,
  t.context_metadata->>'sector',
  t.context_metadata->>'industry',
  t.context_metadata->>'marketCap'
),
context_updated_at = NOW()
WHERE t.target_type = 'stock'
  AND t.context IS NULL;
```

#### Phase 4: Dual-Write Mode

1. Update existing runners to write to both old and new tables
2. Monitor for discrepancies
3. Validate data consistency

```typescript
class MigrationPredictionRunner extends BasePredictionRunner {
  async createPrediction(data: PredictionData) {
    // Write to legacy table
    const legacyResult = await super.createPrediction(data);

    // Also write to new prediction schema
    await this.predictionService.createInNewSchema({
      ...data,
      universeId: this.getUniverseIdForAgent(this.agentSlug)
    });

    return legacyResult;
  }
}
```

#### Phase 5: Cutover

1. Update agent metadata to use new runner
2. Remove `instruments` from metadata (now in targets table)
3. Add universe reference

```sql
-- Update agent to use new runner and reference universe
UPDATE public.agents
SET metadata = jsonb_set(
  jsonb_set(
    metadata - 'runnerConfig' || jsonb_build_object(
      'runnerConfig', (metadata->'runnerConfig') - 'instruments'
    ),
    '{runnerConfig,runnerType}',
    '"prediction-v2"'
  ),
  '{runnerConfig,universeId}',
  to_jsonb((SELECT id::text FROM prediction.universes WHERE agent_slug = agents.slug))
)
WHERE slug = 'us-tech-stocks-2025';
```

#### Phase 6: Cleanup

1. Remove dual-write code
2. Drop legacy prediction tables
3. Update all API consumers

### 18.6 Target Context Templates

Default context templates by domain:

```typescript
const CONTEXT_TEMPLATES = {
  stock: `## {{name}} ({{symbol}})

**Sector:** {{sector}}
**Industry:** {{industry}}
**Market Cap:** {{marketCap}}

### Key Drivers
- Revenue growth and margins
- Competitive positioning
- Management execution

### Signals to Watch
- Earnings surprises
- Guidance changes
- Insider activity
- Analyst revisions

### Historical Patterns
[To be populated by learning system]
`,

  crypto: `## {{name}} ({{symbol}})

**Category:** {{category}}
**Market Cap Rank:** {{rank}}

### Key Drivers
- Network activity and adoption
- Developer activity
- Token economics

### Signals to Watch
- On-chain metrics
- Exchange flows
- Whale movements
- Protocol updates

### Correlation Notes
[To be populated by learning system]
`,

  election: `## {{name}}

**Office:** {{office}}
**Incumbent:** {{incumbent}}
**Election Date:** {{date}}

### Key Factors
- Demographics
- Historical voting patterns
- Candidate quality

### Signals to Watch
- Polling shifts
- Fundraising reports
- Endorsements
- Early voting data
`,

  polymarket: `## {{name}}

**Contract ID:** {{externalId}}
**Resolution Criteria:** {{criteria}}

### Key Factors
- [Specific to contract type]

### Resolution Triggers
- [Official announcements that resolve this contract]
`
};
```

### 18.7 Data Migration Script

Complete migration script:

```typescript
async function migrateAgentToPredictionSchema(agentSlug: string) {
  const universeId = await getOrCreateUniverse(agentSlug);

  // Step 1: Migrate instruments to targets with context
  await migrateInstrumentsToTargets(agentSlug);

  // Step 2: Migrate historical predictions
  const legacyPredictions = await getLegacyPredictions(agentSlug);
  for (const prediction of legacyPredictions) {
    const targetId = await getTargetIdBySymbol(universeId, prediction.instrument);
    if (!targetId) {
      console.warn(`No target found for ${prediction.instrument}, skipping`);
      continue;
    }

    await db.query(`
      INSERT INTO prediction.predictions (
        target_id, direction, magnitude, confidence,
        status, created_at, resolved_at, reasoning
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT DO NOTHING
    `, [
      targetId,
      prediction.direction,
      prediction.magnitude,
      prediction.confidence,
      prediction.status,
      prediction.created_at,
      prediction.resolved_at,
      prediction.reasoning
    ]);
  }

  // Step 3: Log migration
  console.log(`Migrated ${agentSlug}:`);
  console.log(`  - Universe: ${universeId}`);
  console.log(`  - Targets: ${await getTargetCount(universeId)}`);
  console.log(`  - Predictions: ${legacyPredictions.length}`);
}

// Run for all prediction agents
async function migrateAll() {
  const agents = ['us-tech-stocks-2025', 'crypto-majors-2025', 'polymarket-politics-2025'];
  for (const agent of agents) {
    await migrateAgentToPredictionSchema(agent);
  }
}
```

### 18.8 Rollback Plan

If issues occur during migration:

1. **Phase 1-3**: Simply stop writing to new tables, no user impact
2. **Phase 4**: Revert agent metadata to use legacy runner
3. **Phase 5-6**: N/A - past point of no return

### 18.9 Service Migration

**Services that need updates (not replacement):**

| Existing Service | Changes Required |
|------------------|------------------|
| `PredictionDbService` | Update table names: `predictions.*` → `prediction.*` |
| `OutcomeEvaluationService` | Map `recommendations` → `predictions`, `outcomes` → `evaluations` |
| `PostmortemService` | Output to `learnings` table instead of `postmortems` |
| `MissedOpportunityService` | Update schema reference |
| `LearningContextBuilderService` | Query new `learnings` + `targets.context` |
| `AgentContextUpdateService` | Update `targets.context` instead of agent metadata |

**New Services to Create:**

| New Service | Purpose |
|-------------|---------|
| `TargetContextService` | Manage target context (CRUD, enrichment, versioning) |
| `SignalDetectionService` | Signal → Predictor promotion logic |
| `AnalystEnsembleService` | Run analysts across LLM tiers |
| `PredictionSnapshotService` | Create explainability snapshots |
| `LLMTierResolverService` | Map gold/silver/bronze to actual models |

**Learning Loop Migration:**

The existing learning loop services work well but need schema updates:

```typescript
// Old: Learning stored in postmortems table
interface Postmortem {
  what_worked: string[];
  what_failed: string[];
  key_learnings: string[];
  applied_to_context: boolean;  // Updates agent.metadata
}

// New: Learning stored in learnings table with scope
interface Learning {
  scope_level: 'global' | 'domain' | 'target' | 'predictor';
  scope_id: string;           // Target ID, predictor ID, etc.
  content: string;            // The actual learning
  source: 'evaluation' | 'human' | 'meta_analysis';
  applied_at: Date;           // When applied to context
}
```

**Migration of Existing Postmortems:**

```sql
-- Extract learnings from existing postmortems
INSERT INTO prediction.learnings (
  scope_level, scope_id, content, source, confidence, is_active
)
SELECT
  'target',
  t.id,
  unnest(p.key_learnings),
  'evaluation',
  0.7,  -- Default confidence for migrated learnings
  true
FROM predictions.postmortems p
JOIN predictions.recommendations r ON p.recommendation_id = r.id
JOIN prediction.targets t ON t.symbol = r.instrument
WHERE p.key_learnings IS NOT NULL
  AND array_length(p.key_learnings, 1) > 0;
```

### 18.10 Success Criteria

- [ ] All instruments migrated to `prediction.targets` table
- [ ] Each target has basic context populated
- [ ] All existing recommendations queryable via new `predictions` table
- [ ] Existing postmortems converted to `learnings`
- [ ] New predictions created in new schema only
- [ ] No duplicate predictions
- [ ] Cost tracking working via ExecutionContext
- [ ] SSE streaming working for all prediction events
- [ ] A2A protocol endpoints functional
- [ ] No REST prediction dashboard routes exist (e.g. `/api/prediction/*`) — REST controller(s) deleted, not deprecated
- [ ] Frontend uses A2A dashboard mode for all operations defined in Section 18.12 (no direct REST calls)
- [ ] Target context visible in analyst prompts
- [ ] Learning loop continues to function (postmortems → learnings)
- [ ] Missed opportunity detection works with new schema

### 18.11 Deprecation Timeline

| Phase | Timeframe | Action |
|-------|-----------|--------|
| 0 | Now | Create new `prediction` schema alongside `predictions` |
| 1 | Week 1-2 | Migrate targets with context, dual-write mode |
| 2 | Week 3-4 | Migrate historical data, update services |
| 3 | Week 5-6 | Cutover to new schema, monitor |
| 4 | Week 7-8 | Deprecate old schema, remove dual-write |
| 5 | Week 10+ | Drop old `predictions` schema (after backup) |

**Breaking Changes:**
- REST dashboard endpoints (e.g., `/api/prediction/*`) are removed entirely and replaced by A2A dashboard mode operations via `POST /agent-to-agent/:orgSlug/:agentSlug/tasks`
- Frontend stores need updates for new data shapes
- Learning conversation flow updated for new learnings structure

### 18.12 Legacy REST → A2A Dashboard Method/Action Map (Deletion Checklist)

This table is the **authoritative coverage list** for removing legacy REST controllers. Every route listed here MUST be implemented via A2A dashboard mode and then the REST route MUST be deleted.

**A2A Convention**:
- `params.mode = 'dashboard'`
- `method = 'dashboard.<resource>.<operation>'` (recommended)
- `params.payload.action = '<resource>.<operation>'`

| Legacy REST Route (TO DELETE) | A2A `method` | `payload.action` | Notes |
|---|---|---|---|
| `GET /api/prediction/universes` | `dashboard.universes.list` | `universes.list` | Supports filters/pagination |
| `POST /api/prediction/universes` | `dashboard.universes.create` | `universes.create` | |
| `GET /api/prediction/universes/:id` | `dashboard.universes.get` | `universes.get` | `universeId` |
| `PUT /api/prediction/universes/:id` | `dashboard.universes.update` | `universes.update` | `universeId` |
| `DELETE /api/prediction/universes/:id` | `dashboard.universes.delete` | `universes.delete` | `universeId` |
| `GET /api/prediction/universes/:id/targets` | `dashboard.targets.list` | `targets.list` | `universeId` |
| `POST /api/prediction/universes/:id/targets` | `dashboard.targets.create` | `targets.create` | `universeId` |
| `GET /api/prediction/targets/:id` | `dashboard.targets.get` | `targets.get` | `targetId` |
| `PUT /api/prediction/targets/:id` | `dashboard.targets.update` | `targets.update` | `targetId` |
| `DELETE /api/prediction/targets/:id` | `dashboard.targets.delete` | `targets.delete` | `targetId` |
| `GET /api/prediction/targets/:id/predictions` | `dashboard.predictions.list` | `predictions.list` | `targetId` |
| `GET /api/prediction/predictions/:id` | `dashboard.predictions.get` | `predictions.get` | `predictionId` |
| `GET /api/prediction/predictions/:id/snapshot` | `dashboard.predictions.snapshot.get` | `predictions.snapshot.get` | `predictionId` |
| `GET /api/prediction/sources` | `dashboard.sources.list` | `sources.list` | |
| `POST /api/prediction/sources` | `dashboard.sources.create` | `sources.create` | |
| `PUT /api/prediction/sources/:id` | `dashboard.sources.update` | `sources.update` | `sourceId` |
| `DELETE /api/prediction/sources/:id` | `dashboard.sources.delete` | `sources.delete` | `sourceId` |
| `POST /api/prediction/sources/:id/test-crawl` | `dashboard.sources.test_crawl` | `sources.test_crawl` | `sourceId` |
| `GET /api/prediction/review-queue` | `dashboard.review_queue.list` | `review_queue.list` | |
| `POST /api/prediction/review-queue/:id/respond` | `dashboard.review_queue.respond` | `review_queue.respond` | `reviewId` |
| `GET /api/prediction/learnings` | `dashboard.learnings.list` | `learnings.list` | |
| `POST /api/prediction/learnings` | `dashboard.learnings.create` | `learnings.create` | |
| `PUT /api/prediction/learnings/:id` | `dashboard.learnings.update` | `learnings.update` | `learningId` |
| `DELETE /api/prediction/learnings/:id` | `dashboard.learnings.delete` | `learnings.delete` | `learningId` |
| `GET /api/prediction/learning-queue` | `dashboard.learning_queue.list` | `learning_queue.list` | |
| `POST /api/prediction/learning-queue/:id/respond` | `dashboard.learning_queue.respond` | `learning_queue.respond` | `learningQueueId` |
| `GET /api/prediction/analysts` | `dashboard.analysts.list` | `analysts.list` | |
| `POST /api/prediction/analysts` | `dashboard.analysts.create` | `analysts.create` | |
| `PUT /api/prediction/analysts/:id` | `dashboard.analysts.update` | `analysts.update` | `analystId` |
| `DELETE /api/prediction/analysts/:id` | `dashboard.analysts.delete` | `analysts.delete` | `analystId` |
| `GET /api/prediction/strategies` | `dashboard.strategies.list` | `strategies.list` | |
| `GET /api/prediction/missed-opportunities` | `dashboard.missed_opportunities.list` | `missed_opportunities.list` | |
| `GET /api/prediction/missed-opportunities/:id` | `dashboard.missed_opportunities.get` | `missed_opportunities.get` | `missedOpportunityId` |
| `GET /api/prediction/tool-requests` | `dashboard.tool_requests.list` | `tool_requests.list` | |
| `POST /api/prediction/tool-requests` | `dashboard.tool_requests.create` | `tool_requests.create` | |

---

## 19. User Guidance & Onboarding

### 19.1 Key Insight: Learnings Replace Context Files

In this system, users don't edit markdown context files. Instead, they add **learnings** through the UI at the appropriate scope level. This is:
- More accessible (no file editing)
- More auditable (tracked in database)
- More discoverable (UI shows all learnings)
- More guided (system suggests where to add)

### 19.2 Adding Sources - Wizard Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Add Source - Step 1 of 4                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ What URL do you want to monitor?                                            │
│                                                                             │
│ URL: [https://www.reuters.com/technology/apple/______________]             │
│                                                                             │
│ Examples of good sources:                                                   │
│ • News sections: reuters.com/technology/apple/                             │
│ • Company pages: apple.com/newsroom/                                       │
│ • SEC filings: sec.gov/cgi-bin/browse-edgar?company=apple                  │
│ • Social search: twitter.com/search?q=$AAPL                                │
│ • Reddit: reddit.com/r/wallstreetbets/search?q=AAPL                        │
│                                                                             │
│                                                   [Cancel]  [Next →]       │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ Add Source - Step 2 of 4                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ Does this source require authentication?                                    │
│                                                                             │
│ ● No authentication needed (public page)                                   │
│ ○ Username & Password (basic auth)                                         │
│ ○ Cookie/Session (for sites you're logged into)                           │
│ ○ API Key                                                                  │
│                                                                             │
│ Note: Credentials are encrypted and stored securely.                       │
│                                                                             │
│                                          [← Back]  [Cancel]  [Next →]      │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ Add Source - Step 3 of 4                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ Configure how we should crawl this source:                                  │
│                                                                             │
│ Name: [Reuters Apple News_____________________________________]            │
│                                                                             │
│ Check frequency:                                                            │
│ ○ Every 5 minutes (breaking news)                                          │
│ ● Every 15 minutes (standard)                                              │
│ ○ Every 30 minutes                                                         │
│ ○ Every hour (low priority)                                                │
│                                                                             │
│ Filter keywords (optional - only create signals matching these):           │
│ [Apple OR iPhone OR iPad OR Tim Cook_____________________________]         │
│                                                                             │
│ Applies to:                                                                 │
│ ○ All targets in my universe                                               │
│ ● Specific target: [AAPL ▼]                                                │
│                                                                             │
│                                          [← Back]  [Cancel]  [Next →]      │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ Add Source - Step 4 of 4: Test Crawl                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ Let's test the source before saving...                                      │
│                                                                             │
│ ✓ Successfully connected to https://www.reuters.com/technology/apple/      │
│ ✓ Found 12 items on the page                                               │
│ ✓ 8 items match your keyword filter                                        │
│                                                                             │
│ Sample items found:                                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐│
│ │ • "Apple's iPhone sales surge in China amid Huawei competition"         ││
│ │ • "Tim Cook visits Apple supplier in Vietnam"                           ││
│ │ • "Apple announces Q1 earnings date"                                    ││
│ └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│ ✓ This looks good! Ready to save.                                          │
│                                                                             │
│                                          [← Back]  [Cancel]  [Save Source] │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 19.3 Creating Analysts - Guided Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Create Analyst                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ Start from a template or create from scratch:                              │
│                                                                             │
│ Templates:                                                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐│
│ │ 📈 Technical Analyst                                                    ││
│ │    Focuses on chart patterns, indicators, support/resistance            ││
│ │                                                            [Use This]   ││
│ ├─────────────────────────────────────────────────────────────────────────┤│
│ │ 📊 Fundamental Analyst                                                  ││
│ │    Focuses on earnings, valuations, competitive position                ││
│ │                                                            [Use This]   ││
│ ├─────────────────────────────────────────────────────────────────────────┤│
│ │ 🔗 Supply Chain Specialist                                              ││
│ │    Monitors supplier news and manufacturing signals                     ││
│ │                                                            [Use This]   ││
│ ├─────────────────────────────────────────────────────────────────────────┤│
│ │ 🌐 Sector Analyst                                                       ││
│ │    Looks at industry trends and peer comparisons                        ││
│ │                                                            [Use This]   ││
│ ├─────────────────────────────────────────────────────────────────────────┤│
│ │ 📰 News Sentiment Analyst                                               ││
│ │    Evaluates news tone and media coverage patterns                      ││
│ │                                                            [Use This]   ││
│ └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│                    [Create from Scratch]                                   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ Create Analyst - Supply Chain Specialist (Template)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ Name: [Supply Chain Steve_____________________________________]            │
│                                                                             │
│ Applies to:                                                                 │
│ ○ All targets in my universe                                               │
│ ● Specific target: [AAPL ▼]                                                │
│                                                                             │
│ Perspective (what makes this analyst unique):                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐│
│ │ You specialize in Apple's supply chain. You focus on:                   ││
│ │ - Foxconn, TSMC, Pegatron manufacturing signals                         ││
│ │ - Shipping and logistics from Asia                                       ││
│ │ - iPhone production cycle timing (builds Aug-Oct)                        ││
│ │                                                                          ││
│ │ You weight supply chain news higher than general market news.           ││
│ └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│ Weight: [1.2] (1.0 = normal, higher = more influence)                      │
│                                                                             │
│ Active in:                                                                  │
│ ☑ Signal Detection (deciding what's a predictor)                          │
│ ☑ Prediction Generation                                                    │
│ ☑ Evaluation (analyzing outcomes)                                          │
│ ☐ Miss Analysis                                                            │
│                                                                             │
│ [Advanced: Customize per-tier instructions ▼]                              │
│                                                                             │
│                                              [Cancel]  [Create Analyst]    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 19.4 Learning Scope Guide

When users add learnings, guide them on scope selection:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Where should this learning apply?                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ Your learning: "Foxconn revenue reports lead AAPL moves by 6-8 weeks"      │
│                                                                             │
│ ○ Target: AAPL only                                                        │
│   Use when: This pattern is specific to this one stock/asset               │
│   Example: "Tim Cook interviews don't move AAPL"                           │
│                                                                             │
│ ● Universe: All my Tech Stocks                                             │
│   Use when: This pattern applies to multiple targets you track             │
│   Example: "Earnings whispers are often accurate for tech"                 │
│                                                                             │
│ ○ Domain: All stocks (includes others' universes)                          │
│   Use when: This is a general truth about this asset class                 │
│   Example: "After-hours moves often reverse at open"                       │
│   Note: Requires admin approval                                            │
│                                                                             │
│ ○ Analyst: Supply Chain Steve only                                         │
│   Use when: This should only affect one analyst's behavior                 │
│   Example: "Increase confidence when multiple suppliers agree"             │
│                                                                             │
│ 💡 Tip: When in doubt, start specific (target level). You can always      │
│    promote a learning to a broader scope later if it proves useful.        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 20. LLM Cost Tracking

### 20.1 Cost Data Collection

**Source of Truth**: Every LLM call is tracked in existing infrastructure: `public.llm_usage`.

`prediction.analyst_assessments` stores the structured analyst output and references the corresponding cost record via `llm_usage_id`.

```sql
-- Aggregation view
CREATE VIEW prediction.llm_costs AS
SELECT
  DATE_TRUNC('day', lu.created_at) as date,
  a.llm_tier,
  COUNT(*) as call_count,
  SUM(COALESCE(lu.input_tokens, 0) + COALESCE(lu.output_tokens, 0)) as total_tokens,
  SUM(COALESCE(lu.total_cost, 0)) as total_cost,
  AVG(lu.duration_ms) as avg_latency_ms
FROM prediction.analyst_assessments a
JOIN public.llm_usage lu ON lu.id = a.llm_usage_id
GROUP BY DATE_TRUNC('day', lu.created_at), a.llm_tier;

-- Per-universe costs
CREATE VIEW prediction.universe_costs AS
SELECT
  u.id as universe_id,
  u.name as universe_name,
  DATE_TRUNC('day', lu.created_at) as date,
  a.llm_tier,
  SUM(COALESCE(lu.total_cost, 0)) as total_cost,
  COUNT(*) as call_count
FROM prediction.analyst_assessments a
JOIN public.llm_usage lu ON lu.id = a.llm_usage_id
JOIN prediction.predictions p ON a.reference_id = p.id
JOIN prediction.targets t ON p.target_id = t.id
JOIN prediction.universes u ON t.universe_id = u.id
WHERE a.reference_type = 'prediction'
GROUP BY u.id, u.name, DATE_TRUNC('day', lu.created_at), a.llm_tier;
```

### 20.2 Cost Dashboard Widget

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ LLM Usage                                                    [This Month ▼]│
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ By Tier:                                                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐│
│ │ 🟡 Gold (Opus)     │ 142 calls  │ 284K tokens │ $12.40 │ ████████████  ││
│ │ ⚪ Silver (Sonnet) │ 891 calls  │ 1.2M tokens │ $4.20  │ ████          ││
│ │ 🟤 Bronze (Local)  │ 2,847 calls│ 4.1M tokens │ $0.00  │              ││
│ └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│ Total: $16.60 this month                                                   │
│ Daily average: $2.08                                                       │
│ Per prediction: $0.42 average                                              │
│                                                                             │
│ By Universe:                                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐│
│ │ Tech Stocks        │ $8.40  │ 20 predictions │ $0.42/pred              ││
│ │ Crypto             │ $5.20  │ 15 predictions │ $0.35/pred              ││
│ │ Dividend Stocks    │ $3.00  │ 5 predictions  │ $0.60/pred              ││
│ └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│ 📊 Cost Trend                                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐│
│ │     $3 ┤          ╭─╮                                                   ││
│ │     $2 ┤    ╭─╮  ╭╯ ╰╮ ╭─╮                                             ││
│ │     $1 ┤ ╭─╮╯ ╰──╯   ╰─╯ ╰─╮                                           ││
│ │     $0 ┼─────────────────────                                           ││
│ │        Jan 1        Jan 8                                               ││
│ └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│ 💡 Tip: You could save ~$4/month by disabling Gold for signal detection.  │
│    Based on your data, Silver performs nearly as well (2% accuracy diff). │
│                                                           [Adjust Config] │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 20.3 Cost Optimization Suggestions

System can analyze cost vs accuracy and suggest optimizations:

```typescript
interface CostOptimizationSuggestion {
  currentConfig: LLMConfig;
  suggestedConfig: LLMConfig;
  estimatedSavings: number;
  accuracyImpact: string;  // "minimal (<2%)" | "moderate (2-5%)" | "significant (>5%)"
  reasoning: string;
}

async function generateCostOptimizations(universeId: string): Promise<CostOptimizationSuggestion[]> {
  // Analyze historical accuracy by LLM tier
  const accuracy = await getAccuracyByLLMTier(universeId);
  const costs = await getCostsByLLMTier(universeId);

  const suggestions: CostOptimizationSuggestion[] = [];

  // Example: Gold not adding much value for signal detection
  if (accuracy.signalDetection.gold - accuracy.signalDetection.silver < 0.02) {
    suggestions.push({
      suggestedConfig: { ...currentConfig, signalDetection: { gold: false, silver: true, bronze: true }},
      estimatedSavings: costs.signalDetection.gold,
      accuracyImpact: 'minimal (<2%)',
      reasoning: 'Gold tier adds minimal accuracy for signal detection in your universe'
    });
  }

  return suggestions;
}
```

---

## 21. Competitive Differentiation

### 21.1 What Makes This System Unique

| Feature | Us | Traditional Platforms |
|---------|----|-----------------------|
| **Custom Sources** | Add any URL | Limited to pre-built integrations |
| **Custom AI Analysts** | Create your own perspectives | One-size-fits-all model |
| **Multi-LLM Comparison** | See where models agree/disagree | Single model, black box |
| **Full Explainability** | See every signal, analyst, decision | "Trust our algorithm" |
| **Continuous Learning** | System improves from feedback | Static rules |
| **Missed Opportunity Analysis** | Proactively finds gaps | Only shows what it predicted |

### 21.2 Key Value Propositions

1. **For Power Users**: Full control over sources, analysts, and strategies
2. **For Learners**: See exactly how predictions are made, learn patterns
3. **For Skeptics**: Multi-LLM comparison shows model agreement/disagreement
4. **For Improvers**: Continuous learning loop makes system better over time

### 21.3 Defensibility

- **Network effects**: More users → more learnings → better predictions
- **Customization moat**: User-specific analysts and sources are sticky
- **Learning accumulation**: The longer you use it, the more it knows about your targets

---

## 22. Performance & Scalability Requirements

### 22.1 Latency Targets

| Operation | Target Latency | P99 Latency |
|-----------|----------------|-------------|
| Signal ingestion | < 500ms | < 1s |
| Fast-path signal detection | < 5s | < 10s |
| Batch signal processing | < 30s per signal | < 60s |
| Prediction generation | < 15s | < 30s |
| Prediction query (single) | < 100ms | < 300ms |
| Prediction query (list) | < 200ms | < 500ms |
| SSE stream connection | < 100ms | < 300ms |

### 22.2 Throughput Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Signals per minute | 100 | Across all universes |
| Concurrent predictions | 10 | Parallel prediction generations |
| Active SSE connections | 1000 | Per API instance |
| LLM calls per minute | 50 | With explicitly configured tier downgrade |

### 22.3 Scaling Strategy

#### 22.3.1 Horizontal Scaling

```typescript
// Signal processing uses queue-based distribution
interface SignalProcessingConfig {
  // Workers claim signals atomically (see Section 5.7.1)
  maxConcurrentSignals: number;    // Per worker: 10
  batchSize: number;               // Signals per batch: 50

  // LLM call pooling
  maxConcurrentLLMCalls: number;   // Per worker: 5
  llmCallTimeout: number;          // 30000ms
}
```

#### 22.3.2 Database Scaling

```sql
-- Partition signals table by created_at for efficient queries
CREATE TABLE prediction.signals (
  -- ... columns ...
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE prediction.signals_2026_01 PARTITION OF prediction.signals
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

-- Index strategy for common queries
-- Note: Core indexes defined in Section 4 (idx_signals_pending, idx_predictions_active, etc.)
-- Partitioned tables inherit indexes from parent table definition
```

### 22.4 Resource Limits

| Resource | Soft Limit | Hard Limit |
|----------|------------|------------|
| Targets per universe | 100 | 500 |
| Active predictions per target | 1 | 3 |
| Signals per target per day | 50 | 200 |
| Analysts per evaluation | 5 | 10 |
| LLM tiers per evaluation | 3 | 3 |

### 22.5 Caching Strategy

```typescript
interface CacheConfig {
  // Cache analyst definitions (rarely change)
  analysts: {
    ttl: 300,           // 5 minutes
    key: 'analysts:{scope}:{id}'
  };

  // Cache learnings (change on review)
  learnings: {
    ttl: 60,            // 1 minute
    key: 'learnings:{targetId}'
  };

  // Cache LLM tier resolution (rarely change)
  llmTiers: {
    ttl: 600,           // 10 minutes
    key: 'llm-tier:{tier}'
  };

  // Don't cache: signals, predictors, predictions (real-time data)
}
```

---

## 23. Cost Management & Limits

### 23.1 LLM Cost Tracking

All LLM calls are tracked via existing `LLMPricingService` using `ExecutionContext`:

```typescript
// Cost tracking happens automatically
// ExecutionContext.taskId used for aggregation

interface CostTracking {
  // Per-prediction cost query
  getPredictionCost(predictionId: string): Promise<{
    totalCost: number;
    byTier: Record<'gold' | 'silver' | 'bronze', number>;
    byAnalyst: Record<string, number>;
    callCount: number;
  }>;

  // Per-universe daily cost
  getUniverseDailyCost(universeId: string, date: Date): Promise<{
    totalCost: number;
    byTarget: Record<string, number>;
    predictionCount: number;
  }>;
}
```

### 23.2 Cost Limits

#### 23.2.1 Organization Limits

```typescript
interface OrganizationCostLimits {
  dailyLimit: number;           // Default: $50/day
  monthlyLimit: number;         // Default: $500/month
  perPredictionLimit: number;   // Default: $2/prediction

  // Actions when limit reached
  onLimitReached: 'block' | 'notify' | 'downgrade_tier';
}
```

#### 23.2.2 Universe-Level Limits

```sql
ALTER TABLE prediction.universes ADD COLUMN cost_config JSONB DEFAULT '{
  "daily_limit": 10.00,
  "per_prediction_limit": 1.00,
  "allow_gold_tier": true,
  "allow_silver_tier": true,
  "allow_bronze_tier": true
}';
```

### 23.3 Cost Optimization Strategies

| Strategy | Savings | Trade-off |
|----------|---------|-----------|
| Bronze-only for signal detection | 70% | Slightly lower accuracy |
| Skip Gold for low-confidence signals | 50% | May miss edge cases |
| Cache analyst responses | 20% | Stale for 1 minute |
| Batch similar signals | 30% | Higher latency |

### 23.4 Cost Alerts

```typescript
// Alert thresholds
interface CostAlerts {
  // Emit warning when approaching limit
  warningThreshold: 0.8;    // 80% of limit

  // Emit critical when at limit
  criticalThreshold: 0.95;  // 95% of limit

  // Alert channels
  channels: ['email', 'sse'];
}

// Alert emission via ObservabilityEventsService
observability.emit({
  context,
  hook_event_type: 'agent.stream.chunk',
  message: `Cost warning: ${percentage}% of daily limit reached`,
  metadata: {
    type: 'cost_alert',
    level: 'warning',
    currentCost: cost,
    limit: limit,
    percentage: percentage
  }
});
```

### 23.5 Cost Reporting

```sql
-- Daily cost report view
CREATE VIEW prediction.daily_cost_report AS
SELECT
  DATE(lu.created_at) as date,
  u.id as universe_id,
  u.name as universe_name,
  COUNT(DISTINCT p.id) as prediction_count,
  SUM(lu.cost) as total_cost,
  AVG(lu.cost) as avg_cost_per_call,
  SUM(lu.cost) / NULLIF(COUNT(DISTINCT p.id), 0) as avg_cost_per_prediction
FROM public.llm_usage lu
JOIN prediction.predictions p ON lu.task_id = p.task_id
JOIN prediction.targets t ON p.target_id = t.id
JOIN prediction.universes u ON t.universe_id = u.id
GROUP BY DATE(lu.created_at), u.id, u.name
ORDER BY date DESC, total_cost DESC;
```

### 23.6 Tier Selection Logic

```typescript
async function selectOptimalTier(
  context: ExecutionContext,
  universeConfig: UniverseCostConfig,
  signalConfidence: number
): Promise<('gold' | 'silver' | 'bronze')[]> {
  const remainingBudget = await getRemainingDailyBudget(context.orgSlug);
  const estimatedCost = estimatePredictionCost(universeConfig);

  // Check budget constraints
  if (remainingBudget < estimatedCost.gold) {
    // Can't afford gold, try silver
    if (remainingBudget < estimatedCost.silver) {
      // Only bronze available
      return ['bronze'];
    }
    return ['silver', 'bronze'];
  }

  // Budget available, select based on signal confidence
  if (signalConfidence >= 0.9) {
    // High confidence: use all tiers for validation
    return ['gold', 'silver', 'bronze'];
  } else if (signalConfidence >= 0.7) {
    // Medium confidence: skip gold
    return ['silver', 'bronze'];
  } else {
    // Low confidence: bronze only
    return ['bronze'];
  }
}
```

---

## Appendix A: Implementation Phases

> **Note**: For detailed migration from the existing `predictions` schema to the new `prediction` schema, see [Section 18: Migration from Existing Prediction System](#18-migration-from-existing-prediction-system).

### Phase 1: Core Pipeline
1. Create new tables (universes, targets with context, signals, predictors, predictions)
2. Migrate existing instruments to targets table with enriched context
3. Implement Tier 1-4 processing with ExecutionContext
4. Basic UI for predictions

### Phase 2: Multi-Analyst
1. Create analysts table and system analysts
2. Implement analyst ensemble evaluation
3. Analyst management UI

### Phase 3: Multi-LLM
1. Add LLM tier configuration
2. Implement parallel LLM evaluation
3. LLM comparison UI

### Phase 4: Learning System
1. Create learnings tables
2. Implement learning application
3. Review queue UI

### Phase 5: Explainability
1. Create snapshots table
2. Implement snapshot creation
3. Prediction detail UI

### Phase 6: Missed Opportunities
1. Create missed opportunities table
2. Implement detection and analysis
3. Tool wishlist UI

### Phase 7: Sources & Strategies
1. Create sources table
2. Implement Firecrawl integration
3. Create strategies
4. Full configuration UI

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **Analyst** | AI personality with specific perspective |
| **Context** | Target-specific markdown knowledge injected into analyst prompts |
| **Domain** | Category: stocks, crypto, elections, polymarket |
| **Ensemble** | Multi-LLM approach using Gold/Silver/Bronze tiers for diverse perspectives |
| **Learning** | Knowledge extracted from outcomes |
| **LLM Tier** | Quality level: Gold (best), Silver (balanced), Bronze (fast/cheap) |
| **Predictor** | Validated signal with strength and direction |
| **Prediction** | Actual forecast with direction, magnitude, confidence, timeframe |
| **Scope** | Hierarchy level: runner, domain, universe, target, analyst |
| **Signal** | Raw event from a source |
| **Snapshot** | Full state capture at prediction time |
| **Source** | URL or API that provides signals |
| **Strategy** | Investment philosophy (Aggressive, Balanced, etc.) |
| **Target** | What we predict about (stock, election, etc.) |
| **Threshold** | Configurable requirements for triggering predictions |
| **Universe** | User's collection of targets |
