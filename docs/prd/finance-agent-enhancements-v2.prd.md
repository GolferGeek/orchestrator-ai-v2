# PRD: Finance Research Agent Enhancements v2

## Overview

The Finance Research Learning-Loop Agent v1 is operational with market data ingestion, news analysis, agenda extraction, multi-timing recommendations, and outcome evaluation. This PRD defines enhancements to transform it from a prediction system into a **self-improving intelligence system**.

### Core Philosophy

> "We don't just learn from our predictions. We learn from the entire opportunity set."

---

## Problem Statements

### P1: Learning Loop Not Fully Wired
The architecture stores postmortems and lessons, but `getLearningContext()` returns a placeholder. The feedback loop from outcomes → future predictions is incomplete.

### P2: Source Blindness
We use multiple data sources (Yahoo Finance, Alpha Vantage, RSS feeds) but don't track which sources contributed to successful vs. failed predictions. We can't improve what we can't measure.

### P3: No Prediction Confidence
All predictions appear equal. A weak signal looks the same as a strong signal. Users can't prioritize, and we can't correlate confidence with accuracy.

### P4: Missing Operational Visibility
The UI is conversation-focused. There's no way to see historical performance across days/weeks, track a universe's evolution, or review the prediction journal.

### P5: Survivorship Bias in Learning
We only learn from what we predicted. We ignore the larger universe of opportunities we missed. A +20% move we didn't predict teaches us nothing.

### P6: Single Perspective Predictions
One model = one perspective. We generate a single "best guess" instead of exploring the full range of possibilities. An aggressive trader and a conservative trader would make different predictions—both valid.

### P7: Monolithic Service Design
Large services that do many things are hard to test, hard to replace, and hard to understand. We need expert services with single responsibilities.

---

## Architectural Principles

Before diving into solutions, let's establish the architectural foundation.

### Principle 1: Expert Services, Not Monoliths

Every service should be an expert in exactly one thing. This enables:
- **Testability**: Unit test each service in isolation
- **Replaceability**: Swap implementations without touching other code
- **Observability**: Track performance per service
- **Scalability**: Scale heavy services independently
- **Clarity**: Understand the system by understanding small pieces

**Proposed Service Decomposition**:

| Service | Single Responsibility |
|---------|----------------------|
| `MarketDataService` | Fetch & store OHLCV data |
| `NewsIngestionService` | Fetch & store news items |
| `AgendaExtractionService` | LLM-based narrative detection |
| `FeatureBuildingService` | Derive technical & sentiment features |
| `RecommendationService` | Generate predictions with confidence |
| `OutcomeEvaluationService` | Compute win/loss from realized prices |
| `PostmortemService` | LLM analysis of outcomes |
| `MissedOpportunityService` | Find & analyze what we didn't predict |
| `LearningContextService` | Aggregate lessons for future predictions |
| `SourcePerformanceService` | Track & analyze source quality |
| `ConfidenceCalibrationService` | Adjust confidence based on actual accuracy |

Each service:
- Has a single public interface
- Owns its own data access patterns
- Can be mocked completely in tests
- Can be replaced with an alternative implementation

### Principle 2: Three-Stage Prediction Pipeline

Instead of one predictor generating one "best guess," we deploy a **three-stage pipeline** with specialized teams:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                       STAGE 1: PREDICTION GENERATION                             │
│  Analyst teams organized by data dimension, each with sub-specialists            │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐            │
│  │  TECHNICAL TEAM   │  │ FUNDAMENTAL TEAM  │  │  SENTIMENT TEAM   │            │
│  ├───────────────────┤  ├───────────────────┤  ├───────────────────┤            │
│  │ • Momentum        │  │ • Value           │  │ • News Flow       │            │
│  │ • Reversion       │  │ • Growth          │  │ • Social Mood     │            │
│  │ • Pattern         │  │ • Quality         │  │ • Narrative Shift │            │
│  └─────────┬─────────┘  └─────────┬─────────┘  └─────────┬─────────┘            │
│            │                      │                      │                       │
│  ┌─────────┴───────────────────────────────────────────────────────┐            │
│  │                      AGENDA TEAM                                 │            │
│  ├──────────────────────────────────────────────────────────────────┤            │
│  │ • Manipulation Detector  • Coordinated Narrative  • FUD Detector │            │
│  └─────────────────────────────────────┬────────────────────────────┘            │
│                                        │                                         │
└────────────────────────────────────────┼─────────────────────────────────────────┘
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                       STAGE 2: CHALLENGE & REFINE                                │
│  Evaluator red team actively pokes holes in predictions                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │  Devil's    │  │    Risk     │  │    Data     │  │ Historical  │            │
│  │  Advocate   │  │  Assessor   │  │   Skeptic   │  │  Matcher    │            │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘            │
│         │                │                │                │                    │
│         └────────────────┼────────────────┼────────────────┘                    │
│                          │                │                                      │
│                    ┌─────┴────────────────┴─────┐                               │
│                    │    Confidence Calibrator    │                               │
│                    └─────────────┬───────────────┘                               │
│                                  │                                               │
└──────────────────────────────────┼───────────────────────────────────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                       STAGE 3: RISK-PROFILE PACKAGING                            │
│  Clean output per risk profile (complexity hidden, not exposed)                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│     ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐          │
│     │   AGGRESSIVE    │    │    BALANCED     │    │  CONSERVATIVE   │          │
│     │   PORTFOLIO     │    │    PORTFOLIO    │    │    PORTFOLIO    │          │
│     ├─────────────────┤    ├─────────────────┤    ├─────────────────┤          │
│     │ Higher risk     │    │ Medium risk     │    │ Lower risk      │          │
│     │ More trades     │    │ Selective       │    │ Fewer trades    │          │
│     │ Momentum bias   │    │ Balanced        │    │ Quality bias    │          │
│     └─────────────────┘    └─────────────────┘    └─────────────────┘          │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Stage 1: Analyst Teams by Data Dimension**

| Team | Sub-Specialists | Focus Area |
|------|-----------------|------------|
| **Technical** | Momentum, Reversion, Pattern | Price/volume/chart analysis |
| **Fundamental** | Value, Growth, Quality | Financial metrics, valuations |
| **Sentiment** | News Flow, Social Mood, Narrative Shift | Market psychology |
| **Agenda** | Manipulation, Coordinated Narrative, FUD | Detect artificial signals |

Each sub-specialist generates independent predictions with rationale.

**Stage 2: Evaluator Red Team**

The evaluators don't just score—they **actively poke holes** in predictions:

| Evaluator | Role | What They Challenge |
|-----------|------|---------------------|
| **Devil's Advocate** | Find the counter-argument | "What if this is wrong because..." |
| **Risk Assessor** | Quantify downside scenarios | "Worst case is X% loss because..." |
| **Data Skeptic** | Question data quality | "This relies on news that might be..." |
| **Historical Matcher** | Find similar past situations | "Last time this pattern appeared..." |
| **Confidence Calibrator** | Final confidence assignment | "Given all challenges, confidence is..." |

**Stage 3: Risk-Profile Packaging**

Users get **clean output** per their risk profile—not a metadata soup. The complexity exists but is hidden:

- **Aggressive Portfolio**: Higher-confidence momentum plays, more positions
- **Balanced Portfolio**: Mix of technical and fundamental signals
- **Conservative Portfolio**: Only highest-conviction trades, capital preservation focus

**Key Design Decisions**:
1. **Shared personas, per-universe tracking**: Same analyst personas across all universes, but performance tracked per-universe
2. **User configurable**: Risk profile selected at run start, preferences stored as defaults
3. **LLM cost acceptable**: Quality over cost—use Sonnet for complex analysis, Haiku/local for high-volume tasks
4. **Clean output philosophy**: Users see actionable recommendations, not internal debate logs

---

## Proposed Solutions

### Enhancement 1: Complete the Learning Loop

**Goal**: Wire postmortem lessons into recommendation generation.

**Changes**:

1. **Update `getLearningContext()` in evaluation.service.ts**:
   ```typescript
   async getLearningContext(instruments: string[], limit: number = 10): Promise<LearningContext> {
     // Query recent postmortems for these instruments
     const postmortems = await this.financeDb.getRecentPostmortems(instruments, limit);

     // Query instrument-specific win rates
     const instrumentStats = await this.financeDb.getInstrumentPerformance(instruments);

     // Format as structured context
     return {
       recentLessons: postmortems.map(p => p.lessons).flat(),
       instrumentInsights: instrumentStats,
       patternWarnings: this.extractPatternWarnings(postmortems),
       formattedPrompt: this.formatForLLM(postmortems, instrumentStats)
     };
   }
   ```

2. **Inject learning context into recommendation generation** (finance.graph.ts):
   ```typescript
   // In generateRecommendationsNode, before calling LLM:
   const learningContext = await evaluationService.getLearningContext(
     state.instruments.map(i => i.symbol)
   );

   const systemMessage = `...

   LEARNING FROM PAST PREDICTIONS:
   ${learningContext.formattedPrompt}

   Apply these lessons to your current recommendations.`;
   ```

3. **New database function**:
   ```sql
   CREATE FUNCTION finance.get_instrument_lessons(
     p_instruments TEXT[],
     p_limit INTEGER DEFAULT 10
   ) RETURNS TABLE (
     instrument TEXT,
     lesson TEXT,
     outcome TEXT,
     created_at TIMESTAMPTZ
   );
   ```

**Success Metric**: Recommendations should cite past lessons in their rationale.

---

#### Learning Context Architecture (Hybrid: Context Files + RAG)

The learning loop uses a **hybrid approach** combining:
1. **Context Files** - Curated, always-present knowledge per entity type
2. **RAG Collections** - Semantic retrieval of situational lessons

**Context Files** (always in prompt):

```
apps/langgraph/src/agents/finance/context/
├── stocks.md           # General stock trading wisdom
├── crypto.md           # Crypto-specific patterns (24/7, volatility, whale moves)
├── etfs.md             # ETF-specific (NAV discount/premium, sector correlation)
├── core-lessons.md     # Top 20-30 universal lessons (consolidated from RAG)
└── universe-specific/
    └── {universe-slug}.md  # Optional per-universe notes
```

Each context file is human-editable (or AI-editable with review) and contains stable, high-value knowledge that should always be considered regardless of what's being analyzed.

**RAG Collections** (semantic retrieval, uses existing `rag_data` schema):

We leverage the existing RAG infrastructure (`rag_data` schema) with finance-specific collections:

| Collection Slug | Purpose | Indexed Metadata | Retrieved When |
|-----------------|---------|------------------|----------------|
| `finance-lessons` | Individual postmortem lessons | `instrument`, `pattern_type`, `outcome`, `specialist` | Making prediction for same instrument/pattern |
| `finance-missed-opportunities` | Signals we should have caught | `instrument`, `signal_types[]`, `move_pct` | Seeing similar signals now |
| `finance-specialist-insights` | Per-specialist learned adjustments | `specialist_slug`, `instrument`, `bias_direction` | That specialist runs on that instrument |
| `finance-market-regimes` | Macro conditions and their effects | `regime_type`, `date_range`, `affected_sectors[]` | Current market conditions similar |

**Collection Setup** (one-time, via API or migration):

```typescript
// Create finance RAG collections using existing RAG service
await ragCollectionsService.createCollection('finance', {
  name: 'Finance Lessons',
  slug: 'finance-lessons',
  description: 'Postmortem lessons from predictions and missed opportunities',
  embeddingModel: 'nomic-embed-text',
  chunkSize: 500,      // Lessons are short
  chunkOverlap: 50,
  complexityType: 'attributed',  // Track source document IDs
});
```

**Lesson Document Structure** (stored in RAG):

```typescript
interface LessonDocument {
  // Document-level (stored in rag_documents.metadata)
  lessonType: 'postmortem' | 'missed_opportunity' | 'specialist_insight';
  instrument: string;
  patternType?: string;  // 'earnings_play', 'momentum_breakout', etc.
  outcome: 'win' | 'loss' | 'neutral';
  specialistSlug?: string;
  predictionDate: string;

  // Content (stored in rag_documents.content, then chunked)
  content: string;  // The actual lesson text
}

// Example lesson content:
`
LESSON: AAPL Earnings Play - Loss (-2.3%)

PREDICTION: BUY with 75% confidence before Q4 earnings
OUTCOME: Stock dropped 2.3% post-earnings despite beat

WHAT HAPPENED:
- Earnings beat expectations by 4%
- Revenue guidance was slightly below consensus
- Market had already priced in the beat (stock up 8% in prior 2 weeks)

LESSON LEARNED:
Pre-earnings run-ups often price in the expected beat. When a stock is up
significantly going into earnings, even a beat can result in "sell the news."
Lower confidence for earnings plays when stock has rallied >5% in prior 2 weeks.

TAGS: earnings, pre-priced, sell-the-news, momentum-exhaustion
`
```

**Lesson Lifecycle**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LESSON LIFECYCLE                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. CAPTURE                                                                  │
│     Prediction Made → Outcome Observed → Postmortem Generated               │
│     ├── LLM analyzes what happened and why                                  │
│     └── Structured lesson document created                                  │
│                                                                              │
│  2. STORE                                                                    │
│     Lesson Document → RAG Ingestion Pipeline                                │
│     ├── Document stored in rag_documents                                    │
│     ├── Chunked and embedded via existing RAG service                       │
│     └── Indexed with metadata (instrument, pattern, outcome)                │
│                                                                              │
│  3. CONSOLIDATE (Weekly)                                                     │
│     LLM reviews recent lessons → Identifies patterns                        │
│     ├── High-value lessons promoted to core-lessons.md                      │
│     ├── Specialist biases updated in specialist-insights collection        │
│     └── Stale/redundant lessons archived                                    │
│                                                                              │
│  4. RETRIEVE (At prediction time)                                           │
│     Query: instruments + current signals + specialist                       │
│     ├── Always include: context files (stocks.md, core-lessons.md)         │
│     ├── RAG query: similar past lessons for these instruments              │
│     ├── RAG query: missed opportunities with similar signals               │
│     └── Specialist calibration: historical bias for this specialist        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**LearningContextService Implementation**:

```typescript
@Injectable()
export class LearningContextService {
  constructor(
    private readonly ragQueryService: RagQueryService,
    private readonly financeDb: FinanceDbService,
  ) {}

  /**
   * Build complete learning context for a specialist making predictions
   */
  async getContextForSpecialist(params: {
    specialist: string;
    instruments: string[];
    currentSignals: string[];
    entityType: 'stock' | 'crypto' | 'etf';
  }): Promise<LearningContext> {

    // 1. Load entity-type context file (always present)
    const entityContext = await this.loadContextFile(`${params.entityType}s.md`);

    // 2. Load core lessons (always present)
    const coreLessons = await this.loadContextFile('core-lessons.md');

    // 3. RAG: Find relevant past lessons for these instruments
    const lessonsQuery = await this.ragQueryService.query({
      collectionSlug: 'finance-lessons',
      query: `${params.instruments.join(' ')} ${params.currentSignals.join(' ')}`,
      topK: 5,
      filter: {
        instrument: { $in: params.instruments },
      },
    });

    // 4. RAG: Find similar missed opportunities
    const missedQuery = await this.ragQueryService.query({
      collectionSlug: 'finance-missed-opportunities',
      query: params.currentSignals.join(' '),
      topK: 3,
      filter: {
        instrument: { $in: params.instruments },
      },
    });

    // 5. Get specialist calibration from DB (not RAG - structured data)
    const calibration = await this.financeDb.getSpecialistCalibration(
      params.specialist,
      params.instruments,
    );

    return {
      // Always in context
      coreContext: `${entityContext}\n\n${coreLessons}`,

      // Retrieved lessons
      relevantLessons: lessonsQuery.results.map(r => r.content),

      // Similar misses
      similarMisses: missedQuery.results.map(r => ({
        summary: r.content,
        signals: r.metadata?.signalTypes,
        movePct: r.metadata?.movePct,
      })),

      // Specialist adjustment
      specialistCalibration: calibration,

      // Formatted for LLM prompt
      formattedPrompt: this.formatForPrompt({
        entityContext,
        coreLessons,
        lessons: lessonsQuery.results,
        misses: missedQuery.results,
        calibration,
      }),
    };
  }

  /**
   * Store a new lesson in RAG after postmortem
   */
  async storeLesson(lesson: {
    type: 'postmortem' | 'missed_opportunity';
    instrument: string;
    patternType: string;
    outcome: 'win' | 'loss' | 'neutral';
    content: string;
    specialistSlug?: string;
  }): Promise<void> {
    const collectionSlug = lesson.type === 'missed_opportunity'
      ? 'finance-missed-opportunities'
      : 'finance-lessons';

    await this.ragDocumentsService.createAndProcess({
      collectionSlug,
      content: lesson.content,
      filename: `${lesson.instrument}-${lesson.patternType}-${Date.now()}.md`,
      metadata: {
        instrument: lesson.instrument,
        patternType: lesson.patternType,
        outcome: lesson.outcome,
        specialistSlug: lesson.specialistSlug,
        createdAt: new Date().toISOString(),
      },
    });
  }
}
```

**Example Context File** (`stocks.md`):

```markdown
# Stock Trading Context

## Universal Principles

1. **Earnings are Binary Events**: Treat earnings as coin flips with asymmetric outcomes.
   Lower confidence for any earnings-related prediction.

2. **Volume Confirms Price**: A move without volume is suspect. Require 1.5x average
   volume to consider a breakout valid.

3. **Mean Reversion is Real**: Extended moves (RSI > 70 or < 30) tend to revert.
   The further from mean, the higher reversion probability.

4. **News is Usually Priced In**: By the time news hits mainstream, smart money has
   already positioned. Be skeptical of "breaking news" trades.

## Sector-Specific Notes

### Tech (AAPL, MSFT, GOOGL, etc.)
- High correlation to NASDAQ, SPY
- Sensitive to interest rate expectations
- Earnings reactions often outsized

### Financials (JPM, BAC, GS, etc.)
- Yield curve sensitive
- Credit cycle dependent
- Often lead market turns

## Common Pitfalls

- **FOMO Trades**: Chasing moves that have already happened
- **Confirmation Bias**: Finding reasons to support a predetermined view
- **Overconfidence After Wins**: Each trade is independent
```

**Success Metrics**:
- Specialists cite retrieved lessons in their rationale
- Fewer repeated mistakes (same pattern → same failure)
- Missed opportunity patterns decrease over time
- Core lessons file grows with genuinely valuable insights

---

#### HITL Insights Sessions (Human-in-the-Loop Learning)

The learning loop includes an **on-demand human-AI collaboration session** for reviewing history and distilling insights. This is NOT part of any automated flow - it's a separate admin interface that a user initiates when they want to work with the AI to improve the system.

**Concept**: Like pair programming, but for learning from prediction history. The AI can analyze RAG history at scale (find patterns humans can't see), and the human provides judgment, context, and approval.

**Session Flow**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      HITL INSIGHTS SESSION                                   │
│                  (User-initiated, conversational)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  USER: "Let's review insights from the past month"                          │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ AI ANALYSIS (queries RAG, finds patterns)                              │ │
│  │                                                                         │ │
│  │ "I've analyzed 47 postmortems and 12 missed opportunities. Here's     │ │
│  │  what I'm noticing:                                                    │ │
│  │                                                                         │ │
│  │  1. PATTERN: Momentum specialist is consistently overconfident on      │ │
│  │     AAPL by ~15%. 8 of 11 AAPL momentum calls were losses.            │ │
│  │                                                                         │ │
│  │  2. PATTERN: We're missing volume spikes on Fridays. 4 missed         │ │
│  │     opportunities happened Friday afternoon.                           │ │
│  │                                                                         │ │
│  │  3. CONTRADICTION: Our 'earnings are binary' principle worked for     │ │
│  │     tech but failed for financials. JPM and BAC earnings plays        │ │
│  │     were 5/6 wins."                                                    │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  USER: "Tell me more about the AAPL momentum issue"                         │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ AI DEEP DIVE                                                           │ │
│  │                                                                         │ │
│  │ "Looking at the 8 AAPL losses from Momentum specialist:               │ │
│  │  - 6 occurred when RSI was already >70                                │ │
│  │  - 5 occurred within 2 weeks of earnings                              │ │
│  │  - Average confidence was 0.78, but win rate was only 27%             │ │
│  │                                                                         │ │
│  │  Suggested lesson: 'For AAPL, reduce momentum confidence by 20%      │ │
│  │  when RSI >70 or within 2 weeks of earnings.'                         │ │
│  │                                                                         │ │
│  │  Should I add this to the lessons?"                                    │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  USER: "Yes, and also update the stocks.md context file"                    │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ AI ACTIONS                                                             │ │
│  │                                                                         │ │
│  │ ✓ Added lesson to RAG (finance-specialist-insights collection)        │ │
│  │ ✓ Updated stocks.md - added to "Tech (AAPL, MSFT...)" section:        │ │
│  │                                                                         │ │
│  │   "- AAPL momentum signals less reliable when RSI >70 or near         │ │
│  │      earnings. Reduce confidence by 20% in these conditions."         │ │
│  │                                                                         │ │
│  │ Want me to continue with the Friday volume spike pattern?              │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Characteristics**:

1. **User-Initiated**: Not scheduled, not automated. User decides when to review.
2. **Conversational**: Back-and-forth dialogue, not a form or wizard.
3. **AI Does Heavy Lifting**: Queries RAG, finds patterns, suggests lessons.
4. **Human Provides Judgment**: Approves, modifies, or rejects AI suggestions.
5. **Actions Require Approval**: AI proposes changes, human approves before execution.

**What the AI Can Do** (with human approval):

| Action | Description |
|--------|-------------|
| **Add lesson to RAG** | Store a new insight in finance-lessons collection |
| **Update context file** | Modify stocks.md, crypto.md, core-lessons.md, etc. |
| **Create new context file** | Add universe-specific/{slug}.md for new universe |
| **Flag for review** | Mark contradictions or anomalies for deeper analysis |
| **Archive stale lessons** | Mark old lessons as superseded by new insights |
| **Update specialist calibration** | Adjust confidence bias for specific specialists |

**Session Storage**:

```sql
-- Track insights sessions for continuity
CREATE TABLE finance.insights_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,

  -- Session state (for resumption)
  conversation_history JSONB,  -- Full conversation for context
  pending_actions JSONB,       -- Actions proposed but not yet approved
  completed_actions JSONB,     -- Actions that were executed

  -- Scope
  date_range_start DATE,
  date_range_end DATE,
  instruments_reviewed TEXT[],

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track individual actions taken during sessions
CREATE TABLE finance.insights_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES finance.insights_sessions(id),

  action_type TEXT NOT NULL,  -- 'add_lesson', 'update_context', 'archive_lesson', etc.
  action_details JSONB,       -- What was changed

  -- Approval tracking
  proposed_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Execution
  executed_at TIMESTAMPTZ,
  execution_result JSONB
);
```

**UI Location**: Admin section, "Insights Review" or "Learning Session" - a chat-like interface with the AI that has access to RAG history and can propose/execute actions.

**Implementation Notes**:

1. Uses existing LangGraph HITL patterns (interrupt for approval)
2. AI has read access to all RAG collections
3. AI has write access to RAG and context files, but only executes with approval
4. Session can be paused and resumed (conversation history stored)
5. All actions are logged for audit trail

**Example Context File Update Flow**:

```typescript
// AI proposes an update to stocks.md
const proposal = {
  action: 'update_context_file',
  file: 'stocks.md',
  section: 'Tech (AAPL, MSFT, GOOGL, etc.)',
  change: {
    type: 'append',
    content: '- AAPL momentum signals less reliable when RSI >70 or near earnings.',
  },
  rationale: 'Based on 8 losses from Momentum specialist on AAPL with these conditions.',
};

// Human approves
await insightsSession.approveAction(proposal.id);

// System executes
await contextFileService.updateFile(proposal.file, proposal.section, proposal.change);
await insightsActionsService.markExecuted(proposal.id);
```

**Success Metrics**:
- Sessions result in actionable context file updates
- Insights correlate with improved future predictions
- Users find value in the collaborative review process
- Context files grow with human-validated wisdom

---

### Enhancement 2: Source Attribution & Evaluation

**Goal**: Track which sources contribute to predictions and measure source quality.

**New Tables**:

```sql
-- Track which sources contributed to each recommendation
CREATE TABLE finance.source_attributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID REFERENCES finance.recommendations(id),
  source_type TEXT NOT NULL CHECK (source_type IN ('market_data', 'news', 'agenda')),
  source_name TEXT NOT NULL,  -- 'yahoo-finance', 'reuters-rss', etc.
  source_item_id TEXT,        -- Reference to specific news_item or market_bar
  contribution_weight NUMERIC(3,2) DEFAULT 0.5,  -- 0-1, how much this influenced decision
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Materialized view for source performance
CREATE MATERIALIZED VIEW finance.source_performance AS
SELECT
  sa.source_name,
  sa.source_type,
  COUNT(DISTINCT sa.recommendation_id) as total_contributions,
  COUNT(DISTINCT CASE WHEN ro.win_loss = 'win' THEN sa.recommendation_id END) as wins,
  COUNT(DISTINCT CASE WHEN ro.win_loss = 'loss' THEN sa.recommendation_id END) as losses,
  ROUND(
    COUNT(DISTINCT CASE WHEN ro.win_loss = 'win' THEN sa.recommendation_id END)::NUMERIC /
    NULLIF(COUNT(DISTINCT CASE WHEN ro.win_loss IS NOT NULL THEN sa.recommendation_id END), 0),
    4
  ) as win_rate,
  AVG((ro.realized_return_metrics_json->>'returnPct')::NUMERIC) as avg_return
FROM finance.source_attributions sa
LEFT JOIN finance.recommendations r ON r.id = sa.recommendation_id
LEFT JOIN finance.recommendation_outcomes ro ON ro.recommendation_id = r.id
GROUP BY sa.source_name, sa.source_type;

-- Track source discovery candidates
CREATE TABLE finance.source_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT,
  discovery_method TEXT,  -- 'manual', 'llm_suggested', 'similar_to_successful'
  status TEXT DEFAULT 'candidate' CHECK (status IN ('candidate', 'testing', 'active', 'rejected')),
  test_start_date TIMESTAMPTZ,
  test_results JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_type, source_name)
);
```

**Workflow Changes**:

1. During recommendation generation, track which sources were consulted
2. Store attributions with contribution weights
3. Refresh `source_performance` view after evaluation runs
4. Expose API endpoint: `GET /finance/sources/performance`
5. Add "Source Quality" section to admin UI

**Source Discovery Process**:
1. Weekly job: Ask LLM "What other data sources might help predict [instruments]?"
2. Add suggestions to `source_candidates` with status='candidate'
3. Manual review → promote to 'testing'
4. Run in shadow mode for 2 weeks
5. Evaluate performance → promote to 'active' or 'rejected'

---

### Enhancement 3: Prediction Confidence Rating

**Goal**: Every prediction has a confidence score with explainable factors.

**Schema Changes**:

```sql
-- Add to recommendations table (or store in model_metadata)
ALTER TABLE finance.recommendations
ADD COLUMN confidence NUMERIC(3,2) CHECK (confidence >= 0 AND confidence <= 1),
ADD COLUMN confidence_factors JSONB DEFAULT '{}';
```

**Confidence Factors Structure**:
```typescript
interface ConfidenceFactors {
  // Individual factor scores (0-1)
  technicalSignal: number;      // Strength of price/volume patterns
  agendaClarity: number;        // How clear the narrative signals are
  dataCompleteness: number;     // Did we have full data?
  historicalAccuracy: number;   // Our past accuracy on this instrument
  consensusAlignment: number;   // Do multiple signals agree?

  // Overall confidence (weighted average)
  overall: number;

  // Human-readable explanation
  explanation: string;
}
```

**LLM Prompt Addition**:
```
For each recommendation, also provide a confidence assessment:
- technicalSignal (0-1): How strong are the technical indicators?
- agendaClarity (0-1): How clear are the narrative/manipulation signals?
- historicalAccuracy (0-1): Based on past performance with this instrument
- overall (0-1): Your overall confidence in this recommendation

Explain your confidence rating in 1-2 sentences.
```

**UI Changes**:
- Display confidence badge on each recommendation (Low/Medium/High or percentage)
- Color coding: Red (<40%), Yellow (40-70%), Green (>70%)
- Expandable section showing confidence factors
- Filter recommendations by confidence level

**Learning Integration**:
- Track: Do high-confidence predictions actually perform better?
- If not, adjust the confidence calculation
- Add to postmortem: "Confidence was X, outcome was Y, calibration error: Z"

---

### Enhancement 4: Live Recommendations Dashboard

**Goal**: Primary view of current/live recommendations with accessible history. Users see accumulated recommendations when they return to the system.

**Design Philosophy**: The primary view is **what's happening right now**. History is accessible but secondary. Instead of calendar-based navigation, users see an ongoing chronological list of recommendations that accumulates over time.

---

#### Primary View: Live Recommendations Stream

**Universe Detail View** (`/finance/universes/:id`)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Tech Giants v2.1                                      [⚙ Settings] [📊 Analytics]│
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │ 🔔 12 new recommendations since your last visit (3 hours ago)               ││
│  │    [Mark all as seen]                                                       ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │ AAPL - BUY                                          Today 2:34 PM   [NEW]   ││
│  │ Confidence: 78%  │  Timing: Pre-Close                                       ││
│  │ Strong momentum with quality fundamentals.                                   ││
│  │ [Show Detail ▼]                                                             ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │ MSFT - HOLD                                         Today 2:34 PM   [NEW]   ││
│  │ Confidence: 65%  │  Timing: Post-Close                                      ││
│  │ Awaiting earnings report. Neutral until clarity.                            ││
│  │ [Show Detail ▼]                                                             ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
│  ─────────────────────── Earlier Today ───────────────────────                   │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │ NVDA - BUY                                          Today 9:15 AM           ││
│  │ Confidence: 82%  │  Outcome: ✅ WIN +3.2%                                   ││
│  │ AI demand narrative confirmed by volume spike.                              ││
│  │ [Show Detail ▼]                                                             ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
│  ─────────────────────── Yesterday ───────────────────────                       │
│                                                                                  │
│  [...more recommendations...]                                                    │
│                                                                                  │
│  [Load More History ▼]                                                           │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

#### Expanded Recommendation Detail

When user clicks "Show Detail ▼" on a recommendation:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ AAPL - BUY                                             Today 2:34 PM            │
│ Confidence: 78%  │  Timing: Pre-Close                                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│ RATIONALE                                                                        │
│ Strong momentum with quality fundamentals. Technical breakout confirmed by       │
│ volume. No significant manipulation detected.                                    │
│                                                                                  │
│ ────────────────────────────────────────────────────────────────────────────────│
│                                                                                  │
│ SPECIALIST VOTES (12 analysts)                                                   │
│                                                                                  │
│ Technical Team:                                                                  │
│  • Momentum: BUY (0.85) "Strong uptrend with volume confirmation"               │
│  • Reversion: HOLD (0.55) "Extended from mean, but not extreme"                 │
│  • Pattern: BUY (0.80) "Bull flag breakout pattern"                             │
│                                                                                  │
│ Fundamental Team:                                                                │
│  • Value: HOLD (0.60) "Fairly valued at 28x earnings"                           │
│  • Growth: BUY (0.72) "Strong services revenue growth"                          │
│  • Quality: BUY (0.75) "Excellent business quality metrics"                     │
│                                                                                  │
│ Sentiment Team:                                                                  │
│  • News Flow: BUY (0.70) "Positive analyst coverage"                            │
│  • Social Mood: HOLD (0.55) "Mixed retail sentiment"                            │
│  • Narrative: BUY (0.68) "AI integration narrative gaining traction"            │
│                                                                                  │
│ Agenda Team:                                                                     │
│  • Manipulation: PASS "No pump signals detected"                                │
│  • Coordinated Narrative: PASS "Organic coverage pattern"                       │
│  • FUD: PASS "No fear campaign detected"                                        │
│                                                                                  │
│ ────────────────────────────────────────────────────────────────────────────────│
│                                                                                  │
│ CHALLENGES (Red Team)                                                            │
│                                                                                  │
│  • Devil's Advocate: "Extended valuation creates downside risk" - Minor         │
│  • Risk Assessor: "Max 8% downside to support level" - Moderate                 │
│  • Data Skeptic: "Data quality good, all sources fresh" - Pass                  │
│  • Historical Matcher: "Similar pattern in Q3 2025 led to 5% gain" - Supportive │
│                                                                                  │
│ RAW → FINAL CONFIDENCE: 82% → 78% (-4% from challenges)                         │
│                                                                                  │
│ ────────────────────────────────────────────────────────────────────────────────│
│                                                                                  │
│ DATA SOURCES                                                                     │
│  • Yahoo Finance (price data) - Weight: 0.8                                     │
│  • Reuters RSS (news) - Weight: 0.6                                             │
│  • TechCrunch RSS (news) - Weight: 0.4                                          │
│                                                                                  │
│ [Hide Detail ▲]                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

#### Views/Pages Structure

1. **Universe List View** (`/finance/universes`)
   - Card for each universe showing:
     - Name, instrument count
     - Recent activity summary ("12 new recs today")
     - Win rate badge
     - Last activity timestamp

2. **Universe Detail View** (`/finance/universes/:id`) - **Primary View**
   - Live recommendations stream (chronological, newest first)
   - "X new since last visit" notification banner
   - Infinite scroll with date separators
   - Each recommendation expandable to show full detail
   - Filter bar: All | New | Wins | Losses | By Instrument

3. **Analytics View** (`/finance/universes/:id/analytics`) - **Secondary View**
   - Performance charts (win rate over time, cumulative returns)
   - Instrument breakdown table
   - Historical statistics
   - Date range selector for deeper analysis

**API Endpoints**:
```
# Primary: Paginated recommendation stream
GET /finance/universes/:id/recommendations
  ?limit=50
  &before=<cursor>  # Pagination cursor (timestamp or ID)
  &since=<timestamp>  # For "new since last visit"
  &filter=all|new|wins|losses
  &instrument=AAPL  # Optional filter

# Secondary: Analytics data
GET /finance/universes/:id/analytics
  ?period=30d  // or 7d, 90d, all

# Mark recommendations as seen
POST /finance/universes/:id/mark-seen
  Body: { until: <timestamp> }
```

**New Database Views**:
```sql
-- Track user's last seen timestamp per universe
CREATE TABLE finance.user_universe_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  universe_id UUID REFERENCES finance.universes(id),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, universe_id)
);

-- View for recommendation stream with outcome status
CREATE VIEW finance.recommendation_stream AS
SELECT
  r.id,
  r.instrument,
  r.action,
  r.timing_window,
  r.confidence,
  r.rationale,
  r.created_at,
  rr.universe_version_id,
  uv.universe_id,
  ro.win_loss,
  ro.realized_return_metrics_json->>'returnPct' as return_pct,
  ro.evaluated_at
FROM finance.recommendations r
JOIN finance.recommendation_runs rr ON rr.id = r.run_id
JOIN finance.universe_versions uv ON uv.id = rr.universe_version_id
LEFT JOIN finance.recommendation_outcomes ro ON ro.recommendation_id = r.id
ORDER BY r.created_at DESC;

-- Daily performance for analytics view
CREATE VIEW finance.daily_performance AS
SELECT
  DATE(r.created_at) as prediction_date,
  rr.universe_version_id,
  COUNT(r.id) as total_predictions,
  COUNT(CASE WHEN ro.win_loss = 'win' THEN 1 END) as wins,
  COUNT(CASE WHEN ro.win_loss = 'loss' THEN 1 END) as losses,
  ROUND(AVG((ro.realized_return_metrics_json->>'returnPct')::NUMERIC), 4) as avg_return
FROM finance.recommendations r
JOIN finance.recommendation_runs rr ON rr.id = r.run_id
LEFT JOIN finance.recommendation_outcomes ro ON ro.recommendation_id = r.id
GROUP BY DATE(r.created_at), rr.universe_version_id;
```

---

### Enhancement 5: "What We Missed" Analysis

**Goal**: Learn from opportunities we didn't predict, not just from predictions we made.

**New Table**:
```sql
CREATE TABLE finance.missed_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  universe_version_id UUID REFERENCES finance.universe_versions(id),
  analysis_date DATE NOT NULL,
  instrument TEXT NOT NULL,

  -- What happened
  actual_move_pct NUMERIC(8,4) NOT NULL,
  move_direction TEXT CHECK (move_direction IN ('up', 'down')),

  -- What we did (or didn't do)
  our_prediction TEXT,  -- 'buy', 'sell', 'hold', or NULL if no prediction
  prediction_id UUID REFERENCES finance.recommendations(id),

  -- Analysis
  was_predictable BOOLEAN,
  predictability_score NUMERIC(3,2),  -- 0-1, how obvious was this in hindsight?

  -- What signals existed
  available_signals JSONB,  -- { newsItems: [...], technicalPatterns: [...], agendaEvents: [...] }

  -- LLM analysis
  why_we_missed TEXT,
  what_we_should_learn TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(universe_version_id, analysis_date, instrument)
);
```

**Workflow**:

1. **After daily evaluation**, run "opportunity scan":
   ```typescript
   async scanMissedOpportunities(universeVersionId: string, date: Date) {
     // Get all instruments in universe
     const instruments = await this.getUniverseInstruments(universeVersionId);

     // Get actual price moves for each instrument
     const moves = await this.marketDataChain.getDailyMoves(instruments, date);

     // Filter to significant moves (e.g., >3% either direction)
     const significantMoves = moves.filter(m => Math.abs(m.changePct) > 3);

     // Get our predictions for that day
     const ourPredictions = await this.getRecommendationsForDate(universeVersionId, date);

     // Find misses
     for (const move of significantMoves) {
       const ourPrediction = ourPredictions.find(p => p.instrument === move.instrument);

       const wasMissed =
         (move.changePct > 3 && ourPrediction?.action !== 'buy') ||
         (move.changePct < -3 && ourPrediction?.action !== 'sell');

       if (wasMissed) {
         await this.analyzeMissedOpportunity(move, ourPrediction, date);
       }
     }
   }
   ```

2. **LLM Analysis** for each missed opportunity:
   ```
   We missed a significant move:
   - Instrument: ORCL
   - Actual move: +12.5%
   - Our prediction: HOLD (or no prediction)

   Available data at the time:
   - News: [list of news items mentioning ORCL]
   - Technical: [RSI, moving averages, volume]
   - Agenda signals: [any detected narratives]

   Analyze:
   1. Was this predictable with the data we had?
   2. What signals did we miss or underweight?
   3. What should we learn for future predictions?
   ```

3. **Feed back into learning loop**:
   - Add missed opportunities to learning context
   - "In the past week, we missed these moves: [list]. Common patterns in what we missed: [analysis]"

**UI Integration**:
- "What We Missed" tab on day detail view
- Weekly summary: "Biggest misses this week"
- Over time: "Are we missing fewer opportunities?"

**Success Metrics**:
- Reduce "significant misses" over time
- Track: Predictability score of misses (are we missing obvious ones or hard ones?)
- Correlation: Do lessons from misses improve future predictions?

---

### Enhancement 6: Three-Stage Prediction Pipeline

**Goal**: Replace single-perspective predictions with a three-stage pipeline: Generation → Challenge → Risk-Profile Packaging.

**Concept**: Multiple specialized analyst teams generate predictions, an evaluator red team actively challenges them, and the system packages clean outputs per risk profile.

---

#### Stage 1: Analyst Teams (Prediction Generation)

**New Tables**:

```sql
-- Analyst teams organized by data dimension
CREATE TABLE finance.analyst_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  data_dimension TEXT NOT NULL CHECK (data_dimension IN ('technical', 'fundamental', 'sentiment', 'agenda')),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sub-specialists within each team
CREATE TABLE finance.analyst_specialists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES finance.analyst_teams(id),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  specialty TEXT NOT NULL,  -- 'momentum', 'reversion', 'pattern', etc.
  system_prompt TEXT NOT NULL,
  model_preference TEXT DEFAULT 'sonnet',  -- 'sonnet', 'haiku', 'local'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual specialist predictions
CREATE TABLE finance.specialist_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES finance.recommendation_runs(id),
  specialist_id UUID REFERENCES finance.analyst_specialists(id),
  instrument TEXT NOT NULL,

  -- Prediction
  action TEXT CHECK (action IN ('buy', 'sell', 'hold', 'no_opinion')),
  raw_confidence NUMERIC(3,2),  -- Before evaluator challenge
  timing_window TEXT,

  -- Reasoning
  rationale TEXT,
  key_signals JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track specialist performance per universe
CREATE TABLE finance.specialist_universe_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id UUID REFERENCES finance.analyst_specialists(id),
  universe_id UUID REFERENCES finance.universes(id),

  -- Metrics
  predictions_count INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  win_rate NUMERIC(5,4),
  avg_confidence NUMERIC(3,2),

  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(specialist_id, universe_id)
);
```

**Seed Data - Analyst Teams & Specialists**:

```sql
-- Technical Team
INSERT INTO finance.analyst_teams (slug, name, data_dimension, description)
VALUES ('technical', 'Technical Analysis Team', 'technical', 'Price/volume/chart analysis');

INSERT INTO finance.analyst_specialists (team_id, slug, name, specialty, system_prompt) VALUES
((SELECT id FROM finance.analyst_teams WHERE slug = 'technical'),
 'momentum', 'Momentum Analyst', 'momentum',
 'You are a momentum trader. Buy when prices are rising with volume confirmation. Sell when momentum fades. Trend is your friend.'),

((SELECT id FROM finance.analyst_teams WHERE slug = 'technical'),
 'reversion', 'Mean Reversion Analyst', 'reversion',
 'You look for oversold/overbought conditions. Prices revert to mean. Fade extreme moves. Patient for setups.'),

((SELECT id FROM finance.analyst_teams WHERE slug = 'technical'),
 'pattern', 'Chart Pattern Analyst', 'pattern',
 'You identify classic chart patterns: head-and-shoulders, flags, wedges, breakouts. Trade the pattern completion.');

-- Fundamental Team
INSERT INTO finance.analyst_teams (slug, name, data_dimension, description)
VALUES ('fundamental', 'Fundamental Analysis Team', 'fundamental', 'Financial metrics and valuations');

INSERT INTO finance.analyst_specialists (team_id, slug, name, specialty, system_prompt) VALUES
((SELECT id FROM finance.analyst_teams WHERE slug = 'fundamental'),
 'value', 'Value Analyst', 'value',
 'You seek undervalued stocks. P/E below peers, strong balance sheet, margin of safety required.'),

((SELECT id FROM finance.analyst_teams WHERE slug = 'fundamental'),
 'growth', 'Growth Analyst', 'growth',
 'You seek high growth potential. Revenue acceleration, market expansion, willing to pay premium for growth.'),

((SELECT id FROM finance.analyst_teams WHERE slug = 'fundamental'),
 'quality', 'Quality Analyst', 'quality',
 'You seek high-quality businesses. Strong moats, consistent returns, management quality. Long-term view.');

-- Sentiment Team
INSERT INTO finance.analyst_teams (slug, name, data_dimension, description)
VALUES ('sentiment', 'Sentiment Analysis Team', 'sentiment', 'Market psychology and news flow');

INSERT INTO finance.analyst_specialists (team_id, slug, name, specialty, system_prompt) VALUES
((SELECT id FROM finance.analyst_teams WHERE slug = 'sentiment'),
 'news-flow', 'News Flow Analyst', 'news_flow',
 'You analyze news velocity and tone. Breaking news, earnings reactions, analyst upgrades/downgrades.'),

((SELECT id FROM finance.analyst_teams WHERE slug = 'sentiment'),
 'social-mood', 'Social Mood Analyst', 'social_mood',
 'You track social media sentiment, retail trader activity, meme potential. Crowd psychology drives short-term moves.'),

((SELECT id FROM finance.analyst_teams WHERE slug = 'sentiment'),
 'narrative-shift', 'Narrative Shift Analyst', 'narrative_shift',
 'You detect when the story is changing. Bull to bear transitions, new catalysts emerging, thesis breaks.');

-- Agenda Team
INSERT INTO finance.analyst_teams (slug, name, data_dimension, description)
VALUES ('agenda', 'Agenda Detection Team', 'agenda', 'Detect artificial and coordinated signals');

INSERT INTO finance.analyst_specialists (team_id, slug, name, specialty, system_prompt) VALUES
((SELECT id FROM finance.analyst_teams WHERE slug = 'agenda'),
 'manipulation', 'Manipulation Detector', 'manipulation',
 'You detect market manipulation: pump-and-dump, wash trading, spoofing patterns. Trade against artificial moves.'),

((SELECT id FROM finance.analyst_teams WHERE slug = 'agenda'),
 'coordinated-narrative', 'Coordinated Narrative Analyst', 'coordinated_narrative',
 'You detect coordinated media campaigns. When multiple outlets push same story simultaneously, be skeptical.'),

((SELECT id FROM finance.analyst_teams WHERE slug = 'agenda'),
 'fud-detector', 'FUD Detector', 'fud',
 'You identify Fear, Uncertainty, Doubt campaigns. Separate legitimate concerns from manufactured panic.');
```

---

#### Stage 2: Evaluator Red Team (Challenge & Refine)

The evaluators don't just score—they **actively poke holes** in Stage 1 predictions.

```sql
-- Evaluator definitions
CREATE TABLE finance.evaluators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  challenge_focus TEXT NOT NULL,  -- What they challenge
  system_prompt TEXT NOT NULL,
  model_preference TEXT DEFAULT 'sonnet',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Evaluator challenges for each prediction
CREATE TABLE finance.prediction_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES finance.recommendation_runs(id),
  evaluator_id UUID REFERENCES finance.evaluators(id),
  instrument TEXT NOT NULL,

  -- Challenge content
  challenge_text TEXT NOT NULL,  -- "What if this is wrong because..."
  risk_identified TEXT,
  confidence_adjustment NUMERIC(3,2),  -- Suggested adjustment (-0.3 to +0.1 typically)
  severity TEXT CHECK (severity IN ('minor', 'moderate', 'major', 'fatal')),

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Seed Data - Evaluators (Red Team)**:

```sql
INSERT INTO finance.evaluators (slug, name, role, challenge_focus, system_prompt) VALUES
('devils-advocate', 'Devil''s Advocate', 'Find counter-arguments',
 'What if this prediction is wrong?',
 'Your job is to find the BEST counter-argument to each prediction. Challenge assumptions, find alternative explanations for signals, identify what bulls/bears are missing. Output: "What if this is wrong because..."'),

('risk-assessor', 'Risk Assessor', 'Quantify downside scenarios',
 'What could go wrong and how bad?',
 'Quantify the worst-case scenario for each prediction. What is the maximum loss? What events could cause it? How likely are those events? Output: "Worst case is X% loss because..."'),

('data-skeptic', 'Data Skeptic', 'Question data quality and completeness',
 'Is the data reliable?',
 'Challenge the quality and completeness of data underlying each prediction. Is the news reliable? Is the price data clean? Are we missing important information? Output: "This relies on data that might be..."'),

('historical-matcher', 'Historical Pattern Matcher', 'Find similar past situations',
 'What happened last time?',
 'Find historical parallels to current situations. What happened last time we saw this pattern? What were the outcomes? Output: "Last time this pattern appeared..."'),

('confidence-calibrator', 'Confidence Calibrator', 'Final confidence assignment',
 'What should the final confidence be?',
 'Given all challenges raised by other evaluators, assign a final confidence score. High confidence requires surviving all challenges. Output: "Given challenges, final confidence is X because..."');
```

---

#### Stage 3: Risk-Profile Packaging

Users select their risk profile; they get **clean output**, not the internal debate.

```sql
-- Risk profiles
CREATE TABLE finance.risk_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,

  -- Filtering rules
  min_confidence NUMERIC(3,2) NOT NULL,
  max_positions INTEGER,
  allowed_actions TEXT[] DEFAULT ARRAY['buy', 'sell', 'hold'],

  -- Weighting preferences
  team_weights JSONB DEFAULT '{}',  -- { "technical": 1.2, "fundamental": 0.8 }

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Final packaged recommendations per risk profile
CREATE TABLE finance.packaged_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES finance.recommendation_runs(id),
  risk_profile_id UUID REFERENCES finance.risk_profiles(id),
  instrument TEXT NOT NULL,

  -- Clean output
  action TEXT CHECK (action IN ('buy', 'sell', 'hold')),
  confidence NUMERIC(3,2),
  timing_window TEXT,
  rationale TEXT,  -- Synthesized, not raw analyst output

  -- Hidden complexity (available if user drills down)
  specialist_votes JSONB,
  challenges_summary JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(run_id, risk_profile_id, instrument)
);

-- User preferences
CREATE TABLE finance.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,

  -- Default risk profile
  default_risk_profile_id UUID REFERENCES finance.risk_profiles(id),

  -- Notification preferences
  notify_on_high_confidence BOOLEAN DEFAULT true,
  notify_on_major_moves BOOLEAN DEFAULT true,

  -- UI preferences
  show_specialist_detail BOOLEAN DEFAULT false,
  show_challenges BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);
```

**Seed Data - Risk Profiles**:

```sql
INSERT INTO finance.risk_profiles (slug, name, description, min_confidence, max_positions, team_weights) VALUES
('aggressive', 'Aggressive',
 'Higher risk tolerance. More trades, momentum bias, willing to act on lower confidence.',
 0.50, 10,
 '{"technical": 1.3, "sentiment": 1.2, "fundamental": 0.8, "agenda": 1.0}'),

('balanced', 'Balanced',
 'Moderate risk. Selective trades, balanced signals across all dimensions.',
 0.65, 5,
 '{"technical": 1.0, "sentiment": 1.0, "fundamental": 1.0, "agenda": 1.0}'),

('conservative', 'Conservative',
 'Capital preservation focus. Fewer trades, high confidence required, quality bias.',
 0.75, 3,
 '{"technical": 0.8, "sentiment": 0.8, "fundamental": 1.3, "agenda": 1.2}');
```

---

#### Three-Stage Workflow

```typescript
async runThreeStagePipeline(
  features: Features,
  learningContext: LearningContext,
  instruments: string[],
  riskProfile: RiskProfile
): Promise<PackagedRecommendations[]> {

  // STAGE 1: Run all specialist teams in parallel
  const teams = await this.getActiveTeams();
  const specialistPredictions = await Promise.all(
    teams.flatMap(team =>
      team.specialists.map(specialist =>
        this.runSpecialist(specialist, features, learningContext, instruments)
      )
    )
  );
  await this.storeSpecialistPredictions(specialistPredictions);

  // STAGE 2: Run evaluator red team on aggregated predictions
  const evaluators = await this.getActiveEvaluators();
  const aggregatedByInstrument = this.aggregateByInstrument(specialistPredictions);

  const challenges = await Promise.all(
    evaluators.map(evaluator =>
      this.runEvaluator(evaluator, aggregatedByInstrument, instruments)
    )
  );
  await this.storeChallenges(challenges);

  // Apply confidence adjustments from evaluators
  const refinedPredictions = this.applyEvaluatorChallenges(
    aggregatedByInstrument,
    challenges
  );

  // STAGE 3: Package for user's risk profile
  const packaged = this.packageForRiskProfile(
    refinedPredictions,
    riskProfile
  );

  return packaged;
}

private packageForRiskProfile(
  predictions: RefinedPrediction[],
  profile: RiskProfile
): PackagedRecommendation[] {
  return predictions
    // Filter by confidence threshold
    .filter(p => p.finalConfidence >= profile.min_confidence)
    // Apply team weightings
    .map(p => ({
      ...p,
      weightedScore: this.applyTeamWeights(p, profile.team_weights)
    }))
    // Sort by weighted score
    .sort((a, b) => b.weightedScore - a.weightedScore)
    // Limit to max positions
    .slice(0, profile.max_positions)
    // Clean output (hide complexity)
    .map(p => ({
      instrument: p.instrument,
      action: p.action,
      confidence: p.finalConfidence,
      timing_window: p.timing_window,
      rationale: this.synthesizeCleanRationale(p),
      // Hidden but available on drill-down
      _specialist_votes: p.specialistVotes,
      _challenges_summary: p.challengesSummary
    }));
}
```

---

#### UI Changes

**1. Run Configuration** (before starting):
```
┌─────────────────────────────────────────────┐
│ Start Research Run                           │
├─────────────────────────────────────────────┤
│ Universe: [Tech Giants v2.1 ▼]              │
│                                             │
│ Risk Profile:                               │
│  ○ Aggressive - More trades, momentum bias  │
│  ● Balanced - Selective, balanced signals   │
│  ○ Conservative - Fewer, high-confidence    │
│                                             │
│ [Save as my default]  [Start Run →]         │
└─────────────────────────────────────────────┘
```

**2. Clean Recommendation Output**:
```
┌─────────────────────────────────────────────┐
│ AAPL - BUY                                  │
│ Confidence: 78%  │  Timing: Pre-Close       │
├─────────────────────────────────────────────┤
│ Strong momentum with quality fundamentals.  │
│ Technical breakout confirmed by volume.     │
│ No significant manipulation detected.       │
├─────────────────────────────────────────────┤
│ [Show Analysis Detail ▼]                    │
└─────────────────────────────────────────────┘
```

**3. Expanded Detail (on click)**:
```
┌─────────────────────────────────────────────────────────────┐
│ AAPL Analysis Detail                                         │
├─────────────────────────────────────────────────────────────┤
│ SPECIALIST VOTES:                                            │
│  Technical Team:                                             │
│   • Momentum: BUY (0.85) "Strong uptrend with volume"       │
│   • Reversion: HOLD (0.55) "Extended from mean"             │
│   • Pattern: BUY (0.80) "Bull flag breakout"                │
│  Fundamental Team:                                           │
│   • Value: HOLD (0.60) "Fairly valued at 28x"               │
│   • Quality: BUY (0.75) "Excellent business quality"        │
│                                                              │
│ CHALLENGES SURVIVED:                                         │
│  • Devil's Advocate: "Extended valuation" - Minor           │
│  • Risk Assessor: "Max 8% downside to support" - Moderate   │
│  • Data Skeptic: "Data quality good" - Pass                 │
│                                                              │
│ RAW → FINAL CONFIDENCE: 82% → 78% (-4% from challenges)     │
└─────────────────────────────────────────────────────────────┘
```

---

#### Model Selection Strategy

| Component | Default Model | Rationale |
|-----------|---------------|-----------|
| **Tier 1 Triage (3)** | Haiku or Local | Runs on EVERY event - must be fast & cheap |
| **Tier 2 Specialists (12)** | Haiku or Local | High volume, pattern matching |
| **Tier 2 Evaluators (5)** | Sonnet | Complex reasoning, challenge generation |
| Confidence Calibrator | Sonnet | Final synthesis, calibration |
| Rationale Synthesis | Haiku | Text generation, lower complexity |

**Cost Analysis**:
- **Without triage**: 100 events × 17 LLM calls = 1,700 expensive calls
- **With triage**: 100 events × 3 cheap calls = 300 cheap calls, ~10 pass → 10 × 17 = 170 expensive calls
- **Savings**: ~90% reduction in expensive LLM calls

This keeps costs manageable while maintaining quality where it matters.

---

**Success Metrics**:
- Three-stage pipeline win rate > single-model win rate
- High-confidence (post-challenge) predictions outperform raw predictions
- Evaluator challenges correlate with actual failures
- User risk profile satisfaction (right recommendations for their style)
- Clean output philosophy maintained (users don't need to see complexity)

---

### Enhancement 7: Service Decomposition Refactor

**Goal**: Break monolithic services into expert microservices within the workflow.

**Current State**:
- `finance.service.ts` (LangGraph) does too many things
- `finance.service.ts` (API) mixes CRUD with business logic
- Testing requires complex mock setups

**Target State**:

```
apps/langgraph/src/agents/finance/
├── services/
│   ├── market-data.service.ts      # Fetch & store OHLCV
│   ├── news-ingestion.service.ts   # Fetch & store news
│   ├── agenda-extraction.service.ts # LLM narrative detection
│   ├── feature-building.service.ts  # Technical & sentiment features
│   ├── recommendation.service.ts    # Generate predictions
│   ├── analyst-swarm.service.ts     # Coordinate analyst agents
│   ├── outcome-evaluation.service.ts # Compute win/loss
│   ├── postmortem.service.ts        # LLM outcome analysis
│   ├── missed-opportunity.service.ts # Find & analyze misses
│   ├── learning-context.service.ts   # Aggregate lessons
│   └── source-performance.service.ts # Track source quality
├── connectors/                       # Data source implementations
├── dto/                              # Request/response types
├── finance.graph.ts                  # Workflow orchestration only
├── finance.state.ts                  # State definitions
└── finance.module.ts                 # DI configuration
```

**Service Interface Pattern**:

Each service follows this pattern:
```typescript
@Injectable()
export class MarketDataService {
  constructor(
    private readonly financeDb: FinanceDbService,
    private readonly connectorFactory: ConnectorFactory
  ) {}

  // Single public interface
  async ingestMarketData(
    instruments: string[],
    since: string,
    until: string
  ): Promise<MarketDataResult> {
    // 1. Check what we already have
    const existing = await this.financeDb.getMarketBars(instruments, since, until);

    // 2. Identify gaps
    const gaps = this.findDataGaps(instruments, existing, since, until);

    // 3. Fetch missing data
    const fetched = await this.fetchFromConnectors(gaps);

    // 4. Store new data
    await this.financeDb.storeMarketBars(fetched);

    // 5. Return complete dataset
    return {
      bars: [...existing, ...fetched],
      source: this.getSourceInfo(fetched),
      gaps: this.identifyRemainingGaps(instruments, since, until)
    };
  }
}
```

**Graph Node Simplification**:

Before (monolithic):
```typescript
async function ingestMarketDataNode(state: FinanceState): Promise<FinanceState> {
  // 50+ lines of data fetching, validation, storage logic
}
```

After (delegating):
```typescript
async function ingestMarketDataNode(state: FinanceState): Promise<FinanceState> {
  const result = await marketDataService.ingestMarketData(
    state.instruments.map(i => i.symbol),
    state.config.since,
    state.config.until
  );

  return {
    ...state,
    marketBars: result.bars,
    dataSourcesUsed: [...state.dataSourcesUsed, result.source]
  };
}
```

**Testing Benefits**:

Each service can be unit tested in complete isolation:
```typescript
describe('MarketDataService', () => {
  let service: MarketDataService;
  let mockDb: jest.Mocked<FinanceDbService>;
  let mockConnector: jest.Mocked<MarketDataConnector>;

  beforeEach(() => {
    mockDb = createMockFinanceDb();
    mockConnector = createMockConnector();
    service = new MarketDataService(mockDb, mockConnector);
  });

  it('should fetch only missing data', async () => {
    mockDb.getMarketBars.mockResolvedValue([/* partial data */]);

    await service.ingestMarketData(['AAPL'], '2026-01-01', '2026-01-07');

    expect(mockConnector.fetchBars).toHaveBeenCalledWith(
      ['AAPL'],
      '2026-01-05',  // Only missing dates
      '2026-01-07'
    );
  });
});
```

---

### Enhancement 8: Continuous Polling & Two-Tier Evaluation

**Goal**: Continuously poll data sources in the background and intelligently evaluate each incoming event to determine if it warrants full analysis.

**Concept**: Instead of cron-based scheduling, the system **continuously polls** RSS feeds, news sources, and market data APIs. **Every new item goes through Tier 1 Triage** - fast, cheap agents that answer "Is this even a thing?" Only items that pass triage proceed to the expensive Tier 2 full analysis (12 specialists + 5 evaluators).

**Key Design Decisions**:
1. **Polling is cheap**: Yahoo Finance ~2000/hour, RSS unlimited. Poll continuously during market hours.
2. **Pre-filter first**: Simple rule-based checks discard obvious noise (routine price ticks) before any LLM call.
3. **Triage is critical**: We can't run 17 LLM calls for every RSS item. Run 3 cheap triage calls on items that pass pre-filter.
4. **Event-driven**: Each new item triggers immediate evaluation - no batching.

---

#### Three-Layer Filtering Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         CONTINUOUS POLLING WORKER                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────┐    ┌───────────────────┐    ┌───────────────────┐        │
│  │  RSS Feed Poller   │    │  Market Data Poller│    │  News API Poller  │        │
│  │  (every 60s)       │    │  (every 15s)       │    │  (every 5 min)    │        │
│  └─────────┬──────────┘    └─────────┬──────────┘    └─────────┬─────────┘        │
│            └─────────────────────────┼─────────────────────────┘                  │
└──────────────────────────────────────┼────────────────────────────────────────────┘
                                       │
                                       ▼  (each new item)
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    PRE-FILTER (Rule-Based, No LLM)                               │
│                    "Is this even worth evaluating?"                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  Simple rule-based checks - NO LLM calls, just math and lookups:                │
│                                                                                  │
│  PRICE DATA (main use case for pre-filter):                                      │
│   • Day movement < 2%? → SKIP (routine day)                                     │
│   • Hour movement < 1%? → SKIP (normal intraday)                                │
│   • Volume < 1.5x daily average? → SKIP (normal activity)                       │
│                                                                                  │
│  NEWS/RSS (already events, minimal filtering):                                   │
│   • Exact headline seen in last 24h? → SKIP (duplicate)                         │
│                                                                                  │
│  Result: Most routine price polls filtered, 0 LLM calls consumed                │
│                                                                                  │
│               ┌───────────────┴───────────────┐                                  │
│               ▼                               ▼                                  │
│        ┌──────────┐                    ┌──────────┐                              │
│        │  PASS    │                    │   SKIP   │                              │
│        │ To Triage│                    │  Log only│                              │
│        └────┬─────┘                    └──────────┘                              │
└─────────────┼────────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         TIER 1: TRIAGE (Fast, Cheap LLM)                         │
│                         "Is this actually significant?"                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                  │
│  │  NOVELTY CHECK  │  │ MAGNITUDE CHECK │  │  CONTEXT CHECK  │                  │
│  │                 │  │                 │  │                 │                  │
│  │ "Is this new?"  │  │ "Is this big    │  │ "Does this      │                  │
│  │ "Seen similar   │  │  enough to      │  │  connect to     │                  │
│  │  in last 72h?"  │  │  matter?"       │  │  our universe?" │                  │
│  │                 │  │                 │  │                 │                  │
│  │ Haiku/Local     │  │ Haiku/Local     │  │ Haiku/Local     │                  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘                  │
│           │                    │                    │                            │
│           └────────────────────┼────────────────────┘                            │
│                                ▼                                                 │
│                    ┌─────────────────────┐                                       │
│                    │   TRIAGE DECISION   │                                       │
│                    │   Score ≥ threshold?│                                       │
│                    └──────────┬──────────┘                                       │
│                               │                                                  │
│               ┌───────────────┴───────────────┐                                  │
│               ▼                               ▼                                  │
│        ┌──────────┐                    ┌──────────┐                              │
│        │   YES    │                    │    NO    │                              │
│        │ Proceed  │                    │  Store & │                              │
│        │ to Tier 2│                    │  Discard │                              │
│        └────┬─────┘                    └──────────┘                              │
│             │                                                                    │
└─────────────┼────────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    TIER 2: FULL ANALYSIS (Expensive, Thorough)                   │
│                    "What should we do about this?"                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  1. Gather Context: Pull related news, recent price data, historical patterns   │
│  2. Stage 1: Run 12 Specialists (4 teams × 3 specialists)                       │
│  3. Stage 2: Run 5 Evaluators (red team challenges)                             │
│  4. Stage 3: Package for user's risk profile                                    │
│  5. Store recommendation and notify user                                        │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

#### Tier 1: Triage Agents

Three fast, cheap agents that run on every incoming event:

```sql
-- Triage agent definitions
CREATE TABLE finance.triage_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  question TEXT NOT NULL,      -- What it answers
  check_focus TEXT NOT NULL,   -- What it examines
  system_prompt TEXT NOT NULL,
  model_preference TEXT DEFAULT 'haiku',  -- Always cheap/fast
  weight NUMERIC(3,2) DEFAULT 0.33,       -- Weight in final score
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Triage results for each event
CREATE TABLE finance.triage_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL,              -- Reference to the incoming event
  event_type TEXT NOT NULL,            -- 'news_item', 'price_tick', 'volume_data'

  -- Individual agent scores (0-1)
  novelty_score NUMERIC(3,2),
  novelty_reason TEXT,
  magnitude_score NUMERIC(3,2),
  magnitude_reason TEXT,
  context_score NUMERIC(3,2),
  context_reason TEXT,

  -- Final decision
  weighted_score NUMERIC(3,2),         -- Combined score
  passed_triage BOOLEAN NOT NULL,

  -- Timing
  triage_duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_triage_results_passed ON finance.triage_results(passed_triage, created_at);
```

**Seed Data - Triage Agents**:

```sql
INSERT INTO finance.triage_agents (slug, name, question, check_focus, system_prompt, weight) VALUES
('novelty', 'Novelty Checker', 'Is this new information?',
 'Deduplication and recency',
 'You determine if incoming information is genuinely new or just a rehash of recent news.

Check for:
- Have we seen this exact headline/event in the last 72 hours?
- Is this a follow-up to existing news or genuinely new information?
- Does this add new facts or just repeat known information?

Score 0.0-1.0:
- 0.0-0.3: Duplicate or very similar to recent news
- 0.4-0.6: Some new details but mostly known
- 0.7-1.0: Genuinely new information

Output JSON: {"score": 0.X, "reason": "brief explanation"}',
 0.30),

('magnitude', 'Magnitude Checker', 'Is this big enough to matter?',
 'Event significance and impact potential',
 'You determine if an event is significant enough to warrant analysis.

Check for:
- Price moves: Is this >2% change? Unusual for this instrument?
- Volume: Is this >2x average volume?
- News: Does this involve material events (earnings, M&A, FDA, legal)?
- Sentiment: Is this likely to move the market?

Score 0.0-1.0:
- 0.0-0.3: Routine, unlikely to matter
- 0.4-0.6: Moderate significance
- 0.7-1.0: High significance, likely market-moving

Output JSON: {"score": 0.X, "reason": "brief explanation"}',
 0.40),

('context', 'Context Checker', 'Does this connect to our universe?',
 'Relevance to tracked instruments',
 'You determine if an event is relevant to the instruments we track.

Check for:
- Does this mention any of our tracked instruments directly?
- Does this affect the sector/industry of our instruments?
- Could this have indirect effects on our instruments?

Score 0.0-1.0:
- 0.0-0.3: No clear connection to our universe
- 0.4-0.6: Indirect or sector-level connection
- 0.7-1.0: Direct mention or clear impact on our instruments

Output JSON: {"score": 0.X, "reason": "brief explanation"}',
 0.30);
```

---

#### Pre-Filter Service (Rule-Based, No LLM)

The pre-filter is primarily for **price data** - since we poll every 10-15 seconds, most polls show routine movement. News/RSS items are already "events" by nature, so they need minimal filtering.

```typescript
@Injectable()
export class PreFilterService {
  private readonly logger = new Logger(PreFilterService.name);

  // Configurable thresholds
  private readonly DAY_MOVE_MIN_PCT = 2.0;    // Min daily movement to consider
  private readonly HOUR_MOVE_MIN_PCT = 1.0;   // Min hourly movement to consider
  private readonly VOLUME_SPIKE_MIN = 1.5;    // Min volume multiplier vs 20-day avg

  /**
   * Quick rule-based filter - NO LLM calls
   * Returns true if event should proceed to triage
   */
  async shouldProceedToTriage(event: IncomingEvent): Promise<PreFilterResult> {
    const start = Date.now();

    switch (event.type) {
      case 'price_data':
        // Main use case - filter routine price polls
        return this.filterPriceData(event);

      case 'news_item':
      case 'rss_item':
        // News is already an "event" - just check for duplicates
        return this.filterNewsItem(event);

      default:
        // Unknown type - let triage decide
        return { pass: true, reason: 'unknown_type', durationMs: Date.now() - start };
    }
  }

  /**
   * Price data filter - checks cumulative movement over time windows
   * This is where most filtering happens since we poll frequently
   */
  private async filterPriceData(event: PriceDataEvent): Promise<PreFilterResult> {
    const start = Date.now();
    const { instrument, currentPrice } = event;

    // Get reference prices from cache/db
    const [dayOpen, hourAgo, avgVolume] = await Promise.all([
      this.getDayOpenPrice(instrument),
      this.getPriceHoursAgo(instrument, 1),
      this.getAverageVolume(instrument, 20),
    ]);

    // Calculate movements
    const dayMovePct = Math.abs((currentPrice - dayOpen) / dayOpen * 100);
    const hourMovePct = Math.abs((currentPrice - hourAgo) / hourAgo * 100);
    const volumeMultiplier = event.volume / avgVolume;

    // Check if ANY threshold is exceeded
    const reasons: string[] = [];

    if (dayMovePct >= this.DAY_MOVE_MIN_PCT) {
      reasons.push(`day: ${dayMovePct.toFixed(2)}%`);
    }
    if (hourMovePct >= this.HOUR_MOVE_MIN_PCT) {
      reasons.push(`hour: ${hourMovePct.toFixed(2)}%`);
    }
    if (volumeMultiplier >= this.VOLUME_SPIKE_MIN) {
      reasons.push(`volume: ${volumeMultiplier.toFixed(1)}x`);
    }

    if (reasons.length === 0) {
      return {
        pass: false,
        reason: `routine: day=${dayMovePct.toFixed(2)}%, hour=${hourMovePct.toFixed(2)}%, vol=${volumeMultiplier.toFixed(1)}x`,
        durationMs: Date.now() - start,
      };
    }

    return {
      pass: true,
      reason: `significant: ${reasons.join(', ')}`,
      durationMs: Date.now() - start,
    };
  }

  /**
   * News filter - minimal filtering since news is already an "event"
   * Just deduplicate exact headlines
   */
  private async filterNewsItem(event: NewsItemEvent): Promise<PreFilterResult> {
    const start = Date.now();

    // Simple headline deduplication (hash-based, very fast)
    const headlineHash = this.hashHeadline(event.headline);
    const isDuplicate = await this.checkHeadlineSeen(headlineHash, 24); // 24 hour window

    if (isDuplicate) {
      return { pass: false, reason: 'duplicate_headline', durationMs: Date.now() - start };
    }

    // Mark headline as seen
    await this.markHeadlineSeen(headlineHash);

    return { pass: true, reason: 'new_headline', durationMs: Date.now() - start };
  }
}
```

**Pre-Filter Statistics Table**:

```sql
-- Track pre-filter effectiveness
CREATE TABLE finance.prefilter_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  filter_reason TEXT NOT NULL,        -- 'price_change_too_small', 'duplicate_headline', etc.
  count INTEGER DEFAULT 1,
  date DATE DEFAULT CURRENT_DATE,
  UNIQUE(event_type, filter_reason, date)
);

-- Increment on each filter (upsert)
-- This lets us see: "Today we filtered 5,000 routine price ticks"
```

---

#### Triage Service Implementation

The triage service only runs on events that pass the pre-filter:

```typescript
@Injectable()
export class TriageService {
  private readonly PASS_THRESHOLD = 0.55;  // Configurable

  constructor(
    private readonly preFilter: PreFilterService,
    // ... other deps
  ) {}

  /**
   * Evaluate a single incoming event
   * Called immediately when new data arrives from poller
   */
  async triageEvent(event: IncomingEvent, universeInstruments: string[]): Promise<TriageResult> {
    // Step 1: Pre-filter (rule-based, no LLM)
    const preFilterResult = await this.preFilter.shouldProceedToTriage(event);
    if (!preFilterResult.pass) {
      this.logger.debug(`Event ${event.id} PRE-FILTERED: ${preFilterResult.reason}`);
      await this.recordPreFilterSkip(event, preFilterResult);
      return { passedTriage: false, skipReason: preFilterResult.reason };
    }

    // Step 2: LLM-based triage (only for events that pass pre-filter)
    const startTime = Date.now();

    // Run all 3 triage agents in parallel (they're cheap and fast)
    const [novelty, magnitude, context] = await Promise.all([
      this.runNoveltyCheck(event),
      this.runMagnitudeCheck(event),
      this.runContextCheck(event, universeInstruments),
    ]);

    // Calculate weighted score
    const weightedScore =
      (novelty.score * 0.30) +
      (magnitude.score * 0.40) +
      (context.score * 0.30);

    const passed = weightedScore >= this.PASS_THRESHOLD;

    // Store result
    const result = await this.storeTriageResult({
      eventId: event.id,
      eventType: event.type,
      noveltyScore: novelty.score,
      noveltyReason: novelty.reason,
      magnitudeScore: magnitude.score,
      magnitudeReason: magnitude.reason,
      contextScore: context.score,
      contextReason: context.reason,
      weightedScore,
      passedTriage: passed,
      triageDurationMs: Date.now() - startTime,
    });

    if (passed) {
      this.logger.log(
        `Event ${event.id} PASSED triage (${weightedScore.toFixed(2)}): ${event.summary}`
      );
    } else {
      this.logger.debug(
        `Event ${event.id} REJECTED (${weightedScore.toFixed(2)}): ${novelty.reason}`
      );
    }

    return result;
  }

  private async runNoveltyCheck(event: IncomingEvent): Promise<AgentScore> {
    // Check database for similar recent events first (cheap)
    const recentSimilar = await this.findSimilarRecentEvents(event, 72);
    if (recentSimilar.length > 0) {
      return { score: 0.2, reason: `Similar to ${recentSimilar.length} recent events` };
    }

    // If no obvious duplicates, ask LLM for nuanced check
    return this.llmClient.evaluate(
      this.triageAgents.get('novelty').systemPrompt,
      event,
      'haiku'  // Always use cheapest model
    );
  }

  // Similar implementations for magnitude and context checks...
}
```

---

#### Event Processing Flow

```typescript
@Injectable()
export class EventProcessorService {
  /**
   * Called by pollers when new data arrives
   */
  async processIncomingEvent(event: IncomingEvent): Promise<void> {
    // 1. Store the raw event
    await this.storeEvent(event);

    // 2. Get active universes that might care about this event
    const relevantUniverses = await this.findRelevantUniverses(event);

    // 3. Triage for each relevant universe
    for (const universe of relevantUniverses) {
      const triageResult = await this.triageService.triageEvent(
        event,
        universe.instruments
      );

      if (triageResult.passedTriage) {
        // 4. PASSED - Queue for full Tier 2 analysis
        await this.queueForFullAnalysis({
          event,
          universeId: universe.id,
          triageResult,
        });
      }
      // If not passed, event is stored but no further action
    }
  }

  /**
   * Queue event for Tier 2 full analysis
   */
  private async queueForFullAnalysis(item: AnalysisQueueItem): Promise<void> {
    // Check cooldown - don't analyze same instrument too frequently
    const lastAnalysis = await this.getLastAnalysis(item.universeId, item.event.instrument);
    if (lastAnalysis && this.isInCooldown(lastAnalysis)) {
      this.logger.debug(`Skipping ${item.event.instrument} - in cooldown`);
      return;
    }

    // Run the full three-stage pipeline
    await this.financeService.runFullAnalysis({
      universeId: item.universeId,
      triggerEvent: item.event,
      triageResult: item.triageResult,
    });
  }
}
```

---

#### Triage Evaluation & Learning

The triage tier must be evaluatable so we can improve it over time. We track:

**False Negatives (Missed Opportunities)**:
- Events we rejected that later proved significant (big price move we didn't act on)
- Detected via the "What We Missed" analysis - correlate missed moves with rejected triage events

**False Positives (Wasted Analysis)**:
- Events we passed that resulted in "no action" recommendations
- Full Tier 2 analysis concluded there was nothing worth recommending

```sql
-- Track triage evaluation for learning
CREATE TABLE finance.triage_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  triage_result_id UUID REFERENCES finance.triage_results(id),

  -- What happened after triage?
  evaluation_type TEXT CHECK (evaluation_type IN (
    'false_negative',  -- Rejected but should have passed (missed opportunity)
    'false_positive',  -- Passed but led to no recommendation
    'true_positive',   -- Passed and led to actionable recommendation
    'true_negative'    -- Rejected and correctly so (no significant move)
  )),

  -- For false negatives: what move did we miss?
  missed_move_pct NUMERIC(8,4),
  missed_move_instrument TEXT,

  -- For false positives: why was analysis wasted?
  wasted_reason TEXT,

  -- Analysis
  what_triage_missed TEXT,  -- LLM analysis of why triage was wrong
  suggested_improvement TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Triage performance metrics view
CREATE VIEW finance.triage_performance AS
SELECT
  DATE(tr.created_at) as triage_date,
  COUNT(*) as total_events,
  COUNT(CASE WHEN tr.passed_triage THEN 1 END) as passed_count,
  COUNT(CASE WHEN NOT tr.passed_triage THEN 1 END) as rejected_count,

  -- Accuracy metrics (from evaluations)
  COUNT(CASE WHEN te.evaluation_type = 'true_positive' THEN 1 END) as true_positives,
  COUNT(CASE WHEN te.evaluation_type = 'true_negative' THEN 1 END) as true_negatives,
  COUNT(CASE WHEN te.evaluation_type = 'false_positive' THEN 1 END) as false_positives,
  COUNT(CASE WHEN te.evaluation_type = 'false_negative' THEN 1 END) as false_negatives,

  -- Per-agent average scores (for tuning)
  AVG(tr.novelty_score) as avg_novelty_score,
  AVG(tr.magnitude_score) as avg_magnitude_score,
  AVG(tr.context_score) as avg_context_score

FROM finance.triage_results tr
LEFT JOIN finance.triage_evaluations te ON te.triage_result_id = tr.id
GROUP BY DATE(tr.created_at);
```

**Triage Improvement Process**:

1. **Weekly Review**: Analyze false negatives and false positives
2. **Threshold Tuning**: Adjust pass threshold based on accuracy
3. **Agent Prompt Refinement**: Update triage agent prompts based on errors
4. **Weight Adjustment**: Change agent weights if one is consistently wrong

```typescript
@Injectable()
export class TriageEvaluationService {
  /**
   * Called after missed opportunity analysis to check for false negatives
   */
  async evaluateRejectedEvents(
    missedOpportunity: MissedOpportunity
  ): Promise<void> {
    // Find triage results for events around the time of the missed move
    const relatedTriageResults = await this.findTriageResultsForInstrument(
      missedOpportunity.instrument,
      missedOpportunity.analysis_date,
      { hours: 24 }
    );

    // Any rejected events that could have predicted this move?
    for (const triage of relatedTriageResults) {
      if (!triage.passed_triage) {
        // This was a false negative - we rejected something we shouldn't have
        await this.recordFalseNegative(triage, missedOpportunity);
      }
    }
  }

  /**
   * Called after Tier 2 analysis completes with no recommendation
   */
  async evaluatePassedEventWithNoAction(
    triageResultId: string,
    reason: string
  ): Promise<void> {
    // This was a false positive - we passed something that led to nothing
    await this.recordFalsePositive(triageResultId, reason);
  }

  /**
   * Generate weekly triage improvement report
   */
  async generateTriageReport(): Promise<TriageReport> {
    const metrics = await this.getWeeklyMetrics();

    return {
      precision: metrics.true_positives / (metrics.true_positives + metrics.false_positives),
      recall: metrics.true_positives / (metrics.true_positives + metrics.false_negatives),
      f1Score: this.calculateF1(metrics),
      recommendations: this.generateImprovementRecommendations(metrics),
    };
  }
}
```

---

#### Polling Architecture (Updated)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         CONTINUOUS POLLING WORKER                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌───────────────────┐    ┌───────────────────┐    ┌───────────────────┐        │
│  │  RSS Feed Poller   │    │  Market Data Poller│    │  News API Poller  │        │
│  │  (every 60s)       │    │  (every 15s)       │    │  (every 5 min)    │        │
│  └─────────┬──────────┘    └─────────┬──────────┘    └─────────┬─────────┘        │
│            │                         │                         │                  │
│            └─────────────────────────┼─────────────────────────┘                  │
│                                      ▼                                            │
│                    ┌─────────────────────────────────┐                            │
│                    │  For each new item:              │                            │
│                    │  1. Store raw event              │                            │
│                    │  2. Run Tier 1 Triage (3 agents)│                            │
│                    │  3. If passed → Tier 2          │                            │
│                    │  4. If not → store & skip       │                            │
│                    └─────────────────┬───────────────┘                            │
│                                      │                                            │
└──────────────────────────────────────┼────────────────────────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              DATABASE                                            │
│  - All events (passed and rejected triage)                                       │
│  - Triage results with scores and reasons                                        │
│  - Triage evaluations (TP/TN/FP/FN) for learning                                │
│  - Recommendations from events that passed                                       │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

#### Universe Watches

```sql
-- Watch configurations per universe
CREATE TABLE finance.universe_watches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  universe_id UUID REFERENCES finance.universes(id),
  user_id TEXT NOT NULL,

  -- Watch configuration
  is_enabled BOOLEAN DEFAULT true,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'news_break',        -- Breaking news mentioning instruments
    'price_move',        -- Significant price change
    'volume_spike',      -- Unusual volume
    'agenda_signal'      -- Manipulation/agenda detected
  )),
  -- NOTE: No 'scheduled' type - polling replaces cron scheduling

  -- Trigger parameters (type-specific)
  trigger_config JSONB NOT NULL DEFAULT '{}',
  -- Examples:
  -- news_break: { "keywords": ["earnings", "FDA"], "min_relevance": 0.7 }
  -- price_move: { "threshold_pct": 3, "direction": "both" }
  -- volume_spike: { "multiplier": 2.5 }
  -- agenda_signal: { "min_confidence": 0.8 }

  -- Execution settings
  risk_profile_id UUID REFERENCES finance.risk_profiles(id),
  cooldown_minutes INTEGER DEFAULT 60,  -- Minimum time between triggers

  -- Notification settings
  notify_slack BOOLEAN DEFAULT false,
  notify_email BOOLEAN DEFAULT true,
  notify_in_app BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Watch execution history
CREATE TABLE finance.watch_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watch_id UUID REFERENCES finance.universe_watches(id),

  -- Trigger details
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trigger_reason TEXT NOT NULL,  -- Human-readable description
  trigger_data JSONB,  -- Raw event data that triggered

  -- Execution result
  run_id UUID REFERENCES finance.recommendation_runs(id),
  status TEXT CHECK (status IN ('triggered', 'executing', 'completed', 'skipped', 'failed')),
  skip_reason TEXT,  -- If skipped (e.g., cooldown)

  -- Timing
  execution_started_at TIMESTAMPTZ,
  execution_completed_at TIMESTAMPTZ
);
```

---

#### Trigger Types

**1. News Break Trigger**
```typescript
interface NewsBreakConfig {
  keywords?: string[];           // Optional keyword filter
  instruments_only?: boolean;    // Only news mentioning universe instruments
  min_relevance?: number;        // 0-1, LLM-assessed relevance
  sources?: string[];            // Specific sources to monitor
}

// Example watch:
{
  trigger_type: 'news_break',
  trigger_config: {
    keywords: ['earnings', 'FDA approval', 'acquisition'],
    instruments_only: true,
    min_relevance: 0.7
  }
}
```

**2. Price Move Trigger**
```typescript
interface PriceMoveConfig {
  threshold_pct: number;         // Minimum move to trigger (e.g., 3)
  direction: 'up' | 'down' | 'both';
  timeframe_minutes?: number;    // Window to measure move (default: 15)
  instruments?: string[];        // Specific instruments (default: all in universe)
}

// Example watch:
{
  trigger_type: 'price_move',
  trigger_config: {
    threshold_pct: 5,
    direction: 'both',
    timeframe_minutes: 30
  }
}
```

**3. Volume Spike Trigger**
```typescript
interface VolumeSpikeConfig {
  multiplier: number;            // X times average volume
  avg_period_days?: number;      // Period to calculate average (default: 20)
  instruments?: string[];
}

// Example watch:
{
  trigger_type: 'volume_spike',
  trigger_config: {
    multiplier: 3,
    avg_period_days: 20
  }
}
```

**4. Agenda Signal Trigger**
```typescript
interface AgendaSignalConfig {
  signal_types?: string[];       // 'manipulation', 'coordinated_narrative', 'fud'
  min_confidence?: number;
  instruments?: string[];
}

// Example watch:
{
  trigger_type: 'agenda_signal',
  trigger_config: {
    signal_types: ['manipulation', 'fud'],
    min_confidence: 0.75
  }
}
```

---

#### Continuous Polling Service

The poller runs continuously, checking data sources at appropriate intervals:

```typescript
@Injectable()
export class ContinuousPollerService implements OnModuleInit {
  private isRunning = false;

  async onModuleInit() {
    this.startPolling();
  }

  async startPolling(): Promise<void> {
    this.isRunning = true;
    this.logger.log('Starting continuous polling...');

    // Run pollers in parallel with different intervals
    await Promise.all([
      this.runRssFeedPoller(),      // Every 60 seconds
      this.runMarketDataPoller(),   // Every 15 seconds during market hours
      this.runNewsApiPoller(),      // Every 5 minutes
    ]);
  }

  private async runMarketDataPoller() {
    while (this.isRunning) {
      const interval = this.isMarketHours() ? 15_000 : 60_000;  // Faster during market hours

      try {
        const newData = await this.marketDataService.pollLatestPrices();
        if (newData.length > 0) {
          await this.eventProcessor.processMarketData(newData);
        }
      } catch (error) {
        this.logger.warn(`Market data poll failed: ${error.message}`);
      }

      await this.sleep(interval);
    }
  }

  private async runRssFeedPoller() {
    while (this.isRunning) {
      try {
        const newItems = await this.newsService.pollRssFeeds();
        if (newItems.length > 0) {
          await this.eventProcessor.processNewsItems(newItems);
        }
      } catch (error) {
        this.logger.warn(`RSS poll failed: ${error.message}`);
      }

      await this.sleep(60_000);  // Every 60 seconds
    }
  }

  private isMarketHours(): boolean {
    const now = new Date();
    const hour = now.getUTCHours();
    const day = now.getUTCDay();
    // Rough approximation: US market hours in UTC
    return day >= 1 && day <= 5 && hour >= 14 && hour <= 21;
  }
}
```

---

#### Watch Service Architecture

The WatchService evaluates accumulated data against watch triggers:

```typescript
@Injectable()
export class WatchService {
  private activeWatches: Map<string, WatchMonitor> = new Map();

  async startWatch(watchId: string): Promise<void> {
    const watch = await this.getWatch(watchId);

    const monitor = this.createMonitor(watch);
    monitor.on('trigger', (event) => this.handleTrigger(watch, event));
    monitor.start();

    this.activeWatches.set(watchId, monitor);
  }

  private createMonitor(watch: UniverseWatch): WatchMonitor {
    switch (watch.trigger_type) {
      case 'news_break':
        return new NewsBreakMonitor(watch.trigger_config, this.newsService);
      case 'price_move':
        return new PriceMoveMonitor(watch.trigger_config, this.marketDataService);
      case 'volume_spike':
        return new VolumeSpikeMonitor(watch.trigger_config, this.marketDataService);
      case 'agenda_signal':
        return new AgendaSignalMonitor(watch.trigger_config, this.agendaService);
    }
  }

  private async handleTrigger(watch: UniverseWatch, event: TriggerEvent): Promise<void> {
    // Check cooldown
    const lastTrigger = await this.getLastTrigger(watch.id);
    if (lastTrigger && this.isInCooldown(lastTrigger, watch.cooldown_minutes)) {
      await this.logSkippedTrigger(watch.id, event, 'cooldown');
      return;
    }

    // Record trigger
    const triggerId = await this.recordTrigger(watch.id, event);

    // Execute prediction run
    try {
      const run = await this.financeService.execute({
        universeVersionId: await this.getActiveVersionId(watch.universe_id),
        riskProfileId: watch.risk_profile_id,
        triggeredBy: { watchId: watch.id, triggerId, event }
      });

      await this.updateTrigger(triggerId, { run_id: run.id, status: 'completed' });

      // Send notifications
      await this.notifyUser(watch, run, event);
    } catch (error) {
      await this.updateTrigger(triggerId, { status: 'failed', error: error.message });
    }
  }
}
```

---

#### API Endpoints

```
# Watch Management
GET    /api/finance/universes/:id/watches
POST   /api/finance/universes/:id/watches
GET    /api/finance/watches/:watchId
PATCH  /api/finance/watches/:watchId
DELETE /api/finance/watches/:watchId

# Watch Control
POST   /api/finance/watches/:watchId/enable
POST   /api/finance/watches/:watchId/disable
POST   /api/finance/watches/:watchId/test  # Trigger manually for testing

# Watch History
GET    /api/finance/watches/:watchId/triggers
GET    /api/finance/watches/:watchId/triggers/:triggerId
```

---

#### UI Components

**1. Watch Configuration Modal**:
```
┌─────────────────────────────────────────────────┐
│ Configure Universe Watch                         │
├─────────────────────────────────────────────────┤
│ Trigger Type: [Price Move ▼]                    │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ Price Move Settings                          │ │
│ │                                             │ │
│ │ Threshold: [5] %                            │ │
│ │ Direction: ○ Up ○ Down ● Both               │ │
│ │ Timeframe: [30] minutes                     │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ Risk Profile: [Balanced ▼]                      │
│ Cooldown: [60] minutes between triggers         │
│                                                 │
│ Notifications:                                  │
│  ☑ In-app   ☑ Email   ☐ Slack                 │
│                                                 │
│ [Cancel]            [Save Watch]                │
└─────────────────────────────────────────────────┘
```

**2. Watch Status Panel** (on Universe Detail):
```
┌─────────────────────────────────────────────────┐
│ Active Watches                            [+ Add]│
├─────────────────────────────────────────────────┤
│ ● Price Move (5%)          Last: 2h ago    [⚙]  │
│ ● News Break (earnings)    Last: 1d ago    [⚙]  │
│ ○ Scheduled (9 AM daily)   Disabled        [⚙]  │
├─────────────────────────────────────────────────┤
│ Recent Triggers:                                 │
│  • 2h ago: AAPL +6.2% → 3 recommendations       │
│  • 1d ago: "Apple earnings beat" → 2 recs       │
│  • 3d ago: MSFT volume 3.2x → 1 recommendation  │
└─────────────────────────────────────────────────┘
```

---

#### Implementation Notes

1. **Background Service**: Watch monitors run as background workers, not blocking the main API
2. **Scaling**: Each watch type can scale independently based on load
3. **Rate Limiting**: Built-in cooldowns prevent runaway triggers
4. **Cost Control**: Reactive runs use same three-stage pipeline, but can use faster/cheaper model mix for urgent responses
5. **Audit Trail**: All triggers logged with full event data for debugging and learning

**Success Metrics**:
- Reactive predictions made within 5 minutes of trigger event
- Watch precision: >80% of triggers result in actionable predictions
- User engagement: watches increase platform usage frequency
- False positive rate: <20% of triggers skipped due to irrelevance

---

## Data Model Summary

### New Tables (Three-Stage Pipeline)
1. `finance.analyst_teams` - Teams organized by data dimension (technical, fundamental, sentiment, agenda)
2. `finance.analyst_specialists` - Sub-specialists within each team (12 total)
3. `finance.specialist_predictions` - Individual specialist predictions before aggregation
4. `finance.specialist_universe_performance` - Per-universe performance tracking for specialists
5. `finance.evaluators` - Red team evaluators (5: Devil's Advocate, Risk Assessor, Data Skeptic, Historical Matcher, Confidence Calibrator)
6. `finance.prediction_challenges` - Evaluator challenges for each prediction
7. `finance.risk_profiles` - User risk profiles (aggressive, balanced, conservative)
8. `finance.packaged_recommendations` - Final clean recommendations per risk profile
9. `finance.user_preferences` - User defaults and notification settings

### New Tables (Tier 1 Triage)
10. `finance.triage_agents` - Three triage agents (Novelty, Magnitude, Context)
11. `finance.triage_results` - Results for each event's triage evaluation
12. `finance.triage_evaluations` - TP/TN/FP/FN tracking for triage improvement

### New Tables (Other Enhancements)
13. `finance.source_attributions` - Track source contributions to predictions
14. `finance.source_candidates` - Manage source discovery pipeline
15. `finance.missed_opportunities` - Track and analyze what we didn't predict
16. `finance.universe_watches` - Reactive mode watch configurations (4 trigger types: news_break, price_move, volume_spike, agenda_signal)
17. `finance.watch_triggers` - Watch execution history
18. `finance.user_universe_activity` - Track user's last seen timestamp per universe (for "X new since last visit")

### New Views
1. `finance.source_performance` - Aggregated source quality metrics
2. `finance.daily_performance` - Daily aggregated prediction stats (for analytics view)
3. `finance.specialist_leaderboard` - Ranked specialist performance by universe
4. `finance.recommendation_stream` - Recommendation stream with outcome status (for live view)
5. `finance.triage_performance` - Daily triage metrics (precision, recall, per-agent scores)

### Modified Tables
1. `finance.recommendations` - Add `confidence`, `confidence_factors`, `risk_profile_id` columns

---

## API Changes

### New Endpoints
```
# Three-Stage Pipeline
POST /finance/run
  Body: { universeVersionId, riskProfileId }  # Now includes risk profile
GET  /finance/specialists
GET  /finance/specialists/:id/performance
GET  /finance/evaluators
GET  /finance/risk-profiles
GET  /finance/runs/:runId/specialist-votes
GET  /finance/runs/:runId/challenges

# User Preferences
GET   /finance/preferences
PATCH /finance/preferences

# Live Recommendations Stream (Primary View)
GET  /finance/universes/:id/recommendations
  Query: ?limit=50&before=<cursor>&since=<timestamp>&filter=all|new|wins|losses&instrument=AAPL
  Response: {
    recommendations: [...],
    nextCursor: <string>,
    newCount: 12  # Count since last visit
  }
POST /finance/universes/:id/mark-seen
  Body: { until: <timestamp> }

# Analytics (Secondary View)
GET  /finance/universes/:id/analytics
  Query: ?period=30d|7d|90d|all
  Response: {
    winRate: 0.65,
    totalPredictions: 150,
    byInstrument: {...},
    dailyPerformance: [...]
  }

# Universe Watches (Reactive Mode - 4 trigger types)
GET    /finance/universes/:id/watches
POST   /finance/universes/:id/watches
GET    /finance/watches/:watchId
PATCH  /finance/watches/:watchId
DELETE /finance/watches/:watchId
POST   /finance/watches/:watchId/enable
POST   /finance/watches/:watchId/disable
POST   /finance/watches/:watchId/test
GET    /finance/watches/:watchId/triggers

# Polling Status (Admin/Debug)
GET  /finance/polling/status
  Response: {
    isRunning: true,
    lastPoll: { rss: <timestamp>, market: <timestamp>, news: <timestamp> },
    itemsProcessedToday: 1234
  }

# Source Management
GET  /finance/sources/performance
GET  /finance/sources/candidates
POST /finance/sources/candidates
PATCH /finance/sources/candidates/:id/status

# Missed Opportunities
GET  /finance/universes/:id/missed-opportunities
POST /finance/analyze-missed
```

### Modified Endpoints
```
# Recommendations now include risk-profile-specific output
GET /finance/recommendations/:runId
  Query: ?riskProfile=balanced
  Response: {
    recommendations: [...],  # Filtered/weighted for risk profile
    confidence: 0.78,
    _specialist_votes: {...},  # Hidden but available
    _challenges_summary: {...}  # Hidden but available
  }
```

---

## UI Changes

### New Components

**Live Recommendations Stream (Primary View)**
1. `RecommendationStream.vue` - Main component: infinite scroll list with date separators
2. `RecommendationCard.vue` - Clean output card with expandable detail
3. `RecommendationDetail.vue` - Expanded view showing specialist votes, challenges, sources
4. `NewRecommendationsBanner.vue` - "12 new since last visit" notification with mark-as-seen
5. `RecommendationFilters.vue` - Filter bar: All | New | Wins | Losses | By Instrument

**Specialist & Evaluator Detail (Drill-down)**
6. `SpecialistVotesPanel.vue` - Show all 12 specialist votes grouped by team
7. `ChallengesSummary.vue` - Show evaluator challenges with severity badges

**Analytics View (Secondary)**
8. `UniverseAnalytics.vue` - Performance charts, instrument breakdown, date range selector
9. `PerformanceChart.vue` - Win rate and returns over time
10. `InstrumentBreakdownTable.vue` - Sortable/filterable performance by instrument

**Configuration**
11. `RiskProfileSelector.vue` - Risk profile selection with descriptions
12. `WatchConfigModal.vue` - Configure universe watches (4 trigger types)
13. `WatchStatusPanel.vue` - Show active watches and recent triggers
14. `UserPreferencesModal.vue` - Configure default risk profile and notifications

**Admin/Utility**
15. `SourcePerformancePanel.vue` - Source quality metrics
16. `ConfidenceBadge.vue` - Visual confidence indicator (color-coded)
17. `MissedOpportunitiesCard.vue` - Display missed opportunity analysis
18. `PollingStatusIndicator.vue` - Show poller health (admin)

### Modified Components
1. `FinanceTab.vue` - Add risk profile selector, use RecommendationStream as primary view
2. `FinanceUniversesPage.vue` - Add watches panel, add Analytics link
3. `AdminSettingsPage.vue` - Add source management section (if admin)

---

## Implementation Phases

### Phase 1: Complete Learning Loop (Priority: Critical)
- Fix `getLearningContext()` to query real postmortems
- Inject learning context into recommendation prompt
- Verify learning feedback is working

### Phase 2: Service Decomposition (Priority: Critical)
- Break `finance.service.ts` into expert services
- Create service interfaces
- Update graph nodes to delegate to services
- Write comprehensive unit tests for each service

### Phase 3: Three-Stage Pipeline - Stage 1 (Priority: High)
- Create `analyst_teams` and `analyst_specialists` tables + seed data
- Create `specialist_predictions` and `specialist_universe_performance` tables
- Implement `SpecialistSwarmService` - runs 12 specialists in parallel
- Store all specialist predictions with rationale
- Track per-universe performance for each specialist

### Phase 4: Three-Stage Pipeline - Stage 2 (Priority: High)
- Create `evaluators` and `prediction_challenges` tables + seed data
- Implement 5 evaluator services (Devil's Advocate, Risk Assessor, Data Skeptic, Historical Matcher, Confidence Calibrator)
- Apply confidence adjustments based on challenges
- Store challenges with severity ratings

### Phase 5: Three-Stage Pipeline - Stage 3 (Priority: High)
- Create `risk_profiles`, `packaged_recommendations`, `user_preferences` tables + seed data
- Implement `RiskProfilePackagingService`
- Filter and weight by risk profile
- Generate clean output with hidden complexity
- UI: Risk profile selector, clean cards, expandable detail

### Phase 6: What We Missed Analysis (Priority: High)
- Create missed_opportunities table
- Implement opportunity scan workflow
- Add LLM analysis for missed moves
- Add "What We Missed" section to UI

### Phase 7: Universe History Dashboard (Priority: Medium)
- Create new Vue views/components
- Implement history API endpoints
- Calendar view, charts, drill-down
- Day detail with recommendations + misses

### Phase 8: Source Attribution (Priority: Medium)
- Create source_attributions table
- Track sources during recommendation generation
- Create performance view
- Admin UI for viewing source quality

### Phase 9: Reactive/Event-Driven Mode (Priority: Medium)
- Create `universe_watches` and `watch_triggers` tables
- Implement WatchService with monitor types (news, price, volume, scheduled, agenda)
- Background worker for active watch monitoring
- Notification service integration
- UI: Watch configuration modal, status panel

### Phase 10: Source Discovery (Priority: Lower)
- Create candidates table
- LLM-based source suggestion
- Shadow testing workflow
- Promotion/rejection workflow

---

## Success Criteria

1. **Learning Loop**: Recommendations cite past lessons in rationale
2. **Service Quality**: Each service has >80% unit test coverage, can be tested in isolation
3. **Three-Stage Pipeline**: Pipeline win rate > single-model win rate
4. **Evaluator Value**: High-confidence (post-challenge) predictions outperform raw predictions by >5%
5. **Risk Profile Fit**: Users report recommendations match their risk tolerance (>80% satisfaction)
6. **Clean Output**: Users don't need to see complexity to act on recommendations
7. **Missed Opportunities**: "Predictable misses" decrease over time (month-over-month)
8. **Source Quality**: Can identify which sources contribute most to success
9. **Operational Visibility**: Users can review any day's predictions and outcomes
10. **Reactive Mode**: Watch triggers result in actionable predictions >80% of the time
11. **Reactive Latency**: Predictions made within 5 minutes of trigger event

---

## Open Questions

### Resolved (from discussion)
1. **Analyst Organization**: Teams by data dimension (technical, fundamental, sentiment, agenda) with 3 sub-specialists each = 12 specialists total
2. **Evaluator Count**: 5 evaluators (Devil's Advocate, Risk Assessor, Data Skeptic, Historical Matcher, Confidence Calibrator)
3. **Universe Sharing**: Shared personas with per-universe performance tracking
4. **Output Philosophy**: Clean output to users; complexity hidden but available on drill-down
5. **LLM Cost**: Acceptable if quality improves. Use Haiku/local for high-volume specialists, Sonnet for evaluators
6. **User Configuration**: Risk profile selected at run start, preferences stored as defaults

### Open
1. **Confidence Calibration**: How often should we recalibrate confidence scoring? (Proposed: weekly)
2. **Miss Threshold**: What % move counts as "significant" for missed opportunity analysis? (Proposed: 3%)
3. **Source Testing Period**: How long should sources be in shadow testing? (Proposed: 2 weeks)
4. **History Retention**: How far back should we keep detailed prediction history? (Proposed: 1 year)
5. **Watch Cooldown**: What's the minimum time between watch triggers? (Proposed: 60 minutes default)
6. **Model Selection**: Which specialists should use local models vs. cloud? (Needs benchmarking)

---

## Bootstrap & Historical Data Import

### The Bootstrap Problem

The learning system requires historical data to generate meaningful lessons before going live. Without bootstrap data:
- No learning context available for predictions
- No historical patterns to reference
- No baseline for evaluating accuracy

We need to backfill approximately **60 days of data** to train the system through simulated daily runs.

### Data Availability Assessment

| Data Type | Source | Free Tier Availability | Recommendation |
|-----------|--------|----------------------|----------------|
| **Intraday Prices** | Yahoo Finance | 60 days, 1m/5m/15m/30m/60m intervals | ✅ Use 5m data, aggregate to 10m |
| **Intraday Prices** | Alpha Vantage | 30 days trailing | ⚠️ Shorter window, use as backup |
| **Daily OHLCV** | Yahoo Finance | Full history | ✅ Use for longer trends |
| **Historical RSS** | Standard feeds | Only recent 3-5 items | ❌ Not feasible |
| **Historical News** | Yahoo Finance | No public API | ❌ Not directly available |
| **Historical News** | News API | Archive with paid plan | 💰 Optional paid source |
| **Historical News** | Polygon.io | With subscription | 💰 Optional paid source |

### Bootstrap Strategy

Given the constraints, we recommend a **price-first bootstrap** approach:

#### Phase 1: Price Pattern Learning (Day 0-7)

Focus on price data only, which is fully available:

```typescript
interface HistoricalPriceImportConfig {
  lookbackDays: 60;
  interval: '5m';          // Aggregate to 10m
  sources: ['yahoo'];      // Primary source
  fallback: ['alphavantage']; // If Yahoo fails
}

// Import workflow
async function bootstrapPriceData(universe: Universe): Promise<void> {
  for (const instrument of universe.instruments) {
    // 1. Fetch 60 days of 5-minute data
    const rawData = await yahooFinance.getHistoricalIntraday(instrument, {
      interval: '5m',
      period: '60d'
    });

    // 2. Aggregate to 10-minute buckets
    const aggregated = aggregateToInterval(rawData, '10m');

    // 3. Calculate day/hour movements for pre-filter training
    const withMovements = calculateMovements(aggregated);

    // 4. Store in market_data table
    await financeDb.bulkInsertMarketData(instrument, withMovements);
  }
}
```

#### Phase 2: Synthetic Event Replay (Day 7-14)

Run the system in "replay mode" against historical data:

```typescript
interface ReplayConfig {
  startDate: Date;       // 60 days ago
  endDate: Date;         // Today
  speed: 'fast';         // Skip to next event, no real-time waiting
  generateEvents: true;  // Create synthetic price events
  runTriage: true;       // Test pre-filter and triage
  runAnalysis: false;    // Skip full analysis (no news context)
  recordBaseline: true;  // Store what the pre-filter would have passed
}
```

This phase:
- Tests the pre-filter thresholds against real data
- Identifies which price movements would trigger analysis
- Creates a baseline of "interesting" events
- Does NOT generate predictions (no news context available)

#### Phase 3: Forward Collection + Shadow Mode (Day 14-30)

Start real-time collection while running predictions in shadow mode:

```
Real-time sources:
├── Price polling (every 10 minutes)
├── RSS monitoring (every 15 minutes)
├── News API (every 30 minutes) [optional]
└── Yahoo Finance headlines (every hour)

Shadow mode:
├── Run full pipeline on new events
├── Generate predictions but mark as "shadow"
├── Track what we WOULD have recommended
└── Evaluate outcomes when prices resolve
```

#### Phase 4: Go Live (Day 30+)

After 30 days of shadow mode:
- Review shadow prediction accuracy
- Fine-tune confidence thresholds
- Accumulate initial learning context
- Enable live recommendations

### Historical News Alternative

For teams that want news context during bootstrap, options include:

**Option A: News API Archive ($449/month)**
- 3 years of historical news
- Full-text search
- Ticker associations
- Good: Comprehensive coverage
- Bad: Expensive, may not match Yahoo Finance exactly

**Option B: Forward Collection Only**
- Start RSS/news polling immediately
- Accept that first 30 days have limited news context
- System learns forward from day one
- Good: Free, simple
- Bad: No historical news patterns

**Option C: Wayback Machine Reconstruction**
- Use tools like `history4feed` to reconstruct RSS history
- Scrape Wayback Machine for archived pages
- Good: Free, access to some history
- Bad: Spotty coverage, labor-intensive, may miss most items

**Recommendation**: Option B (Forward Collection Only) for initial launch, with Option A as a Phase 2 enhancement if deeper historical analysis proves valuable.

### Bootstrap Data Storage

```sql
-- Table for imported historical data (separate from live data)
CREATE TABLE finance.historical_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id UUID REFERENCES finance.instruments(id),
  import_type TEXT NOT NULL, -- 'price_intraday', 'price_daily', 'news_archive'
  source TEXT NOT NULL,       -- 'yahoo', 'alphavantage', 'newsapi'
  data_start_ts TIMESTAMPTZ NOT NULL,
  data_end_ts TIMESTAMPTZ NOT NULL,
  record_count INTEGER,
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);

-- Mark replay-generated events distinctly
ALTER TABLE finance.triage_events
ADD COLUMN is_replay BOOLEAN DEFAULT FALSE;

-- Mark shadow predictions distinctly
ALTER TABLE finance.recommendations
ADD COLUMN is_shadow BOOLEAN DEFAULT FALSE;
```

### Bootstrap Commands

```bash
# Phase 1: Import historical price data
npm run finance:bootstrap:prices -- --days=60 --universe=my-universe

# Phase 2: Replay historical events
npm run finance:bootstrap:replay -- --start=2025-11-08 --end=2026-01-07

# Phase 3: Start shadow mode
npm run finance:shadow:start -- --universe=my-universe

# Check shadow mode status
npm run finance:shadow:status

# Phase 4: Go live
npm run finance:shadow:promote -- --universe=my-universe
```

### Success Criteria for Bootstrap

- [ ] 60 days of 10-minute price data for all universe instruments
- [ ] Pre-filter thresholds validated against historical data
- [ ] Replay identifies at least 100 "significant" events per universe
- [ ] Shadow mode runs for 14+ days with <5% error rate
- [ ] At least 50 shadow predictions generated with tracked outcomes
- [ ] Initial learning context file populated with lessons

---

## Migration Strategy: V1 to V2

### Analysis

The v1 Finance Agent is a **request-driven** system: an API call triggers a single synchronous workflow. The v2 architecture is fundamentally **event-driven**: continuous polling generates events that flow through triage before analysis. This architectural shift means the core workflow needs to be rebuilt rather than incrementally modified.

### What to Keep from V1

These components are solid foundations that should be preserved:

| Component | Location | Rationale |
|-----------|----------|-----------|
| **Database Schema** | `apps/api/src/finance/` migrations | Tables for universes, instruments, recommendations, news items, etc. are well-designed and compatible with v2 |
| **Data Connectors** | `apps/langgraph/src/agents/finance/connectors/` | Yahoo Finance, Alpha Vantage, RSS fetchers are working and will be reused by the polling system |
| **NestJS Module Structure** | `finance.module.ts`, `finance.controller.ts` | The module/controller/service pattern is correct; we extend it rather than replace it |
| **Database Service** | `finance-db.service.ts` | Query patterns are reusable; add new methods for triage/specialist tables |
| **DTO Definitions** | `apps/langgraph/src/agents/finance/dto/` | Type definitions can be extended for new capabilities |
| **Test Infrastructure** | `*.spec.ts` files | Test patterns and mocks can be extended |

### What to Rebuild

These components need architectural changes that make incremental modification impractical:

| Component | Current State | Target State | Why Rebuild |
|-----------|---------------|--------------|-------------|
| **Core Workflow** | Single `execute()` method, synchronous | Event-driven with triage gate | Entry point concept changes fundamentally |
| **Service Layer** | Monolithic `finance.service.ts` | 12+ decomposed expert services | V1 service mixes too many concerns; cleaner to start fresh with right boundaries |
| **Graph Structure** | Linear flow for single request | Two-tier evaluation (triage → full analysis) | Graph topology changes significantly |
| **State Management** | Request-scoped state | Event state + watch state + recommendation stream | State model expands substantially |

### Migration Phases

**Phase A: Database Foundation (Week 1)**
```
Keep: Existing tables (universes, instruments, recommendations, news_items, etc.)
Add: New tables for triage, specialists, evaluators, risk profiles
Add: New views for recommendation stream, triage performance
```

**Phase B: Connectors & Polling Layer (Week 1-2)**
```
Keep: Existing connector implementations
Add: ContinuousPollerService - wraps connectors in polling loops
Add: EventProcessorService - routes polled items to triage
```

**Phase C: Triage Layer (Week 2)**
```
New: TriageService - runs 3 cheap agents on every event
New: Triage agents table + seed data
New: Triage result storage
```

**Phase D: Specialist & Evaluator Services (Week 2-3)**
```
New: SpecialistSwarmService - runs 12 specialists in parallel
New: EvaluatorService - runs 5 evaluators (red team)
New: Analyst/evaluator tables + seed data
Keep: Some existing analysis logic can be extracted into specialists
```

**Phase E: Risk Profile Packaging (Week 3)**
```
New: RiskProfilePackagingService - filters by confidence, weights by team
New: Risk profile tables + seed data
New: User preferences table
```

**Phase F: Integration & Cutover (Week 3-4)**
```
Update: Controller to support both old and new endpoints
Update: Module to wire new services
Add: Feature flag to route traffic
Test: Run both systems in parallel, compare results
Deprecate: Old execute() flow once v2 is validated
```

### Coexistence Strategy

During migration, both systems can run simultaneously:

```typescript
// finance.controller.ts
@Post('run')
async run(@Body() dto: FinanceRequestDto) {
  if (this.configService.get('FINANCE_V2_ENABLED')) {
    // New event-driven flow
    return this.financeV2Service.triggerAnalysis(dto);
  } else {
    // Legacy synchronous flow
    return this.financeService.execute(dto);
  }
}
```

### Data Migration

No data migration needed - v2 tables are additive:
- Existing `recommendations` table continues to work
- New `packaged_recommendations` links to existing recommendations
- Specialist votes and challenges are stored separately
- Triage results have their own table

### Risk Mitigation

1. **Feature Flag**: Roll out v2 behind a flag, enable per-universe
2. **Parallel Running**: Run both systems during transition, compare outputs
3. **Rollback Path**: Keep v1 code intact until v2 is validated
4. **Incremental Tables**: Add tables one at a time, each with its own migration
5. **Connector Reuse**: Minimize risk by keeping proven data fetching code

### Success Criteria for Migration

- [ ] All v1 API endpoints continue to work during migration
- [ ] New triage layer filters >80% of noise events
- [ ] Specialist swarm produces richer analysis than v1 single-model
- [ ] Evaluator challenges correlate with actual prediction failures
- [ ] User risk profile filtering matches user expectations
- [ ] No data loss during transition
- [ ] V2 latency within 2x of v1 for equivalent operations

---

## Appendix: Example Learning Context Prompt

```
LEARNING FROM PAST PREDICTIONS:

Recent lessons for AAPL, MSFT, GOOGL:
- [2026-01-05] AAPL: Predicted BUY, actual -2.3% (LOSS). Lesson: Earnings uncertainty should lower confidence
- [2026-01-04] MSFT: Predicted HOLD, actual +1.2% (WIN). Lesson: Conservative approach during low-volume days works
- [2026-01-03] GOOGL: Predicted SELL, actual -4.1% (WIN). Lesson: Negative agenda signals were strong predictors

Instrument-specific insights:
- AAPL: 62% win rate, tends to overreact to news (mean reversion opportunity)
- MSFT: 71% win rate, responds well to technical signals
- GOOGL: 55% win rate, highly sensitive to regulatory news

Recent missed opportunities:
- [2026-01-05] NVDA: Moved +8.2%, we had no prediction. Signals we missed: Strong pre-market volume, AI news cluster

Apply these lessons to your current recommendations.
```

---

*Document created: 2026-01-07*
*Author: Claude Code + User collaboration*
*Status: Draft for review*
