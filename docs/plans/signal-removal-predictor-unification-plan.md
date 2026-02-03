# Signal Removal & Predictor Unification Plan

**Status:** Ready to Execute
**Created:** 2026-02-03
**Priority:** TONIGHT - v2 Demo Readiness

## Executive Summary

Remove the `signals` concept entirely from the codebase. Articles will create `predictors` directly. Risk system will consume predictors from the prediction system. This eliminates duplicate article processing, simplifies the architecture, and removes technical debt.

## Current Architecture (BROKEN)

```
Articles (crawled)
    ↓
Signal Creation (per target - WASTEFUL!)
    ├─→ TSLA signal
    ├─→ AAPL signal
    ├─→ NVDA signal (same article!)
    ├─→ GOOGL signal (same article!)
    └─→ MSFT signal (same article!)
    ↓
11 articles × 5 targets = 55 signals (WRONG!)
    ↓
Predictors (from signals)
    ↓
Predictions
```

**Problems:**
- Same article creates signals for EVERY target
- Signals are redundant middle layer
- Risk system reads articles separately (duplicate work)
- Technical debt everywhere

## Target Architecture (CLEAN)

```
Articles (crawled ONCE)
    ↓
Analyze: Which instruments relevant?
    ↓
Create PREDICTORS directly (skip signals!)
    ├─→ NVDA predictor (if relevant)
    ├─→ AMD predictor (if relevant)
    └─→ Skip others
    ↓
11 articles → ~15-20 predictors (only relevant)
    ↓
Prediction System: Aggregate → Predictions
Risk System: Query predictors → Update risk analysis
```

**Benefits:**
- Single article read
- No redundant signals layer
- Risk consumes predictors (no duplicate processing)
- Clean, maintainable code

## Key Design Decisions

### 1. Predictors are the Universal Unit
- Created from articles with instrument relevance analysis
- Contain: article_id, instrument, dimension, direction, confidence, reasoning
- Used by BOTH prediction and risk systems

### 2. Risk Analysis Approach
- NO article reading in risk system
- Query predictors from `prediction.predictors`
- Pass ALL new predictors into each dimension analyst prompt
- LLM decides relevance (no pre-filtering in code)
- Existing risk is "large mass", predictors are "small deltas"

### 3. Instrument Synchronization
- Single source of truth for instruments
- Same identifiers across: prediction targets, risk subjects, crawler subscriptions
- Current instruments: AAPL, TSLA, NVDA, GOOGL, MSFT, BTC

## Tasks

### Task 1: Synchronize Instrument Lists
**Priority:** First (foundation for everything)

**Files to check:**
- `prediction.targets` table
- `risk.subjects` table
- Crawler subscriptions
- Any hardcoded instrument lists

**Actions:**
1. Query current instruments from each system
2. Identify mismatches
3. Create single source of truth
4. Update references

### Task 2: Remove Signals from API

**Files to DELETE:**
```
apps/api/src/prediction-runner/repositories/signal.repository.ts
apps/api/src/prediction-runner/interfaces/signal.interface.ts
apps/api/src/prediction-runner/repositories/__tests__/signal.repository.spec.ts
```

**Files to UPDATE:**
```
apps/api/src/prediction-runner/services/article-processor.service.ts
  - Remove signal creation
  - Add instrument relevance analysis
  - Create predictors directly

apps/api/src/prediction-runner/prediction-runner.module.ts
  - Remove SignalRepository from providers/exports

Any file importing signal-related code
```

**New Logic in ArticleProcessorService:**
```typescript
async processArticle(article: CrawlerArticle): Promise<Predictor[]> {
  // 1. Analyze which instruments this article affects
  const relevantInstruments = await this.analyzeInstrumentRelevance(article);

  // 2. For each relevant instrument, create a predictor
  const predictors: Predictor[] = [];
  for (const instrument of relevantInstruments) {
    const predictor = await this.createPredictor(article, instrument);
    predictors.push(predictor);
  }

  return predictors;
}

async analyzeInstrumentRelevance(article: CrawlerArticle): Promise<string[]> {
  // Get all active instruments
  const instruments = await this.targetRepository.findAllActive();

  // Use LLM to determine which instruments are affected
  const prompt = `
    Article: ${article.title}
    Content: ${article.content}

    Which of these instruments does this article affect?
    Instruments: ${instruments.map(i => i.symbol).join(', ')}

    Return JSON array of affected instrument symbols.
    Only include instruments with clear relevance.
  `;

  // Parse LLM response
  return relevantInstruments;
}
```

### Task 3: Update/Remove Cron Jobs

**Search for signal references:**
```bash
grep -r "signal" apps/api/src --include="*.ts" | grep -i "cron\|schedule\|runner"
```

**Known files to check:**
```
apps/api/src/prediction-runner/runners/signal-generator.runner.ts
  - UPDATE: Rename to predictor-generator.runner.ts
  - Change to create predictors from articles

Any scheduled jobs in:
  - src/app.module.ts (ScheduleModule)
  - src/**/runners/*.ts
  - src/**/tasks/*.ts
```

**Cron job updates:**
- Signal generation → Predictor generation (from articles)
- Signal processing → Remove (predictors go directly to prediction)
- Signal cleanup → Remove

### Task 4: Database Migration

**Create migration file:**
```sql
-- Migration: Remove signals infrastructure
-- Date: 2026-02-03

-- 1. Drop signals table
DROP TABLE IF EXISTS prediction.signals CASCADE;

-- 2. Remove any views referencing signals
DROP VIEW IF EXISTS prediction.signal_stats CASCADE;

-- 3. Ensure predictors table has article_id
ALTER TABLE prediction.predictors
ADD COLUMN IF NOT EXISTS article_id UUID REFERENCES crawler.articles(id);

-- 4. Add index for efficient article lookup
CREATE INDEX IF NOT EXISTS idx_predictors_article_id
ON prediction.predictors(article_id);
```

### Task 5: Update Risk System

**Files to UPDATE:**
```
apps/api/src/risk-runner/services/analysis.service.ts (or similar)
  - Remove article reading/processing
  - Query predictors from prediction.predictors
  - Update prompt to include predictors
```

**New risk analysis pattern:**
```typescript
async analyzeRisk(subjectId: string, dimensionId: string) {
  // 1. Get existing risk
  const existingRisk = await this.getLatestRisk(subjectId, dimensionId);

  // 2. Get ALL new predictors since last analysis
  const newPredictors = await this.predictionDb.query(`
    SELECT p.*, a.title, a.content
    FROM prediction.predictors p
    LEFT JOIN crawler.articles a ON a.id = p.article_id
    WHERE p.created_at > $1
    ORDER BY p.created_at DESC
  `, [existingRisk?.last_updated || '1970-01-01']);

  // 3. Build prompt - pass ALL predictors, let LLM filter
  const prompt = `
    Subject: ${subject.name} (${subject.identifier})
    Dimension: ${dimension.name}

    Current Risk Analysis:
    ${existingRisk?.analysis || 'No prior analysis'}

    NEW PREDICTORS since last analysis:
    ${newPredictors.map(p => `
      - Article: "${p.title}"
        Instrument: ${p.instrument}
        Direction: ${p.direction}
        Confidence: ${p.confidence}
        Reasoning: ${p.reasoning}
    `).join('\n')}

    Update the risk analysis. Remember:
    - Existing risk is accumulated from weeks of analysis (large mass)
    - New predictors are small deltas
    - Only dramatic news should shift risk significantly
    - Consider which predictors are relevant to this subject/dimension
  `;

  // 4. LLM analyzes and updates
  return await this.llm.analyze(prompt);
}
```

### Task 6: Clean Frontend

**Files to search for signal references:**
```bash
grep -r "signal" apps/web/src --include="*.ts" --include="*.vue" | grep -v node_modules
```

**Known files:**
```
apps/web/src/services/predictionDashboardService.ts
  - Remove signal-related methods

apps/web/src/stores/predictionStore.ts
  - Remove signal state/actions

apps/web/src/components/prediction/*.vue
  - Remove any signal UI components

apps/web/src/views/prediction/*.vue
  - Update to not reference signals
```

**Dashboard fix - one prediction per instrument:**
```typescript
// In predictionStore or dashboard service
const filteredPredictions = computed(() => {
  // Group by instrument, keep only latest
  const byInstrument = new Map();
  for (const pred of predictions.value) {
    const key = pred.targetSymbol;
    const existing = byInstrument.get(key);
    if (!existing || new Date(pred.generatedAt) > new Date(existing.generatedAt)) {
      byInstrument.set(key, pred);
    }
  }
  return Array.from(byInstrument.values());
});
```

## Execution Order

1. **Task 1: Sync instruments** (30 min)
   - Foundation for everything else

2. **Task 3: Audit cron jobs** (15 min)
   - Know what we're replacing before we break it

3. **Task 2: Remove signals from API** (1-2 hours)
   - Delete signal files
   - Update ArticleProcessorService
   - Add instrument relevance analysis
   - Create predictors directly

4. **Task 4: Database migration** (15 min)
   - Drop signals table
   - Ensure predictors.article_id exists

5. **Task 5: Update risk system** (30-45 min)
   - Remove article reading
   - Query predictors
   - Update prompts

6. **Task 6: Clean frontend** (30-45 min)
   - Remove signal references
   - Fix dashboard (one per instrument)
   - Test Analysts modal

## Testing Checklist

- [ ] Articles create predictors (not signals)
- [ ] Predictors have article_id reference
- [ ] Only relevant instruments get predictors
- [ ] Predictions aggregate from predictors correctly
- [ ] Risk analysis queries predictors from prediction schema
- [ ] Risk prompts include predictor list
- [ ] No signal references in codebase (`grep -r "signal" --include="*.ts"`)
- [ ] Frontend shows one prediction per instrument
- [ ] Analysts modal displays correctly
- [ ] Cron jobs run without errors
- [ ] No TypeScript errors (`npm run build`)
- [ ] No runtime errors in logs

## Rollback Plan

If something breaks catastrophically:
1. Revert git commits
2. Restore signals table from backup (if needed)
3. Re-enable signal-based cron jobs

**Backup before starting:**
```bash
pg_dump -h localhost -U postgres -n prediction -t prediction.signals > signals_backup.sql
```

## Files Reference

### TO DELETE:
```
apps/api/src/prediction-runner/repositories/signal.repository.ts
apps/api/src/prediction-runner/repositories/__tests__/signal.repository.spec.ts
apps/api/src/prediction-runner/interfaces/signal.interface.ts
```

### TO HEAVILY MODIFY:
```
apps/api/src/prediction-runner/services/article-processor.service.ts
apps/api/src/prediction-runner/runners/signal-generator.runner.ts
apps/api/src/risk-runner/services/*.ts (analysis services)
apps/web/src/services/predictionDashboardService.ts
apps/web/src/stores/predictionStore.ts
apps/web/src/views/prediction/PredictionDashboard.vue
```

### DATABASE CHANGES:
```sql
DROP TABLE prediction.signals;
ALTER TABLE prediction.predictors ADD COLUMN article_id UUID;
```

## Success Criteria

1. `grep -r "signal" apps/ --include="*.ts" | wc -l` returns minimal/zero results
2. Articles → Predictors flow works
3. Risk consumes predictors from prediction schema
4. Dashboard shows clean, one-per-instrument view
5. All tests pass
6. No runtime errors
7. Demo-ready!

---

**Ready to execute. Start with Task 1 (instrument sync).**
