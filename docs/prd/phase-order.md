# Orchestrator AI v2-start: Phase Order

## Overview

This document defines the final phase order for implementing Orchestrator AI v2-start. Each phase builds on previous phases, with agent implementations serving as validation points for completed infrastructure.

## Phase Order with Rationale

### Phase 0: Port & Environment Configuration
**Priority:** Critical
**Must complete first:** Yes

**Goals:**
- Change all ports (API: 6100, LangGraph: 6200, N8n: 5678, etc.)
- Clean up .env.example files with comprehensive documentation
- Update all port references in code
- Update Supabase configuration for port 6100
- Update N8n configuration
- Ensure environment is consistent before building agents

**Why First:**
- Prevents breaking changes during development
- Establishes consistent environment from the start
- All subsequent phases use correct ports

**Deliverables:**
- Updated .env.example with all variables documented
- All services configured for new ports
- Documentation of port assignments
- No hardcoded port references

---

### Phase 1: Agent Infrastructure
**Priority:** Critical
**Depends on:** Phase 0

**Goals:**
- Agent table structure (normalized columns)
- Organizations table
- Seed files (organizations + agents)
- Database as single source of truth (no agent JSON files)

**Why Now:**
- Foundation for all agent work
- Must be solid before discovery/execution

**Deliverables:**
- Agents table migration
- Organizations table migration
- Seed files created
- Documentation of table structure

---

### Phase 1.5: Agent Discovery & Runner Cleanup
**Priority:** Critical
**Depends on:** Phase 1

**Goals:**
- Update agent discovery for new table structure
- Clean up agent runners (context, api, external)
- Implement external agent runner with A2A discovery
- Remove tool agent runner
- Update frontend for new agent structure

**Why Now:**
- Must work before building first agent
- Validates Phase 1 table structure

**Deliverables:**
- Three agent runners working (context, api, external)
- Agent discovery updated
- Frontend displays agents correctly
- Tool agent code removed

---

### Phase 2: Streaming & Observability
**Priority:** Critical
**Depends on:** Phase 1.5

**Goals:**
- Unified streaming service (RxJS Subject)
- Observability events structure
- PII & Pseudonymization (basic dictionary-based)
- LLM usage tracking (document existing)
- Evaluations system (document existing)

**Why Now:**
- Needed for monitoring all agents (including context agent)
- Foundation for debugging and analytics

**Deliverables:**
- Streaming service implemented
- Observability events working
- PII dictionary pseudonymization working
- Admin observability UI functional

---

### 🎯 BUILD: Blog Post Writer Agent (Context)
**Validates:** Phase 0, 1, 1.5, 2

**Why Build Now:**
- Simplest agent type (context agent)
- Tests entire stack: database, discovery, context runner, frontend
- No external dependencies
- Immediate validation that infrastructure works
- Great starting point for educational videos

**Success Criteria:**
- Agent in database
- Discoverable via API
- Executes via context runner
- Streaming/observability works
- Frontend can use agent

---

### Phase 5: LangGraph Agent Architecture
**Priority:** Critical
**Depends on:** Phase 2
**Must complete BEFORE any LangGraph agents**

**Goals:**
- Shared services module (ObservabilityService, HitlService placeholder, LLMHttpClientService, WebhookStatusService)
- Agent feature modules structure (one module per agent)
- LangGraph tools module (database, file system, API calls - NOT RAG yet)
- Transport Types (Full API, Simple API, Response types)
- **LangGraph patterns and practices established**
- **Skills and agents files properly defined**
- **Learning/mastery phase for LangGraph**

**Why Now:**
- Must establish LangGraph foundation BEFORE building LangGraph agents
- Learn and master LangGraph patterns here
- Create reusable patterns for all future LangGraph agents
- Transport types needed for LangGraph agent communication

**Deliverables:**
- Shared services module created
- Agent feature module pattern established
- Tools module with common tools
- Transport types implemented
- LangGraph best practices documented
- Example/template module structure
- Skills files defined for LangGraph usage

**Important Note:**
This is the phase to get LangGraph right. Take time to establish patterns, create examples, and document best practices. All subsequent LangGraph agents will follow these patterns.

---

### Phase 3: RAG Infrastructure
**Priority:** High
**Depends on:** Phase 5 (LangGraph foundation must be solid first)

**Goals:**
- RAG database structure (multiple collections)
- RAG backend API (collection management, document ingestion, query/search)
- RAG frontend UI (collection management, document upload, query testing)
- RAG as a service
- **RAG LangGraph tool** (added to existing tools module from Phase 5)
- Basic RAG implementation (basic strategy, optional reranking)

**Why After Phase 5:**
- RAG tool needs to integrate with LangGraph tools module
- RAG agents are LangGraph agents, so LangGraph must be solid first
- Builds on working LangGraph foundation

**Deliverables:**
- RAG database created
- RAG API endpoints working
- RAG frontend UI functional
- RAG LangGraph tool implemented
- Basic RAG strategy working
- HR content ingested into RAG collection

---

### 🎯 BUILD: HR Assistant Agent (LangGraph with RAG)
**Validates:** Phase 5, Phase 3

**Why Build Now:**
- First LangGraph agent - validates Phase 5 LangGraph architecture works
- Validates RAG infrastructure and RAG tool
- Simpler than HITL (no pause/resume complexity)
- Tests: LangGraph foundation, RAG tool, shared services, agent module structure
- Canonical example of RAG usage

**Success Criteria:**
- Agent module created following Phase 5 patterns
- RAG tool integration works
- Can query HR RAG collection
- Retrieves and uses context correctly
- Streaming/observability works
- Well-documented as RAG reference implementation

**Important:**
This agent validates that Phase 5 LangGraph patterns are solid. If this agent is hard to build, go back and fix Phase 5 patterns.

---

### Phase 4: Human-in-the-Loop (HITL)
**Priority:** High
**Depends on:** Phase 5, HR Assistant working

**Goals:**
- LangGraph HITL integration (checkpointer, interrupt mechanism)
- HITL service (shared across LangGraph agents)
- HITL flow implementation (pause/resume architecture)
- HITL frontend UI (display requests, collect responses)

**Why After HR Assistant:**
- Most complex LangGraph feature
- Builds on proven LangGraph foundation from HR Assistant
- HITL requires solid understanding of LangGraph state management
- Checkpointer patterns established

**Deliverables:**
- HITL service implemented
- Checkpointer configured
- Interrupt/resume working
- HITL frontend UI functional
- All HITL request types supported (confirmation, choice, input, approval)

---

### 🎯 BUILD: Marketing Swarm Agent (LangGraph with HITL)
**Validates:** Phase 4, Phase 5

**Why Build Now:**
- Second LangGraph agent - validates HITL infrastructure
- Tests: HITL service, checkpointer, pause/resume, multi-step workflow
- Most complex LangGraph agent (multi-step with approval checkpoint)
- Demonstrates HITL modification capability

**Success Criteria:**
- Agent module created
- Multi-step workflow works (LinkedIn → Blog → SEO)
- HITL pause at LinkedIn post approval
- User can approve/reject/modify
- Agent resumes correctly after HITL response
- Streaming continues after resume
- Well-documented as HITL reference implementation

---

### 🎯 BUILD: Metrics Agent (MCP/LangGraph Tools)
**Validates:** LangGraph tools, database access, MCP integration

**Why Build Now:**
- Validates tools module works
- Tests database access patterns
- Shows MCP integration (if using MCP)
- Demonstrates structured data querying

**Success Criteria:**
- Agent can query company data
- Returns metrics/KPI information
- Tools integration works
- Example of database-backed agent

**Note:** Optional - may need work, but examples exist using MCP tools.

---

### 🎯 BUILD: Jokes Agent (N8n - Simple API)
**Validates:** Simple API transport, API agent runner, N8n integration

**Why Build Last:**
- Validates Simple API transport type
- Tests API agent runner with simplest case
- Demonstrates N8n integration (for intern prototypes)
- Shows how simple external agents can be

**Success Criteria:**
- Simple N8n workflow created
- Simple API transport works (endpoint + prompt only)
- Returns simple text response
- Frontend integration minimal

**Note:** Optional - demonstrates N8n but not part of core v2-start user experience.

---

## Phase Summary Table

| Phase | Name | Priority | Builds Agent? | Dependencies |
|-------|------|----------|---------------|--------------|
| 0 | Port & Environment | Critical | No | None |
| 1 | Agent Infrastructure | Critical | No | Phase 0 |
| 1.5 | Discovery & Runners | Critical | No | Phase 1 |
| 2 | Streaming & Observability | Critical | No | Phase 1.5 |
| **BUILD** | **Blog Post Writer** | Critical | **Context** | Phase 2 |
| 5 | LangGraph Architecture | Critical | No | Phase 2 |
| 3 | RAG Infrastructure | High | No | Phase 5 |
| **BUILD** | **HR Assistant** | High | **LangGraph + RAG** | Phase 5, 3 |
| 4 | HITL | High | No | Phase 5 |
| **BUILD** | **Marketing Swarm** | High | **LangGraph + HITL** | Phase 5, 4 |
| **BUILD** | **Metrics Agent** | Medium | **LangGraph Tools** | Phase 5 |
| **BUILD** | **Jokes Agent** | Low | **N8n Simple API** | Phase 5 |

## Agent Complexity Progression

1. **Blog Post Writer** (Context) - Simplest
2. **HR Assistant** (LangGraph + RAG) - Medium
3. **Marketing Swarm** (LangGraph + HITL) - Complex
4. **Metrics Agent** (Tools) - Medium
5. **Jokes Agent** (N8n) - Simple (different pattern)

## Key Principles

1. **Infrastructure First, Agents Second** - Each infrastructure phase completed before building agents
2. **Progressive Validation** - Each agent validates completed infrastructure
3. **Immediate Feedback** - Know if infrastructure works before adding complexity
4. **LangGraph Mastery** - Phase 5 establishes patterns, subsequent agents follow them
5. **Educational Flow** - Order optimized for teaching and learning

## Critical Path

**Must Complete in Order:**
- Phase 0 → Phase 1 → Phase 1.5 → Phase 2 → Blog Post Writer
- Phase 5 (LangGraph foundation) → Phase 3 (RAG) → HR Assistant
- Phase 4 (HITL) → Marketing Swarm

**Can Parallelize (after dependencies met):**
- Metrics Agent and Jokes Agent can be built in any order after their dependencies

## Success Criteria

- Each phase has clear deliverables
- Each agent successfully validates its infrastructure phase
- LangGraph patterns established in Phase 5 and reused in all LangGraph agents
- Progressive complexity in agent implementations
- All infrastructure working before final cleanup phases

## Notes

- Phase numbers preserved from original PRD where possible
- Transport types moved from Phase 2 to Phase 5 (better fit with LangGraph)
- RAG moved after LangGraph architecture (dependency clarified)
- HITL moved after LangGraph architecture and first LangGraph agent (complexity justified)
- Each BUILD milestone is a validation point and natural stopping place
