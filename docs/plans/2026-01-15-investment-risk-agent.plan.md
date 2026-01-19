# Investment Risk Agent PRD

## Overview

Build an **Investment Risk Agent** in the **finance** organization that provides comprehensive, multi-factor risk assessment for investment decisions. The system follows the proven Prediction runner architecture patterns including:
- **Runner-based pipeline** with cron-scheduled batch processing
- **ExecutionContext capsule** flowing through the entire stack
- **A2A dashboard mode** for frontend data access
- **Learning loop** with HITL review for continuous improvement
- **Custom UI** with `hasCustomUI: true` metadata routing

**Agent**: `investment-risk-agent` (org: `finance`)
**MVP Domain**: Investment Risk (stocks, crypto)
**Architecture**: Separate `risk-runner` module with dedicated `risk.*` database schema

---

## Architecture Philosophy

### Generalized, Table-Driven Design

Unlike the Prediction runner (which needs variants for stocks, betting markets, elections), the Risk runner is designed to be **fully generalized**:

| Aspect | Prediction Runner | Risk Runner |
|--------|-------------------|-------------|
| Domain variants | Needs code changes for betting/elections | Same code works for all domains |
| Analysts | Hardcoded analyst classes | Table-defined dimensions with versioned prompts |
| Configuration | Mix of code and config | Fully table-driven |
| Extensibility | Fork runner for new domains | Add rows to database |

**Why this works for risk**: Risk analysis follows the same fundamental pattern regardless of domain:
1. Identify what you're assessing (Subject)
2. Define the boundary/context (Scope)
3. Analyze across multiple dimensions
4. Debate/challenge findings
5. Synthesize into a score

### Hierarchy

```
risk-runner (generic, reusable)
  └── Used by multiple agents:
       ├── investment-risk-agent (finance org) ← THIS PRD
       ├── business-risk-agent (future)
       ├── project-risk-agent (future)
       └── ... any domain that needs risk analysis

Each agent defines its own:
  ├── Scopes (analysis boundaries)
  ├── Subjects (things being assessed)
  ├── Dimensions (risk factors to analyze)
  └── Dimension Contexts (prompts/config)
```

**This PRD**: `investment-risk-agent` in `finance` org - first implementation using the generic risk-runner.

---

## Terminology

| Risk Analysis | Prediction System | Meaning |
|---------------|-------------------|---------|
| **Scope** | Universe | The analysis boundary/context (e.g., "US Tech Stocks", "Crypto Portfolio") |
| **Subject** | Target | The thing being risk-assessed (e.g., AAPL, BTC, a business decision) |

**Why different terminology?**
- Risk analysis may assess things Prediction doesn't care about (business decisions, projects)
- "Scope" and "Subject" are more general - better for multi-domain expansion
- Risk has **completely independent data** - own `risk.*` schema, no references to `prediction.*` tables
- No shared targets/subjects between systems - avoids schema coupling

---

## Signature Features (Both Available in MVP)

### 1. Risk Radar (Multi-Factor Parallel Analysis)

Multiple specialized "Risk Analyst" agents analyze different risk dimensions **simultaneously**:

| Analyst | Focus Area | Key Signals |
|---------|------------|-------------|
| **Market Risk** | Price volatility, liquidity, sentiment | VIX, bid-ask spreads, options flow |
| **Fundamental Risk** | Company health, earnings stability | Debt ratios, cash flow, P/E trends |
| **Technical Risk** | Chart patterns, momentum breakdown | Support breaks, RSI divergence |
| **Macro Risk** | Economic environment, sector rotation | Interest rates, sector ETF flows |
| **Correlation Risk** | Portfolio concentration, correlations | Beta to market, cross-asset correlation |

**Output**: Composite Risk Score (1-100) with individual dimension breakdown

### 2. Red Team / Blue Team Debate

After Risk Radar generates initial assessment, adversarial agents debate:

```
Blue Agent (Defender)
├── Presents risk assessment with evidence
├── Argues for accuracy of Risk Radar findings
└── Cites supporting data points

Red Agent (Challenger)
├── Challenges: "What did you miss?"
├── Probes: "What's overstated?"
├── Identifies blind spots
└── Proposes alternative scenarios

Arbiter Agent (Synthesizer)
├── Reviews both perspectives
├── Adjusts scores with reasoning
├── Produces final risk assessment
└── Full debate transcript stored
```

**Why**: Reduces blind spots and overconfidence. Creates explainable risk analysis.

---

## Technical Architecture

### ExecutionContext Flow

The ExecutionContext "capsule" flows unchanged through the entire risk analysis pipeline:

```typescript
interface ExecutionContext {
  orgSlug: string;        // Organization identifier (e.g., 'finance')
  userId: string;         // Authenticated user
  conversationId: string; // Conversation session
  taskId: string;         // Task instance (frontend generates before SSE connect)
  planId: string;         // Associated plan (NIL_UUID if none)
  deliverableId: string;  // Associated deliverable (NIL_UUID if none)
  agentSlug: string;      // 'investment-risk-agent' (agent identity, not module)
  agentType: string;      // 'api'
  provider: string;       // LLM provider
  model: string;          // LLM model
}
```

**Note on Identity**:
- `agentSlug` = `'investment-risk-agent'` - the registered agent identity in `public.agents`
- `risk-runner` = internal module that implements the agent logic
- This distinction matters: other agents (e.g., `business-risk-agent`) could reuse `risk-runner` module

**Key Rules**:
- Pass as complete capsule, never split into individual fields
- Frontend creates taskId upfront for SSE stream connection
- Backend validates userId matches JWT auth
- Context attached to all observability events

### Database Schema (`risk.*`)

```sql
-- Schema: risk

-- =====================================================
-- CORE ENTITIES (Table-Driven Configuration)
-- =====================================================

CREATE TABLE risk.scopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_slug TEXT NOT NULL,
  agent_slug TEXT NOT NULL,
  name TEXT NOT NULL,
  domain TEXT NOT NULL, -- 'investment', 'business', 'project', 'personal'
  llm_config JSONB DEFAULT '{}',  -- provider, model, tiers
  thresholds JSONB DEFAULT '{}',  -- alert thresholds, etc.
  analysis_config JSONB DEFAULT '{}',  -- which analysis types enabled
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE risk.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_id UUID REFERENCES risk.scopes(id),
  identifier TEXT NOT NULL,  -- symbol for stocks, slug for decisions
  name TEXT,
  subject_type TEXT NOT NULL, -- 'stock', 'crypto', 'decision', 'project'
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true
);

-- =====================================================
-- VERSIONED CONTEXT (Like prediction analyst contexts)
-- =====================================================

CREATE TABLE risk.dimensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_id UUID REFERENCES risk.scopes(id),
  slug TEXT NOT NULL, -- 'market', 'fundamental', 'technical', 'macro', 'correlation'
  name TEXT NOT NULL,
  description TEXT,
  weight NUMERIC(3,2) DEFAULT 1.0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Versioned prompts for each dimension (like analyst context versions)
CREATE TABLE risk.dimension_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dimension_id UUID REFERENCES risk.dimensions(id),
  version INTEGER NOT NULL DEFAULT 1,
  system_prompt TEXT NOT NULL,  -- The full prompt for this dimension's analysis
  output_schema JSONB,          -- Expected output structure
  examples JSONB DEFAULT '[]',  -- Few-shot examples
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(dimension_id, version)
);

-- Red Team / Blue Team debate prompts (also versioned)
CREATE TABLE risk.debate_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_id UUID REFERENCES risk.scopes(id),
  role TEXT NOT NULL, -- 'blue', 'red', 'arbiter'
  version INTEGER NOT NULL DEFAULT 1,
  system_prompt TEXT NOT NULL,
  output_schema JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(scope_id, role, version)
);

-- Assessment Entities
CREATE TABLE risk.assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID REFERENCES risk.subjects(id),
  dimension_id UUID REFERENCES risk.dimensions(id),
  task_id UUID, -- ExecutionContext.taskId
  score INTEGER CHECK (score >= 0 AND score <= 100),
  confidence NUMERIC(3,2),
  reasoning TEXT,
  evidence JSONB DEFAULT '[]',
  analyst_response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE risk.debates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID REFERENCES risk.subjects(id),
  task_id UUID,
  blue_assessment JSONB, -- Risk Radar summary
  red_challenges JSONB,  -- Red Team findings
  arbiter_synthesis JSONB, -- Final synthesis
  final_score INTEGER,
  transcript JSONB DEFAULT '[]', -- Full debate conversation
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE risk.composite_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID REFERENCES risk.subjects(id),
  task_id UUID,
  overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),
  dimension_scores JSONB, -- { "market": 65, "fundamental": 45, ... }
  debate_adjustment INTEGER DEFAULT 0, -- Score change from Red Team
  confidence NUMERIC(3,2),
  status TEXT DEFAULT 'active', -- 'active', 'superseded', 'expired'
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE risk.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID REFERENCES risk.subjects(id),
  composite_score_id UUID REFERENCES risk.composite_scores(id),
  alert_type TEXT, -- 'threshold_breach', 'rapid_change', 'dimension_spike'
  severity TEXT, -- 'info', 'warning', 'critical'
  message TEXT,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Learning Entities (same pattern as prediction)
CREATE TABLE risk.learnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_level TEXT NOT NULL, -- 'runner', 'domain', 'scope', 'subject'
  domain TEXT,
  scope_id UUID,
  subject_id UUID,
  learning_type TEXT NOT NULL, -- 'rule', 'pattern', 'avoid', 'weight_adjustment', 'threshold'
  title TEXT NOT NULL,
  description TEXT,
  config JSONB DEFAULT '{}',
  times_applied INTEGER DEFAULT 0,
  times_helpful INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  is_test BOOLEAN DEFAULT true,
  source_type TEXT, -- 'human', 'ai_suggested', 'ai_approved'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE risk.learning_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggested_scope_level TEXT,
  suggested_learning_type TEXT,
  suggested_title TEXT,
  suggested_description TEXT,
  suggested_config JSONB,
  ai_reasoning TEXT,
  ai_confidence NUMERIC(3,2),
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'modified'
  reviewed_by_user_id UUID,
  reviewed_at TIMESTAMPTZ,
  learning_id UUID, -- Created learning if approved
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE risk.evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  composite_score_id UUID REFERENCES risk.composite_scores(id),
  actual_outcome JSONB, -- What actually happened
  score_accuracy NUMERIC(3,2), -- How accurate was the risk score
  dimension_accuracy JSONB, -- Per-dimension accuracy
  learnings_suggested TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Runner Pipeline (Simplified, Generic)

The risk runner uses a **single generic processing pipeline** that reads configuration from tables:

| Runner | Schedule | Purpose |
|--------|----------|---------|
| `RiskAnalysisRunner` | */30 min | Generic processor: runs Risk Radar + Red Team based on scope config |
| `RiskAlertRunner` | */5 min | Check thresholds, send notifications |
| `RiskEvaluationRunner` | Daily | Compare past assessments to actual outcomes |
| `RiskLearningRunner` | Daily | Generate learning suggestions from evaluations |

**Key Difference from Prediction**: No separate runners per analysis type. The `RiskAnalysisRunner` reads `scope.analysis_config` to determine which analysis types to run:

```typescript
// Generic processing - no hardcoded analyst classes
async processSubject(subject: Subject, scope: Scope): Promise<CompositeScore> {
  const analysisConfig = scope.analysis_config;

  // 1. Risk Radar: Run all active dimensions in parallel
  if (analysisConfig.riskRadar?.enabled) {
    const dimensions = await this.dimensionRepo.findByScope(scope.id);
    const assessments = await Promise.all(
      dimensions.map(dim => this.runDimensionAnalysis(subject, dim))
    );
  }

  // 2. Red Team: Run adversarial debate if enabled
  if (analysisConfig.redTeam?.enabled) {
    const debate = await this.runDebate(subject, assessments);
    // Debate may adjust scores
  }

  // 3. Aggregate into composite score
  return this.aggregateScores(assessments, debate);
}

// Dimension analysis reads prompt from database
async runDimensionAnalysis(subject: Subject, dimension: Dimension): Promise<Assessment> {
  const context = await this.contextRepo.findActiveForDimension(dimension.id);

  return this.llmService.generateResponse(executionContext, {
    systemPrompt: context.system_prompt,  // From table, not code
    // ...
  });
}
```

**Overlap Prevention Pattern** (same as Prediction):
```typescript
private isRunning = false;

@Cron('*/30 * * * *')
async runRiskAnalysis(): Promise<void> {
  if (this.isRunning) {
    this.logger.warn('Skipping - previous run in progress');
    return;
  }
  this.isRunning = true;
  try {
    await this.processAllActiveScopes();
  } finally {
    this.isRunning = false;
  }
}
```

### Module Structure (Simplified)

```
apps/api/src/risk-runner/
├── risk-runner.module.ts
├── repositories/
│   ├── scope.repository.ts
│   ├── subject.repository.ts
│   ├── dimension.repository.ts
│   ├── dimension-context.repository.ts  # Versioned prompts
│   ├── debate-context.repository.ts     # Versioned debate prompts
│   ├── assessment.repository.ts
│   ├── debate.repository.ts
│   ├── composite-score.repository.ts
│   ├── alert.repository.ts
│   ├── learning.repository.ts
│   └── learning-queue.repository.ts
├── services/
│   ├── risk-analysis.service.ts        # Generic analysis orchestration
│   ├── dimension-analyzer.service.ts   # Runs any dimension from config
│   ├── debate.service.ts               # Blue/Red/Arbiter from config
│   ├── score-aggregation.service.ts    # Weighted score computation
│   ├── risk-alert.service.ts           # Threshold monitoring
│   ├── risk-learning.service.ts        # Learning management
│   └── historical-replay.service.ts    # Test framework
├── runners/
│   ├── risk-analysis.runner.ts         # Single generic runner
│   ├── risk-alert.runner.ts
│   ├── risk-evaluation.runner.ts
│   └── risk-learning.runner.ts
├── task-router/
│   ├── risk-dashboard.router.ts
│   └── handlers/
│       ├── scope.handler.ts
│       ├── subject.handler.ts
│       ├── dimension.handler.ts        # CRUD for dimensions + contexts
│       ├── assessment.handler.ts
│       ├── debate.handler.ts
│       ├── composite-score.handler.ts
│       ├── alert.handler.ts
│       ├── learning.handler.ts
│       └── learning-queue.handler.ts
└── dto/
    └── risk-runner.dto.ts

# NOTE: No hardcoded analyst classes!
# Dimensions and their prompts are defined in database tables.
# To add a new risk dimension (e.g., "regulatory risk"):
# 1. INSERT INTO risk.dimensions (scope_id, slug, name, weight)
# 2. INSERT INTO risk.dimension_contexts (dimension_id, system_prompt, ...)
# No code changes required.
```

### A2A Dashboard Mode Integration

**Routing Pattern** (same as Prediction):
```typescript
// RiskAgentRunnerService
async execute(definition, request, orgSlug): Promise<TaskResponseDto> {
  const { mode } = request;

  if (mode === 'dashboard') {
    return this.handleDashboard(definition, request, orgSlug);
  }

  return super.execute(definition, request, orgSlug);
}

private async handleDashboard(definition, request, orgSlug) {
  const { action } = request.payload;
  const result = await this.dashboardRouter.route(action, request.payload, request.context);
  return TaskResponseDto.success('dashboard', result);
}
```

**Action Naming Convention**: `{entity}.{operation}`
- `scopes.list`, `scopes.get`, `scopes.create`
- `subjects.list`, `subjects.get`, `subjects.create`
- `assessments.list`, `assessments.getBySubject`
- `debates.view`, `debates.trigger`
- `composite-scores.list`, `composite-scores.history`
- `alerts.list`, `alerts.acknowledge`
- `learning-queue.list`, `learning-queue.respond`

### Agent Registration

```sql
INSERT INTO public.agents (
  slug,
  organization_slug,
  agent_type,
  name,
  description,
  metadata,
  endpoint
) VALUES (
  'investment-risk-agent',
  'finance',
  'api',
  'Investment Risk Agent',
  'Multi-factor investment risk assessment with adversarial debate and learning loop',
  '{
    "hasCustomUI": true,
    "customUIComponent": "investment-risk-dashboard",
    "provider": "langgraph",
    "capabilities": ["risk-radar", "red-team-debate", "risk-alerts", "learning-loop"],
    "supportedActions": [
      "scopes.list",
      "scopes.get",
      "scopes.create",
      "subjects.list",
      "subjects.get",
      "subjects.create",
      "assessments.list",
      "assessments.getBySubject",
      "debates.view",
      "debates.trigger",
      "composite-scores.list",
      "composite-scores.get",
      "composite-scores.history",
      "alerts.list",
      "alerts.acknowledge",
      "learning-queue.list",
      "learning-queue.respond"
    ]
  }'::JSONB,
  '{"url": "http://localhost:3000/risk-runner"}'::JSONB
);
```

---

## Data Sourcing Strategy

### Overview

Risk analysis requires market data, fundamentals, and other signals to produce meaningful assessments. This section defines how data flows into the risk-runner.

### Data Sources (MVP)

| Data Type | Source | Update Frequency | Usage |
|-----------|--------|------------------|-------|
| **Price Data** | Yahoo Finance API (free tier) | Real-time/15-min delay | Market Risk dimension |
| **Fundamentals** | Yahoo Finance / FMP API | Daily | Fundamental Risk dimension |
| **Technical Indicators** | Calculated from price data | On-demand | Technical Risk dimension |
| **Macro Indicators** | FRED API (Federal Reserve) | Weekly/Monthly | Macro Risk dimension |
| **News Sentiment** | NewsAPI / LLM analysis | On-demand | All dimensions (context) |

### Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ External APIs                                                   │
│ (Yahoo Finance, FRED, NewsAPI)                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Data Fetcher Service                                            │
│ - Caches responses (Redis/in-memory)                            │
│ - Rate limiting per API                                         │
│ - Transforms to internal format                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Dimension Analyzer Service                                      │
│ - Receives subject + dimension context                          │
│ - Fetches relevant data via Data Fetcher                        │
│ - Constructs LLM prompt with data                               │
│ - Returns assessment                                            │
└─────────────────────────────────────────────────────────────────┘
```

### MVP Data Implementation

For MVP, data sourcing is **simplified**:

1. **On-Demand Fetching**: Data fetched when assessment runs (not pre-cached)
2. **Basic Caching**: Simple TTL cache to avoid repeated API calls within same run
3. **Manual Subject Setup**: Symbols/identifiers entered manually in admin UI
4. **Free APIs Only**: No paid data subscriptions in MVP

### Future Enhancements (Post-MVP)

- Real-time data streaming via WebSocket connections
- Historical data warehouse for backtesting
- Alternative data sources (options flow, social sentiment)
- Automated subject discovery from watchlists

---

## Custom UI Architecture

### Why Custom UI is Needed

1. **Risk Radar Visualization**: Spider/radar chart showing all dimensions
2. **Debate Transcript View**: Blue vs Red arguments with highlighting
3. **Risk Timeline**: How risk score evolved over time
4. **Alert Management**: Configure thresholds, acknowledge alerts
5. **Learning Review**: HITL queue for AI-suggested learnings
6. **Comparison Views**: Compare risk across multiple targets

### Component Structure

```
apps/web/src/components/risk/
├── InvestmentRiskDashboard.vue      # Entry component (ConversationView routes here)
├── components/
│   ├── RiskSidebar.vue              # Left panel: scope selector + subject list
│   ├── RiskViewTabs.vue             # Tab bar: Radar | Debate | Timeline | Alerts | Learnings
│   ├── RiskRadarChart.vue           # Spider chart (Chart.js or D3)
│   ├── RiskDimensionCard.vue        # Individual dimension detail (clickable)
│   ├── RiskDebateViewer.vue         # Blue/Red/Arbiter transcript
│   ├── RiskTimelineChart.vue        # Score evolution line chart
│   ├── RiskAlertPanel.vue           # Alert list with acknowledge buttons
│   ├── RiskLearningQueue.vue        # HITL review interface
│   ├── RiskConfigPanel.vue          # Scope/subject/dimension CRUD (admin)
│   ├── RiskEmptyState.vue           # "No scopes/subjects/scores yet" states
│   └── RiskLoadingState.vue         # Skeleton loaders per view
└── types/
    └── risk.ts                      # TypeScript interfaces
```

**Entry Component**: `InvestmentRiskDashboard.vue` is the single entry point routed from ConversationView.

### ConversationView Integration

```vue
<!-- apps/web/src/components/ConversationView.vue -->
<template>
  <template v-if="hasCustomUI">
    <!-- Existing custom UIs -->
    <MarketingSwarmTab v-if="customUIComponent === 'marketing-swarm'" />
    <CadAgentTab v-else-if="customUIComponent === 'cad-agent'" />
    <FinanceTab v-else-if="customUIComponent === 'finance'" />
    <PredictionAgentPane v-else-if="customUIComponent === 'prediction-dashboard'" />

    <!-- NEW: Investment Risk Dashboard (finance org) -->
    <InvestmentRiskDashboard
      v-else-if="customUIComponent === 'investment-risk-dashboard'"
      :conversation="conversation"
      :agent="currentAgent"
    />
  </template>
</template>
```

### Pinia Store Pattern

```typescript
// apps/web/src/stores/riskDashboardStore.ts
export const useRiskDashboardStore = defineStore('riskDashboard', () => {
  // State
  const scopes = ref<RiskScope[]>([]);
  const subjects = ref<RiskSubject[]>([]);
  const compositeScores = ref<Map<string, CompositeScore>>(new Map());
  const currentDebate = ref<RiskDebate | null>(null);
  const alerts = ref<RiskAlert[]>([]);
  const learningQueue = ref<LearningQueueItem[]>([]);

  // Selection state
  const selectedScopeId = ref<string | null>(null);
  const selectedSubjectId = ref<string | null>(null);

  // UI state
  const currentView = ref<'radar' | 'debate' | 'timeline' | 'alerts' | 'learnings'>('radar');
  const isLoading = ref(false);

  // Computed
  const selectedSubject = computed(() =>
    subjects.value.find(s => s.id === selectedSubjectId.value)
  );

  const currentScore = computed(() =>
    selectedSubjectId.value ? compositeScores.value.get(selectedSubjectId.value) : null
  );

  const pendingLearnings = computed(() =>
    learningQueue.value.filter(l => l.status === 'pending')
  );

  // Mutations (synchronous only)
  function setScopes(data: RiskScope[]) { scopes.value = data; }
  function setSubjects(data: RiskSubject[]) { subjects.value = data; }
  // ... more mutations

  return { /* state, computed, mutations */ };
});
```

### Service Layer (A2A Integration)

```typescript
// apps/web/src/services/riskDashboardService.ts
export class RiskDashboardService {
  constructor(
    private agent2AgentApi: Agent2AgentApi,
    private executionContextStore: ExecutionContextStore
  ) {}

  // Helper for all dashboard calls
  private async dashboardCall<T>(action: string, params?: Record<string, unknown>): Promise<T> {
    const response = await this.agent2AgentApi.executeStrictRequest({
      method: 'tasks/send',
      params: {
        context: this.executionContextStore.current,
        mode: 'dashboard',
        payload: { action, params }
      }
    });
    return response.payload.content;
  }

  // ─── SCOPES ────────────────────────────────────────────────────────
  async listScopes(): Promise<RiskScope[]> {
    return this.dashboardCall('scopes.list');
  }

  async getScope(id: string): Promise<RiskScope> {
    return this.dashboardCall('scopes.get', { id });
  }

  async createScope(data: CreateScopeDto): Promise<RiskScope> {
    return this.dashboardCall('scopes.create', data);
  }

  // ─── SUBJECTS ──────────────────────────────────────────────────────
  async listSubjects(scopeId: string): Promise<RiskSubject[]> {
    return this.dashboardCall('subjects.list', { scopeId });
  }

  async getSubject(id: string): Promise<RiskSubject> {
    return this.dashboardCall('subjects.get', { id });
  }

  async createSubject(data: CreateSubjectDto): Promise<RiskSubject> {
    return this.dashboardCall('subjects.create', data);
  }

  // ─── ASSESSMENTS ───────────────────────────────────────────────────
  async listAssessments(subjectId: string): Promise<RiskAssessment[]> {
    return this.dashboardCall('assessments.list', { subjectId });
  }

  async getAssessmentsBySubject(subjectId: string): Promise<RiskAssessment[]> {
    return this.dashboardCall('assessments.getBySubject', { subjectId });
  }

  // ─── COMPOSITE SCORES ──────────────────────────────────────────────
  async listCompositeScores(scopeId: string): Promise<CompositeScore[]> {
    return this.dashboardCall('composite-scores.list', { scopeId });
  }

  async getCompositeScore(subjectId: string): Promise<CompositeScore> {
    return this.dashboardCall('composite-scores.get', { subjectId });
  }

  async getScoreHistory(subjectId: string, limit?: number): Promise<CompositeScore[]> {
    return this.dashboardCall('composite-scores.history', { subjectId, limit });
  }

  // ─── DEBATES ───────────────────────────────────────────────────────
  async viewDebate(subjectId: string): Promise<RiskDebate> {
    return this.dashboardCall('debates.view', { subjectId });
  }

  async triggerDebate(subjectId: string): Promise<{ taskId: string }> {
    return this.dashboardCall('debates.trigger', { subjectId });
  }

  // ─── ALERTS ────────────────────────────────────────────────────────
  async listAlerts(scopeId?: string): Promise<RiskAlert[]> {
    return this.dashboardCall('alerts.list', { scopeId });
  }

  async acknowledgeAlert(id: string): Promise<void> {
    return this.dashboardCall('alerts.acknowledge', { id });
  }

  // ─── LEARNING QUEUE ────────────────────────────────────────────────
  async listLearningQueue(): Promise<LearningQueueItem[]> {
    return this.dashboardCall('learning-queue.list');
  }

  async respondToLearning(
    id: string,
    decision: 'approved' | 'rejected' | 'modified',
    notes?: string
  ): Promise<void> {
    return this.dashboardCall('learning-queue.respond', { id, decision, reviewerNotes: notes });
  }
}
```

### MVP vs Post-MVP Actions

| Action | MVP | Post-MVP | Notes |
|--------|-----|----------|-------|
| `scopes.list` | ✓ | | Required for scope dropdown |
| `scopes.get` | ✓ | | Required for scope details |
| `scopes.create` | ✓ | | Required for initial setup |
| `subjects.list` | ✓ | | Required for sidebar |
| `subjects.get` | ✓ | | Required for subject details |
| `subjects.create` | ✓ | | Required for adding subjects |
| `assessments.list` | | ✓ | Nice-to-have for history |
| `assessments.getBySubject` | ✓ | | Required for dimension cards |
| `composite-scores.list` | ✓ | | Required for sidebar scores |
| `composite-scores.get` | ✓ | | Required for radar chart |
| `composite-scores.history` | | ✓ | Timeline view (Phase 2+) |
| `debates.view` | | ✓ | Phase 2 |
| `debates.trigger` | | ✓ | Phase 2 |
| `alerts.list` | | ✓ | Phase 4 |
| `alerts.acknowledge` | | ✓ | Phase 4 |
| `learning-queue.list` | | ✓ | Phase 3 |
| `learning-queue.respond` | | ✓ | Phase 3 |

---

## UI User Flows

### Layout Structure

```
┌─────────────────────────────────────────────────────────────────────────┐
│ InvestmentRiskDashboard                                                 │
├──────────────────┬──────────────────────────────────────────────────────┤
│ RiskSidebar      │ Main Content Area                                    │
│                  │ ┌────────────────────────────────────────────────┐   │
│ [Scope Dropdown] │ │ RiskViewTabs: [Radar] [Debate] [Timeline]     │   │
│                  │ │               [Alerts] [Learnings] [Config]    │   │
│ Subject List:    │ └────────────────────────────────────────────────┘   │
│ ┌──────────────┐ │                                                      │
│ │ AAPL    [75] │ │ ┌────────────────────────────────────────────────┐   │
│ │ MSFT    [62] │ │ │ Active View Content                           │   │
│ │ BTC     [84] │ │ │ (RiskRadarChart / RiskDebateViewer / etc.)    │   │
│ │ + Add...     │ │ │                                                │   │
│ └──────────────┘ │ │                                                │   │
│                  │ └────────────────────────────────────────────────┘   │
│ [⚙ Config]       │                                                      │
└──────────────────┴──────────────────────────────────────────────────────┘
```

### View Navigation

| Tab | Component | Trigger |
|-----|-----------|---------|
| Radar | `RiskRadarChart` + `RiskDimensionCard` list | Default view when subject selected |
| Debate | `RiskDebateViewer` | Click "View Debate" button or Debate tab |
| Timeline | `RiskTimelineChart` | Click Timeline tab |
| Alerts | `RiskAlertPanel` | Click Alerts tab (badge shows unacknowledged count) |
| Learnings | `RiskLearningQueue` | Click Learnings tab (badge shows pending count) |
| Config | `RiskConfigPanel` | Click ⚙ icon in sidebar or Config tab |

### User Flow A: Initial Setup (Admin)

```
1. User opens InvestmentRiskDashboard (no scopes exist yet)
   → RiskEmptyState: "No scopes configured. Create your first scope."
   → [Create Scope] button

2. Click [Create Scope]
   → RiskConfigPanel opens
   → Form: Name, Domain (investment), LLM config, Thresholds
   → Submit calls `scopes.create`

3. Scope created → sidebar shows scope in dropdown
   → RiskEmptyState: "No subjects in this scope. Add a subject."
   → [Add Subject] button

4. Click [Add Subject]
   → Modal: Identifier (e.g., "AAPL"), Name, Type (stock/crypto)
   → Submit calls `subjects.create`

5. Subject appears in sidebar list
   → Auto-selected → Radar view shows RiskEmptyState: "No assessment yet"
   → [Run Assessment] button enabled
```

### User Flow B: Run Assessment

```
1. Subject selected in sidebar (e.g., AAPL)
   → Radar tab active
   → If no score: RiskEmptyState with [Run Assessment] button
   → If stale score (valid_until passed): Warning banner + [Refresh] button

2. Click [Run Assessment]
   → Button shows spinner
   → SSE connection established with taskId
   → Progress events update status: "Analyzing Market Risk..." etc.

3. Assessment completes
   → SSE completion event received
   → Service fetches `composite-scores.get`
   → RiskRadarChart renders spider diagram
   → RiskDimensionCard list shows each dimension with score + reasoning

4. Click a RiskDimensionCard
   → Expands to show full evidence and reasoning
   → "View in Debate" link (if debate exists)
```

### User Flow C: View Debate

```
1. From Radar view, click "View Debate" button
   OR click Debate tab

2. If no debate exists for current assessment:
   → RiskEmptyState: "Debate not yet run for this assessment"
   → [Trigger Debate] button (calls `debates.trigger`)

3. If debate exists:
   → RiskDebateViewer renders three sections:
     - Blue Agent (left): Initial assessment defense
     - Red Agent (right): Challenges and blind spots
     - Arbiter (bottom): Synthesis and final adjustment

4. Debate adjustment shown:
   → "Original: 72 → Final: 78 (+6 from debate)"
   → Reasoning for adjustment highlighted

5. [Back to Radar] button returns to Radar tab
```

### User Flow D: Manage Alerts

```
1. Click Alerts tab (badge shows "3" unacknowledged)

2. RiskAlertPanel shows list:
   ┌─────────────────────────────────────────────────────────┐
   │ 🔴 CRITICAL: BTC risk score 84 exceeds threshold 80    │
   │    Subject: BTC | 2 hours ago | [View] [Acknowledge]   │
   ├─────────────────────────────────────────────────────────┤
   │ 🟡 WARNING: AAPL rapid change +15 in 24h               │
   │    Subject: AAPL | 5 hours ago | [View] [Acknowledge]  │
   └─────────────────────────────────────────────────────────┘

3. Click [View] on an alert
   → Sidebar selects that subject
   → Switches to Radar tab

4. Click [Acknowledge]
   → Calls `alerts.acknowledge`
   → Alert moves to "Acknowledged" section
   → Badge count decrements
```

### User Flow E: Review Learnings

```
1. Click Learnings tab (badge shows "2" pending)

2. RiskLearningQueue shows pending items:
   ┌─────────────────────────────────────────────────────────┐
   │ PATTERN: "High VIX + low volume = elevated risk"       │
   │ AI Confidence: 78% | Source: evaluation of AAPL        │
   │ AI Reasoning: "Score was 45 but 15% drop occurred..."  │
   │ [Approve] [Reject] [Modify]                            │
   └─────────────────────────────────────────────────────────┘

3. Click [Approve]
   → Calls `learning-queue.respond` with decision: 'approved'
   → Toast: "Learning approved. Will be tested in next evaluation cycle."
   → Item moves to "Approved (Testing)" section

4. Click [Modify]
   → Modal opens with editable fields
   → User adjusts title/description/config
   → Submit calls `learning-queue.respond` with decision: 'modified'

5. Click [Reject]
   → Confirmation modal: "Reason for rejection?"
   → Submit calls `learning-queue.respond` with decision: 'rejected'
```

### User Flow F: Configure Dimensions (Admin)

```
1. Click Config tab or ⚙ icon

2. RiskConfigPanel shows tabs: Scopes | Subjects | Dimensions | Debates

3. Dimensions tab:
   ┌─────────────────────────────────────────────────────────┐
   │ Market Risk      [Weight: 1.0] [Active ✓] [Edit]       │
   │ Fundamental Risk [Weight: 1.0] [Active ✓] [Edit]       │
   │ Technical Risk   [Weight: 0.8] [Active ✓] [Edit]       │
   │ [+ Add Dimension]                                       │
   └─────────────────────────────────────────────────────────┘

4. Click [Edit] on a dimension
   → Expands to show:
     - Name, Description, Weight slider
     - Context Versions table (version 1, 2, 3...)
     - Active version selector
     - [Edit Prompt] button for current version

5. Click [Edit Prompt]
   → Modal with system_prompt textarea
   → output_schema JSON editor
   → examples array editor
   → [Save as New Version] creates v+1
   → [Update Current] modifies in place (warning: affects future runs)
```

### Runtime UI States

| State | Component | Display |
|-------|-----------|---------|
| **Loading** | `RiskLoadingState` | Skeleton loaders matching view layout |
| **Empty (no scopes)** | `RiskEmptyState` | "No scopes configured" + [Create Scope] |
| **Empty (no subjects)** | `RiskEmptyState` | "No subjects in scope" + [Add Subject] |
| **Empty (no score)** | `RiskEmptyState` | "No assessment yet" + [Run Assessment] |
| **Stale** | Banner in Radar view | "Score expired {time} ago" + [Refresh] |
| **Error (API)** | Toast + inline error | "Failed to load: {message}" + [Retry] |
| **Error (auth)** | Redirect | Navigate to login page |
| **Rate limited** | Toast | "External API rate limited. Try again in {time}." |

### Component Interactions

```
User Action                    → Store Mutation              → API Call
─────────────────────────────────────────────────────────────────────────
Select scope dropdown          → setSelectedScopeId()        → subjects.list
Click subject in list          → setSelectedSubjectId()      → composite-scores.get
Click "Run Assessment"         → setAssessmentRunning(true)  → (triggers runner)
SSE progress event             → updateProgress()            → (none)
SSE completion event           → setAssessmentRunning(false) → composite-scores.get
Click tab                      → setCurrentView()            → (lazy load if needed)
Click "Acknowledge" alert      → removeAlert()               → alerts.acknowledge
Click "Approve" learning       → removePendingLearning()     → learning-queue.respond
Switch scope                   → resetSubjectState()         → subjects.list
```

---

## Learning Loop Integration

### Learning Types for Risk Analysis

| Type | Example | Applied As |
|------|---------|------------|
| **rule** | "Always increase risk score during earnings week" | Hard rule in analyst prompt |
| **pattern** | "High VIX + low volume = elevated risk" | Pattern recognition hint |
| **avoid** | "Don't lower risk based solely on recent gains" | Anti-pattern warning |
| **weight_adjustment** | "Technical analyst overweights momentum" | Adjust dimension weight |
| **threshold** | "Require >70 risk score for critical alert" | Threshold tuning |

### Learning Workflow

```
┌─────────────────────────────────────────────────┐
│ 1. RISK EVALUATION                              │
│    Risk score vs actual outcome analyzed        │
│    "Score was 45, but 15% drop occurred"        │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│ 2. AI SUGGESTION                                │
│    "Pattern: earnings + low volume = underrated"│
│    ai_confidence: 0.78                          │
│    → Added to risk.learning_queue               │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│ 3. HITL REVIEW                                  │
│    Human reviews in Risk Dashboard              │
│    Decision: approved / rejected / modified     │
│    → Creates risk.learnings (is_test=true)      │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│ 4. TEST VALIDATION                              │
│    Historical replay testing                    │
│    Validate learning improves accuracy          │
│    Track times_applied, times_helpful           │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│ 5. PROMOTION (HITL)                             │
│    Human approves promotion to production       │
│    Creates production copy (is_test=false)      │
│    Audit trail in learning_lineage              │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│ 6. APPLICATION                                  │
│    Learning applied to future risk assessments  │
│    Effectiveness continuously tracked           │
└─────────────────────────────────────────────────┘
```

### Evaluation Metrics & Ground Truth

**Challenge**: Risk scores are forward-looking assessments. How do we measure if a risk score of 75 was "correct"?

#### Ground Truth Definition

Risk scores predict the **probability and magnitude of adverse outcomes**. We evaluate against actual outcomes:

| Outcome Type | Measurement | Timeframe |
|--------------|-------------|-----------|
| **Price Drop** | % decline from assessment date | 7d, 30d, 90d |
| **Volatility Spike** | Realized vol vs implied vol at assessment | Rolling 30d |
| **Drawdown** | Max drawdown from assessment date | 30d, 90d |
| **Fundamental Change** | Earnings miss, debt downgrade, etc. | Next quarter |

#### Evaluation Metrics

1. **Calibration Score**: Do subjects with risk score 70-80 actually experience adverse events ~70-80% of the time?
   - Bin risk scores into deciles
   - Compare predicted risk % to actual adverse event rate
   - Perfect calibration = diagonal line on calibration plot

2. **Discrimination Score (AUC)**: Can the model distinguish high-risk from low-risk subjects?
   - Higher AUC = better separation between subjects that had adverse events vs those that didn't

3. **Brier Score**: Overall accuracy combining calibration and discrimination
   - Lower is better (0 = perfect, 1 = worst)

4. **Per-Dimension Accuracy**: Which dimensions contribute most to accurate predictions?
   - Track `dimension_accuracy` in `risk.evaluations` table
   - Identifies dimensions needing prompt tuning or weight adjustment

#### Evaluation Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│ Daily: RiskEvaluationRunner                                     │
│ 1. Find assessments from 7/30/90 days ago                       │
│ 2. Fetch actual outcomes (price changes, events)                │
│ 3. Compare risk score to outcome severity                       │
│ 4. Store in risk.evaluations with per-dimension breakdown       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Weekly: Aggregate metrics for dashboard display                 │
│ - Overall calibration, AUC, Brier score                         │
│ - Per-scope and per-dimension breakdown                         │
│ - Trend analysis (is accuracy improving?)                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Development Roadmap

### Phase 1: Foundation (MVP)
1. Database schema creation (`risk.*` tables)
2. Risk runner module scaffolding
3. Scope and subject repositories
4. Basic Risk Radar with 3 dimensions (Market, Fundamental, Technical)
5. Risk aggregation service (composite score calculation)
6. Simple dashboard showing composite scores
7. Agent registration with `hasCustomUI: true`
8. Basic A2A dashboard handlers

### Phase 2: Red Team Enhancement
1. Red Team / Blue Team debate system
2. Arbiter synthesis logic
3. Debate transcript storage and retrieval
4. UI component for viewing debates
5. Score adjustment from debate

### Phase 3: Learning Loop
1. Risk evaluation runner
2. AI suggestion generation
3. Learning queue with HITL review
4. Historical replay testing service
5. Learning promotion workflow
6. UI for learning review

### Phase 4: Alerts & Notifications
1. Alert system with configurable thresholds
2. Alert acknowledgment workflow
3. Notification integration (Slack, email)
4. SSE streaming for real-time alerts

### Phase 5: Advanced Features
1. Remaining risk dimensions (Macro, Correlation)
2. Cross-subject correlation analysis
3. Portfolio-level risk aggregation
4. Optional integration with Prediction system (API-based, not schema coupling)
5. Risk-gated prediction generation (future consideration)

---

## Testing Strategy

### Test Matrix by Layer

| Layer | Type | What's Tested | Mock Strategy |
|-------|------|---------------|---------------|
| **Database** | Integration | Migrations, constraints, indexes, seed data | Real test DB (Docker) |
| **Repositories** | Integration | CRUD operations, query correctness | Real test DB |
| **Services** | Unit | Score aggregation, prompt assembly, cache TTL | Mock repositories |
| **Runners** | Integration | Pipeline orchestration, overlap prevention | Mock LLM + Mock Data Fetcher |
| **Dashboard Handlers** | Integration | Auth/org scoping, pagination, error states | Mock services |
| **Pinia Store** | Unit | Mutations, computed properties, state reset | Mock service responses |
| **Vue Components** | Unit | Rendering, user interactions, loading/error states | Mock store |
| **E2E** | E2E | Full user flows | Seeded DB + Mock external APIs |

### Unit Tests

**Score Aggregation Service** (`score-aggregation.service.spec.ts`)
- Weighted average calculation with varying dimension weights
- Handles missing dimensions gracefully
- Debate adjustment applied correctly
- Confidence calculation from dimension confidences

**Dimension Analyzer Service** (`dimension-analyzer.service.spec.ts`)
- Prompt assembly from `dimension_contexts` table
- Correct data injection into prompt template
- Output schema validation
- Handles missing/inactive context versions

**Data Fetcher Service** (`data-fetcher.service.spec.ts`)
- TTL cache respects expiration
- Cache key generation for different subjects/data types
- Rate limiting per API source
- Graceful degradation on API failures

**Pinia Store** (`riskDashboardStore.spec.ts`)
- `setScopes()` / `setSubjects()` mutations update state
- `selectedSubject` computed returns correct item
- `currentScore` computed handles missing subject
- State resets when switching scope (`resetSubjectState()`)
- `pendingLearnings` filters correctly

### Integration Tests

**Database Migrations** (`risk-schema.migration.spec.ts`)
- Migration applies cleanly to empty DB
- Required indexes exist (`risk.subjects.scope_id`, `risk.assessments.subject_id`)
- Foreign key constraints enforced
- Seed script creates valid scope → subject → dimensions → contexts

**Dashboard Handlers** (`risk-dashboard.handler.spec.ts`)
- Auth: rejects unauthenticated requests
- Org scoping: user only sees their org's scopes
- Pagination: `limit` and `offset` work correctly
- Invalid IDs: returns 404, not 500
- Empty states: returns `[]` not error

**Risk Analysis Runner** (`risk-analysis.runner.spec.ts`)
- Processes all active scopes
- Skips inactive subjects
- Overlap prevention works (concurrent trigger blocked)
- Creates assessments for each dimension
- Aggregates into composite score
- Mock LLM returns deterministic responses

### E2E Tests

**Happy Path Flow** (`risk-e2e.spec.ts`)
```
1. Login as finance org user
2. Navigate to investment-risk-agent conversation
3. Verify InvestmentRiskDashboard renders
4. Create new scope via config panel
5. Add subject to scope
6. Select subject in sidebar
7. Click "Run Assessment" button
8. Wait for SSE completion event
9. Verify RiskRadarChart shows dimension scores
10. Click "View Debate" → RiskDebateViewer opens
11. Navigate to Alerts tab
12. Acknowledge an alert
13. Navigate to Learnings tab
14. Approve a pending learning
15. Verify toast/confirmation shown
```

**Error Handling Flow** (`risk-error-e2e.spec.ts`)
```
1. Simulate API failure (500 response)
2. Verify error state shown in UI
3. Verify retry button available
4. Simulate auth expiration
5. Verify redirect to login
```

### SSE Testing

**SSE Stream Tests** (`risk-sse.spec.ts`)
- Client connects with correct `taskId`
- Progress events update UI in real-time
- Completion event triggers data refresh
- Connection drop triggers reconnect
- Error event shows notification

### MVP Test Commitment

**Must be automated before merge:**
- [ ] All unit tests (services, store)
- [ ] DB migration test
- [ ] Dashboard handler integration tests (auth, CRUD, pagination)
- [ ] Runner integration test with mock LLM
- [ ] Basic E2E: create scope → add subject → run assessment → see scores

**Manual testing acceptable for MVP:**
- SSE reconnection edge cases
- External API rate limit handling
- Cross-browser compatibility
- Mobile responsiveness

**Non-goals for MVP:**
- No live external API calls in CI (Yahoo Finance, FRED, NewsAPI all mocked)
- No load/performance testing
- No visual regression testing

---

## Relationship with Prediction System

### Data Independence
- **No shared data** - `risk.*` schema is completely independent from `prediction.*`
- Risk has its own subjects, scopes, assessments - no foreign keys to prediction tables
- This allows the risk-runner to be used by non-finance agents (business risk, project risk, etc.)

### Potential Future Integration (Optional, Not in MVP)
- Could display risk scores alongside predictions in Finance UI
- Could implement risk-gated predictions (only predict low-risk subjects)
- Would be done via API calls, not schema coupling

### UI Integration (MVP)
- Investment Risk Dashboard is a separate custom UI component
- Accessible via `investment-risk-agent` in finance org
- No integration with Prediction dashboard in MVP

---

## Verification Plan

### Database
```bash
# After migrations
psql -c "SELECT * FROM risk.scopes;"
psql -c "SELECT * FROM risk.subjects;"
psql -c "SELECT * FROM risk.dimensions;"
psql -c "SELECT * FROM risk.composite_scores LIMIT 5;"
```

### Runners
```bash
# Test individual runners
npm run test:risk-runner

# Manual trigger via API
curl -X POST localhost:3000/risk-runner/trigger/risk-radar \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

### A2A Dashboard
```bash
# Test dashboard action (uses agent slug, not module name)
curl -X POST localhost:3000/agent-to-agent/finance/investment-risk-agent/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tasks/send",
    "params": {
      "context": { "orgSlug": "finance", "agentSlug": "investment-risk-agent", ... },
      "mode": "dashboard",
      "payload": { "action": "composite-scores.list" }
    }
  }'
```

### UI Verification
1. Navigate to risk agent conversation
2. Verify Risk Radar chart renders with dimension breakdown
3. Trigger assessment and watch real-time updates via SSE
4. View Red Team debate transcript (Phase 2)
5. Review and respond to learning suggestion (Phase 3)

### End-to-End Flow
1. Create scope and add subject via dashboard
2. Wait for Risk Radar runner (or trigger manually)
3. Verify composite score with dimension breakdown
4. Verify debate initiated for high-priority subjects
5. Verify alert generated if threshold breached
6. Review AI-suggested learning in queue
7. Approve learning and verify applied to next assessment

---

## Critical Files to Create/Modify

### New Files (API)
- `apps/api/src/risk-runner/risk-runner.module.ts`
- `apps/api/src/risk-runner/repositories/*.ts`
- `apps/api/src/risk-runner/services/*.ts`
- `apps/api/src/risk-runner/runners/*.ts`
- `apps/api/src/risk-runner/task-router/*.ts`
- `apps/api/src/agent2agent/services/risk-agent-runner.service.ts`
- `apps/api/supabase/migrations/YYYYMMDD_risk_schema.sql`

**Note**: No `analysts/*.ts` directory - dimensions and their prompts are fully table-driven via `risk.dimensions` and `risk.dimension_contexts`.

### New Files (Web)
- `apps/web/src/components/risk/RiskDashboardTab.vue`
- `apps/web/src/components/risk/components/*.vue`
- `apps/web/src/stores/riskDashboardStore.ts`
- `apps/web/src/services/riskDashboardService.ts`
- `apps/web/src/types/risk.ts`

### Modified Files
- `apps/web/src/components/ConversationView.vue` - Add risk-dashboard routing
- `apps/api/src/app.module.ts` - Import RiskRunnerModule
- `apps/api/src/agent2agent/agent2agent.module.ts` - Register RiskAgentRunnerService

---

## Key Patterns Reference

| Pattern | Location | Description |
|---------|----------|-------------|
| ExecutionContext Capsule | `transport-types/core/execution-context.ts` | Pass complete context, never split |
| Runner Overlap Prevention | `prediction-runner/runners/*.ts` | `isRunning` flag pattern |
| A2A Dashboard Routing | `prediction-runner/task-router/` | `{entity}.{operation}` action format |
| Custom UI Routing | `ConversationView.vue` | `hasCustomUI` + `customUIComponent` metadata |
| Pinia Store Pattern | `stores/predictionAgentStore.ts` | State + computed + sync mutations only |
| Learning Lifecycle | `prediction-runner/services/learning*.ts` | Suggestion → Review → Test → Promote |
| SSE Streaming | `services/streaming.service.ts` | Real-time updates with `emitProgress()` |

---

## Summary

This PRD defines a comprehensive **Investment Risk Agent** that:

1. **Follows proven patterns** from the Prediction runner system
2. **Provides multi-factor risk assessment** via Risk Radar parallel analysis
3. **Reduces blind spots** via Red Team / Blue Team adversarial debate
4. **Continuously improves** via learning loop with HITL review
5. **Operates independently** with its own `risk.*` schema and custom UI (no Prediction integration in MVP)
6. **Maintains full observability** via ExecutionContext capsule flow
7. **Is fully table-driven** - new risk dimensions added via database, not code changes

**MVP Scope Boundaries**:
- Standalone Investment Risk Dashboard (separate from Prediction)
- Manual subject management (no automated watchlist sync)
- Free API data sources only
- No cross-system integration in Phase 1
