---
name: Finance learning-loop agent
overview: Add a finance-only (org slug `finance`) workflow that stores market/world data, generates multi-timing buy/sell recommendations, evaluates outcomes, and logs post-hoc "why it happened" explanations (including manipulation/agenda signals) as first-class learning data for future decisions.
todos:
  # ============================================
  # PHASE 1: Foundation (org + schema + RBAC)
  # ============================================
  - id: org-finance-creation
    content: "Create `finance` organization migration with org record, default settings, features, and preferences. Assign test user(s) to the org. Follow pattern from `20260105000002_create_legal_org.sql` and `20251229200004_add_engineering_org_and_user.sql`."
    status: pending

  - id: schema-finance
    content: "Add `finance` schema migration: universes (versioned+active), market/news storage, agenda extraction tables, recommendations+outcomes+postmortems. Include RLS policies gated to org `finance`, service role bypass policies, `updated_at` triggers, and performance indexes. Follow engineering schema pattern in `20251229200001_create_engineering_schema.sql`."
    status: pending
    dependencies:
      - org-finance-creation

  - id: rbac-finance-admin-permission
    content: "Add RBAC permission `finance:admin` (category `finance`) via migration. Grant to `admin` role in org `finance`. Assign finance admin role to test user(s). Follow pattern from `20260105000011_create_legal_agents.sql` RBAC section."
    status: pending
    dependencies:
      - org-finance-creation

  # ============================================
  # PHASE 2: Backend API + LangGraph
  # ============================================
  - id: api-finance-module
    content: "Implement `apps/api/src/finance/` module with: FinanceController, FinanceService, FinanceModule, and DTOs (CreateUniverseDto, UpdateUniverseDto, CreateUniverseVersionDto, etc.). Register module in app.module.ts. Enforce org `finance` guard + RBAC using @UseGuards(JwtAuthGuard, RbacGuard) and @RequirePermission('finance:admin'). Endpoints: universe CRUD, trigger run, list recommendations/outcomes."
    status: pending
    dependencies:
      - schema-finance
      - rbac-finance-admin-permission

  - id: langgraph-finance-endpoint
    content: "Add LangGraph workflow in `apps/langgraph/src/agents/finance/` following marketing-swarm pattern: finance.module.ts, finance.controller.ts, finance.service.ts, finance.graph.ts, finance.state.ts, finance-db.service.ts, and request DTOs. Accept ExecutionContext capsule + payload, generate multi-timing recommendations, write to `finance.*` tables. Include SSE streaming for progress updates."
    status: pending
    dependencies:
      - schema-finance

  - id: api-agent-finance-registration
    content: "Register `finance-research` agent in `public.agents` via incremental migration: agent_type='api', organization_slug='finance', transport.api.endpoint pointing to LangGraph finance endpoint. Metadata: hasCustomUI=true, customUIComponent='finance', provider='langgraph', langgraphWorkflow='finance'. Include io_schema, capabilities array, and context markdown. Follow `20251229200006_register_cad_agent.sql` pattern."
    status: pending
    dependencies:
      - langgraph-finance-endpoint

  # ============================================
  # PHASE 3: Data Processing Pipelines
  # ============================================
  - id: data-connectors-finance
    content: "Implement market data and news ingestion connectors in LangGraph finance module: RSS/GDELT for open-source news, Yahoo Finance or Alpha Vantage for market data (free tier). Create abstract connector interface for future licensed providers (Bloomberg/Refinitiv). Write to `finance.market_bars` and `finance.news_items`."
    status: pending
    dependencies:
      - schema-finance

  - id: agenda-extraction
    content: "Implement LLM-based agenda/manipulation extraction node in finance graph. Process stored news items, extract narrative objects with confidence + citations, persist to `finance.agenda_events` and `finance.agenda_features`. Integrate extracted signals into decision context for recommendation generation."
    status: pending
    dependencies:
      - schema-finance
      - data-connectors-finance

  - id: evaluation-loop
    content: "Implement next-day evaluation + postmortem generation pipeline as scheduled LangGraph workflow node. Add scheduling mechanism (cron endpoint or pg_cron trigger) to run evaluation at market close. Query `finance.recommendations` for pending evaluations, compute outcomes from realized prices, generate 'why it happened' explanations via LLM, write to `finance.recommendation_outcomes` and `finance.postmortems`. Feed lessons back into learning context."
    status: pending
    dependencies:
      - schema-finance
      - langgraph-finance-endpoint
      - data-connectors-finance

  # ============================================
  # PHASE 4: Frontend
  # ============================================
  - id: web-finance-service
    content: "Create `apps/web/src/services/financeService.ts` for API calls to finance module endpoints: getUniverses, createUniverse, getRecommendations, getOutcomes, triggerRun. Follow `ragService.ts` pattern."
    status: pending
    dependencies:
      - api-finance-module

  - id: web-finance-store
    content: "Create `apps/web/src/stores/financeStore.ts` Pinia store for managing finance state: universes, activeUniverse, recommendations, outcomes, loading states. Include actions for CRUD operations using financeService. Follow `ragStore.ts` pattern."
    status: pending
    dependencies:
      - web-finance-service

  - id: web-finance-custom-pane
    content: "Create `FinanceTab.vue` component in `apps/web/src/components/` with tabs: Config (universe selection, timing windows), Progress (SSE streaming status), Recommendations (list with outcomes, win/loss indicators, postmortem links). Add conditional render in ConversationView.vue for `customUIComponent === 'finance'`. Follow MarketingSwarmTab pattern."
    status: pending
    dependencies:
      - api-agent-finance-registration
      - web-finance-store

  - id: web-admin-finance-universes
    content: "Add 'Finance Universes' nav item in AdminSettingsPage.vue under 'Data & Access' group, gated by `v-permission=\"finance:admin\"`. Create `apps/web/src/views/admin/FinanceUniversesPage.vue` async-loaded component with: stats overview (universe count, recommendation count, success rate), universe cards with CRUD actions, version management (create version, set active), instrument list editor. Follow RagCollectionsPage.vue pattern."
    status: pending
    dependencies:
      - rbac-finance-admin-permission
      - web-finance-store

  # ============================================
  # PHASE 5: Testing
  # ============================================
  - id: tests-finance-api
    content: "Write Jest tests for finance API module: FinanceController.spec.ts, FinanceService.spec.ts. Test universe CRUD, recommendation listing, RBAC enforcement, org `finance` guard. Use existing Supabase test auth patterns."
    status: pending
    dependencies:
      - api-finance-module

  - id: tests-finance-langgraph
    content: "Write Jest tests for LangGraph finance workflow: finance.controller.spec.ts, finance.service.spec.ts, finance-db.service.spec.ts. Test recommendation generation, outcome evaluation, postmortem creation. Follow marketing-swarm test patterns."
    status: pending
    dependencies:
      - langgraph-finance-endpoint
      - evaluation-loop
---

# Finance agent: multi-universe + learning loop

## Goals (v1)

- **Multiple tradable universes** (sets of instruments) stored in a dedicated `finance` Postgres schema, scoped to org/user but **restricted to org slug `finance`**.
- **Two parallel schemas of inputs**:
  - **Traditional market/metrics**: prices + derived features.
  - **Agenda/manipulation**: extracted narrative objects with confidence + citations.
- **Multi-timing recommendations**: each daily run can emit multiple "what would you do" records (pre-close, post-close, pre-open, intraday), without requiring us to pick a single timing upfront.
- **Learning loop**: store success/failure + next-day outcome + post-hoc explanation, and feed those back into the next run.

## Key design choices (aligned to your notes)

- **No auto-trading yet**: the agent only writes **recommendation records** (buy/sell/hold + time window + intended price/entry method + rationale).
- **Versioned + active** for universes/feature sets/models so you can A/B and audit.
- **Finance-only gating**:
  - RLS and API checks require `org_slug = 'finance'`.
  - Access controlled via existing RBAC membership (`public.rbac_user_org_roles`) pattern used by other domain schemas (see [`20251229200001_create_engineering_schema.sql`](apps/api/supabase/migrations/20251229200001_create_engineering_schema.sql)).

## Data model (new `finance` schema)

Create a migration that follows the repo's domain-schema pattern (schemas like `engineering`, `orch_flow`, `code_ops` already exist).

### Universe configuration
- `finance.universes` (id, org_slug, slug, name, description, created_by, created_at, updated_at)
- `finance.universe_versions` (id, universe_id, version, is_active, config_json, created_at)
  - `config_json` holds instruments list, market hours/timezone, allowed timing windows, data-source profile refs.

### Raw market data + features
- `finance.market_bars` (id, instrument, ts, open, high, low, close, volume, vendor, ingestion_metadata, created_at)
- `finance.market_features` (id, universe_version_id, asof_ts, instrument, feature_set_version_id, features_json, created_at)

### News/world events (license-safe)
- `finance.news_items` (id, source, published_at, url, title, snippet, vendor_ids, retrieval_metadata, created_at)
- Optional `finance.news_fulltext` only if/when license allows; otherwise keep references.

### Agenda/manipulation schema (LLM extracted)
- `finance.agenda_events` (id, asof_ts, source_refs[], narrative, suspected_incentive, target_instruments[], confidence, evidence_json, created_at)
- `finance.agenda_features` (id, universe_version_id, asof_ts, instrument, agenda_features_json, created_at)

### Recommendations + evaluation + learning
- `finance.recommendation_runs` (id, universe_version_id, run_ts, produced_by_agent, inputs_hash, status, created_at)
- `finance.recommendations` (id, run_id, instrument, action, timing_window, entry_style, intended_price, sizing_json, rationale, model_metadata, created_at)
- `finance.recommendation_outcomes` (id, recommendation_id, realized_return_metrics_json, win_loss, evaluation_notes, evaluated_at, created_at)
- `finance.postmortems` (id, recommendation_id, what_happened, why_it_happened, links_to_agenda_events[], lessons, created_at)

### Required schema infrastructure
- **RLS policies**: All tables gated to `org_slug = 'finance'` using helper function
- **Service role bypass**: `USING (true)` policies for service role on all tables
- **Updated_at triggers**: Auto-update `updated_at` on universes table
- **Indexes**: On foreign keys, timestamps, and frequently queried columns

## Execution flow

```mermaid
flowchart TD
  ingest[IngestMarketAndNews] --> storeRaw[StoreRawData]
  storeRaw --> extractAgenda[ExtractAgendaSignals]
  extractAgenda --> storeAgenda[StoreAgendaSchema]
  storeRaw --> buildFeatures[BuildMarketFeatures]
  storeAgenda --> fuse[BuildDecisionContext]
  buildFeatures --> fuse
  fuse --> recommend[GenerateRecommendationsMultiTiming]
  recommend --> writeRec[WriteRecommendations]
  writeRec --> eval[EvaluateNextDayOutcomes]
  eval --> postmortem[GeneratePosthocWhy]
  postmortem --> learn[UpdateLearningStore]
  learn --> recommend
```

## API + agent integration (NestJS)

- **Frontend → A2A**: frontend builds the ExecutionContext capsule and POSTs to `POST /agent-to-agent/:orgSlug/:agentSlug/tasks`, which validates context and creates task records before execution (see `apps/api/src/agent2agent/agent2agent.controller.ts`).
- **Agent execution path**: implement finance as an **`api` agent** whose `transport.api.endpoint` targets a **LangGraph app endpoint**. This matches Marketing Swarm's pattern.
- **API runner → LangGraph**: the backend `ApiAgentRunnerService` forwards `context` + `userMessage` (and enriches provider/model for interpolation) when calling API agents (see `apps/api/src/agent2agent/services/api-agent-runner.service.ts`).
- **LangGraph endpoint**: implement the finance workflow inside `apps/langgraph` as a new agent module/controller (like `apps/langgraph/src/agents/marketing-swarm/marketing-swarm.controller.ts`) that requires `request.context` and uses `context.taskId` as the primary thread/task key.
- Keep a small API module under `apps/api/src/finance/` for **CRUD + viewing** (universes, recommendation runs, outcomes) and to enforce org slug `finance` + RBAC.
- Insert a new `public.agents` record for org `finance` via a new incremental migration (do **not** modify baseline; follow `apps/api/supabase/migrations/GOLD_STANDARD_README.md`).

## Frontend: dedicated conversation pane (like Marketing Swarm)

- The web app renders a dedicated pane when the agent metadata includes `hasCustomUI` and `customUIComponent` (see `apps/web/src/components/ConversationView.vue`).
- For finance, we'll add a new custom UI component (e.g., `FinanceTab.vue`) and render it in `ConversationView.vue` when `customUIComponent === 'finance'`.
- The finance agent record in `public.agents.metadata` will include `hasCustomUI: true` and `customUIComponent: 'finance'` so selection by agent slug triggers the correct pane (same mechanism used for Marketing Swarm and CAD).

## Multi-timing support (your "run all three, then decide")

- Each run generates a bundle of recommendations across timing windows (e.g., `pre_close`, `post_close`, `pre_open`, `intraday_now`).
- Store them as separate rows with consistent IDs so you can compare:
  - same instrument, same run, different timing_window/entry_style.
- Evaluation computes outcomes for each window using the appropriate realized price series.

## News source feasibility (Bloomberg and others)

- Build connectors to support **historical day queries** where licensing permits.
- For v1 (hybrid), implement:
  - Open-source ingestion (RSS/GDELT/etc.)
  - Yahoo Finance or Alpha Vantage for market data (free tier)
  - A "licensed connector interface" that can later be wired to Bloomberg/Refinitiv without schema changes.

## Deliverables (what you'll see daily)

- A list of **recommendation records** per universe version:
  - instrument, buy/sell/hold
  - when to place (timing_window)
  - intended price/entry style
  - sizing + risk notes
  - rationale (market + agenda schema fused)
- Next day: outcomes + postmortems + updated learning context.

## Validation / demo testing

- Use the existing Supabase test auth patterns (repo standard) to call the finance agent endpoint and finance API endpoints.
- Test user in `finance` org with `finance:admin` permission for admin UI testing.

## Admin UI: Finance Universes (inside AdminSettings)

- Add a new AdminSettings "Data & Access" item (same layout as RAG in `apps/web/src/views/AdminSettingsPage.vue`).
- Gate with RBAC permission `finance:admin` using the existing `v-permission` directive (`apps/web/src/directives/permission.ts`).
- The detail view should support: list universes, create universe, create new version, set active version, and manage instrument lists + timing variants.
- Backend endpoints for this admin UI are provided by the `apps/api/src/finance/` module and should be protected with `@RequirePermission('finance:admin')` + `RbacGuard`.

## Reference implementations

| Component | Reference File |
|-----------|---------------|
| Domain schema | [`20251229200001_create_engineering_schema.sql`](apps/api/supabase/migrations/20251229200001_create_engineering_schema.sql) |
| Org creation | [`20260105000002_create_legal_org.sql`](apps/api/supabase/migrations/20260105000002_create_legal_org.sql) |
| Agent registration | [`20251229200006_register_cad_agent.sql`](apps/api/supabase/migrations/20251229200006_register_cad_agent.sql) |
| LangGraph module | [`marketing-swarm.module.ts`](apps/langgraph/src/agents/marketing-swarm/marketing-swarm.module.ts) |
| Admin UI page | [`RagCollectionsPage.vue`](apps/web/src/views/admin/RagCollectionsPage.vue) |
| Frontend service | [`ragService.ts`](apps/web/src/services/ragService.ts) |
| Frontend store | [`ragStore.ts`](apps/web/src/stores/ragStore.ts) |
