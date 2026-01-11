# Financial Asset Predictor Runner

**Created:** 2026-01-10
**Status:** Draft
**Author:** Claude + User
**Related:** [Prediction Dashboard UI Refactor PRD](./2026-01-09-prediction-dashboard-ui-refactor.md) (authoritative source for shared infrastructure)

---

## Executive Summary

Consolidate the existing `stock-predictor` and `crypto-predictor` runners into a single `financial-asset-predictor` runner. This reduces code duplication, simplifies maintenance, and establishes a clean pattern for future prediction domains (betting markets, etc.).

Additionally, this PRD covers the supporting infrastructure needed for the prediction system:
- Story deduplication to prevent duplicate signals from crawled sources
- Test data injection framework for validating the prediction pipeline

> **Note:** The story deduplication and test data injection sections reference and extend the authoritative specifications in the [Dashboard UI Refactor PRD](./2026-01-09-prediction-dashboard-ui-refactor.md) Appendices H, I, and J. This document provides runner-specific implementation details.

---

## Problem Statement

### Current State

The prediction system has three runners that share 99% identical pipeline logic:

```
apps/api/src/agent2agent/runners/prediction/
├── stock-predictor/      # Stocks, ETFs
├── crypto-predictor/     # Bitcoin, Ethereum, etc.
└── market-predictor/     # Polymarket (not actively used)
```

**Problems:**
1. **Code duplication** - Same LangGraph pipeline repeated three times
2. **Maintenance burden** - Bug fixes must be applied to all three
3. **False distinction** - Crypto is just another asset class (Bitcoin ETFs trade on stock exchanges)
4. **Unused code** - `market-predictor` works but isn't actively used

### Additional Problems

1. **Duplicate signals** - Crawling sources every 10 minutes creates duplicate/near-duplicate stories
2. **Testing difficulty** - Hard to test individual pipeline tiers without running the full system

---

## Goals

1. **Merge stock + crypto** into a single `financial-asset-predictor` runner
2. **Delete unused code** - Remove `crypto-predictor` and `market-predictor` directories
3. **Implement story deduplication** - Prevent duplicate signals from crawled sources
4. **Build test data injection** - Enable testing any tier of the prediction pipeline
5. **Establish clean pattern** - Make it easy to add future prediction domains

## Non-Goals

1. Building the betting market predictor now (will do later using this as template)
2. Changing the core LangGraph pipeline logic
3. Modifying the base prediction runner class

---

## Architecture

### Target Directory Structure

```
apps/api/src/agent2agent/runners/prediction/
├── base/
│   ├── base-prediction-runner.service.ts   # Unchanged
│   └── base-prediction.types.ts            # Unchanged
├── financial-asset-predictor/
│   ├── financial-asset-predictor-runner.service.ts
│   ├── tools/
│   │   ├── yahoo-finance.tool.ts           # From stock-predictor
│   │   ├── alpha-vantage.tool.ts           # From stock-predictor
│   │   ├── binance.tool.ts                 # From crypto-predictor
│   │   ├── coingecko.tool.ts               # From crypto-predictor
│   │   ├── whale-alert.tool.ts             # From crypto-predictor
│   │   └── defillama.tool.ts               # From crypto-predictor
│   └── specialists/
│       ├── technical-analyst.ts
│       ├── fundamental-analyst.ts
│       ├── sentiment-analyst.ts
│       ├── onchain-analyst.ts              # Only for crypto instruments
│       └── defi-analyst.ts                 # Only for crypto instruments
├── runner.registry.ts
├── runner-factory.service.ts
└── prediction.module.ts
```

### Why Merge Stock + Crypto?

| Aspect | Stock | Crypto | Verdict |
|--------|-------|--------|---------|
| Core concept | Price movement | Price movement | **Same** |
| Trading mechanics | Buy/sell orders | Buy/sell orders | **Same** |
| Technical analysis | Charts, MA, RSI | Charts, MA, RSI | **Same** |
| Claim types | price, volume, change | price, volume, change | **Same** |
| Data frequency | Market hours | 24/7 | Config flag |
| Volatility threshold | 2% | 5% | Config per instrument |
| On-chain data | N/A | whale_transaction, gas | Optional tools |

**Conclusion:** Crypto is just another asset class. Bitcoin ETFs (IBIT, GBTC) already trade on stock exchanges.

---

## Implementation

### Phase 1: Runner Consolidation

#### Step 1: Rename Directory

```bash
git mv apps/api/src/agent2agent/runners/prediction/stock-predictor \
       apps/api/src/agent2agent/runners/prediction/financial-asset-predictor
```

#### Step 2: Rename Service File

```bash
cd apps/api/src/agent2agent/runners/prediction/financial-asset-predictor
git mv stock-predictor-runner.service.ts financial-asset-predictor-runner.service.ts
```

#### Step 3: Update Class and Registration

```typescript
// Before
@RegisterRunner({ type: 'stock-predictor', name: 'Stock Predictor', ... })
export class StockPredictorRunnerService extends BasePredictionRunnerService

// After
@RegisterRunner({
  type: 'financial-asset-predictor',
  name: 'Financial Asset Predictor',
  supportedTargetTypes: ['stock', 'etf', 'crypto', 'forex'],
})
export class FinancialAssetPredictorRunnerService extends BasePredictionRunnerService
```

#### Step 4: Merge Tools

```typescript
getTools() {
  return [
    // Stock data sources
    'yahoo-finance',
    'alpha-vantage',
    // Crypto data sources (merged from crypto-predictor)
    'binance',
    'coingecko',
    'whale-alert',
    'etherscan',
    'defillama',
  ];
}
```

#### Step 5: Conditional Specialists

```typescript
getSpecialistContexts(bundle: EnrichedClaimBundle) {
  const specialists = [
    'technical-analyst',
    'fundamental-analyst',
    'sentiment-analyst',
    'news-analyst',
  ];

  // Only add crypto-specific specialists if bundle contains crypto instruments
  if (this.hasCryptoInstruments(bundle)) {
    specialists.push('onchain-analyst', 'defi-analyst');
  }

  return specialists;
}

private hasCryptoInstruments(bundle: EnrichedClaimBundle): boolean {
  const cryptoPatterns = ['BTC', 'ETH', 'SOL', 'USDT', 'USDC', '-USD', 'COIN'];
  return bundle.claims.some(c =>
    cryptoPatterns.some(p => c.instrument.toUpperCase().includes(p))
  );
}
```

#### Step 6: Unified Risk Profiles

```typescript
getRiskProfiles() {
  return [
    // Traditional terminology
    { id: 'conservative', label: 'Conservative', volatilityThreshold: 0.02 },
    { id: 'moderate', label: 'Moderate', volatilityThreshold: 0.05 },
    { id: 'aggressive', label: 'Aggressive', volatilityThreshold: 0.10 },
    // Crypto terminology (aliases to traditional)
    { id: 'hodler', label: 'HODLer', volatilityThreshold: 0.02 },
    { id: 'trader', label: 'Trader', volatilityThreshold: 0.05 },
    { id: 'degen', label: 'Degen', volatilityThreshold: 0.15 },
  ];
}
```

#### Step 7: Delete Old Runners

```bash
rm -rf apps/api/src/agent2agent/runners/prediction/crypto-predictor
rm -rf apps/api/src/agent2agent/runners/prediction/market-predictor
```

#### Step 8: Update Module

```typescript
// prediction.module.ts
@Module({
  providers: [
    FinancialAssetPredictorRunnerService,
    // REMOVED: StockPredictorRunnerService
    // REMOVED: CryptoPredictorRunnerService
    // REMOVED: MarketPredictorRunnerService
  ],
})
export class PredictionModule {}
```

#### Step 9: Backwards Compatibility

```typescript
// runner-factory.service.ts
resolveRunnerType(type: string): string {
  const aliases: Record<string, string> = {
    'stock-predictor': 'financial-asset-predictor',
    'crypto-predictor': 'financial-asset-predictor',
  };
  return aliases[type] ?? type;
}
```

#### Step 10: Database Migration

```sql
-- Update agent records that reference old runner types
UPDATE agents SET runner_type = 'financial-asset-predictor'
WHERE runner_type IN ('stock-predictor', 'crypto-predictor');
```

---

### Phase 2: Story Deduplication

When crawling sources every 10 minutes, the system encounters duplicate or near-duplicate stories that create wasted analyst cycles.

#### Deduplication Layers

**Layer 1: Exact Hash Match (Existing)**
```
Story → SHA-256(normalized title + first 500 chars) → Check source_seen_items
```
Already implemented in `ContentHashService.hashArticle()`.

**Layer 2: Cross-Source Hash Check (New)**
```
Content hash → Check ALL sources for this target (not just current source)
```

```sql
CREATE OR REPLACE FUNCTION prediction.check_content_hash_for_target(
  p_content_hash TEXT,
  p_target_id UUID
) RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM prediction.source_seen_items ssi
    JOIN prediction.sources s ON ssi.source_id = s.id
    WHERE ssi.content_hash = p_content_hash
    AND s.target_id = p_target_id
  );
$$ LANGUAGE SQL STABLE;
```

**Layer 3: Fuzzy Title Matching (New)**
```
Story title → Compare against recent signals → Jaccard similarity > 0.85
```
Uses existing `ContentHashService.isSimilar()` on titles.

**Layer 4: Key Phrase Overlap (New - Configurable)**
```
Story content → Extract key phrases → Compare phrase overlap > 70%
```
Uses existing `ContentHashService.extractKeyPhrases()`.

#### Database Changes

```sql
-- New columns on source_seen_items
ALTER TABLE prediction.source_seen_items ADD COLUMN IF NOT EXISTS
  title_normalized TEXT,
  key_phrases TEXT[],
  fingerprint_hash TEXT;

-- New table for signal fingerprints
CREATE TABLE prediction.signal_fingerprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID REFERENCES prediction.signals(id) ON DELETE CASCADE,
  target_id UUID REFERENCES prediction.targets(id),
  title_normalized TEXT NOT NULL,
  key_phrases TEXT[] NOT NULL,
  fingerprint_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (signal_id)
);

CREATE INDEX idx_signal_fingerprints_target ON prediction.signal_fingerprints(target_id);
CREATE INDEX idx_signal_fingerprints_hash ON prediction.signal_fingerprints(fingerprint_hash);
```

#### Enhanced processItem() Flow

```typescript
private async processItem(source, item, targetId): Promise<ProcessResult> {
  const contentHash = this.contentHashService.hashArticle(item.title, item.content);

  // Layer 1: Exact hash match
  const { isNew } = await this.sourceSeenItemRepository.markSeen(source.id, contentHash);
  if (!isNew) return { isNew: false, reason: 'exact_duplicate' };

  // Layer 2: Cross-source hash check
  const seenInOtherSource = await this.sourceSeenItemRepository.hasBeenSeenForTarget(contentHash, targetId);
  if (seenInOtherSource) return { isNew: false, reason: 'cross_source_duplicate' };

  // Layer 3: Fuzzy title match
  const normalizedTitle = this.contentHashService.normalizeContent(item.title);
  const similarSignal = await this.findSimilarByTitle(targetId, normalizedTitle, 0.85);
  if (similarSignal) return { isNew: false, reason: 'fuzzy_title_match', similarTo: similarSignal.id };

  // Layer 4: Key phrase overlap (configurable)
  if (source.crawl_config?.fuzzy_dedup_enabled) {
    const keyPhrases = this.contentHashService.extractKeyPhrases(item.content, 15);
    const overlapMatch = await this.findByPhraseOverlap(targetId, keyPhrases, 0.7);
    if (overlapMatch) return { isNew: false, reason: 'phrase_overlap', similarTo: overlapMatch.id };
  }

  // Create signal with fingerprint
  const signal = await this.signalRepository.create(signalData);
  await this.signalFingerprintRepository.create({
    signal_id: signal.id,
    target_id: targetId,
    title_normalized: normalizedTitle,
    key_phrases: keyPhrases,
    fingerprint_hash: this.contentHashService.hash(keyPhrases.join('|')),
  });

  return { isNew: true, signalId: signal.id };
}
```

#### Configuration

Add to `crawl_config` JSONB on sources:

```json
{
  "fuzzy_dedup_enabled": true,
  "title_similarity_threshold": 0.85,
  "phrase_overlap_threshold": 0.70,
  "cross_source_dedup": true
}
```

#### Metrics

Track deduplication stats in `source_crawls`:

```sql
ALTER TABLE prediction.source_crawls ADD COLUMN IF NOT EXISTS
  duplicates_exact INTEGER DEFAULT 0,
  duplicates_cross_source INTEGER DEFAULT 0,
  duplicates_fuzzy_title INTEGER DEFAULT 0,
  duplicates_phrase_overlap INTEGER DEFAULT 0;
```

---

### Phase 3: Test Data Injection Framework

The prediction pipeline is database-driven - each tier reads from and writes to database tables. This enables testing any tier by injecting test data directly.

#### Pipeline Overview

```
Sources → Signals → Predictors → Predictions → Outcomes → Evaluations → Learning
   ↑         ↑          ↑            ↑            ↑           ↑            ↑
[INJECT] [INJECT]   [INJECT]     [INJECT]     [INJECT]    [INJECT]     [INJECT]
```

#### Database Schema: Test Data Markers

```sql
-- Add to ALL prediction tables
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'prediction' AND table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('
      ALTER TABLE prediction.%I
      ADD COLUMN IF NOT EXISTS is_test_data BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS test_scenario_id UUID
    ', tbl);
  END LOOP;
END $$;

-- Indexes for fast test data operations
CREATE INDEX IF NOT EXISTS idx_signals_test_data
  ON prediction.signals(is_test_data) WHERE is_test_data = TRUE;
CREATE INDEX IF NOT EXISTS idx_predictions_test_data
  ON prediction.predictions(is_test_data) WHERE is_test_data = TRUE;
```

#### Test Scenarios Table

```sql
CREATE TABLE IF NOT EXISTS prediction.test_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  injection_points TEXT[] NOT NULL,
  target_id UUID REFERENCES prediction.targets(id),
  organization_slug TEXT NOT NULL,  -- Multi-tenant isolation
  config JSONB DEFAULT '{}',
  created_by TEXT,
  status TEXT DEFAULT 'active',
  results JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- RLS for multi-tenant isolation
ALTER TABLE prediction.test_scenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY test_scenarios_org_isolation ON prediction.test_scenarios
  USING (organization_slug = current_setting('app.current_org', true));
```

#### Test Data Isolation Requirements

> **Critical:** Test data must NEVER pollute production metrics, dashboards, or learning loops.

**Requirement 1: Default Exclusion**
All dashboard queries, pipeline processing, and analytics MUST exclude `is_test_data = TRUE` by default:

```typescript
// Every query that aggregates or displays prediction data must include:
.eq('is_test_data', false)  // Or: .is('is_test_data', null)
```

**Backend Filter Flag:** Services/handlers must accept a standard filter interface:

```typescript
interface TestDataFilter {
  includeTestData?: boolean;      // Default: false - include test data in results
  testScenarioId?: string;        // Filter to specific scenario only
}

// Usage in repository methods:
async findSignals(targetId: string, filter?: TestDataFilter): Promise<Signal[]> {
  let query = this.client.from('signals').select('*').eq('target_id', targetId);

  if (!filter?.includeTestData) {
    query = query.or('is_test_data.is.null,is_test_data.eq.false');
  }
  if (filter?.testScenarioId) {
    query = query.eq('test_scenario_id', filter.testScenarioId);
  }

  return query;
}
```

**Requirement 2: Test Mode Filter**
The UI should provide an explicit "Test Mode" toggle that, when enabled:
- Shows test data alongside (or instead of) production data
- Visually distinguishes test data (e.g., badge, different color)
- Prevents test data from being used in learning calculations

**Requirement 3: Pipeline Isolation**
When processing test scenarios, the pipeline must:
- Only process records matching the `test_scenario_id`
- Write outputs with the same `test_scenario_id` marker
- Never update production analyst/context configurations

#### Multi-Tenant Requirements

**New Tables:** `prediction.signal_fingerprints` and `prediction.test_scenarios` inherit tenant isolation through their foreign keys:

| Table | Isolation Strategy |
|-------|-------------------|
| `signal_fingerprints` | Via `target_id` → `targets.universe_id` → org-scoped |
| `test_scenarios` | Direct `organization_slug` column + RLS policy |

> **Important:** All reads/writes to `signal_fingerprints` MUST join through org-scoped `targets` or `sources`. No direct unscoped access is permitted. If direct access becomes necessary, add `organization_slug` + RLS to the table.

**Helper Functions:** All new RPC functions must be tenant-safe:

```sql
-- Example: check_content_hash_for_target is safe because it joins through
-- sources → targets, which are already org-scoped via universe_id
```

#### Architecture: Frontend-First, JSON-Based

All test data lives in the frontend Pinia store until the user clicks "Execute". The backend is stateless during the conversation.

```
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND (Vue/Pinia)                                           │
├─────────────────────────────────────────────────────────────────┤
│  testDataBuilderStore                                           │
│  ├── scenario: { name, targetId, ... }                          │
│  ├── pendingData: { signals: [], predictions: [], ... }         │
│  └── conversationHistory: [...]                                 │
│                                                                 │
│  Flow:                                                          │
│  1. User types: "Add 5 bearish signals about Bitcoin"           │
│  2. POST to A2A: { prompt, currentJSON }                        │
│  3. A2A returns: { updatedJSON, displayMessage }                │
│  4. Store updatedJSON in Pinia (NOT in database)                │
│  5. User reviews, refines...                                    │
│  6. User clicks [Execute]                                       │
│  7. POST finalJSON to A2A execute action                        │
│  8. Backend generates INSERTs with is_test_data=true            │
└─────────────────────────────────────────────────────────────────┘
```

#### A2A Agent: test-data-builder

All operations go through the standard A2A tasks endpoint:

```
POST /agent-to-agent/:orgSlug/test-data-builder/tasks
```

| Action | Payload | Database Write? |
|--------|---------|-----------------|
| Build/refine test data | `{ "action": "build", "prompt": "...", "currentJSON": {...} }` | NO |
| Execute (insert) | `{ "action": "execute", "finalJSON": {...} }` | YES |
| Cleanup scenario | `{ "action": "cleanup", "scenarioId": "..." }` | YES (delete) |
| List scenarios | `{ "action": "list-scenarios" }` | NO (read) |
| Run tier | `{ "action": "run-tier", "scenarioId": "...", "tier": "..." }` | YES |

#### Frontend Store

```typescript
// stores/testDataBuilder.store.ts
export const useTestDataBuilderStore = defineStore('testDataBuilder', {
  state: () => ({
    scenario: { name: '', targetId: '', universeId: '' },
    pendingData: {
      sources: [] as TestSourceData[],
      signals: [] as TestSignalData[],
      predictors: [] as TestPredictorData[],
      predictions: [] as TestPredictionData[],
      outcomes: [] as TestOutcomeData[],
      learningItems: [] as TestLearningItemData[],
    },
    conversationHistory: [] as Message[],
    executedScenarioId: null as string | null,
  }),

  actions: {
    async sendPrompt(prompt: string) {
      this.conversationHistory.push({ role: 'user', content: prompt });

      const response = await agentService.callA2A('test-data-builder', {
        userMessage: prompt,
        payload: {
          action: 'build',
          currentJSON: { scenario: this.scenario, ...this.pendingData },
        },
      });

      if (response.payload?.updatedJSON) {
        this.pendingData = response.payload.updatedJSON;
      }
      this.conversationHistory.push({ role: 'assistant', content: response.content });
    },

    async execute() {
      const response = await agentService.callA2A('test-data-builder', {
        userMessage: 'Execute this test dataset',
        payload: {
          action: 'execute',
          finalJSON: { scenario: this.scenario, ...this.pendingData },
        },
      });
      this.executedScenarioId = response.payload?.scenarioId;
    },

    reset() {
      this.pendingData = { sources: [], signals: [], predictions: [], outcomes: [], learningItems: [] };
      this.conversationHistory = [];
      this.executedScenarioId = null;
    },
  },
});
```

#### Conversational UI

The AI-powered builder understands requests at each tier:

| Tier | Example Prompts |
|------|-----------------|
| Sources | "Add a TechCrunch-style source that crawls every 5 minutes" |
| Signals | "Create 5 bearish signals about Bitcoin regulation" |
| Predictors | "Add a predictor that's been assigned 3 of these signals" |
| Predictions | "Generate predictions with a 60% bullish bias" |
| Outcomes | "Set outcomes so that 70% of predictions were correct" |
| Learning Items | "Queue up improvements based on the analyst's mistakes" |

---

### Phase 3 Supporting Details

#### Injection Points Reference

> **Important:** Per the Dashboard PRD, `prediction.analysts` is deprecated and being migrated to `prediction.contexts` (with `context_type='analyst'`). Test injection should target the unified contexts model.

| Want to Test | Inject Into | Then Run |
|--------------|-------------|----------|
| Source crawling | `prediction.sources` with mock config | `SourceCrawlerRunner` |
| Deduplication | `prediction.source_seen_items` | Crawl with similar content |
| Signal detection | `prediction.signals` | `SignalDetectionService` |
| Analyst behavior | `prediction.contexts` where `context_type='analyst'` | Signal detection |
| Prediction generation | `prediction.predictors` | `PredictionGenerationService` |
| Outcome tracking | `prediction.predictions` with outcomes | `OutcomeTrackingService` |
| Evaluation accuracy | `prediction.predictions` + known outcomes | `EvaluationService` |
| Missed opportunity | `prediction.signals` without predictions | `MissedOpportunityService` |
| Learning loop | `prediction.learning_queue` items | `LearningService` |
| Strategy rules | `prediction.strategies` | Any tier with strategy checks |

#### TestDataInjectorService

```typescript
@Injectable()
export class TestDataInjectorService {

  // ═══════════════════════════════════════════════════════════════════
  // GENERIC INJECTION - Insert into ANY prediction table
  // ═══════════════════════════════════════════════════════════════════

  async injectIntoTable<T>(tableName: string, data: T[], scenarioId: string): Promise<T[]> {
    const withTestMarkers = data.map(row => ({
      ...row,
      is_test_data: true,
      test_scenario_id: scenarioId,
    }));

    const { data: inserted, error } = await this.supabase
      .schema('prediction')
      .from(tableName)
      .insert(withTestMarkers)
      .select();

    if (error) throw new Error(`Failed to inject into ${tableName}: ${error.message}`);
    return inserted;
  }

  // ═══════════════════════════════════════════════════════════════════
  // TIER-SPECIFIC INJECTORS
  // ═══════════════════════════════════════════════════════════════════

  async injectSignals(scenarioId: string, signals: Partial<Signal>[]): Promise<Signal[]>;
  async injectContexts(scenarioId: string, contexts: Partial<PredictionContext>[]): Promise<PredictionContext[]>; // Unified model (replaces analysts)
  async injectPredictors(scenarioId: string, predictors: Partial<Predictor>[]): Promise<Predictor[]>;
  async injectPredictions(scenarioId: string, predictions: Partial<Prediction>[]): Promise<Prediction[]>;
  async injectOutcomes(scenarioId: string, outcomes: OutcomeData[]): Promise<void>;
  async injectMissedOpportunities(scenarioId: string, missed: Partial<MissedOpp>[]): Promise<MissedOpp[]>;
  async injectLearningItems(scenarioId: string, items: Partial<LearningItem>[]): Promise<LearningItem[]>;
  async injectStrategies(scenarioId: string, strategies: Partial<Strategy>[]): Promise<Strategy[]>;

  // ═══════════════════════════════════════════════════════════════════
  // SCENARIO RUNNERS - Execute tiers against test data
  // ═══════════════════════════════════════════════════════════════════

  async runSignalDetection(scenarioId: string): Promise<{ signalsProcessed, predictorsCreated }>;
  async runPredictionGeneration(scenarioId: string): Promise<{ predictorsProcessed, predictionsGenerated }>;
  async runEvaluation(scenarioId: string): Promise<{ evaluated, correct, incorrect, partial }>;
  async runMissedOpportunityDetection(scenarioId: string): Promise<{ analyzed, found }>;
  async runLearningProcessor(scenarioId: string): Promise<{ processed, analystsUpdated }>;

  // ═══════════════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════════════

  async cleanupScenario(scenarioId: string): Promise<CleanupResult>;
  async cleanupAllTestData(): Promise<CleanupResult>;
}
```

#### TestDataGeneratorService

```typescript
@Injectable()
export class TestDataGeneratorService {

  /** Generate realistic mock news articles */
  generateMockArticles(config: {
    count: number;
    topic: string;        // "Apple", "Bitcoin", "Fed"
    sentiment?: 'bullish' | 'bearish' | 'mixed';
  }): CrawledItem[];

  /** Generate signals with known characteristics */
  generateMockSignals(config: {
    count: number;
    targetId: string;
    distribution: { bullish: number; bearish: number; neutral: number };
  }): CreateSignalData[];

  /** Generate predictions with known outcomes for evaluation testing */
  generateMockPredictionsWithOutcomes(config: {
    count: number;
    accuracyRate: number;  // 0.0 - 1.0
  }): Array<{ prediction: CreatePredictionData; outcome: 'correct' | 'incorrect' }>;
}
```

#### Example Test Scenarios

**Test Complete Loop: Signals → Learning**

```typescript
async function testCompleteLoop() {
  const scenario = await injector.createScenario({
    name: 'Full Loop Test - Fed Rate Decision',
    injectionPoints: ['signals', 'outcomes'],
  });

  // 1. Inject signals
  await injector.injectSignals(scenario.id, [
    { target_id: targetId, content: 'Fed signals rate hike pause', direction: 'bullish' },
    { target_id: targetId, content: 'Inflation remains sticky at 3.2%', direction: 'bearish' },
  ]);

  // 2. Run signal detection → creates predictors
  await injector.runSignalDetection(scenario.id);

  // 3. Run prediction generation → creates predictions
  await injector.runPredictionGeneration(scenario.id);

  // 4. Inject outcomes (simulate what actually happened)
  await injector.injectOutcomes(scenario.id, [
    { prediction_id: pred1.id, actual_direction: 'bullish' },   // Correct
    { prediction_id: pred2.id, actual_direction: 'bullish' },   // Incorrect
  ]);

  // 5. Run evaluation
  const results = await injector.runEvaluation(scenario.id);

  // 6. Run learning processor
  await injector.runLearningProcessor(scenario.id);

  // 7. Cleanup
  await injector.cleanupScenario(scenario.id);
}
```

**Test Analyst Accuracy with Known Outcomes**

```typescript
async function testAnalystAccuracy() {
  const scenario = await injector.createScenario({ name: 'Analyst Benchmark' });

  // Inject 100 predictions with known outcomes (70% accuracy)
  const testData = generator.generateMockPredictionsWithOutcomes({
    count: 100,
    accuracyRate: 0.7,
  });

  const predictions = await injector.injectPredictions(scenario.id, testData.map(d => d.prediction));

  // Inject matching outcomes
  for (let i = 0; i < predictions.length; i++) {
    await injector.injectOutcomes(scenario.id, [{
      prediction_id: predictions[i].id,
      actual_direction: testData[i].outcome === 'correct'
        ? predictions[i].direction
        : oppositeDirection(predictions[i].direction),
    }]);
  }

  // Run evaluation and verify metrics
  const results = await injector.runEvaluation(scenario.id);
  expect(results.correct).toBe(70);
  expect(results.incorrect).toBe(30);
}
```

#### Test Lab Dashboard UI

```
┌─────────────────────────────────────────────────────────────┐
│  Test Lab                                                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Active Scenarios: 3                                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ "Fed Rate Hike Test"                                │   │
│  │    Tier: Signal Detection                           │   │
│  │    Signals: 15 injected | Predictions: 8 generated  │   │
│  │    [View Details] [Run Tier] [Cleanup]              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Quick Actions:                                             │
│  [+ New Scenario]  [Generate Test Articles]  [Cleanup All]  │
│                                                             │
│  Test Data Stats:                                           │
│  • Test sources: 5                                          │
│  • Test signals: 47                                         │
│  • Test predictions: 23                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Benefits of Test Data Injection

| Benefit | Description |
|---------|-------------|
| **Tier Isolation** | Test signal detection without waiting for crawlers |
| **Reproducibility** | Same test data = same results |
| **Speed** | Skip slow upstream processes |
| **Edge Cases** | Inject specific scenarios (all bullish, mixed signals, etc.) |
| **Evaluation Testing** | Test accuracy calculations with known outcomes |
| **Safe Cleanup** | `is_test_data` flag ensures production data is never touched |
| **Demo Mode** | Show stakeholders the system with controlled data |
| **Learning Loop Testing** | Test analyst updates without real failures |

---

### Phase 4: Conversational Test Data Builder UI

The conversational UI provides additional capabilities beyond the core injection framework.

#### Guided Workflows

```
┌─────────────────────────────────────────────────────────────────┐
│  Guided Workflows                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Test Analyst Accuracy]                                        │
│  Create predictions with known outcomes and verify evaluation   │
│  metrics are calculated correctly.                              │
│                                                                 │
│  [Test Full Pipeline]                                           │
│  Inject signals and run the complete loop through to learning.  │
│                                                                 │
│  [Test Deduplication]                                           │
│  Generate similar articles to verify fuzzy matching works.      │
│                                                                 │
│  [Test Conflicting Signals]                                     │
│  Create mixed bullish/bearish signals for same target.          │
│                                                                 │
│  [Test Missed Opportunities]                                    │
│  Add signals that should trigger missed opportunity detection.  │
│                                                                 │
│  [Test Learning Loop]                                           │
│  Queue learning items and verify analyst updates.               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Export & Replay

Test datasets can be exported and replayed:

```typescript
interface TestDataset {
  id: string;
  name: string;
  description: string;
  created_at: string;

  // Data by tier
  sources?: SourceData[];
  articles?: ArticleData[];
  signals?: SignalData[];
  predictors?: PredictorData[];
  predictions?: PredictionData[];
  outcomes?: OutcomeData[];
  learning_items?: LearningItemData[];

  // Expected results (for validation)
  expected_results?: {
    predictions_generated?: number;
    accuracy_rate?: number;
    learning_items_created?: number;
  };
}
```

#### Live Monitor

The UI includes a live monitor that shows test data being processed:

```
┌─────────────────────────────────────────────────────────────────┐
│  Live Monitor                                        [Watching] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  12:34:56  Signal detected: "Fed hints at rate pause"           │
│            → Created predictor pred_abc123                      │
│                                                                 │
│  12:34:58  Predictor pred_abc123 processing...                  │
│            → Generated prediction: BULLISH (75% confidence)     │
│                                                                 │
│  12:35:02  Outcome recorded for prediction pred_abc123          │
│            → Actual: BULLISH (Correct!)                         │
│                                                                 │
│  12:35:05  Evaluation complete                                  │
│            → Analyst accuracy: 80% (4/5 correct)                │
│                                                                 │
│  12:35:08  Learning item queued                                 │
│            → "Analyst overweight inflation signals"             │
│                                                                 │
│  [Pause] [Clear] [Export Log]                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Implementation Phases for Phase 3 & 4

| Sub-Phase | What | Priority | Notes |
|-----------|------|----------|-------|
| **3.1** | Add `is_test_data` + `test_scenario_id` columns to all prediction tables | HIGH | Database migration |
| **3.2** | Build A2A execute action (`action: "execute"`) | HIGH | Generates INSERTs with test markers |
| **3.3** | Build A2A cleanup actions (`action: "cleanup"`, `action: "cleanup-all"`) | HIGH | Safe test data removal |
| **3.4** | Create Pinia store (`testDataBuilderStore`) | HIGH | Frontend state management |
| **4.1** | Build Test Data Builder UI shell (panels, layout) | MEDIUM | Vue components |
| **4.2** | Create A2A agent for conversational building (`action: "build"`) | MEDIUM | Context agent with test data knowledge |
| **4.3** | Wire up conversation → A2A → store updates | MEDIUM | Integration |
| **4.4** | Add tier runners (`action: "run-tier"`) | MEDIUM | Execute pipeline tiers on test data |
| **4.5** | Add guided workflows (pre-built test scenarios) | LOW | UX enhancement |
| **4.6** | Add export/import JSON functionality | LOW | Portable test datasets |
| **4.7** | Build live monitor for watching data flow | LOW | Real-time feedback |

---

## Testing Checklist

### Runner Consolidation
- [ ] `financial-asset-predictor` handles stock symbols (AAPL, MSFT)
- [ ] `financial-asset-predictor` handles crypto symbols (BTC-USD, ETH-USD)
- [ ] On-chain specialists only activate for crypto instruments
- [ ] Risk profiles work for both traditional and crypto terminology
- [ ] Old runner type aliases resolve correctly
- [ ] Build passes with crypto/market directories deleted
- [ ] Existing predictions with old runner types still display correctly

### Story Deduplication
- [ ] Exact hash match prevents same-content duplicates
- [ ] Cross-source dedup catches same story from different outlets
- [ ] Fuzzy title matching catches headline variations
- [ ] Key phrase overlap catches paraphrased stories
- [ ] Dedup metrics are recorded in source_crawls

### Test Data Injection
- [ ] Test data markers (`is_test_data`, `test_scenario_id`) added to all tables
- [ ] Test scenarios can be created and stored
- [ ] Conversational UI generates valid JSON
- [ ] Execute action inserts data with test markers
- [ ] Cleanup action removes only test data
- [ ] Tier runners process test data correctly

---

## Rollback Plan

### Runner Consolidation
1. Restore deleted directories from git: `git checkout HEAD~1 -- apps/api/src/agent2agent/runners/prediction/crypto-predictor`
2. Revert database migration: `UPDATE agents SET runner_type = 'stock-predictor' WHERE runner_type = 'financial-asset-predictor'`
3. Re-register old runners in module

### Story Deduplication
1. Drop new columns/tables
2. Disable fuzzy dedup in crawl configs

### Test Data Injection
1. Remove `is_test_data` and `test_scenario_id` columns
2. Drop `test_scenarios` table

---

## Future Work

### Betting Market Predictor (Phase 2)

When ready to add Polymarket, sports betting, elections:

1. Create `betting-market-predictor/` directory
2. Copy structure from `financial-asset-predictor/`
3. Replace tools: Polymarket API, odds aggregators, resolution trackers
4. Replace specialists: Market Analyst, Event Analyst, Contrarian
5. Replace claim types: odds, probability, resolution
6. Register new runner

The clean `financial-asset-predictor` becomes the template.

---

## Timeline

| Phase | Work | Priority |
|-------|------|----------|
| **Phase 1** | Runner consolidation (stock + crypto merge) | HIGH |
| **Phase 2** | Story deduplication implementation | MEDIUM |
| **Phase 3** | Test data injection framework | MEDIUM |
| **Phase 4** | Conversational test data builder UI | LOW |
| **Future** | Betting market predictor | DEFERRED |
