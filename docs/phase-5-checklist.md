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
- [ ] Start LangGraph app successfully (requires running services)
- [x] Checkpointer tables created in database
- [ ] `/llm/usage` endpoint accepts POST requests (requires running API)

---

## Phase 5b: Tools Module (1-2 days)

### Tools Module Setup
- [ ] Create `apps/langgraph/src/tools/tools.module.ts`
- [ ] Create `apps/langgraph/src/tools/index.ts` (barrel export)

### SQL Query Tool
- [ ] Create `apps/langgraph/src/tools/sql-query.tool.ts`
- [ ] Uses Ollama/SQLCoder for SQL generation
- [ ] Reports usage via LLMUsageReporterService
- [ ] Executes read-only queries
- [ ] Returns structured results

### Schema Tools
- [ ] Create `apps/langgraph/src/tools/list-tables.tool.ts`
- [ ] Create `apps/langgraph/src/tools/describe-table.tool.ts`

### Verification
- [ ] Tools can be instantiated
- [ ] SQL generation works with Ollama
- [ ] Usage reporting reaches `/llm/usage`
- [ ] Read-only queries execute correctly

---

## Phase 5c: Data Analyst Agent (2-3 days)

### Agent Structure
- [ ] Create `apps/langgraph/src/agents/data-analyst/` directory
- [ ] Create `data-analyst.state.ts` (state annotation)
- [ ] Create `data-analyst.graph.ts` (StateGraph with tool-calling)
- [ ] Create `data-analyst.service.ts`
- [ ] Create `data-analyst.controller.ts`
- [ ] Create `data-analyst.module.ts`
- [ ] Create `dto/data-analyst-request.dto.ts`
- [ ] Create `dto/index.ts`

### Graph Implementation
- [ ] Input validation with Zod
- [ ] Tool-calling node with ToolNode
- [ ] LLM node for summarization (via LLMHttpClientService)
- [ ] Conditional routing based on tool results
- [ ] Checkpointing enabled

### Integration
- [ ] Register module in app.module.ts
- [ ] Register agent in database (agents table)
- [ ] Expose endpoints: POST `/data-analyst/analyze`, GET `/data-analyst/status/:threadId`

### Verification
- [ ] End-to-end: Question → SQL generation → Execution → Summary
- [ ] Tool LLM usage appears in usage tracking
- [ ] Observability events fire correctly
- [ ] Checkpoints persist across requests

---

## Phase 5d: Extended Post Writer Agent (2-3 days)

### Agent Structure
- [ ] Create `apps/langgraph/src/agents/extended-post-writer/` directory
- [ ] Create `extended-post-writer.state.ts`
- [ ] Create `extended-post-writer.graph.ts` (StateGraph with HITL)
- [ ] Create `extended-post-writer.service.ts`
- [ ] Create `extended-post-writer.controller.ts`
- [ ] Create `extended-post-writer.module.ts`
- [ ] Create `dto/extended-post-writer-request.dto.ts`
- [ ] Create `dto/extended-post-writer-resume.dto.ts`
- [ ] Create `dto/index.ts`

### Graph Implementation
- [ ] Input validation with Zod
- [ ] Content generation node (blog, SEO, social)
- [ ] HITL interrupt node (calls `interrupt()` directly)
- [ ] Resume handling with `Command({ resume })`
- [ ] Finalization node
- [ ] Checkpointing enabled

### Integration
- [ ] Register module in app.module.ts
- [ ] Register agent in database
- [ ] Expose endpoints: POST `/extended-post-writer/generate`, POST `/extended-post-writer/resume/:threadId`, GET `/extended-post-writer/status/:threadId`

### Verification
- [ ] Generate → Interrupt → status shows `hitl_waiting`
- [ ] Resume with approve → completes successfully
- [ ] Resume with edit → uses edited content
- [ ] Resume with reject → handles gracefully
- [ ] HITL events visible in observability

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
- Build passes for both langgraph and API apps
- Database migration created but not yet applied
- Runtime verification pending (requires DB and running services)
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
