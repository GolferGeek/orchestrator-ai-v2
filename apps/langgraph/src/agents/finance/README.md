# Finance Research Learning-Loop Agent

> A self-improving financial intelligence system that learns from predictions, sources, and missed opportunities.

## Vision

This isn't just a prediction engine. It's a **learning system** that:

1. **Predicts** buy/sell/hold recommendations across multiple timing windows
2. **Evaluates** outcomes against realized prices
3. **Learns** from both successes AND failures
4. **Discovers** what it missed and why
5. **Improves** its data sources over time
6. **Calibrates** confidence to match actual accuracy

The goal: A system that gets smarter every day, not just from what it predicts, but from the entire opportunity landscape.

---

## Architecture Overview

### Core Philosophy: Two-Tier Evaluation with Three-Stage Pipeline

The Finance agent uses a **two-tier evaluation system**:

**Tier 1: Triage (Fast, Cheap)** - "Is this even a thing?"
- Runs on EVERY incoming event (RSS item, price tick, volume data)
- 3 triage agents: Novelty Checker, Magnitude Checker, Context Checker
- Uses Haiku/local models for speed and cost
- Only events that pass triage proceed to Tier 2

**Tier 2: Full Analysis (Expensive, Thorough)** - "What should we do about it?"
1. **Stage 1: Prediction Generation** - 12 specialist teams analyze data
2. **Stage 2: Challenge & Refine** - 5 evaluators poke holes in predictions
3. **Stage 3: Risk-Profile Packaging** - Clean output per user's risk profile

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         CONTINUOUS POLLING (Data Ingestion)                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐                            │
│  │  RSS Poller │   │Market Poller│   │ News Poller │                            │
│  │  (60s)      │   │  (15s)      │   │   (5min)    │                            │
│  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘                            │
│         └──────────────────┴──────────────────┘                                 │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │ (each new item)
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    PRE-FILTER (Rule-Based, No LLM)                               │
│                    "Is this even worth evaluating?"                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│  PRICE DATA: Day move <2%? Hour move <1%? Volume <1.5x? → SKIP                 │
│  NEWS/RSS: Duplicate headline? → SKIP                                           │
│  (Filters ~80% of routine price polls with zero LLM cost)                       │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │ (passes pre-filter)
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    TIER 1: TRIAGE (3 Agents - Fast, Cheap LLM)                   │
│                    "Is this actually significant?"                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐                            │
│  │  Novelty    │   │  Magnitude  │   │   Context   │                            │
│  │  Checker    │   │  Checker    │   │   Checker   │                            │
│  │ "Is it new?"│   │"Big enough?"│   │"Our stocks?"│                            │
│  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘                            │
│         └──────────────────┴──────────────────┘                                 │
│                            │                                                     │
│              ┌─────────────┴─────────────┐                                       │
│              ▼                           ▼                                       │
│         [ PASS ]                    [ REJECT ]                                   │
│         Proceed                     Store & Skip                                 │
└─────────────┬───────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                   TIER 2 - STAGE 1: PREDICTION GENERATION (12 Specialists)       │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐           │
│  │  TECHNICAL TEAM   │  │ FUNDAMENTAL TEAM  │  │  SENTIMENT TEAM   │           │
│  │  • Momentum       │  │  • Value          │  │  • News Flow      │           │
│  │  • Reversion      │  │  • Growth         │  │  • Social Mood    │           │
│  │  • Pattern        │  │  • Quality        │  │  • Narrative Shift│           │
│  └───────────────────┘  └───────────────────┘  └───────────────────┘           │
│                           ┌───────────────────┐                                 │
│                           │   AGENDA TEAM     │                                 │
│                           │  • Manipulation   │                                 │
│                           │  • Coord. Narrtvs │                                 │
│                           │  • FUD Detector   │                                 │
│                           └─────────┬─────────┘                                 │
└─────────────────────────────────────┼───────────────────────────────────────────┘
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                   TIER 2 - STAGE 2: CHALLENGE & REFINE (5 Evaluators)            │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │  Devil's    │  │    Risk     │  │    Data     │  │ Historical  │            │
│  │  Advocate   │  │  Assessor   │  │   Skeptic   │  │  Matcher    │            │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘            │
│         └────────────────┼────────────────┼────────────────┘                    │
│                    ┌─────┴────────────────┴─────┐                               │
│                    │    Confidence Calibrator    │                               │
│                    └─────────────┬───────────────┘                               │
└──────────────────────────────────┼───────────────────────────────────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                   TIER 2 - STAGE 3: RISK-PROFILE PACKAGING                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│     ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐          │
│     │   AGGRESSIVE    │    │    BALANCED     │    │  CONSERVATIVE   │          │
│     │ • More trades   │    │ • Selective     │    │ • Fewer trades  │          │
│     │ • Min conf: 50% │    │ • Min conf: 65% │    │ • Min conf: 75% │          │
│     │ • Tech-weighted │    │ • Balanced      │    │ • Quality-bias  │          │
│     └─────────────────┘    └─────────────────┘    └─────────────────┘          │
└─────────────────────────────────────────────────────────────────────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            LEARNING LOOP                                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐                      │
│  │  Outcome    │      │ Postmortem  │      │   Missed    │                      │
│  │ Evaluation  │ ──▶  │ Generation  │ ──▶  │ Opportunity │                      │
│  │  Service    │      │   Service   │      │   Service   │                      │
│  └─────────────┘      └─────────────┘      └──────┬──────┘                      │
│                                                   │                             │
│         ┌─────────────────────────────────────────┘                             │
│         ▼                                                                       │
│  ┌─────────────┐      ┌─────────────┐                                          │
│  │  Learning   │      │   Source    │                                          │
│  │   Context   │ ◄──  │ Performance │                                          │
│  │   Service   │      │   Service   │                                          │
│  └─────────────┘      └─────────────┘                                          │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Three-Stage Pipeline Details

**Stage 1: Analyst Teams (12 Specialists)**

| Team | Specialists | Focus |
|------|-------------|-------|
| **Technical** | Momentum, Reversion, Pattern | Price/volume analysis |
| **Fundamental** | Value, Growth, Quality | Financial metrics |
| **Sentiment** | News Flow, Social Mood, Narrative Shift | Market psychology |
| **Agenda** | Manipulation, Coordinated Narrative, FUD | Detect artificial signals |

**Stage 2: Evaluator Red Team (5 Members)**

| Evaluator | Role |
|-----------|------|
| **Devil's Advocate** | "What if this is wrong because..." |
| **Risk Assessor** | "Worst case is X% loss because..." |
| **Data Skeptic** | "This relies on data that might be..." |
| **Historical Matcher** | "Last time this pattern appeared..." |
| **Confidence Calibrator** | Final confidence assignment |

**Stage 3: Risk Profiles**

| Profile | Min Confidence | Max Positions | Bias |
|---------|---------------|---------------|------|
| **Aggressive** | 50% | 10 | Technical, Sentiment |
| **Balanced** | 65% | 5 | Equal weighting |
| **Conservative** | 75% | 3 | Fundamental, Quality |

### Expert Services

Each service is expert in exactly one thing:

| Service | Single Responsibility |
|---------|----------------------|
| **ContinuousPollerService** | Poll RSS, market data, news APIs continuously |
| **PreFilterService** | Rule-based filter for price data (day/hour move, volume) - no LLM |
| **TriageService** | Run 3 triage agents on events that pass pre-filter |
| **TriageEvaluationService** | Track TP/TN/FP/FN for triage improvement |
| **EventProcessorService** | Route events through pre-filter → triage → full analysis |
| **MarketDataService** | Fetch & store OHLCV data |
| **NewsIngestionService** | Fetch & store news items |
| **AgendaExtractionService** | LLM-based narrative detection |
| **FeatureBuildingService** | Derive technical & sentiment features |
| **SpecialistSwarmService** | Run 12 specialists in parallel |
| **EvaluatorRedTeamService** | Run 5 evaluators to challenge predictions |
| **RiskProfilePackagingService** | Filter/weight by risk profile |
| **OutcomeEvaluationService** | Compute win/loss from realized prices |
| **PostmortemService** | LLM analysis of why outcome occurred |
| **MissedOpportunityService** | Find & analyze what we didn't predict |
| **LearningContextService** | Aggregate lessons for future predictions |
| **WatchService** | Manage reactive/event-driven triggers |

### Why This Matters

1. **Two-Layer Filtering**: Pre-filter (rule-based, free) removes routine price polls; triage (cheap LLM) filters the rest
2. **Cost Efficiency**: Pre-filter catches ~80% of price noise with zero LLM cost; triage filters remaining ~50% cheaply
3. **Diversity of Thought**: 12 specialists catch different opportunities
4. **Active Challenges**: Red team pokes holes, not just scores
5. **Clean Output**: Users get actionable recommendations, not internal debates
6. **User-Specific**: Risk profile matches user's tolerance
7. **Testability**: Each service can be unit tested in isolation
8. **Replaceability**: Swap implementations without touching other code

---

## The Learning Loop

This is the heart of the system. Unlike typical prediction engines, we learn from **three sources**:

### 1. Prediction Outcomes
```
Prediction → Outcome → Postmortem → Lessons → Better Predictions
```

Every prediction we make gets evaluated. Win or loss, we generate a postmortem explaining *why* it happened. Those lessons feed back into future predictions.

### 2. Missed Opportunities
```
Market Moves → Compare to Predictions → Find Misses → Analyze → Lessons
```

A +15% move we didn't predict is just as valuable (maybe more valuable) than a prediction we got wrong. We actively scan for what we missed and learn from it.

### 3. Source Quality
```
Sources → Attribution → Outcome Correlation → Source Score → Source Selection
```

Which news sources actually help us predict? Which market data vendors are reliable? We track source contributions and measure their quality over time.

---

## Data Flow

### Daily Prediction Run

```
1. INITIALIZE
   └── Load universe config (instruments, timing windows)
   └── Create recommendation run record

2. INGEST MARKET DATA
   └── Check database for recent data
   └── Fetch from connectors if needed (Yahoo → Alpha Vantage → Mock)
   └── Store to finance.market_bars

3. INGEST NEWS
   └── Fetch from RSS feeds
   └── Store to finance.news_items

4. EXTRACT AGENDA SIGNALS
   └── Send news to LLM for narrative/manipulation detection
   └── Store to finance.agenda_events

5. BUILD FEATURES
   └── Technical features from market data
   └── Sentiment features from agenda events
   └── Store to finance.market_features, finance.agenda_features

6. GENERATE RECOMMENDATIONS
   └── Load learning context (past lessons)
   └── Send features + context to LLM
   └── Generate recommendations with confidence scores
   └── Track source attributions
   └── Store to finance.recommendations

7. COMPLETE
   └── Update run status
   └── Emit completion event
```

### Daily Evaluation Run

```
1. GET PENDING RECOMMENDATIONS
   └── Find recommendations without outcomes
   └── Filter to evaluable time window

2. FOR EACH RECOMMENDATION:
   a. FETCH REALIZED PRICES
      └── Get current/closing price for instrument

   b. COMPUTE OUTCOME
      └── Calculate return %
      └── Determine win/loss/neutral
      └── Store to finance.recommendation_outcomes

   c. GENERATE POSTMORTEM
      └── Send outcome to LLM for analysis
      └── Extract lessons learned
      └── Store to finance.postmortems

3. SCAN MISSED OPPORTUNITIES
   └── Get significant market moves (>3%)
   └── Compare to our predictions
   └── For each miss: analyze why we missed it
   └── Store to finance.missed_opportunities

4. UPDATE LEARNING CONTEXT
   └── Aggregate recent lessons
   └── Update instrument-specific insights
   └── Refresh source performance metrics
```

---

## Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| `finance.universes` | Trading universe definitions |
| `finance.universe_versions` | Versioned universe configurations |
| `finance.market_bars` | OHLCV price data |
| `finance.market_features` | Derived technical features |
| `finance.news_items` | News and world events |
| `finance.agenda_events` | LLM-extracted manipulation signals |
| `finance.agenda_features` | Derived sentiment features |
| `finance.recommendation_runs` | Batch execution tracking |
| `finance.recommendations` | Individual predictions with confidence |
| `finance.recommendation_outcomes` | Realized performance |
| `finance.postmortems` | Why it happened analysis |

### Learning Tables (v2)

| Table | Purpose |
|-------|---------|
| `finance.source_attributions` | Track which sources influenced predictions |
| `finance.source_candidates` | Pipeline for discovering new sources |
| `finance.missed_opportunities` | What we didn't predict but should have |

### Key Views

| View | Purpose |
|------|---------|
| `finance.daily_performance` | Aggregated daily prediction stats |
| `finance.source_performance` | Source quality metrics |
| `finance.instrument_performance` | Per-instrument accuracy |

---

## API Endpoints

### LangGraph Controller (`/agents/finance/`)

```
POST /finance/run
  Execute a recommendation workflow
  Body: { context: ExecutionContext, universeVersionId: string }
  Returns: { success, runId, recommendations[] }

GET /finance/recommendations/:runId
  Get recommendations for a run
  Returns: { recommendations[] }

POST /finance/evaluate
  Trigger evaluation for pending recommendations
  Query: ?lookbackHours=48
  Returns: { summary, results[] }

GET /finance/learning-context
  Get aggregated learning context
  Query: ?instruments=AAPL,MSFT&limit=10
  Returns: { instruments, context }
```

### NestJS API Controller (`/api/finance/`)

```
# Universes
GET    /api/finance/universes
POST   /api/finance/universes
GET    /api/finance/universes/:id
PATCH  /api/finance/universes/:id
DELETE /api/finance/universes/:id

# Versions
POST   /api/finance/universes/:id/versions
PATCH  /api/finance/universes/:id/versions/:versionId/activate

# Recommendations
GET    /api/finance/universes/:id/recommendations
GET    /api/finance/universes/:id/recommendations/:recId/outcome

# Analytics (v2)
GET    /api/finance/universes/:id/history
GET    /api/finance/universes/:id/performance
GET    /api/finance/sources/performance
```

---

## Connectors

### Market Data Connectors

| Connector | Status | API Key Required | Rate Limits |
|-----------|--------|------------------|-------------|
| Yahoo Finance | ✅ Active | No | ~2000/hour |
| Alpha Vantage | ✅ Active | Yes (free tier) | 5/min, 500/day |
| Mock | ✅ Fallback | No | Unlimited |
| Bloomberg | 🔮 Future | Yes (licensed) | TBD |

### News Connectors

| Connector | Status | Sources |
|-----------|--------|---------|
| RSS Aggregator | ✅ Active | Yahoo Finance, MarketWatch, Reuters, CNBC |
| GDELT | 🔮 Future | Global news events |
| Refinitiv | 🔮 Future | Premium financial news |

### Connector Chain Pattern

Connectors are tried in order. If one fails, the next is attempted:

```typescript
const marketChain = createMarketDataChain();
// Tries: Yahoo → Alpha Vantage → Mock

const newsChain = createNewsChain();
// Tries: RSS → Mock
```

---

## Confidence Rating System

Every recommendation includes a confidence score:

```typescript
{
  confidence: 0.75,  // Overall confidence (0-1)
  confidenceFactors: {
    technicalSignal: 0.8,      // Price/volume pattern strength
    agendaClarity: 0.6,        // Narrative signal clarity
    dataCompleteness: 0.9,     // Did we have full data?
    historicalAccuracy: 0.7,   // Past accuracy on this instrument
  },
  confidenceExplanation: "Strong technical setup with moderate agenda uncertainty"
}
```

### Confidence Calibration

We track whether high-confidence predictions actually perform better:

```sql
SELECT
  CASE
    WHEN confidence >= 0.7 THEN 'high'
    WHEN confidence >= 0.4 THEN 'medium'
    ELSE 'low'
  END as confidence_level,
  COUNT(*) as predictions,
  AVG(CASE WHEN win_loss = 'win' THEN 1 ELSE 0 END) as actual_win_rate
FROM finance.recommendations r
JOIN finance.recommendation_outcomes o ON o.recommendation_id = r.id
GROUP BY 1;
```

If high-confidence predictions don't outperform, we recalibrate.

---

## Frontend Components

### Custom UI Pane (`FinanceTab.vue`)

Three-tab interface when agent is selected:

1. **Config Tab**
   - Universe selection
   - Version selection (shows instruments)
   - Timing window checkboxes
   - Lookback period slider
   - "Start Research Run" button

2. **Progress Tab**
   - Real-time progress steps
   - SSE streaming status
   - Current step indicator

3. **Recommendations Tab**
   - Stats summary (total, wins, losses, win rate)
   - Recommendation cards with:
     - Instrument, action, timing
     - Confidence badge
     - Outcome (if evaluated)
     - Rationale
     - Postmortem (expandable)
   - "Evaluate Pending" button

### Admin Page (`FinanceUniversesPage.vue`)

- Stats overview (universes, instruments, recommendations, win rate)
- Universe cards with CRUD actions
- Version management modal
- Instrument list editor

### History Dashboard (v2)

- Calendar view of daily predictions
- Performance charts over time
- Drill-down to day detail
- "What We Missed" section

---

## Configuration

### Environment Variables

```bash
# Alpha Vantage API Key (optional, for market data)
ALPHA_VANTAGE_API_KEY=your_key_here

# LLM Configuration (inherited from ExecutionContext)
# Default: Anthropic Claude for analysis
```

### Universe Configuration

```json
{
  "instruments": [
    { "symbol": "AAPL", "name": "Apple Inc.", "type": "stock" },
    { "symbol": "MSFT", "name": "Microsoft Corp.", "type": "stock" }
  ],
  "marketHours": "09:30-16:00",
  "timezone": "America/New_York",
  "timingWindows": ["pre_close", "post_close", "pre_open", "intraday"],
  "dataSourceProfile": {
    "marketData": ["yahoo", "alpha_vantage"],
    "news": ["rss"]
  }
}
```

---

## Testing

### Unit Tests

```bash
# LangGraph tests
npm test -- apps/langgraph/src/agents/finance/

# API tests
npm test -- apps/api/src/finance/
```

### Test Files

| File | Coverage |
|------|----------|
| `finance.controller.spec.ts` | Controller endpoints |
| `finance.service.spec.ts` | Service business logic |
| `evaluation.service.spec.ts` | Evaluation workflow |
| `connectors/*.spec.ts` | Data connector mocks |

### Integration Testing

```bash
# With real database
E2E_TESTS=true npm test -- apps/langgraph/src/agents/finance/
```

---

## Monitoring & Observability

### Key Metrics

| Metric | Description |
|--------|-------------|
| `finance.runs.total` | Total recommendation runs |
| `finance.runs.duration_ms` | Run execution time |
| `finance.recommendations.count` | Recommendations generated |
| `finance.recommendations.win_rate` | Rolling win rate |
| `finance.confidence.calibration` | Predicted vs actual accuracy |
| `finance.sources.reliability` | Per-source success rate |
| `finance.missed.count` | Missed opportunities detected |

### Logging

All services use structured logging with correlation via `taskId`:

```typescript
this.logger.log({
  taskId: context.taskId,
  step: 'generate_recommendations',
  instrumentCount: instruments.length,
  duration: Date.now() - startTime
});
```

---

## Roadmap

### v1 (Complete)
- [x] Market data ingestion (Yahoo, Alpha Vantage)
- [x] News ingestion (RSS)
- [x] Agenda/manipulation extraction
- [x] Multi-timing recommendations
- [x] Outcome evaluation
- [x] Postmortem generation
- [x] Custom UI pane
- [x] Admin universe management

### v2 (In Progress)
- [ ] Complete learning loop (wire postmortems to recommendations)
- [ ] Service decomposition (expert services)
- [ ] Three-stage prediction pipeline
  - [ ] Stage 1: 12 specialists (4 teams x 3 specialists)
  - [ ] Stage 2: 5 evaluators (red team)
  - [ ] Stage 3: Risk profile packaging
- [ ] User preferences and configuration
- [ ] "What We Missed" analysis
- [ ] Universe history dashboard
- [ ] Reactive/event-driven mode (watches)

### v3 (Future)
- [ ] Source attribution & tracking
- [ ] Source discovery pipeline
- [ ] A/B testing for prediction models
- [ ] Multi-universe correlation analysis
- [ ] Automated confidence recalibration
- [ ] Bloomberg/Refinitiv connectors
- [ ] Local model integration for cost optimization

---

## Reactive Mode (v2)

Beyond scheduled runs, the system can monitor for triggers and execute predictions reactively.

### Watch Types

| Trigger | Description |
|---------|-------------|
| **News Break** | Breaking news mentioning universe instruments |
| **Price Move** | Significant price change (e.g., >5%) |
| **Volume Spike** | Unusual volume (e.g., 3x average) |
| **Scheduled** | Cron-like schedule (e.g., 9 AM daily) |
| **Agenda Signal** | Manipulation/agenda detected |

### Watch Configuration

```typescript
{
  trigger_type: 'price_move',
  trigger_config: {
    threshold_pct: 5,
    direction: 'both',
    timeframe_minutes: 30
  },
  risk_profile_id: 'balanced',
  cooldown_minutes: 60,
  notify_email: true
}
```

When triggered, the watch executes the full three-stage pipeline and notifies the user.

---

## Contributing

### Adding a New Connector

1. Implement the interface in `connectors/`:
   ```typescript
   export class MyConnector implements MarketDataConnector {
     readonly name = 'my-connector';
     isConfigured(): boolean { ... }
     fetchBars(symbols, since, until): Promise<MarketBar[]> { ... }
     fetchQuotes(symbols): Promise<MarketBar[]> { ... }
   }
   ```

2. Add to connector factory in `connectors/connector.factory.ts`

3. Add to chain in `connectors/index.ts`

4. Write tests in `connectors/my-connector.spec.ts`

### Adding a New Service

1. Create service file: `my-feature.service.ts`
2. Follow single-responsibility principle
3. Inject via NestJS DI in module
4. Add to graph nodes if part of workflow
5. Write comprehensive tests

---

## License

Internal use only. Part of Orchestrator AI platform.

---

*Built with LangGraph, NestJS, Vue.js, and a commitment to continuous improvement.*
