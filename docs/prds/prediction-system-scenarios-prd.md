# Prediction System Scenarios PRD

## Overview

This PRD documents all user scenarios for the Prediction System, their current implementation status, and remaining work needed for a complete demo-ready system.

**Last Updated:** 2026-01-12
**Status:** In Progress
**Owner:** Finance Organization

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
- **Universe owns LLM Config**: Each universe can have its own tier contexts
- **Test Data Isolation**: T_ prefixed targets mirror production targets

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
      "llm_config": {
        "provider": "anthropic",
        "model": "claude-sonnet-4-20250514",
        "temperature": 0.3
      }
    }
  }
}
```

| Status | Handler | Service | Repository | E2E Test |
|--------|---------|---------|------------|----------|
| ✅ Implemented | universe.handler | universe.service | universe.repository | ❌ Missing |

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
      "universe_id": "<universe-id>",
      "symbol": "AAPL",
      "name": "Apple Inc.",
      "target_type": "stock",
      "context": "Consumer electronics, services, Mac, iPhone, iPad"
    }
  }
}
```

| Status | Handler | Service | Repository | E2E Test |
|--------|---------|---------|------------|----------|
| ✅ Implemented | target.handler | target.service | target.repository | ❌ Missing |

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
      "universe_id": "<universe-id>",
      "target_id": "<target-id>",
      "source_type": "rss",
      "url": "https://feeds.finance.yahoo.com/rss/2.0/headline?s=AAPL",
      "name": "Yahoo Finance AAPL RSS",
      "crawl_frequency_minutes": 10
    }
  }
}
```

| Status | Handler | Service | Repository | E2E Test |
|--------|---------|---------|------------|----------|
| ⚠️ Unknown | source.handler | ? | source.repository | ❌ Missing |

**Remaining Work:**
- [ ] Verify source.handler exists and has create action
- [ ] Add crawl_frequency_minutes support
- [ ] E2E test for source creation

---

### 1.5 Add News Site Source

**Description:** Add a news website as a source (uses Firecrawl for scraping)

| Status | Handler | Service | Repository | E2E Test |
|--------|---------|---------|------------|----------|
| ⚠️ Unknown | source.handler | firecrawl.service | source.repository | ❌ Missing |

**Remaining Work:**
- [ ] Verify Firecrawl integration for non-RSS sources
- [ ] E2E test for news site source

---

### 1.6 Configure Crawl Frequency

**Description:** Set how often sources are crawled per source or per universe

| Status | Handler | Service | Repository | E2E Test |
|--------|---------|---------|------------|----------|
| ❌ Not Implemented | - | - | - | - |

**Remaining Work:**
- [ ] Add crawl_frequency to source schema if not present
- [ ] Source crawler runner respects per-source frequency
- [ ] UI/API to update frequency

---

### 1.7 Add/Configure Analysts

**Description:** Create analyst personas that make predictions

| Status | Handler | Service | Repository | E2E Test |
|--------|---------|---------|------------|----------|
| ✅ Implemented | analyst.handler | analyst.service | analyst.repository | ✅ List only |

**Remaining Work:**
- [ ] E2E test for analyst CRUD
- [ ] Unit tests for analyst.handler

---

### 1.8 Create/Modify Strategies

**Description:** Define prediction strategies and frameworks

| Status | Handler | Service | Repository | E2E Test |
|--------|---------|---------|------------|----------|
| ⚠️ Partial | strategy.handler | strategy.service | strategy.repository | ❌ Missing |

**Remaining Work:**
- [ ] Verify strategy handler actions
- [ ] E2E test for strategy CRUD
- [ ] Unit tests for strategy.handler

---

### 1.9 Feed Deduplication & Historical Tracking

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

## Test Coverage Summary

### Current State

| Category | Files | With Tests | Coverage |
|----------|-------|------------|----------|
| Handlers | 16 | 1 | 6% |
| Repositories | 20 | 1 | 5% |
| Services | 38 | 17 | 45% |
| Runners | 7 | 7 | 100% |
| E2E Tests | 14 | 14 | Basic ops only |

### Priority Test Additions

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

### Prediction Handler
- `predictions.list` - List predictions
- `predictions.get` - Get prediction with details

### Analytics Handler
- `analytics.summary` - System overview
- `analytics.accuracy-comparison` - Compare accuracy metrics

### Learning Promotion Handler
- `learning-promotion.list-candidates` - List promotion candidates
- `learning-promotion.stats` - Get promotion statistics
