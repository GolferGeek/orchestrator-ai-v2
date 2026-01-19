# Finance Stock/Crypto Predictor - Complete Capabilities Overview

**Document Created**: 2026-01-16
**System Version**: Production
**Purpose**: High-level inventory of ALL system capabilities for documentation, testing, and stakeholder communication

---

## Executive Summary

The Finance Stock/Crypto Predictor is a production-grade AI-powered prediction platform featuring:
- Multi-LLM ensemble prediction pipeline
- Dual-fork analyst learning system with $1M progress accounts
- Comprehensive portfolio management with position tracking
- Full rollback and version history capabilities
- Extensive testing infrastructure

---

## 1. PREDICTION & FORECASTING SYSTEM

### 1.1 Core Prediction Pipeline
- **5-Stage Architecture**: Source Crawling → Signal Detection → Predictor Generation → Prediction Generation → Evaluation
- **Multi-LLM Ensemble**: Gold (Opus 4.5), Silver (Sonnet 4), Bronze (Haiku) tiers
- **Threshold-Based Triggers**: Configurable min_predictors, min_combined_strength, min_direction_consensus

### 1.2 Universe & Target Management
- **Universes**: Analysis domains (stocks, crypto)
- **Targets**: Individual symbols (AAPL, BTC, ETH, etc.)
- **Test Isolation**: T_ prefix targets isolated from production metrics

### 1.3 Source Management & Crawling
- **Source Types**: News feeds, RSS, APIs
- **Crawl Frequencies**: 5, 10, 15, 30, 60 minute intervals
- **Scopes**: Runner, domain, universe, target level configuration

### 1.4 Signal Detection & Processing
- **LLM Analysis**: Direction detection (bullish/bearish/neutral)
- **Confidence Scoring**: 0.0-1.0 scale
- **Deduplication**: Content hash + fuzzy matching

### 1.5 Predictor Generation
- **Predictor Synthesis**: Converts signals into structured predictors (e.g., catalyst, thesis, timeframe, confidence)
- **Aggregation Inputs**: Produces predictor artifacts used by downstream prediction ensemble voting
- **Traceability**: Links predictors back to source(s) and signal(s) for audit/evaluation

### 1.5 Prediction Generation
- **Ensemble Voting**: Multi-tier LLM consensus
- **Confidence Weighting**: Tier-based confidence adjustments
- **Direction & Magnitude**: Price movement predictions with target prices

### 1.6 Evaluation & Scoring
- **Auto-Evaluation**: Direction, magnitude, timing, overall scores (0.0-1.0)
- **Manual Override**: User corrections with full audit trail
- **Outcome Tracking**: Actual vs predicted price comparison

---

## 2. PORTFOLIO & TRADING SYSTEM

### 2.1 User Portfolios
- **Starting Balance**: $1,000,000 default
- **Position Types**: Long and short positions
- **P&L Tracking**: Realized and unrealized profit/loss
- **Win Rate**: Automatic tracking of successful trades

### 2.2 Analyst Progress Accounts (Dual Fork Model)
- **Two Portfolios Per Analyst**: Each analyst gets $1M in TWO accounts
  - **User Fork**: Learning loop controlled, conservative, human-guided
  - **Agent Fork**: Self-improving with motivation system
- **Status Motivation System** (Agent fork):
  - Active: ≥80% of initial balance
  - Warning: 60-80%
  - Probation: 40-60%
  - Suspended: <40%

### 2.3 Position Management
- **Position Sizing**: Risk-based (2% default per trade)
- **Confidence-Adjusted Sizing**: Higher confidence = larger positions
- **Stop Loss & Targets**: Automatic calculation recommendations
- **Paper Trading**: Recovery mode for suspended analysts

---

## 3. ANALYST & LEARNING SYSTEM

### 3.1 Analyst Management
- **Configuration**: Perspective, tier instructions, default weight
- **Assessment Tracking**: System of record for LLM analysis decisions
- **Fork Attribution**: Clear tracking of which fork made each decision

### 3.2 Context Versioning (Complete Version History)
- **Analyst Context Versions**: Perspective, instructions, weights, agent journal
- **Runner Context Versions**: System-wide configuration history
- **Universe Context Versions**: Universe-level configuration history
- **Target Context Versions**: Target-specific configuration history

### 3.3 Rollback & Learning Data Management
- **Context Rollback**: Revert analyst to any previous version
- **Non-Destructive**: Creates new version, preserves full history
- **Audit Trail**: Complete modification log

### 3.4 Agent Self-Modification
- **Modification Types**: rule_added, rule_removed, weight_changed, journal_entry, status_change
- **Performance Context**: Captured at time of modification
- **HITL Acknowledgment**: Human approval tracking

### 3.5 Learning Exchange (Bidirectional Learning)
- **Fork Learning Exchanges**: Dialogue between user and agent forks
- **Initiator Tracking**: Who proposed the change
- **Outcome Recording**: adopted, rejected, noted, pending
- **Performance Evidence**: Stored for each exchange

### 3.6 Performance Metrics
- **Daily Analyst Metrics**:
  - Solo P&L (if only this analyst)
  - Contribution P&L (weighted ensemble)
  - Dissent Accuracy (accuracy when disagreeing with consensus)
  - Portfolio Ranking

### 3.7 Learning Queues
- **Review Queue**: Human-in-the-loop for uncertain signals (0.4-0.7 confidence)
- **Learning Queue**: AI-suggested improvements from evaluation

---

## 4. TESTING & VALIDATION SYSTEM

### 4.1 Test Data Infrastructure
- **Test Isolation**: `is_test_data` flag on all test records
- **T_ Prefix Targets**: Isolated from production metrics
- **Synthetic Data Generation**: Articles, prices, scenarios

### 4.2 Test Lab Dashboard
- **Test Scenario Creation**: Define test conditions
- **Synthetic Article Generator**: Create test news content
- **Price Data Generator**: Historical and real-time test prices
- **Target Mirroring**: Clone real targets for testing
- **Backtest Runner**: Historical scenario replay

### 4.3 Test Scenario Management
- **Scenario Tracking**: Name, description, injection points
- **Status Management**: pending, running, completed, failed
- **Results Storage**: Full execution history

### 4.4 Replay Testing
- **Historical Replay**: Run pipeline against past data
- **Scenario Injection**: Insert specific test conditions
- **Comparison Analysis**: Expected vs actual results

---

## 5. ANALYTICS & MONITORING

### 5.1 Analytics Dashboard
- **Overall Accuracy Rate**: System-wide prediction accuracy
- **Accuracy by Target**: Per-symbol performance
- **Accuracy by Strategy**: Strategy effectiveness comparison
- **Signal Quality Metrics**: Source and detection quality
- **Analyst Performance**: Individual analyst comparison

### 5.2 Missed Opportunity Detection
- **Unpredicted Move Analysis**: Significant moves without prediction
- **Root Cause Analysis**: Why was it missed?
- **Improvement Suggestions**: Actionable recommendations

### 5.3 Background Runners (Automated Processes)
- **SourceCrawlerRunner**: 5/10/15/30/60 minute intervals
- **BatchSignalProcessorRunner**: Every 15 minutes
- **BatchPredictionGeneratorRunner**: Every 30 minutes
- **OutcomeTrackingRunner**: Every 15 minutes
- **EvaluationRunner**: Hourly
- **MissedOpportunityScannerRunner**: Every 4 hours
- **ExpirationRunner**: Periodic cleanup

---

## 6. USER INTERFACE SCREENS

### 6.1 Prediction System UI
- **Terminology note**:
  - **Agents** = records in `public.agents` (what users select in the app)
  - **Instruments** = the tradable items being predicted (what the backend historically calls "targets", e.g., AAPL, BTC)
- **Dashboard** (`/prediction`): System overview
- **Instruments List** (`/prediction/targets`): Browse instruments (targets)
- **Instrument Detail** (`/prediction/targets/:id`): Individual instrument (target) view
- **Universe Config** (`/prediction/universes`): Universe management
- **Analyst Management** (`/prediction/analysts`): Analyst configuration
- **Prediction Detail** (`/prediction/predictions/:id`): Individual prediction
- **Signal Detail** (`/prediction/signals/:id`): Signal analysis
- **Review Queue** (`/prediction/review`): HITL interface
- **Learning Queue** (`/prediction/learnings`): Improvement suggestions
- **Analytics** (`/prediction/analytics`): Performance metrics
- **Test Lab** (`/prediction/test-lab`): Testing interface

---

## 7. DATABASE ARCHITECTURE

### 7.1 Prediction Schema Tables
**Authoritative source**: these are the actual table names in the `prediction` Postgres schema (i.e., referenced as `prediction.<table_name>`).

- **Core entities**: `universes`, `targets`, `sources`, `signals`, `predictors`, `predictions`, `evaluations`, `strategies`
- **Context/versioning & snapshots**: `runner_context_versions`, `universe_context_versions`, `target_context_versions`, `snapshots`, `target_snapshots`
- **Crawling & ingestion**: `source_crawls`, `source_seen_items`
- **Queues, learning & HITL**: `review_queue`, `learning_queue`, `learnings`, `learning_lineage`, `fork_learning_exchanges`
- **Analysts & performance**: `analysts`, `analyst_assessments`, `analyst_context_versions`, `analyst_overrides`, `analyst_performance_metrics`, `analyst_adaptation_diffs`, `agent_self_modification_log`
- **Portfolios & positions**: `analyst_portfolios`, `analyst_positions`, `user_portfolios`, `user_positions`
- **Scenario/test execution**: `scenario_runs`
- **Missed opportunities**: `missed_opportunities`
- **Tooling**: `tool_requests`
- **Testing infrastructure**: `test_scenarios`, `test_articles`, `test_price_data`, `test_target_mirrors`, `test_audit_log`

---

## 8. API ENDPOINTS SUMMARY

### 8.1 Prediction Runner API
**Primary execution endpoint (A2A, JWT required)**:
- `POST /agent-to-agent/:orgSlug/:agentSlug/tasks` - executes tasks for the selected agent (includes Prediction UI `mode: "dashboard"` requests)

**Dashboard mode (Prediction UI data API)**:
- **Action format**: `<entity>.<operation>` via `payload.action` (routed by `PredictionDashboardRouter`)
- **Entities**: `universes`, `targets`, `predictions`, `sources`, `signals`, `analysts`, `learnings`, `learning-queue`, `review-queue`, `strategies`, `missed-opportunities`, `tool-requests`, `learning-promotion`, `test-scenarios`, `test-articles`, `test-price-data`, `test-target-mirrors`, `analytics`, `source-seen-items`, `agent-activity`, `learning-session`

**Streaming (SSE, JWT required)**:
- `POST /agent-to-agent/:orgSlug/:agentSlug/tasks/:taskId/stream-token` - mint short-lived stream token
- `GET /agent-to-agent/:orgSlug/:agentSlug/tasks/:taskId/stream` - stream progress/events

**Async completion callback (no JWT; used by async workflows)**:
- `POST /agent-to-agent/:orgSlug/:agentSlug/tasks/:taskId/complete`

**Agent discovery / cards**:
- `GET /agent-to-agent/.well-known/hierarchy`
- `GET /agent-to-agent/:orgSlug/:agentSlug/.well-known/agent.json` (also `GET /agents/:orgSlug/:agentSlug/.well-known/agent.json`)
- `GET /agent-to-agent/:orgSlug/:agentSlug/health`
- `POST /agent-to-agent/conversations` (JWT required)

**Task records (generic, JWT required)**:
- `GET /tasks`, `GET /tasks/metrics`, `GET /tasks/active`
- `GET /tasks/:id`, `PUT /tasks/:id`, `DELETE /tasks/:id`
- `GET /tasks/:id/status`, `GET /tasks/:id/messages`
- `GET /tasks/:id/progress` (SSE), `PUT /tasks/:id/progress`

---

## 9. INTEGRATION POINTS

### 9.1 External Data Sources
- News API integration
- RSS feed parsing
- Market data APIs (prices, volumes)

### 9.2 LLM Integration
- **Multi-provider support**: Anthropic, OpenAI, Google, xAI, Ollama
- **Local development option**: Ollama-hosted models (where configured)
- Model tier management
- Token usage tracking

### 9.3 Observability
- Observability is implemented primarily through our webhooks endpoint and the SSE (Server-Sent Events) frontend, enabling near real-time monitoring of prediction and analysis events.
- All LLM calls are routed through a dedicated LLM service that provides full observability into the cost, latency, and success/failure status of each model run.
- Core event, performance, and error tracking logs are emitted by services and centralized through internal endpoints, allowing basic analysis and debugging.
- No third-party observability providers are used at this time; all monitoring and tracing is performed in-house, with system coverage corresponding to our internal integration points.

---

## Document Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-16 | 1.0 | Initial comprehensive capabilities document |

---

**Next Steps**:
1. Create detailed description document expanding each capability
2. Build comprehensive testing script
3. Execute systematic testing
