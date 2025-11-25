# Phase 5: LangGraph Production - Implementation Checklist

> **Spec Document:** `/specs/phase-5-langgraph-production.md`
> **Estimated Duration:** 10-15 days
> **Goal:** Production-ready LangGraph infrastructure with two demo agents demonstrating tool-calling and HITL patterns

---

## Quick Context Recovery

When starting a new session, share this file and say:
> "We're implementing Phase 5 LangGraph. Here's the checklist - pick up where we left off."

**Key Architecture Decisions:**
- LangGraph agents call back to Orchestrator AI's `/llm/generate` for traditional LLM calls
- Tools use specialized models directly (Ollama/SQLCoder) and report usage via `/llm/usage`
- `interrupt()` is ONLY called in graph nodes, never in services
- ObservabilityService replaces WebhookStatusService
- Two demo agents: Data Analyst (tool-calling), Extended Post Writer (HITL)

---

## Phase 5a: Infrastructure (2-3 days) - COMPLETED 2025-11-25

### Package Dependencies
- [x] Add `@langchain/langgraph` to package.json (upgraded to ^1.0.2)
- [x] Add `@langchain/langgraph-checkpoint-postgres` to package.json (^1.0.0)
- [x] Add `zod` to package.json (^3.23.0)
- [x] Run `npm install`

### Database Migration
- [x] Create migration file `apps/langgraph/src/migrations/001_langgraph_schema.sql`
- [x] Creates `langgraph` schema
- [x] Creates `checkpoints` table
- [x] Creates `checkpoint_blobs` table
- [x] Creates `checkpoint_writes` table
- [x] Creates indexes
- [x] Run migration and verify tables exist

### Shared Services Module
- [x] Create `apps/langgraph/src/services/shared-services.module.ts`
- [x] Create `apps/langgraph/src/services/observability.service.ts` (NEW)
- [x] Create `apps/langgraph/src/services/hitl-helper.service.ts` (NEW)
- [x] Create `apps/langgraph/src/services/llm-usage-reporter.service.ts` (NEW)
- [x] Create `apps/langgraph/src/services/index.ts` (barrel export)
- [x] Verify `llm-http-client.service.ts` exists (no changes needed)

### Persistence Module
- [x] Create `apps/langgraph/src/persistence/persistence.module.ts`
- [x] Create `apps/langgraph/src/persistence/postgres-checkpointer.service.ts`
- [x] Create `apps/langgraph/src/persistence/index.ts` (barrel export)

### State Annotations
- [x] Create `apps/langgraph/src/state/base-state.annotation.ts`
- [x] Create `apps/langgraph/src/state/index.ts` (barrel export)
- [x] Includes Zod validation schema

### API Endpoint (Orchestrator AI API)
- [x] Add POST `/llm/usage` endpoint to `apps/api/src/llms/llm.controller.ts`
- [x] Create `RecordLLMUsageDto` in `apps/api/src/llms/dto/`
- [x] Wire to existing usage tracking service

### App Module Updates
- [x] Update `apps/langgraph/src/app.module.ts` with new modules

### Verification
- [x] Build passes for both langgraph and API apps
- [x] LangGraph app starts successfully (health check OK)
- [x] Checkpointer tables created in database
- [ ] `/llm/usage` endpoint accepts POST requests (requires running API)

---

## Phase 5b: Tools Module (1-2 days) - COMPLETED 2025-11-25

### Tools Module Setup
- [x] Create `apps/langgraph/src/tools/tools.module.ts`
- [x] Create `apps/langgraph/src/tools/index.ts` (barrel export)

### SQL Query Tool
- [x] Create `apps/langgraph/src/tools/sql-query.tool.ts`
- [x] Uses Ollama/SQLCoder for SQL generation
- [x] Reports usage via LLMUsageReporterService
- [x] Executes read-only queries
- [x] Returns structured results

### Schema Tools
- [x] Create `apps/langgraph/src/tools/list-tables.tool.ts`
- [x] Create `apps/langgraph/src/tools/describe-table.tool.ts`

### Verification
- [x] Build passes with swc (switched from tsc due to LangChain 1.x memory issues)
- [ ] Tools can be instantiated (requires running app)
- [ ] SQL generation works with Ollama (requires Ollama running)
- [ ] Usage reporting reaches `/llm/usage` (requires running API)
- [ ] Read-only queries execute correctly (requires running app)

---

## Phase 5c: Data Analyst Agent (2-3 days) - COMPLETED 2025-11-25

### Agent Structure
- [x] Create `apps/langgraph/src/agents/data-analyst/` directory
- [x] Create `data-analyst.state.ts` (state annotation)
- [x] Create `data-analyst.graph.ts` (StateGraph with tool-calling)
- [x] Create `data-analyst.service.ts`
- [x] Create `data-analyst.controller.ts`
- [x] Create `data-analyst.module.ts`
- [x] Create `dto/data-analyst-request.dto.ts`
- [x] Create `dto/index.ts`

### Graph Implementation
- [x] Input validation with Zod
- [x] Tool-calling via direct tool invocation (discover → describe → query)
- [x] LLM node for summarization (via LLMHttpClientService)
- [x] Conditional routing based on tool results
- [x] Checkpointing enabled via PostgresSaver

### Integration
- [x] Register module in app.module.ts
- [ ] Register agent in database (agents table) - manual step
- [x] Expose endpoints: POST `/data-analyst/analyze`, GET `/data-analyst/status/:threadId`, GET `/data-analyst/history/:threadId`

### Verification
- [x] Build passes
- [ ] End-to-end: Question → SQL generation → Execution → Summary (requires running services)
- [ ] Tool LLM usage appears in usage tracking (requires Ollama)
- [ ] Observability events fire correctly (requires running API)
- [ ] Checkpoints persist across requests (requires running services)

---

## Phase 5d: Extended Post Writer Agent (2-3 days) - COMPLETED 2025-11-25

### Agent Structure
- [x] Create `apps/langgraph/src/agents/extended-post-writer/` directory
- [x] Create `extended-post-writer.state.ts`
- [x] Create `extended-post-writer.graph.ts` (StateGraph with HITL)
- [x] Create `extended-post-writer.service.ts`
- [x] Create `extended-post-writer.controller.ts`
- [x] Create `extended-post-writer.module.ts`
- [x] Create `dto/extended-post-writer-request.dto.ts`
- [x] Create `dto/extended-post-writer-resume.dto.ts`
- [x] Create `dto/index.ts`

### Graph Implementation
- [x] Input validation with Zod
- [x] Content generation node (blog, SEO, social)
- [x] HITL interrupt node (calls `interrupt()` directly)
- [x] Resume handling with `Command({ resume })`
- [x] Finalization node
- [x] Checkpointing enabled via PostgresSaver

### Integration
- [x] Register module in app.module.ts
- [ ] Register agent in database - manual step
- [x] Expose endpoints: POST `/extended-post-writer/generate`, POST `/extended-post-writer/resume/:threadId`, GET `/extended-post-writer/status/:threadId`, GET `/extended-post-writer/history/:threadId`

### Verification
- [x] Build passes
- [ ] Generate → Interrupt → status shows `hitl_waiting` (requires running services)
- [ ] Resume with approve → completes successfully (requires running services)
- [ ] Resume with edit → uses edited content (requires running services)
- [ ] Resume with reject → handles gracefully (requires running services)
- [ ] HITL events visible in observability (requires running services)

---

## Phase 5e: HITL Front-End (2 days)

### Vue Components
- [ ] Create `apps/web/src/components/hitl/HitlStatusBanner.vue`
- [ ] Create `apps/web/src/components/hitl/HitlApprovalModal.vue`
- [ ] Shows pending content for review
- [ ] Edit capability for content fields
- [ ] Approve/Reject/Edit buttons

### Integration
- [ ] Update agent chat view to detect HITL status
- [ ] Show HitlStatusBanner when `hitl_waiting`
- [ ] Open HitlApprovalModal on user action
- [ ] Call resume endpoint with decision

### Verification
- [ ] Full UI flow: Start → See banner → Open modal → Approve → Complete
- [ ] Edit flow works correctly
- [ ] Reject flow works correctly
- [ ] Status updates in real-time

---

## Phase 5f: Cleanup & Polish (1-2 days)

### Deprecation Cleanup
- [ ] Delete `apps/langgraph/src/services/webhook-status.service.ts`
- [ ] Delete `apps/langgraph/src/workflows/graphs/marketing-swarm.graph.ts`
- [ ] Remove any orphaned imports

### Quality
- [ ] Error handling review - all errors handled gracefully
- [ ] Loading states - UI shows appropriate loading indicators
- [ ] Lint passes
- [ ] Build passes
- [ ] No TypeScript errors

### Documentation
- [ ] Update README in `apps/langgraph/`
- [ ] Document new endpoints
- [ ] Document environment variables required

---

## Success Criteria

### Data Analyst Agent
- [ ] Lists database tables correctly
- [ ] Generates valid SQL from natural language
- [ ] Executes SQL safely (read-only enforced)
- [ ] Summarizes results clearly
- [ ] Tool LLM usage reported to `/llm/usage`
- [ ] Observability events visible

### Extended Post Writer Agent
- [ ] Generates blog, SEO, social content
- [ ] Pauses at HITL with `hitl_waiting` status
- [ ] Resumes correctly on all three decisions
- [ ] HITL events visible in observability
- [ ] Front-end approval flow works

### Infrastructure
- [ ] Checkpoints persisted in `langgraph` schema
- [ ] `/llm/usage` endpoint functional
- [ ] All traditional LLM calls through `/llm/generate`
- [ ] Zod validation catching invalid input
- [ ] Clean separation of concerns

---

## Notes / Issues Log

_Add notes here as implementation progresses:_

```
[2025-11-25] - Phase 5a Infrastructure Completed
--------------
- Upgraded to latest LangChain/LangGraph versions:
  - @langchain/core: ^1.1.0
  - @langchain/langgraph: ^1.0.2
  - @langchain/langgraph-checkpoint-postgres: ^1.0.0
- Created all Phase 5a infrastructure files
- Database migration applied, langgraph schema tables created
- LangGraph app starts successfully (health check OK)

[2025-11-25] - Phase 5b Tools Module Completed
--------------
- Created tools module with 3 tools:
  - list-tables.tool.ts - Lists database tables
  - describe-table.tool.ts - Describes table schemas
  - sql-query.tool.ts - Executes SQL queries with Ollama/SQLCoder integration
- Switched build to SWC due to LangChain 1.x type-checking memory issues
- Build completes in ~38ms with swc

[2025-11-25] - Phase 5c Data Analyst Agent Completed
--------------
- Created data-analyst agent with:
  - Zod input validation
  - Tool-calling flow (discover → describe → query → summarize)
  - LLM summarization via LLMHttpClientService
  - PostgresSaver checkpointing
- Endpoints: POST /data-analyst/analyze, GET /data-analyst/status/:threadId, GET /data-analyst/history/:threadId

[2025-11-25] - Phase 5d Extended Post Writer Agent Completed
--------------
- Created extended-post-writer agent with HITL support:
  - Generates blog post, SEO description, and social posts
  - Uses interrupt() directly in graph node for HITL
  - Supports approve/edit/reject decisions via Command({ resume })
  - PostgresSaver checkpointing persists state across HITL
- Endpoints: POST /extended-post-writer/generate, POST /extended-post-writer/resume/:threadId, GET /extended-post-writer/status/:threadId
- Added .gitignore to exclude dist/
```

---

## File Structure Reference

```
apps/langgraph/src/
├── services/
│   ├── shared-services.module.ts
│   ├── index.ts
│   ├── llm-http-client.service.ts    # EXISTS
│   ├── llm-usage-reporter.service.ts # NEW
│   ├── observability.service.ts      # NEW
│   └── hitl-helper.service.ts        # NEW
├── persistence/
│   ├── persistence.module.ts
│   ├── index.ts
│   └── postgres-checkpointer.service.ts
├── state/
│   ├── index.ts
│   └── base-state.annotation.ts
├── tools/
│   ├── tools.module.ts
│   ├── index.ts
│   ├── sql-query.tool.ts
│   ├── list-tables.tool.ts
│   └── describe-table.tool.ts
├── agents/
│   ├── data-analyst/
│   │   ├── data-analyst.module.ts
│   │   ├── data-analyst.controller.ts
│   │   ├── data-analyst.service.ts
│   │   ├── data-analyst.graph.ts
│   │   ├── data-analyst.state.ts
│   │   └── dto/
│   │       ├── index.ts
│   │       └── data-analyst-request.dto.ts
│   └── extended-post-writer/
│       ├── extended-post-writer.module.ts
│       ├── extended-post-writer.controller.ts
│       ├── extended-post-writer.service.ts
│       ├── extended-post-writer.graph.ts
│       ├── extended-post-writer.state.ts
│       └── dto/
│           ├── index.ts
│           ├── extended-post-writer-request.dto.ts
│           └── extended-post-writer-resume.dto.ts
├── migrations/
│   └── 001_langgraph_schema.sql
└── app.module.ts
```
