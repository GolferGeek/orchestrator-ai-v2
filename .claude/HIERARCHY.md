# Claude Code Components Hierarchy

Complete hierarchy of all Agents, Skills, and Commands in the Orchestrator AI Claude Code system.

## Overview

```
Commands (User-Initiated)
  ↓
Base Agent (Main Claude)
  ↓
Architecture Agents (Domain Specialists)
  ↓
Agent Builders (Agent Creation)
  ↓
Skills (Patterns & Validation)
```

---

## Commands (User-Initiated)

### `/commit`
**Purpose:** Commit changes to current branch (no push)  
**Uses:** `direct-commit-skill`  
**Workflow:**
1. Runs quality gates (lint, build, test)
2. Performs safety review
3. Generates commit message
4. Commits to current branch

**Related:**
- `direct-commit-skill/` - Handles commit workflow
- `quality-gates-skill/` - Quality checks
- `strict-linting-skill/` - Linting rules

### `/commit-push`
**Purpose:** Commit and push to remote  
**Uses:** `direct-commit-skill`  
**Workflow:**
1. Runs quality gates
2. Performs safety review
3. Generates commit message
4. Commits to current branch
5. Fetches and merges remote changes
6. Pushes to remote

**Related:**
- `direct-commit-skill/` - Handles commit and push workflow
- `quality-gates-skill/` - Quality checks
- `strict-linting-skill/` - Linting rules

### `/review-pr`
**Purpose:** Review a pull request systematically  
**Uses:** `pr-review-agent`  
**Workflow:**
1. Gets PR information (number, branch, status)
2. Reads PR diff
3. Checks CI status
4. Runs quality checks (lint, build, test)
5. Analyzes code quality and architecture
6. Validates ExecutionContext and A2A compliance
7. Generates review comments
8. Approves or requests changes

**Related:**
- `pr-review-agent.md` - Performs the review
- `quality-gates-skill/` - Quality checks
- `execution-context-skill/` - ExecutionContext validation
- `transport-types-skill/` - A2A compliance validation
- All architecture skills - Domain-specific validation

### `/build-plan`
**Purpose:** Build structured, machine-readable execution plan from PRD(s)  
**Uses:** Base agent for planning, creates JSON plan file  
**Accepts:**
- PRD file path(s): `docs/prd/active/landing-page-prd.md`
- Multiple PRDs: `docs/prd/active/landing-page-prd.md docs/prd/active/auth-prd.md`
- PRD content: `"PRD: Build landing page. Overview: ... Technical Plan: ..."`

**Workflow:**
1. Parses PRD(s) and extracts all relevant sections
2. Creates structured JSON plan matching `plan_json` schema
3. Breaks work into phases and steps
4. Assigns agents to each step
5. Defines dependencies between steps
6. Includes validation checkpoints
7. Adds progress tracking fields (status, progress, timestamps)
8. Outputs JSON file (`.plan.json`) for use in Cursor or `/work-plan`

**Output:**
- JSON file (`.plan.json`) with phases, steps, agents, dependencies, checkpoints
- Includes progress tracking fields for monitoring execution
- Machine-readable format for use outside Claude Code (Cursor, scripts, etc.)

**Related:**
- `/work-plan` - Executes plans (can read `.plan.json` files)
- `schemas/agent-platform/orchestration.schema.json` - Plan structure schema
- `plans.plan_json` - Database column that stores plan structure

### `/work-plan`
**Purpose:** Create and execute structured work plan from task, PRD, or existing plan file  
**Uses:** Base agent for planning and execution, delegates to architecture agents  
**Accepts:**
- Plan file: `--plan plans/landing-page.plan.json` (executes existing plan)
- Task description: `"Build a new landing page"` (creates plan on-the-fly)
- PRD file path: `docs/prd/active/landing-page-prd.md` (creates plan on-the-fly)
- PRD content: `"PRD: Build landing page. Overview: ... Technical Plan: ..."`

**Workflow:**
1. **If `--plan` flag:**
   - Reads existing structured plan JSON file
   - Executes plan, updating progress fields as it goes
2. **If PRD provided:**
   - Reads and parses PRD structure
   - Extracts: Overview, Goals, Scope, Deliverables, Technical Plan, Development Roadmap, Dependencies
   - Maps PRD sections to work plan phases
   - Creates plan on-the-fly
3. **If task provided:**
   - Analyzes task requirements
   - Identifies affected domains (web, API, LangGraph, etc.)
   - Creates plan on-the-fly
4. Determines required agents (architecture agents, builders, etc.)
5. Creates structured plan with:
   - Work breakdown by phase (from PRD roadmap or task analysis)
   - Agent assignments per phase
   - Dependencies between phases (from PRD dependency chain or task analysis)
   - Validation checkpoints
6. Executes plan by delegating to architecture agents
7. Updates progress fields (status, progress, timestamps) as execution proceeds

**PRD Parsing:**
- Extracts Technical Plan → Determines affected domains and agents
- Extracts Development Roadmap → Creates work breakdown phases
- Extracts Logical Dependency Chain → Defines phase dependencies
- Extracts Deliverables → Sets validation checkpoints

**Related:**
- Base Agent - Executes the plan
- Architecture Agents - Assigned to phases
- Agent Builders - If creating agents
- `plan-evaluation-skill/` - Evaluates implementation vs plan, suggests corrections
- `pr-review-agent.md` - For final validation
- PRD Template - `obsidian/docs/archive/prd/templates/prd-template.md`

### `/create-pr` (Planned)
**Purpose:** Create pull request with progressive validation  
**Uses:** Multiple skills based on changed files  
**Workflow:**
1. Analyzes changed files
2. Progressively invokes relevant skills:
   - `execution-context-skill` (if execution context files changed)
   - `transport-types-skill` (if transport type files changed)
   - `web-architecture-skill` (if web files changed)
   - `api-architecture-skill` (if API files changed)
   - `langgraph-architecture-skill` (if LangGraph files changed)
3. Runs quality gates
4. Creates PR if all checks pass

**Related:**
- All architecture skills
- `quality-gates-skill/`
- `pr-review-agent.md` - For PR review

---

## Base Agent (Main Claude)

**Purpose:** Main entry point for all tasks  
**Responsibilities:**
- Receives user requests
- Determines which agents/skills to use
- Coordinates multi-agent workflows
- Delegates to specialized agents

**Delegates To:**
- Architecture agents (web, API, LangGraph)
- Agent builders (for agent creation)
- Specialized agents (PR review, codebase audit)

---

## Architecture Agents (Domain Specialists)

### `web-architecture-agent.md`
**Purpose:** Autonomous web app specialist  
**Capabilities:**
- Builds Vue components, stores, services, composables, views
- Creates landing pages and custom UI components
- Understands Vue 3 Composition API and reactivity patterns
- Implements three-layer architecture (store/service/component)
- Makes architectural decisions for web code

**Mandatory Skills:**
- `execution-context-skill/` - ExecutionContext validation (MANDATORY)
- `transport-types-skill/` - A2A compliance (MANDATORY)
- `web-architecture-skill/` - Web file classification & validation (MANDATORY)

**Uses:**
- `web-architecture-skill/` - For file classification and pattern validation
- `execution-context-skill/` - For ExecutionContext flow validation
- `transport-types-skill/` - For A2A protocol compliance
- Can call `agent-builder-agent` to register agents

**Key Patterns:**
- Three-layer architecture (store/service/component)
- Vue 3 Composition API (`<script setup>`)
- ExecutionContext from store (never created)
- A2A calls via `a2aOrchestrator.execute()`
- Custom UI components for complex workflows (reference marketing swarm pattern)

**Related:**
- `web-architecture-skill/` - Classification & validation
- `.claude/docs/marketing-swarm-conversation-window.md` - Complex workflow patterns

### `api-architecture-agent.md`
**Purpose:** Autonomous API specialist  
**Capabilities:**
- Builds NestJS endpoints, services, controllers, modules
- Creates API runners (context, api, external, orchestrator, rag, media)
- Understands NestJS patterns, dependency injection, mode routing
- Makes architectural decisions for API code

**Mandatory Skills:**
- `execution-context-skill/` - ExecutionContext validation (MANDATORY)
- `transport-types-skill/` - A2A compliance (MANDATORY)
- `api-architecture-skill/` - API file classification & validation (MANDATORY)

**Uses:**
- `api-architecture-skill/` - For file classification and pattern validation
- `execution-context-skill/` - For ExecutionContext flow validation
- `transport-types-skill/` - For A2A protocol compliance
- Can call `agent-builder-agent` to register agents

**Key Patterns:**
- NestJS module/controller/service architecture
- Agent runner pattern (extends BaseAgentRunner)
- ExecutionContext flow (created by frontend, validated, passed through)
- A2A protocol (JSON-RPC 2.0, transport types)
- Mode routing (CONVERSE, PLAN, BUILD, HITL)
- LLM service integration (external API endpoint, automatic usage/cost tracking)
- Observability integration (SSE streaming, event sending)

**Related:**
- `api-architecture-skill/` - Classification & validation

### `langgraph-architecture-agent.md`
**Purpose:** Autonomous LangGraph specialist  
**Capabilities:**
- Builds LangGraph workflows
- Implements HITL patterns
- Creates state graphs with checkpointing
- Makes architectural decisions for LangGraph code

**Mandatory Skills:**
- `execution-context-skill/` - ExecutionContext validation
- `transport-types-skill/` - A2A compliance
- `langgraph-architecture-skill/` - LangGraph file classification & validation
- `langgraph-development-skill/` - LangGraph patterns

**Uses:**
- `langgraph-development-skill/` - For LangGraph patterns
- Can call `agent-builder-agent` to register agents

**Related:**
- `langgraph-architecture-skill/` - Classification & validation
- `langgraph-development-skill/` - Prescriptive patterns
- `langgraph-api-agent-builder.md` - For building LangGraph agents

---

## Agent Builder System

### `agent-builder-agent.md`
**Purpose:** Main orchestrator for agent creation  
**Capabilities:**
- Determines agent type (context, rag, media, API, external, orchestrator)
- Routes to appropriate agent-type skill
- Coordinates agent creation workflow
- Handles database registration

**Routes To:**
- Agent-type skills (context, rag, media, api, external, orchestrator)
- Framework-specific builders (for API agents)

**Related:**
- All agent-type skills
- Framework-specific builders

### Framework-Specific Builders

#### `langgraph-api-agent-builder.md`
**Purpose:** Builds and maintains LangGraph API agents  
**Capabilities:**
- Builds new LangGraph API agents
- Maintains existing LangGraph agents (updates, fixes, refactors)
- Handles LangGraph-specific database registration

**Delegates To:**
- `langgraph-architecture-agent` - For building workflows
- `agent-builder-agent` - For database registration

**Uses:**
- `langgraph-architecture-agent` uses `langgraph-development-skill`
- `execution-context-skill/` (via architecture agent)
- `transport-types-skill/` (via architecture agent)

**Related:**
- `langgraph-architecture-agent.md`
- `langgraph-development-skill/`
- `api-agent-skill/` - For API agent patterns

#### `n8n-api-agent-builder.md`
**Purpose:** Builds and maintains N8N API agents  
**Capabilities:**
- Builds new N8N API agents
- Maintains existing N8N agents (updates, fixes, refactors)
- Handles N8N-specific database registration
- Uses N8N MCP for workflow creation

**Uses:**
- N8N MCP tools - For workflow creation
- `n8n-development-skill/` - For N8N patterns
- `execution-context-skill/` - For ExecutionContext validation
- `transport-types-skill/` - For A2A compliance

**Related:**
- `n8n-development-skill/`
- `api-agent-skill/` - For API agent patterns

---

## Specialized Agents

### `pr-review-agent.md`
**Purpose:** Systematically review pull requests  
**Capabilities:**
- Reviews PR diffs
- Runs quality checks
- Analyzes code quality and architecture
- Generates review comments
- Approves or requests changes

**Uses:**
- `quality-gates-skill/` - For quality checks
- Architecture skills - For architecture validation
- `execution-context-skill/` - For ExecutionContext validation
- `transport-types-skill/` - For A2A compliance

**Related:**
- `quality-gates-skill/`
- All architecture skills

### `codebase-audit-agent.md` (Planned)
**Purpose:** Comprehensive codebase audits  
**Capabilities:**
- Audits codebase for violations
- Uses all architecture skills for validation
- Generates audit reports
- Finds violations and suggests fixes

**Uses:**
- `codebase-hardening-skill/` - Orchestrates validation
- All architecture skills
- All development skills

**Related:**
- `codebase-hardening-skill/`
- All architecture and development skills

---

## Core Domain Skills (Cross-Cutting)

### `execution-context-skill/`
**Purpose:** ExecutionContext flow validation  
**Used By:** All architecture agents, all agent builders  
**Key Rules:**
- ExecutionContext is received, never created
- ExecutionContext passed whole, never cherry-picked
- ExecutionContext flows through entire system

**Related:**
- All architecture agents (mandatory reference)
- All agent builders (via architecture agents)

### `transport-types-skill/`
**Purpose:** A2A protocol compliance  
**Used By:** All architecture agents, all agent builders  
**Key Rules:**
- JSON-RPC 2.0 format for agent calls
- Transport types match mode (plan, build, converse, hitl)
- `.well-known/agent.json` discovery

**Related:**
- All architecture agents (mandatory reference)
- All agent builders (via architecture agents)

---

## Development Skills (Prescribed Patterns)

### `langgraph-development-skill/`
**Purpose:** Prescriptive LangGraph patterns  
**Used By:** `langgraph-architecture-agent`, `langgraph-api-agent-builder`  
**Key Patterns:**
- ExecutionContext flow in LangGraph
- HITL implementation
- Checkpointing patterns
- Service integration

**Related:**
- `langgraph-architecture-agent.md`
- `langgraph-api-agent-builder.md`

### `n8n-development-skill/`
**Purpose:** Prescriptive N8N patterns  
**Used By:** `n8n-api-agent-builder`, N8N workflows  
**Key Patterns:**
- Helper LLM pattern
- ExecutionContext in N8N
- Observability integration
- A2A compliance in N8N

**Related:**
- `n8n-api-agent-builder.md`
- N8N MCP tools

---

## Architecture Skills (Classification & Validation)

### `web-architecture-skill/`
**Purpose:** Web file classification & validation  
**Used By:** `web-architecture-agent`  
**Capabilities:**
- Classifies files (view, component, store, service, composable, type)
- Validates against web patterns (Vue 3, Composition API, reactivity)
- Validates three-layer architecture (store/service/component)
- Checks ExecutionContext flow (via execution-context-skill)
- Validates A2A protocol usage (via transport-types-skill)
- Validates file naming conventions
- Validates file location (stores/, services/, components/, etc.)

**Key Validations:**
- Store: State only, no async, no API calls
- Service: Async operations, API calls, business logic
- Component: UI only, uses stores/services
- Composable: Reusable logic, combines stores/services
- ExecutionContext: From store, never created
- A2A: Via `a2aOrchestrator.execute()`

**Related:**
- `web-architecture-agent.md`
- `execution-context-skill/` - ExecutionContext validation
- `transport-types-skill/` - A2A compliance

### `api-architecture-skill/`
**Purpose:** API file classification & validation  
**Used By:** `api-architecture-agent`  
**Capabilities:**
- Classifies files (controller, service, module, runner, dto, interface)
- Validates against API patterns (NestJS, dependency injection)
- Validates module/controller/service architecture
- Checks runner patterns (extends BaseAgentRunner, mode handlers)
- Validates ExecutionContext flow (via execution-context-skill)
- Validates A2A protocol usage (via transport-types-skill)
- Validates file naming conventions
- Validates file location (controllers/, services/, modules/, etc.)

**Key Validations:**
- Module: DI configuration only, no business logic
- Controller: HTTP handling only, delegates to services
- Service: Business logic only, no HTTP handling
- Runner: Extends BaseAgentRunner, implements mode handlers
- ExecutionContext: From request, validated, passed whole
- A2A: JSON-RPC 2.0 format, transport types
- LLM Service: ExecutionContext required, automatic tracking
- Observability: ExecutionContext required, non-blocking events

**Related:**
- `api-architecture-agent.md`
- `execution-context-skill/` - ExecutionContext validation
- `transport-types-skill/` - A2A compliance

### `langgraph-architecture-skill/`
**Purpose:** LangGraph file classification & validation  
**Used By:** `langgraph-architecture-agent`  
**Capabilities:**
- Classifies files (workflow, state, node, service)
- Validates against LangGraph patterns
- Checks graph structure
- Validates HITL implementation

**Related:**
- `langgraph-architecture-agent.md`

---

## Agent Type Skills (Agent Creation)

### `context-agent-skill/`
**Purpose:** How to build context agents  
**Used By:** `agent-builder-agent`  
**Key Patterns:**
- Knowledge-based intelligence patterns
- Context retrieval patterns
- Database requirements

**Related:**
- `agent-builder-agent.md`

### `rag-agent-skill/`
**Purpose:** How to build RAG agents  
**Used By:** `agent-builder-agent`  
**Key Patterns:**
- RAG collection setup
- Embedding patterns
- Retrieval patterns

**Related:**
- `agent-builder-agent.md`

### `media-agent-skill/`
**Purpose:** How to build media agents  
**Used By:** `agent-builder-agent`  
**Key Patterns:**
- Image generation patterns
- Video generation patterns
- Media storage patterns

**Related:**
- `agent-builder-agent.md`

### `api-agent-skill/`
**Purpose:** How to build API agents  
**Used By:** `agent-builder-agent`  
**Key Patterns:**
- Determines framework (LangGraph, N8N, future)
- Routes to framework-specific builder
- API endpoint patterns
- Database registration requirements

**Routes To:**
- `langgraph-api-agent-builder.md`
- `n8n-api-agent-builder.md`
- Future framework builders

**Related:**
- `agent-builder-agent.md`
- Framework-specific builders

### `external-agent-skill/`
**Purpose:** How to build external agents  
**Used By:** `agent-builder-agent`  
**Key Patterns:**
- External service integration
- A2A protocol for external calls
- Discovery patterns

**Related:**
- `agent-builder-agent.md`

### `orchestrator-agent-skill/` (If Needed)
**Purpose:** How to build orchestrator agents  
**Used By:** `agent-builder-agent`  
**Key Patterns:**
- Workflow coordination patterns
- Multi-agent orchestration

**Related:**
- `agent-builder-agent.md`

---

## Utility Skills

### `plan-evaluation-skill/`
**Purpose:** Evaluate plan implementation against original plan, identify gaps and deviations, suggest corrections  
**Used By:** Base agent during plan execution  
**Key Capabilities:**
- Compares actual implementation to planned work
- Identifies gaps (missing steps, incomplete work, missing deliverables)
- Detects deviations (different approach than planned)
- Suggests corrections and improvements
- Updates plan with actual progress and status
- Supports sub-plan creation for complex steps
- Adds improvements directly to existing plan

**Workflow:**
1. Load original plan structure
2. Analyze actual implementation (git diff, file system, code analysis)
3. Map implementation to plan steps
4. Identify gaps and deviations
5. Calculate progress and update status fields
6. Suggest corrections for gaps
7. Propose plan improvements
8. Update plan file with progress

**Sub-Plan Support:**
- Base agent can create sub-plans for complex steps
- Sub-plans are evaluated when complete
- Sub-plan results feed back into parent plan step
- Parent step marked complete when sub-plan completes

**Plan Improvements:**
- Improvements can be added directly to existing plan
- New steps/phases/checkpoints added in-place
- Plan structure updated while preserving progress
- No separate sub-plan needed for improvements

**Related:**
- `/build-plan` - Creates structured plans (can create sub-plans)
- `/work-plan` - Executes plans (uses this skill for evaluation)
- Base Agent - Uses this skill during plan execution, creates sub-plans when needed

### `direct-commit-skill/`
**Purpose:** Direct commit workflow  
**Used By:** `/commit`, `/commit-push` commands  
**Capabilities:**
- Runs quality gates
- Generates commit messages
- Performs safety review
- Handles git operations

**Uses:**
- `quality-gates-skill/` - For quality checks
- `strict-linting-skill/` - For linting rules

**Related:**
- `/commit` command
- `/commit-push` command
- `quality-gates-skill/`
- `strict-linting-skill/`

### `quality-gates-skill/`
**Purpose:** Quality gate checks  
**Used By:** `direct-commit-skill`, `pr-review-agent`  
**Capabilities:**
- Runs lint (API, Web, LangGraph)
- Runs build
- Runs tests
- Validates code quality

**Related:**
- `direct-commit-skill/`
- `pr-review-agent.md`
- `strict-linting-skill/`

### `strict-linting-skill/`
**Purpose:** Strict linting rules enforcement  
**Used By:** `direct-commit-skill`, `quality-gates-skill`  
**Key Rules:**
- Remove unused variables (no underscore workarounds)
- Fix root causes, not symptoms
- Enforce type safety

**Related:**
- `direct-commit-skill/`
- `quality-gates-skill/`

### `codebase-hardening-skill/` (Planned)
**Purpose:** Orchestrates validation across all skills  
**Used By:** `codebase-audit-agent`  
**Capabilities:**
- Coordinates validation across all architecture skills
- Checks files against multiple skills/subskills
- Validates compliance across domains

**Uses:**
- All architecture skills
- All development skills
- All domain skills

**Related:**
- `codebase-audit-agent.md`
- All other skills

---

## Meta Skills (Builder Skills)

### `skill-builder-skill/` (Planned)
**Purpose:** Building Claude Code Skills  
**Used By:** When creating new skills  
**Capabilities:**
- Guides skill creation
- Ensures best practices
- Validates skill structure

**Related:**
- All skills (meta-skill for creating skills)

### `agent-builder-skill/` (Planned)
**Purpose:** Building Claude Code Agents  
**Used By:** When creating new agents  
**Capabilities:**
- Guides agent creation
- Ensures best practices
- Validates agent structure

**Related:**
- All agents (meta-skill for creating agents)

---

## Reference Skills

### `worktree-manager-skill/`
**Purpose:** Git worktree management  
**Used By:** Various workflows  
**Status:** Mature, well-documented

### `supabase-management-skill/`
**Purpose:** Supabase database management  
**Used By:** Database operations  
**Status:** Critical for database sync

### `meta-skill/`
**Purpose:** Documentation about Skills  
**Used By:** For understanding skill creation  
**Status:** Reference documentation

---

## Complete Dependency Graph

```
Commands
  ├─ /commit → direct-commit-skill
  ├─ /commit-push → direct-commit-skill
  └─ /create-pr → [multiple skills based on files]

Base Agent
  ├─ → Architecture Agents
  │   ├─ web-architecture-agent
  │   │   ├─ execution-context-skill (mandatory)
  │   │   ├─ transport-types-skill (mandatory)
  │   │   └─ web-architecture-skill
  │   ├─ api-architecture-agent
  │   │   ├─ execution-context-skill (mandatory)
  │   │   ├─ transport-types-skill (mandatory)
  │   │   └─ api-architecture-skill
  │   └─ langgraph-architecture-agent
  │       ├─ execution-context-skill (mandatory)
  │       ├─ transport-types-skill (mandatory)
  │       ├─ langgraph-architecture-skill
  │       └─ langgraph-development-skill
  │
  ├─ → Agent Builders
  │   ├─ agent-builder-agent
  │   │   └─ → Agent Type Skills
  │   │       ├─ context-agent-skill
  │   │       ├─ rag-agent-skill
  │   │       ├─ media-agent-skill
  │   │       ├─ api-agent-skill
  │   │       │   └─ → Framework Builders
  │   │       │       ├─ langgraph-api-agent-builder
  │   │       │       │   └─ → langgraph-architecture-agent
  │   │       │       └─ n8n-api-agent-builder
  │   │       ├─ external-agent-skill
  │   │       └─ orchestrator-agent-skill
  │   │
  │   └─ Framework Builders
  │       ├─ langgraph-api-agent-builder
  │       │   └─ → langgraph-architecture-agent
  │       └─ n8n-api-agent-builder
  │
  └─ → Specialized Agents
      ├─ pr-review-agent
      │   ├─ quality-gates-skill
      │   └─ [architecture skills as needed]
      └─ codebase-audit-agent
          └─ codebase-hardening-skill
              └─ [all skills]
```

---

## Key Principles

1. **Mandatory Skills:** All architecture agents MUST reference execution-context-skill and transport-types-skill
2. **Delegation:** Agent builders delegate to architecture agents, which use development skills
3. **Extensibility:** New frameworks add new builders, not modify existing ones
4. **Progressive Discovery:** Skills auto-discover via descriptions, or explicitly specified
5. **Validation:** Architecture skills classify and validate, development skills provide patterns

---

## Status Legend

- ✅ **Complete** - Implemented and documented
- ⏳ **Planned** - In the plan, not yet implemented
- 🔄 **In Progress** - Currently being worked on

---

## Quick Reference

**Need to build web code?** → `web-architecture-agent`  
**Need to build API code?** → `api-architecture-agent`  
**Need to build LangGraph workflow?** → `langgraph-architecture-agent`  
**Need to create an agent?** → `agent-builder-agent`  
**Need to commit code?** → `/commit` or `/commit-push`  
**Need to review a PR?** → `/review-pr`  
**Need to plan a task?** → `/work-plan "task description"`  
**Need to plan from PRD?** → `/work-plan docs/prd/active/prd-name.md`  
**Need to validate ExecutionContext?** → `execution-context-skill`  
**Need to validate A2A?** → `transport-types-skill`

