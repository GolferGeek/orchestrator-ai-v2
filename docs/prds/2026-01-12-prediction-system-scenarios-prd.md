# Prediction System Scenarios PRD

**Last Updated:** 2026-01-12 21:00 UTC
**Status:** In Progress - BLOCKING ISSUE IDENTIFIED
**Owner:** Finance Organization
**Version:** 1.5

---

## Overview

This PRD documents all user scenarios for the Prediction System, their current implementation status, and remaining work needed for a complete demo-ready system.

---

## Architecture Summary

### Entity Hierarchy

```
Organization (finance)
  └── Agent (stock-predictor, crypto-predictor, etc.)
        └── Universe (US Tech Stocks, EU Energy, etc.)
              ├── Targets (AAPL, NVDA, MSFT...)
              ├── Sources (RSS feeds, news sites)
              ├── LLM Config (tier contexts per universe)
              ├── Strategies
              └── Predictions, Signals, Learnings...
```

### Key Design Decisions

- **Agent = Container for Universes**: One agent can manage multiple universes
- **Universe = Scope for Operations**: Most operations require `universeId`
- **Universe owns LLM Config**: Each universe can have its own tier contexts (gold/silver/bronze)
- **Test Data Isolation**: T_ prefixed targets mirror production targets
- **Strategies are Read-Only**: System-defined strategies only; custom strategies require database access

### LLM Tier System

Universes support tiered LLM configuration for different quality/cost tradeoffs:

```typescript
interface LlmConfig {
  gold?: { provider: string; model: string };   // Highest quality (e.g., claude-opus)
  silver?: { provider: string; model: string }; // Balanced (e.g., claude-sonnet)
  bronze?: { provider: string; model: string }; // Fast/cheap (e.g., claude-haiku)
}
```

- **Universe sets defaults**: Each universe configures its tier preferences
- **Target can override**: Individual targets can specify `llmConfigOverride` (DB column: `llm_config_override`)
- **Tier resolution**: `llm-tier-resolver.service` maps requests to appropriate tier
- **Ensemble predictions**: Multiple analysts may use different tiers

**Note on `temperature`:** The shared dashboard transport types standardize on provider/model (and tier mappings). If we want per-universe/per-target `temperature`, it should be added explicitly to `apps/transport-types/modes/dashboard.types.ts` and mapped in handlers; until then, keep dashboard API examples provider/model(+tiers) only.

### Entity Scoping Rules

| Entity | Scope | Notes |
|--------|-------|-------|
| Universe | Agent | Agent can have multiple universes |
| Target | Universe | Strictly universe-scoped |
| Source | Flexible | Can be target, universe, domain, or runner scoped |
| Analyst | Universe | Universe-scoped personas |
| Strategy | System | Read-only, system-defined only |
| Prediction | Target | Belongs to specific target |

### API Parameter Convention

**Important:** The codebase uses different conventions at different layers:

- **Dashboard request params** (transport-types + web UI): `camelCase` (e.g., `universeId`, `targetId`)
- **Database columns** (SQL): `snake_case` (e.g., `universe_id`, `target_id`)
- **Mapping** should happen at the API boundary (handlers/services) so callers always use `camelCase`

When writing dashboard API calls, use `camelCase` in params per `apps/transport-types/modes/dashboard.types.ts`.

### Storage & Retention Strategy

**Environment:** Mac Studio with 128GB RAM, 1TB SSD, local Supabase (PostgreSQL)

This is a **demo system** - we prioritize simplicity over aggressive optimization.

| Data Type | Storage Strategy | Retention |
|-----------|------------------|-----------|
| Article full text | Store both full text AND URL | Indefinite (demo) |
| Article metadata | JSONB (title, summary, published_at) | Indefinite |
| Observability events | Keep all events | 30+ days minimum |
| Predictions + rationale | Full storage | Indefinite |
| Signal fingerprints | Full storage | Indefinite |
| Source seen items | Hash + metadata | Indefinite |

**Estimated Storage (aggressive demo usage):**
- 1000 articles/day × 30KB avg × 365 days = ~11GB/year
- Observability events: ~1-2GB/year
- Predictions/signals: ~500MB/year
- **Total: Well under 20GB** - easily handled on 1TB SSD

**In-Memory Buffer Configuration:**
```bash
# Environment variable (default: 500)
OBSERVABILITY_EVENT_BUFFER=2000
```

The `ObservabilityEventsService` maintains an in-memory ring buffer for instant replay when clients reconnect. Increase if needed for longer replay windows.

**PostgreSQL Tuning (optional, for high-memory system):**
```bash
# In docker-compose or postgresql.conf
shared_buffers = 4GB          # 3-4GB for 128GB system
effective_cache_size = 96GB   # 75% of RAM
work_mem = 256MB              # For complex queries
maintenance_work_mem = 1GB    # For VACUUM, CREATE INDEX
```

**No Archiving Strategy:** For demo purposes, we don't archive. If data grows too large, we can delete old records directly.

### Existing Frontend Infrastructure

**Prediction Routes** (`/prediction/*`):
- `/prediction/dashboard` - PredictionDashboard.vue (main landing)
- `/prediction/universes` - UniverseManagement.vue
- `/prediction/review-queue` - ReviewQueue.vue
- `/prediction/learning-queue` - LearningQueue.vue
- `/prediction/:id` - PredictionDetail.vue
- `/prediction/target/:id` - TargetDetail.vue
- Plus: analysts, learnings, missed opportunities, test lab

**Key Components** (`apps/web/src/components/prediction/`):
- `PredictionCard.vue` - Card with status, direction, confidence
- `SignalList.vue`, `PredictorList.vue` - List displays
- `UniverseCard.vue`, `AnalystCard.vue` - Entity cards
- `LLMComparisonBadge.vue`, `LLMEnsembleView.vue` - LLM display

**Observability UI Patterns** (to reuse):
- `AdminEventRow.vue` - Compact row with yellow highlight for new events
- `AdminObservabilityView.vue` - Connection status, time range selector, tabs
- `useAdminObservabilityStream()` - SSE composable with connect/disconnect
- `observabilityStore` - Event state, filtering, history

**Toast/Notification**: `GlobalErrorNotification.vue` (Ionic ion-toast)

---

## Phase 1: Setup & Configuration

### 1.1 Create a New Universe

**Description:** Add a new universe to an agent (e.g., "Asia Semiconductors" to stock-predictor)

**API:**
```typescript
POST /agent-to-agent/finance/stock-predictor/tasks
{
  "mode": "dashboard",
  "payload": {
    "action": "universes.create",
    "params": {
      "name": "Asia Semiconductors",
      "domain": "stocks",
      "description": "Tracking TSMC, Samsung, and Asian chip makers",
      "llmConfig": {
        "tiers": {
          "silver": { "provider": "anthropic", "model": "claude-sonnet-4-20250514" }
        }
      }
    }
  }
}
```

| Status | Handler | Service | Repository | E2E Test |
|--------|---------|---------|------------|----------|
| ⚠️ Partial | universe.handler | universe.service | universe.repository | ❌ Missing |

**Remaining Work:**
- [ ] E2E test for universe creation
- [ ] Validate domain values (stocks, crypto, elections, polymarket)

---

### 1.2 Add a Target to Universe

**Description:** Add a new target (e.g., AAPL) to a universe

**API:**
```typescript
POST /agent-to-agent/finance/stock-predictor/tasks
{
  "mode": "dashboard",
  "payload": {
    "action": "targets.create",
    "params": {
      "universeId": "<universe-id>",
      "symbol": "AAPL",
      "name": "Apple Inc.",
      "targetType": "stock",
      "context": "Consumer electronics, services, Mac, iPhone, iPad"
    }
  }
}
```

| Status | Handler | Service | Repository | E2E Test |
|--------|---------|---------|------------|----------|
| ⚠️ Partial | target.handler | target.service | target.repository | ❌ Missing |

**Remaining Work:**
- [ ] E2E test for target creation
- [ ] Verify T_ mirror auto-creation via database trigger

---

### 1.3 Auto-Create T_ Test Mirror

**Description:** When a target is created, automatically create its T_ prefixed test mirror

**Implementation:** Database trigger `auto_create_test_mirror`

| Status | Trigger | Service | Repository | E2E Test |
|--------|---------|---------|------------|----------|
| ⚠️ Partial | Trigger exists | test-target-mirror.service | test-target-mirror.repository | ❌ Missing |

**Remaining Work:**
- [ ] Verify trigger fires correctly on target insert
- [ ] E2E test: create target → verify T_ mirror exists
- [ ] Test mirror shows in `test-target-mirrors.list`

---

### 1.4 Add RSS Feed Source

**Description:** Add an RSS feed as a source for a target

**API:**
```typescript
POST /agent-to-agent/finance/stock-predictor/tasks
{
  "mode": "dashboard",
  "payload": {
    "action": "sources.create",
    "params": {
      "scopeLevel": "target",
      "universeId": "<universe-id>",
      "targetId": "<target-id>",
      "sourceType": "rss",
      "name": "Yahoo Finance AAPL RSS",
      "url": "https://feeds.finance.yahoo.com/rss/2.0/headline?s=AAPL",
      "crawlFrequencyMinutes": 10
    }
  }
}
```

**Note:** Handler currently expects snake_case (`source_type`, `scope_level`, `universe_id`, `target_id`, `crawl_frequency_minutes`). Sprint 0 will fix handlers to accept camelCase as shown above.

| Status | Handler | Service | Repository | E2E Test |
|--------|---------|---------|------------|----------|
| ⚠️ Partial | source.handler | source-crawler.service | source.repository | ❌ Missing |

**Available Source Handler Actions:**
- `sources.list` - List sources for universe/target
- `sources.get` - Get source by ID
- `sources.create` - Create new source
- `sources.update` - Update source config
- `sources.delete` - Delete source
- `sources.test-crawl` - Preview crawl results without persisting

**Valid `sourceType` values:** `web` (Firecrawl scraping), `rss`, `twitter_search`, `api`

**Valid `scopeLevel` values:** `runner` (global), `domain`, `universe`, `target`

**Valid `crawlFrequencyMinutes` values:** `5`, `10`, `15`, `30`, `60`

**Remaining Work:**
- [ ] E2E test for source creation
- [ ] E2E test for test-crawl action

---

### 1.5 Add News Site Source (Firecrawl)

**Description:** Add a news website as a source (uses Firecrawl for scraping). This example shows a universe-scoped source that applies to all targets in the universe.

**API:**
```typescript
POST /agent-to-agent/finance/stock-predictor/tasks
{
  "mode": "dashboard",
  "payload": {
    "action": "sources.create",
    "params": {
      "scopeLevel": "universe",
      "universeId": "<universe-id>",
      "sourceType": "web",
      "name": "Bloomberg Tech News",
      "url": "https://www.bloomberg.com/technology",
      "crawlFrequencyMinutes": 30
    }
  }
}
```

**Note:** When `scopeLevel` is "universe", omit `targetId` - the source applies to all targets in that universe. Handler currently expects snake_case; Sprint 0 will fix to accept camelCase.

| Status | Handler | Service | Repository | E2E Test |
|--------|---------|---------|------------|----------|
| ⚠️ Partial | source.handler | firecrawl.service | source.repository | ❌ Missing |

**Remaining Work:**
- [ ] E2E test for Firecrawl source creation
- [ ] Verify Firecrawl API key configuration

---

### 1.6 Test Crawl (Preview)

**Description:** Preview what a source crawl would return without persisting data

**API:**
```typescript
POST /agent-to-agent/finance/stock-predictor/tasks
{
  "mode": "dashboard",
  "payload": {
    "action": "sources.test-crawl",
    "params": {
      "id": "<source-id>"
    }
  }
}
```

| Status | Handler | Service | Repository | E2E Test |
|--------|---------|---------|------------|----------|
| ⚠️ Partial | source.handler | source-crawler.service | - | ❌ Missing |

**Remaining Work:**
- [ ] E2E test for test-crawl

---

### 1.7 Configure Crawl Frequency

**Description:** Set how often sources are crawled per source or per universe

| Status | Handler | Service | Repository | E2E Test |
|--------|---------|---------|------------|----------|
| ⚠️ Partial | source.handler (update) | source-crawler.runner | source.repository | ❌ Missing |

**Remaining Work:**
- [ ] Verify source crawler runner respects per-source frequency
- [ ] E2E test for frequency update
- [ ] Document default frequency values

---

### 1.8 Add/Configure Analysts

**Description:** Create analyst personas that make predictions

**API (examples):**
```typescript
POST /agent-to-agent/finance/stock-predictor/tasks
{
  "mode": "dashboard",
  "payload": {
    "action": "analysts.create",
    "params": {
      "slug": "momentum-mike",
      "name": "Momentum Mike",
      "perspective": "Prefers momentum + trend continuation signals",
      "scopeLevel": "universe",
      "universeId": "<universe-id>",
      "tierInstructions": {
        "silver": "Be concise. Cite the strongest 1-2 signals only."
      }
    }
  }
}

// Update:
{
  "mode": "dashboard",
  "payload": {
    "action": "analysts.update",
    "params": {
      "id": "<analyst-id>",
      "defaultWeight": 1.2,
      "active": true
    }
  }
}

// Delete:
{
  "mode": "dashboard",
  "payload": {
    "action": "analysts.delete",
    "params": { "id": "<analyst-id>" }
  }
}
```

| Status | Handler | Service | Repository | E2E Test |
|--------|---------|---------|------------|----------|
| ⚠️ Partial | analyst.handler | analyst.service | analyst.repository | ⚠️ List only |

**Remaining Work:**
- [ ] E2E test for analyst CRUD (create, update, delete)
- [ ] Unit tests for analyst.handler

---

### 1.9 View/Recommend Strategies (Read-Only)

**Description:** View system-defined strategies and get recommendations

**Important Limitation:** Strategy handler is **read-only**. It supports `list`, `get`, and `recommend` actions only. Custom strategy creation/modification requires direct database access.

**API:**
```typescript
POST /agent-to-agent/finance/stock-predictor/tasks
{
  "mode": "dashboard",
  "payload": {
    "action": "strategies.list",
    "params": { "universeId": "<universe-id>" }
  }
}

// Or get recommendations:
{
  "mode": "dashboard",
  "payload": {
    "action": "strategies.recommend",
    "params": { "targetId": "<target-id>", "context": "earnings announcement" }
  }
}
```

| Status | Handler | Service | Repository | E2E Test |
|--------|---------|---------|------------|----------|
| ✅ Read-only | strategy.handler | strategy.service | strategy.repository | ❌ Missing |

**Available Actions:**
- `strategies.list` - List system strategies
- `strategies.get` - Get strategy by ID
- `strategies.recommend` - Get strategy recommendations for context

**Not Available (by design):**
- ~~`strategies.create`~~ - System strategies only
- ~~`strategies.update`~~ - System strategies only
- ~~`strategies.delete`~~ - System strategies only

**Remaining Work:**
- [ ] E2E test for strategy.list
- [ ] E2E test for strategy.recommend
- [ ] Document available system strategies

---

### 1.10 Feed Deduplication & Historical Tracking

**Description:** Track seen articles/items to avoid re-processing duplicates. When sources are crawled, articles are hashed and checked against historical records before processing.

**Why Important:**
- Prevents the same news article from generating multiple signals/predictions
- Reduces API costs (no duplicate LLM calls for same content)
- Enables cross-source deduplication (same story on Yahoo and Bloomberg)
- Provides audit trail of what content was processed

**Implementation:**

The `source_seen_items` table tracks:
- `content_hash` - Hash of article content for deduplication
- `source_id` - Which source discovered the article
- `original_url` - URL of the original article
- `signal_id` - If a signal was generated from this article
- `first_seen_at` / `last_seen_at` - Timestamps for tracking
- `metadata` - Additional context (title, summary, etc.)

**Key Operations:**
```typescript
// Check if article has been seen before
const seen = await sourceSeenItemRepository.hasBeenSeen(sourceId, contentHash);

// Mark article as seen (returns isNew: true/false)
const { isNew, seenItem } = await sourceSeenItemRepository.markSeen(
  sourceId, contentHash, url, signalId, metadata
);

// Cross-source deduplication (same story from different sources)
const seenElsewhere = await sourceSeenItemRepository.hasBeenSeenForTarget(contentHash, targetId);

// Cleanup old records (configurable retention)
await sourceSeenItemRepository.cleanupOldItems(sourceId, retentionDays);
```

| Status | Handler | Service | Repository | E2E Test |
|--------|---------|---------|------------|----------|
| ✅ Repository exists | ❌ No handler | ❌ No service | ✅ source-seen-item.repository | ❌ Missing |

**Remaining Work:**
- [ ] Create source-seen-items.handler for dashboard visibility
- [ ] Add handler to dashboard router
- [ ] Actions: `source-seen-items.list`, `source-seen-items.stats`
- [ ] Show recent seen items per source
- [ ] Show deduplication statistics (items seen, duplicates prevented)
- [ ] E2E test for deduplication flow
- [ ] Verify `check_content_hash_for_target` RPC function exists in database
- [ ] Consider content fingerprinting strategy (full content hash vs title+date hash)

---

## Phase 2: Real-time Operations

### Real-time Infrastructure (Existing)

The system has a built-in SSE workflow. **Backend** pushes events, **Frontend** subscribes.

#### Backend: Push Events

```typescript
// Service: apps/api/src/observability/observability-events.service.ts
// Controller: apps/api/src/observability/observability-stream.controller.ts

// Inject the service:
constructor(private readonly observabilityEventsService: ObservabilityEventsService) {}

// Push events from any runner/service:
await this.observabilityEventsService.push({
  context: executionContext,  // Must include agentSlug, orgSlug, etc.
  source_app: 'prediction-runner',
  hook_event_type: 'prediction.created',  // Event type for filtering
  status: 'success',
  message: 'New prediction for AAPL',
  progress: null,
  step: null,
  payload: { predictionId, targetSymbol, direction, confidence },
  timestamp: Date.now(),
});
```

#### Frontend: Subscribe to SSE

```typescript
// Composable: apps/web/src/composables/useAdminObservabilityStream.ts
// SSE Client: apps/web/src/services/agent2agent/sse/sseClient.ts
// Store: apps/web/src/stores/observabilityStore.ts

// In a Vue component:
import { useAdminObservabilityStream } from '@/composables/useAdminObservabilityStream';

const {
  connect,
  disconnect,
  allEvents,
  recentEvents,
  getAgentEvents
} = useAdminObservabilityStream();

// Connect with filters:
await connect({
  agentSlug: 'stock-predictor',  // Filter by agent
  conversationId: 'conv-123'     // Or by conversation
});

// Events are automatically added to the store
// Access via computed refs:
const predictionEvents = computed(() =>
  allEvents.value.filter(e => e.hook_event_type.startsWith('prediction.'))
);

// Clean up on unmount (automatic via onUnmounted in composable)
```

#### SSE Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /observability/stream` | Live SSE stream with filters |
| `GET /observability/history` | Historical events query |

Query params: `?userId=&agentSlug=&conversationId=&token=`

**Key Point:** Runners/services push to `ObservabilityEventsService`, frontend subscribes via `useAdminObservabilityStream`.

---

### 2.1 Watch Sources Being Crawled

**Description:** See sources being crawled every X minutes in real-time

| Status | Runner | Service | Visibility |
|--------|--------|---------|------------|
| ✅ Runner exists | source-crawler.runner | source-crawler.service | ❌ No real-time UI |

**Remaining Work:**
- [ ] Emit `source.crawl.started` and `source.crawl.completed` events via ObservabilityEventsService
- [ ] Dashboard widget showing recent crawls (subscribe to SSE with agentSlug filter)
- [ ] Crawl status per source (last_crawl_at, next_crawl_at)

---

### 2.2 See New Articles Discovered

**Description:** View newly discovered articles/items from sources

**API (planned once handler exists):**
```typescript
POST /agent-to-agent/finance/stock-predictor/tasks
{
  "mode": "dashboard",
  "payload": {
    "action": "source-seen-items.list",
    "params": {
      "sourceId": "<source-id>"
    },
    "pagination": { "limit": 50 }
  }
}
```

| Status | Table | Handler | E2E Test |
|--------|-------|---------|----------|
| ⚠️ Partial | source_seen_items | ❌ No handler | ❌ Missing |

**Remaining Work:**
- [ ] Create source-seen-items.handler for dashboard access
- [ ] Emit `article.discovered` event via ObservabilityEventsService when new article found
- [ ] Show article title, source, discovered_at

---

### 2.3 Watch Signals Detected

**Description:** See signals being detected from articles in real-time

**API (planned once handler exists):**
```typescript
POST /agent-to-agent/finance/stock-predictor/tasks
{
  "mode": "dashboard",
  "payload": {
    "action": "signals.list",
    "params": {
      "universeId": "<universe-id>",
      "targetId": "<target-id>"
    },
    "pagination": { "limit": 50 }
  }
}

// Get one signal (with fingerprint/details):
{
  "mode": "dashboard",
  "payload": {
    "action": "signals.get",
    "params": { "id": "<signal-id>" }
  }
}
```

| Status | Service | Handler | Real-time |
|--------|---------|---------|-----------|
| ✅ Service exists | signal-detection.service | ❌ No handler | ❌ No real-time |

**Remaining Work:**
- [ ] Create signals.handler for dashboard access
- [ ] Emit `signal.detected` event via ObservabilityEventsService
- [ ] Show signal fingerprint, strength, source article

---

### 2.4 Signal → Predictor Assignment

**Description:** See signals being assigned to predictors

| Status | Runner | Service | Visibility |
|--------|--------|---------|------------|
| ✅ Exists | batch-signal-processor.runner | - | ❌ No visibility |

**Remaining Work:**
- [ ] Emit `signal.assigned` event via ObservabilityEventsService
- [ ] Dashboard view of predictor queue (query historical events)

---

### 2.5 Watch Predictions Being Generated

**Description:** See predictions being generated in real-time

| Status | Service | Handler | Real-time |
|--------|---------|---------|-----------|
| ✅ Exists | prediction-streaming.service | prediction.handler | ⚠️ Partial |

**Remaining Work:**
- [ ] Emit `prediction.created` event via ObservabilityEventsService
- [ ] E2E test for prediction streaming
- [ ] Real-time feed UI component

---

### 2.6 Real-time Prediction Feed

**Description:** Frontend component showing live prediction stream

| Status | Backend | Frontend |
|--------|---------|----------|
| ⚠️ Partial | ObservabilityEventsService exists | ❌ Not implemented |

**Remaining Work:**
- [ ] Vue component subscribing to `GET /observability/stream?agentSlug=stock-predictor`
- [ ] Filter for `prediction.*` event types
- [ ] Show prediction with confidence, direction, rationale preview

---

### 2.7 Notification on Prediction Created

**Description:** Push/email notification when prediction is created

| Status | Service | Channels |
|--------|---------|----------|
| ✅ Service exists | notification.service | ⚠️ Need verification |

**Remaining Work:**
- [ ] Verify notification channels work (push, email)
- [ ] Test notification delivery
- [ ] Notification preferences per universe

---

### 2.8 View Prediction with Full Reasoning Chain

**Description:** Click on prediction to see complete decision trail

| Status | Handler | Data Available |
|--------|---------|----------------|
| ⚠️ Partial | prediction.handler | ⚠️ Need to verify |

**Remaining Work:**
- [ ] Ensure prediction includes source article reference
- [ ] Include signal fingerprint in response
- [ ] Include analyst reasoning and strategy used
- [ ] E2E test for prediction deep-dive

---

## Phase 3: Prediction Exploration

### 3.1 List Predictions by Target

**API:**
```typescript
POST /agent-to-agent/finance/stock-predictor/tasks
{
  "mode": "dashboard",
  "payload": {
    "action": "predictions.list",
    "params": {
      "universeId": "<universe-id>",
      "targetId": "<target-id>"
    }
  }
}
```

| Status | Handler | E2E Test |
|--------|---------|----------|
| ✅ Implemented | prediction.handler | ✅ Basic list |

**Remaining Work:**
- [ ] E2E test with target filter
- [ ] Pagination test

---

### 3.2 Filter Predictions by Status

**Description:** Filter by active, expired, evaluated status

| Status | Handler | E2E Test |
|--------|---------|----------|
| ⚠️ Need verification | prediction.handler | ❌ Missing |

**Remaining Work:**
- [ ] Verify status filter works
- [ ] E2E test for each status filter

---

### 3.3-3.8 Prediction Details

| Scenario | Status | Work Needed |
|----------|--------|-------------|
| 3.3 View prediction details | ⚠️ Partial | Verify all fields returned |
| 3.4 See source article | ⚠️ Partial | Add source linkage |
| 3.5 See analyst reasoning | ⚠️ Partial | Include in response |
| 3.6 View signal fingerprint | ✅ Repo exists | Add to prediction response |
| 3.7 See prediction lineage | ⚠️ Partial | learning-lineage.repository |
| 3.8 Compare predictions | ❌ Not implemented | New feature |

---

## Phase 4: Evaluation & Outcomes

### 4.1 View Predictions Ready for Evaluation

**Description:** List predictions past their horizon date ready for evaluation

**API (examples):**
```typescript
POST /agent-to-agent/finance/stock-predictor/tasks
{
  "mode": "dashboard",
  "payload": {
    "action": "review-queue.list",
    "params": {
      "universeId": "<universe-id>",
      "status": "pending"
    }
  }
}

// Respond (approve/reject/modify):
{
  "mode": "dashboard",
  "payload": {
    "action": "review-queue.respond",
    "params": {
      "id": "<review-queue-item-id>",
      "decision": "approve",
      "reviewerNotes": "Looks correct based on the source article."
    }
  }
}
```

| Status | Handler | E2E Test |
|--------|---------|----------|
| ⚠️ Partial | review-queue.handler | ❌ Missing |

**Remaining Work:**
- [ ] Verify review-queue.handler exists
- [ ] E2E test for review queue
- [ ] Filter by ready-for-evaluation status

---

### 4.2-4.9 Evaluation Flow

| Scenario | Status | Work Needed |
|----------|--------|-------------|
| 4.2 Get actual price data | ✅ Service exists | E2E test |
| 4.3 Auto-evaluate prediction | ✅ Runner exists | E2E test |
| 4.4 Manual evaluation override | ❌ Not implemented | New feature |
| 4.5 See evaluation score | ⚠️ Partial | Handler verification |
| 4.6 View evaluation reasoning | ✅ Service exists | Include in response |
| 4.7 Accuracy by analyst | ✅ Analytics handler | E2E test exists |
| 4.8 Accuracy by strategy | ⚠️ Partial | Add to analytics |
| 4.9 Accuracy by target | ⚠️ Partial | Add to analytics |

---

## Phase 5: Learning Loop

### 5.1 Detect Missed Opportunities

**Description:** Find cases where we should have made a prediction but didn't

| Status | Runner | Service | Handler |
|--------|--------|---------|---------|
| ✅ Runner exists | missed-opportunity-scanner | missed-opportunity-detection | missed-opportunity.handler |

**Remaining Work:**
- [ ] E2E test for missed opportunity detection
- [ ] Verify handler actions

---

### 5.2-5.8 Learning Flow

| Scenario | Status | Work Needed |
|----------|--------|-------------|
| 5.2 Analyze why missed | ⚠️ Service exists | Unit tests |
| 5.3 Add to learning queue | ⚠️ Handler exists | E2E test |
| 5.4 Review candidates | ⚠️ Handler exists | E2E test |
| 5.5 Approve promotion | ✅ Handler exists | E2E test exists |
| 5.6 Promote to strategy | ⚠️ Service exists | E2E test |
| 5.7 Track lineage | ⚠️ Repo exists | E2E test |
| 5.8 View impact | ❌ Not implemented | Analytics addition |

---

## Phase 6: Test Scenario Framework

### 6.1 Create Test Scenario

**API:**
```typescript
POST /agent-to-agent/finance/stock-predictor/tasks
{
  "mode": "dashboard",
  "payload": {
    "action": "test-scenarios.create",
    "params": {
      "universeId": "<universe-id>",
      "targetId": "<target-id>",
      "name": "AAPL Earnings Beat Scenario",
      "description": "Test prediction behavior on positive earnings surprise"
    }
  }
}
```

| Status | Handler | E2E Test |
|--------|---------|----------|
| ✅ Implemented | test-scenario.handler | ✅ List only |

**Remaining Work:**
- [ ] E2E test for scenario creation
- [ ] Verify create action works

---

### 6.2-6.9 Test Scenario Flow

| Scenario | Status | Work Needed |
|----------|--------|-------------|
| 6.2 Inject synthetic article | ⚠️ Service exists | E2E test |
| 6.3 Inject price data | ⚠️ Service exists | E2E test |
| 6.4 Run scenario | ⚠️ Service exists | E2E test |
| 6.5 See T_ predictions | ✅ Mirrors work | E2E test |
| 6.6 Evaluate scenario | ⚠️ Partial | E2E test |
| 6.7 Compare vs production | ❌ Not implemented | New feature |
| 6.8 Create variation | ✅ Service exists | E2E test |
| 6.9 Batch run variations | ❌ Not implemented | New feature |

---

## Phase 7: Monitoring & Observability

### 7.0 Live Activity Feed (Primary Use Case)

**Description:** A finance manager's view - watch the prediction pipeline in real-time. Events stream in as a growing list (newest at top), filterable by what you care about.

**User Experience:**
- Open prediction dashboard → click "Watch Activity" button
- Events appear as a list, newest at top, growing as system works
- Each row shows: icon + type + brief description + timestamp
- **Filter toggles**: Show only what you care about
  - Articles (new stories coming in)
  - Signals (patterns detected)
  - Predictors (thresholds met, ready to predict)
  - Predictions (new predictions generated)
  - Evaluations (predictions scored)
  - Learnings (promotions, test runs)
- **Click any row** → opens modal with full details
  - Signal row → Signal detail modal
  - Predictor row → Predictor detail modal
  - Prediction row → Prediction detail modal (existing PredictionDetail)
- **Event timing**: Crawl intervals (e.g., every 10 min) create bursts of activity (articles → signals → predictors → predictions), then quieter periods. Other events (evaluations, learning promotions, manual actions) happen throughout.

**Visual Design (reuse AdminEventRow pattern):**
```
┌─────────────────────────────────────────────────────────────────┐
│ 🔍 Filter: [✓ All] [Articles] [Signals] [Predictors] [Predictions] │
├─────────────────────────────────────────────────────────────────┤
│ 🎯 prediction.created  AAPL ⬆️ UP 85% confidence      10:32:15  │ ← yellow highlight (new)
│ 📊 predictor.ready     AAPL predictor #47 (3 signals)  10:32:14  │
│ ⚡ signal.detected     Strong momentum signal for AAPL  10:32:12  │
│ 📰 article.discovered  "Apple announces Q4 earnings..." 10:32:10  │
│ 🔄 source.crawl.done   Yahoo Finance: 12 articles, 3 new 10:32:08  │
│ ...                                                              │
└─────────────────────────────────────────────────────────────────┘
```

**Existing UI to Leverage:**
- `AdminEventRow.vue` - Compact row with yellow highlight animation for new events
- `AdminObservabilityView.vue` - Connection status, history range selector
- `useAdminObservabilityStream()` - SSE connection composable
- `observabilityStore` - Event state management
- Detail modals already exist for predictions, signals, etc.

**Architecture:**
```
Backend Runners/Services → ObservabilityEventsService.push() → SSE Stream
                                                                    ↓
Frontend: useAdminObservabilityStream() → observabilityStore → PredictionActivityFeed.vue
                                                                    ↓
                                                              Click → Detail Modal
```

**Event Types to Emit:**

| Event Type | Icon | Source | Click Opens |
|------------|------|--------|-------------|
| `source.crawl.started` | 🔄 | source-crawler.runner | Source detail |
| `source.crawl.completed` | ✅ | source-crawler.runner | Source detail |
| `article.discovered` | 📰 | source-crawler.service | Article URL |
| `article.duplicate` | 🔁 | source-seen-item.repo | Original article |
| `signal.detected` | ⚡ | signal-detection.service | Signal modal |
| `predictor.ready` | 📊 | predictor.service | Predictor modal |
| `prediction.created` | 🎯 | prediction.service | PredictionDetail |
| `prediction.evaluated` | 📈 | evaluation.service | PredictionDetail |
| `learning.promoted` | 🎓 | learning-promotion | Learning detail |
| `test.completed` | 🧪 | test-scenario.service | Test results |

| Status | Backend | Frontend |
|--------|---------|----------|
| ⚠️ SSE exists | Need to emit events from runners | Adapt AdminEventRow pattern |

**Remaining Work:**

Backend:
- [ ] Add ObservabilityEventsService injection to runners/services
- [ ] Emit events at each pipeline stage (see table above)
- [ ] Include entity IDs in payload for drill-down

Frontend:
- [ ] Create `PredictionActivityFeed.vue` (adapt AdminObservabilityView pattern)
- [ ] Add "Watch Activity" button to PredictionDashboard.vue
- [ ] Event type filter toggles (checkboxes or chips)
- [ ] Row click → open appropriate detail modal
- [ ] Reuse AdminEventRow yellow highlight animation
- [ ] Add "Clear" and "Pause/Resume" controls
- [ ] Mobile-responsive (works on phone)

---

### 7.1-7.8 Additional Monitoring

| Scenario | Status | Work Needed |
|----------|--------|-------------|
| 7.1 System health overview | ✅ Analytics handler | E2E test exists |
| 7.2 Predictions per day | ⚠️ Partial | Add to analytics |
| 7.3 Accuracy trends | ✅ Handler exists | E2E test exists |
| 7.4 Source crawl status | ❌ Not implemented | New dashboard |
| 7.5 Signal detection rate | ❌ Not implemented | New metric |
| 7.6 Alert: crawl failing | ❌ Not implemented | Alert system |
| 7.7 Alert: unusual patterns | ❌ Not implemented | Anomaly detection |
| 7.8 Tool request tracking | ⚠️ Handler exists | E2E test |

---

## Phase 8: Administration

| Scenario | Status | Work Needed |
|----------|--------|-------------|
| 8.1 Pause/resume crawling | ❌ Not implemented | Source status field |
| 8.2 Deactivate target | ⚠️ Handler has update | E2E test |
| 8.3 ~~Archive old predictions~~ | ~~Deferred~~ | Delete if needed |
| 8.4 Export predictions | ❌ Not implemented | Export endpoint |
| 8.5 View audit log | ⚠️ Service exists | Handler needed |

---

### 8.6 Slack Notifications

**Description:** Send prediction alerts to Slack channels

**Implementation Options:**

1. **Slack Incoming Webhooks** (Simpler)
   - Create a Slack App → Enable Incoming Webhooks
   - Get webhook URL per channel
   - Store webhook URL in universe `notification_config`
   - POST formatted message to webhook URL

2. **Slack Bot API** (More Features)
   - Create Slack App with Bot Token
   - Can post to any channel bot is invited to
   - Supports threads, reactions, interactive messages
   - More complex setup

**Recommended: Incoming Webhooks** for simplicity

**Configuration:**
```typescript
// Universe notification_config
{
  "slack": {
    "webhook_url": "https://hooks.slack.com/services/T.../B.../xxx",
    "channel": "#predictions",  // For display only
    "events": ["prediction.created", "prediction.evaluated"]
  }
}
```

**Message Format:**
```
🎯 New Prediction: AAPL
Direction: ⬆️ UP (85% confidence)
Horizon: 7 days
Analyst: momentum-mike
View: https://app.orchestrator.ai/predictions/xxx
```

| Status | Service | Config | E2E Test |
|--------|---------|--------|----------|
| ❌ Not implemented | notification.service | universe.notification_config | ❌ Missing |

**Remaining Work:**
- [ ] Research Slack Incoming Webhooks setup
- [ ] Add `slack` section to notification.service
- [ ] Add Slack webhook URL to universe config
- [ ] Format messages with emoji and links
- [ ] Test with real Slack workspace

---

## Phase 9: Agent Hardening (Non-RBAC) & Production Readiness

**Important context:** Authentication, authorization, and RBAC are handled by the **A2A API harness**. This phase focuses on **agent/system hardening** that the harness does not automatically guarantee: correctness of scoping, reliability, cost controls, deterministic testing, external integration safety, and observability integrity.

### 9.1 Contract & Data Shape Hardening (Transport ↔ Web ↔ API ↔ DB)

**Goal:** Make request/response contracts unambiguous and enforced so the UI + tests + agent stay in lockstep.

- [ ] Fix the **camelCase vs snake_case** mismatch (see **Blocking Issues → Contract Mismatch**) so all dashboard create/update operations work with shared transport types
- [ ] Ensure API examples in this PRD match `apps/transport-types/modes/dashboard.types.ts`
- [ ] Add request validation for critical enums and config shapes (domain, sourceType, scopeLevel, prediction status/direction, etc.)
- [ ] Ensure responses include all fields required by the dashboard components (avoid “partial UI” states due to missing fields)

**Done when:**
- All Phase 1 create/update operations are proven via E2E and can be executed from the UI without shape workarounds.

---

### 9.2 Multi-Tenant & Test Isolation Correctness (Scoping Guarantees)

**Goal:** Even with RBAC in the harness, ensure the agent logic and DB queries are correctly scoped and cannot cross-contaminate.

- [ ] Verify every list/get/create/update/delete operation is scoped correctly by `orgSlug` and relevant entity scope (`agentSlug`, `universeId`, `targetId`)
- [ ] Ensure `is_test` behavior is consistent across:
  - predictions generation
  - analytics defaults and optional inclusion (`includeTest`)
  - notifications (no production notifications for test data)
  - UI indicators for test entities
- [ ] Add “negative tests” that prove cross-org data cannot leak (authorized but wrong org context should return empty/404)

**Done when:**
- Cross-scope leakage is proven impossible by tests (at least API E2E coverage).

---

### 9.3 Reliability, Backpressure, and Cost Controls

**Goal:** Prevent runaway background work and ensure predictable behavior under load.

- [ ] Add explicit rate limits / backpressure rules for:
  - crawl frequency per source
  - maximum items processed per crawl cycle
  - per-universe concurrency limits
- [ ] Ensure deduplication is “hard” (no repeated processing of same content across sources/targets)
- [ ] Add configurable caps for LLM usage (per tier and per universe) and clear error behavior when limits are hit
- [ ] Ensure runners are idempotent and safe to restart (no double-processing)

**Done when:**
- We can run the agent continuously without cost spikes or runaway queues, and failures recover safely on the next cycle.

---

### 9.4 External Integrations Hardening (Firecrawl, Price APIs, Slack)

**Goal:** Make integrations robust, safe, and observable.

- [ ] Standardize retry/backoff/timeouts per integration (RSS, Firecrawl, price providers, Slack)
- [ ] Ensure secrets/config are validated at startup (fail-fast with clear errors; no silent fallbacks)
- [ ] Add explicit “degraded mode” behaviors (e.g., Firecrawl down → skip source, emit event, keep pipeline healthy)
- [ ] Add integration-specific E2E tests where possible (or deterministic “mock endpoint” tests for Slack webhook)

**Done when:**
- Integration failures are visible, do not crash the system, and do not corrupt data.

---

### 9.5 Observability Integrity & Operator UX

**Goal:** Operators can understand what happened, and events are correct and safe.

- [ ] Ensure every emitted event includes correct ExecutionContext and entity IDs needed for drill-down
- [ ] Ensure event payloads do not leak cross-tenant details
- [ ] Add “pipeline stage” events across crawl → dedup → signal → predictor → prediction → evaluation → learning
- [ ] Add operator-facing dashboards/widgets for failures (crawl failing, price fetch failing, queue backlog)

**Done when:**
- You can debug any scenario using the activity feed + history without SSH’ing into the server.

---

### 9.6 Deterministic End-to-End Verification (Demo/Release Gate)

**Goal:** Prove the system works end-to-end with one repeatable, comprehensive test.

- [ ] Implement the **Full Pipeline Proof** test (see **Demo Readiness Gates**) that runs:
  - create universe → create target → verify T_ mirror → add source → crawl/test-crawl → generate signals → generate predictors → generate prediction → view deep-dive → evaluate → learning actions (as applicable)
- [ ] Add a matching **UI E2E** that covers the demo path in `/prediction/*`
- [ ] Document a one-command local validation run (API E2E + UI E2E) that produces a “demo ready” pass/fail signal

**Done when:**
- A teammate can run the test suite and get a reliable go/no-go for demos/releases.

---

## Background Runners

The prediction system uses scheduled runners for autonomous operations:

| Runner | Purpose | Schedule | Status |
|--------|---------|----------|--------|
| `source-crawler.runner` | Crawl sources for new articles | Per-source frequency | ✅ Documented |
| `batch-signal-processor.runner` | Process signals into predictors | On new signals | ✅ Documented |
| `batch-prediction-generator.runner` | Generate predictions from ready predictors | On predictor ready | ✅ Documented |
| `evaluation.runner` | Auto-evaluate expired predictions | Hourly | ✅ Documented |
| `expiration.runner` | Mark predictions as expired | Hourly | ⚠️ Undocumented |
| `outcome-tracking.runner` | Capture actual price outcomes | Daily | ⚠️ Undocumented |
| `missed-opportunity-scanner.runner` | Find missed prediction opportunities | Daily | ✅ Documented |

### Undocumented Runners

**expiration.runner**: Marks predictions as expired when their timeframe passes.
- Runs hourly
- Updates prediction status from 'active' to 'expired'
- Should emit `prediction.expired` event (not currently implemented)

**outcome-tracking.runner**: Captures actual price/outcome data for evaluation.
- Runs daily (or more frequently)
- Fetches real price data from market APIs
- Stores in `target_snapshots` table
- Critical for evaluation accuracy

**Remaining Work:**
- [ ] Document expiration.runner behavior and schedule
- [ ] Document outcome-tracking.runner data sources
- [ ] Add `prediction.expired` event emission
- [ ] Verify outcome data is used correctly in evaluation

---

## Error Handling

### Source Crawl Failures

| Error Type | Behavior | User Visibility |
|------------|----------|-----------------|
| RSS feed down | Retry with exponential backoff (3 attempts) | Source status shows 'error' |
| Firecrawl API error | Log error, skip source this cycle | Admin alert (if configured) |
| Rate limiting | Respect Retry-After header | Crawl delayed |
| Parse errors | Log and continue with valid articles | Partial results returned |

**Recovery:**
- Sources auto-retry on next scheduled crawl
- Manual retry via `sources.test-crawl` action
- Admin can pause/resume problematic sources

### Insufficient Signals

When a predictor doesn't have enough signals to meet `min_predictors` threshold:

| Scenario | Behavior |
|----------|----------|
| Below threshold | Predictor remains in 'pending' state, no prediction generated |
| Threshold met | Predictor moves to 'ready', prediction generated |
| Timeout without signals | Predictor expires without prediction (configurable) |

### Empty State Handling

| Operation | Empty State Behavior |
|-----------|---------------------|
| List predictions on empty target | Returns empty array, no error |
| List targets on empty universe | Returns empty array, no error |
| Create universe without targets | Valid - targets added later |
| Evaluate prediction without signals | Uses available context, lower confidence |

### Test Data Isolation

**How isolation works:**
- T_ prefixed targets are automatically flagged `is_test=true`
- All predictions from T_ targets inherit `is_test=true`
- Analytics endpoints exclude `is_test=true` by default
- Dashboard shows test predictions with visual indicator
- Test predictions never trigger production notifications

**Remaining Work:**
- [ ] Add `includeTest` param to analytics endpoints
- [ ] Visual indicator for test predictions in UI
- [ ] Verify notification filtering by is_test

---

## Test Coverage Summary

### Current State

| Category | Files | With Tests | Coverage |
|----------|-------|------------|----------|
| Handlers | 17 | 1 | 6% |
| Repositories | 23 | 1 | 4% |
| Services | 38 | 17 | 45% |
| Runners | 7 | 7 | 100% |
| E2E Tests | 14 | 14 | Basic ops only |

### Priority Test Additions

**Demo readiness:** The test suite is considered “demo-complete” only when all **Demo Readiness Gates** in **Blocking Issues → Demo Readiness Gates (Definition of Done)** are green (contract alignment + core API E2E + demo-path UI E2E + one full pipeline proof).

1. **High Priority - Core Demo Flow**
   - [ ] Universe CRUD E2E
   - [ ] Target CRUD with T_ mirror verification
   - [ ] Source CRUD E2E
   - [ ] Prediction deep-dive E2E
   - [ ] Evaluation workflow E2E

2. **Medium Priority - Power User Features**
   - [ ] Learning promotion full flow
   - [ ] Test scenario execution
   - [ ] Analytics by analyst/strategy/target

3. **Lower Priority - Polish**
   - [ ] Administration features
   - [ ] Alert system
   - [ ] Export functionality

---

## Implementation Priorities

### Sprint 0: Agent Hardening Foundation (Pre-Demo Blockers)

**Focus:** Fix critical blockers from Phase 9 that must be resolved before demo work can proceed safely.

**From Phase 9.1 - Contract Hardening:**
1. Fix camelCase vs snake_case mismatch in handlers (see Blocking Issues)
   - Update `target.handler.ts` to accept camelCase params for **create + update** (map internally to DTO/DB snake_case)
   - Update `source.handler.ts` to accept camelCase params for **create + update** (map internally to DTO/DB snake_case)
   - Update `universe.handler.ts` to accept camelCase params for **create + update** (map internally to DTO/DB snake_case)
2. Add E2E regression coverage proving camelCase requests work
   - Create: universe/target/source create works with transport-types params
   - Update: universe/target/source update works with transport-types params

**From Phase 9.2 - Scoping Correctness:**
3. Add negative tests proving cross-org / cross-scope data cannot leak
   - Use a valid auth token, but request with the wrong `orgSlug` / wrong `agentSlug` / wrong `universeId`
   - Expected: empty list, `NOT_FOUND`, or clear scoped error (no cross-tenant data returned)
4. Verify `is_test` isolation across predictions, analytics, and notifications

**From Phase 9.6 - Pipeline Verification:**
5. Create one "full pipeline proof" E2E test (deterministic happy path)
   - create universe → create target → verify **T_ mirror** exists → add source → crawl/test-crawl → signal → predictor → prediction
   - view prediction deep-dive / snapshot (as applicable)
   - evaluate prediction (and optionally verify learning queue entry if generated)

**Done when:**
- All universe/target/source **create + update** operations work with camelCase params from transport types
- Demo Readiness Gate 1 (Contract Alignment) is green
- At least one full-pipeline E2E test passes end-to-end without manual intervention

---

### Sprint 1: Core Demo Flow
1. Verify all CRUD operations work for Universe, Target, Source
2. Add E2E tests for create operations
3. Implement real-time prediction feed
4. Add prediction deep-dive with full lineage

### Sprint 2: Evaluation & Learning
1. Complete evaluation workflow
2. Implement learning queue review flow
3. Add learning promotion with lineage tracking

### Sprint 3: Test Framework
1. Test scenario creation and execution
2. Synthetic data injection
3. Scenario vs production comparison

### Sprint 4: Monitoring & Polish
1. Source crawl status dashboard
2. Alert system for failures
3. Export and archive functionality

---

## Decisions Made

1. **Crawl Frequency**: Per-universe default with per-source override
2. **Real-time Updates**: SSE (existing ObservabilityEventsService infrastructure)
3. **Alert Destinations**: Push notifications (existing), Slack integration (new - see below)
4. **Archive Policy**: No archiving for now - delete if needed

## Open Questions

1. **Slack Integration**: How to set up Slack webhook/bot for notifications?
   - Research: Slack Incoming Webhooks vs Bot API
   - Decision needed: Per-universe Slack channel or single channel with tags?

---

## Blocking Issues

### CRITICAL: camelCase vs snake_case Contract Mismatch

**Status:** 🔴 Blocking - Must fix before demo

**Problem:** The transport types (`apps/transport-types/modes/dashboard.types.ts`) define camelCase params for create operations, but backend handlers still expect snake_case:

| Layer | Convention | Example |
|-------|------------|---------|
| Transport Types (shared) | camelCase | `universeId`, `targetType`, `llmConfigOverride` |
| Backend Handlers (API) | snake_case | `universe_id`, `target_type`, `llm_config_override` |

**Impact:**
- Frontend sending camelCase will fail validation in handlers
- All create/update operations in Phase 1 are broken at runtime
- Tests don't catch this because E2E tests for create flows are missing

**Affected Handlers:**
- `target.handler.ts` - `handleCreate()` expects `universe_id`, `target_type`
- `source.handler.ts` - `handleCreate()` expects `source_type`, `scope_level`, `universe_id`
- `universe.handler.ts` - `handleCreate()` expects `llm_config`, `strategy_id`

**Resolution Options:**

1. **Option A: Fix handlers to accept camelCase** (Recommended)
   - Update handlers to read camelCase from params
   - Map to snake_case DTOs internally
   - Aligns with transport types and frontend expectations

2. **Option B: Change transport types to snake_case**
   - Update `dashboard.types.ts` to use snake_case
   - Update frontend to send snake_case
   - Inconsistent with JavaScript conventions

**Files to Fix (Option A):**
- [ ] `apps/api/src/prediction-runner/task-router/handlers/target.handler.ts`
- [ ] `apps/api/src/prediction-runner/task-router/handlers/source.handler.ts`
- [ ] `apps/api/src/prediction-runner/task-router/handlers/universe.handler.ts`
- [ ] Add E2E tests for create operations to catch regressions

### Demo Readiness Gates (Definition of Done)

These gates must be **green** before we can claim the PRD scenarios are fully addressed end-to-end (backend + frontend + tests) and are **safe to demo**.

#### Gate 1: Contract Alignment (Blocking)
- [ ] Dashboard mode request params are **consistent across**:
  - `apps/transport-types/modes/dashboard.types.ts` (shared types)
  - Frontend dashboard services (web)
  - Backend dashboard handlers (api)
- [ ] Universe/Target/Source create+update accept **camelCase** request params as defined in transport types (recommended), and map internally to DB/DTO `snake_case` as needed.
- [ ] Add at least one regression test that fails if camelCase create requests stop working.

#### Gate 2: Core Demo Flow (API E2E)
- [ ] **Universe CRUD**: `universes.create/update/delete` API E2E
- [ ] **Target CRUD**: `targets.create/update/delete` API E2E
- [ ] **T_ Mirror verification**: create target → assert `auto_create_test_mirror` fired → assert `test-target-mirrors.list` shows mirror
- [ ] **Source CRUD**: `sources.create/update/delete` API E2E
- [ ] **Test crawl**: `sources.test-crawl` API E2E (RSS + Firecrawl where applicable)

#### Gate 3: Demo-Path UI Journeys (Frontend E2E)
- [ ] Cypress (or Playwright) tests cover the **actual /prediction UI path** for:
  - Create Universe → add Target → add Source → verify surfaced in UI
  - Navigate PredictionDashboard → open prediction detail → open deep-dive/snapshot view
  - Learning/review queue basic navigation + action (where applicable)

#### Gate 4: Full Pipeline Proof (Single End-to-End Scenario)
- [ ] One “happy path” end-to-end test exists that proves the **full range** works together:
  - Create universe → create target → verify T_ mirror → add source → crawl/test-crawl → generate signals → generate predictors → generate prediction → view prediction deep-dive → evaluate → learning queue/promotion (as applicable)
- [ ] This test is deterministic enough to run in CI/dev and is the primary **demo readiness proof**.

---

## Appendix: Handler Action Reference

### Universe Handler
- `universes.list` - List universes for current agent
- `universes.get` - Get universe by ID
- `universes.create` - Create new universe
- `universes.update` - Update universe
- `universes.delete` - Delete universe

### Target Handler
- `targets.list` - List targets (requires universeId)
- `targets.get` - Get target by ID
- `targets.create` - Create target
- `targets.update` - Update target
- `targets.delete` - Delete target

### Source Handler
- `sources.list` - List sources for universe/target
- `sources.get` - Get source by ID
- `sources.create` - Create new source
- `sources.update` - Update source config
- `sources.delete` - Delete source
- `sources.test-crawl` - Preview crawl results without persisting

### Source Seen Items Handler (Planned)
- `source-seen-items.list` - List seen articles/items per source *(not yet implemented)*
- `source-seen-items.stats` - Get deduplication statistics *(not yet implemented)*

### Analyst Handler
- `analysts.list` - List analysts for universe
- `analysts.get` - Get analyst by ID
- `analysts.create` - Create analyst persona
- `analysts.update` - Update analyst
- `analysts.delete` - Delete analyst

### Strategy Handler (Read-Only)
- `strategies.list` - List system strategies
- `strategies.get` - Get strategy by ID
- `strategies.recommend` - Get strategy recommendations

### Prediction Handler
- `predictions.list` - List predictions (with filters)
- `predictions.get` - Get prediction with full details
- `predictions.get-snapshot` - Get prediction state at point in time

### Review Queue Handler
- `review-queue.list` - List predictions ready for review
- `review-queue.get` - Get review item details
- `review-queue.respond` - Submit review response

### Learning Handler
- `learnings.list` - List learnings
- `learnings.get` - Get learning by ID
- `learnings.create` - Create learning
- `learnings.update` - Update learning
- `learnings.supersede` - Mark learning as superseded

### Learning Queue Handler
- `learning-queue.list` - List items in learning queue
- `learning-queue.get` - Get queue item details
- `learning-queue.respond` - Process queue item

### Learning Promotion Handler
- `learning-promotion.list-candidates` - List promotion candidates
- `learning-promotion.validate` - Validate candidate for promotion
- `learning-promotion.promote` - Promote learning to strategy
- `learning-promotion.reject` - Reject promotion candidate
- `learning-promotion.history` - View promotion history
- `learning-promotion.stats` - Get promotion statistics
- `learning-promotion.run-backtest` - Run backtest on candidate

### Missed Opportunity Handler
- `missed-opportunities.list` - List missed opportunities
- `missed-opportunities.detect` - Trigger detection scan
- `missed-opportunities.analyze` - Analyze specific opportunity

### Test Scenario Handler
- `test-scenarios.list` - List test scenarios
- `test-scenarios.get` - Get scenario by ID
- `test-scenarios.create` - Create test scenario
- `test-scenarios.update` - Update scenario
- `test-scenarios.delete` - Delete scenario
- `test-scenarios.run` - Execute scenario
- `test-scenarios.create-variation` - Create scenario variation
- Plus 7 more actions for advanced scenario management

### Test Article Handler
- `test-articles.list` - List test articles
- `test-articles.get` - Get article by ID
- `test-articles.create` - Create test article
- `test-articles.bulk-create` - Bulk create articles
- `test-articles.generate` - AI-generate test article
- `test-articles.update` - Update article
- `test-articles.delete` - Delete article

### Test Price Data Handler
- `test-price-data.list` - List price data
- `test-price-data.get` - Get price data by ID
- `test-price-data.create` - Create price data point
- `test-price-data.bulk-create` - Bulk create price data
- `test-price-data.by-date-range` - Query by date range
- `test-price-data.update` - Update price data
- `test-price-data.delete` - Delete price data

### Test Target Mirror Handler
- `test-target-mirrors.list` - List T_ mirrors
- `test-target-mirrors.get` - Get mirror by ID
- `test-target-mirrors.create` - Create mirror manually
- `test-target-mirrors.update` - Update mirror
- `test-target-mirrors.delete` - Delete mirror
- Plus advanced query actions

### Analytics Handler
- `analytics.summary` - System overview
- `analytics.accuracy-comparison` - Compare accuracy metrics
- `analytics.learning-velocity` - Learning promotion rate
- `analytics.scenario-effectiveness` - Test scenario metrics
- `analytics.promotion-funnel` - Promotion pipeline metrics

### Tool Request Handler
- `tool-requests.list` - List tool requests
- `tool-requests.get` - Get request by ID
- `tool-requests.create` - Create tool request
- `tool-requests.update-status` - Update request status

---

## Appendix: Status Values

### Prediction Status
- `active` - Prediction is live, awaiting outcome
- `expired` - Timeframe passed, ready for evaluation
- `resolved` - Evaluated with outcome
- `cancelled` - Manually cancelled

### Source Status
- `active` - Source is being crawled
- `paused` - Temporarily disabled
- `error` - Crawl failing, needs attention
- `archived` - Permanently disabled

### Signal Sentiment
- `bullish` - Positive indicator
- `bearish` - Negative indicator
- `neutral` - No clear direction

### Prediction Direction
- `up` - Price expected to increase
- `down` - Price expected to decrease
- `flat` - No significant change expected
