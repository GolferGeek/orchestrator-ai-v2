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

### `/test`
**Purpose:** Run tests, generate tests, fix failing tests, or check coverage  
**Uses:** `testing-agent`  
**Workflow:**
1. Detects affected apps from changed files (or uses specified app)
2. Determines action (run, generate, fix, coverage, setup)
3. Delegates to `testing-agent` for execution
4. Reports results with actionable feedback

**Accepts:**
- App: `web`, `api`, `langgraph`, or `all` (default: auto-detect)
- Action: `run`, `generate`, `fix`, `coverage`, `setup` (default: `run`)
- Target: Specific file or pattern (for generate/fix)

**Examples:**
- `/test` - Run tests for affected apps
- `/test web` - Run tests for web app
- `/test generate src/services/my.service.ts` - Generate tests for file
- `/test fix` - Fix failing tests
- `/test coverage` - Check coverage

**Related:**
- `testing-agent.md` - Performs testing operations
- `web-testing-skill/` - Web app testing patterns
- `api-testing-skill/` - API app testing patterns
- `langgraph-testing-skill/` - LangGraph app testing patterns

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
3. Runs quality gates (including tests via `/test`)
4. Creates PR if all checks pass

**Related:**
- All architecture skills
- `quality-gates-skill/`
- `testing-agent.md` - For test execution
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
- Builds LangGraph workflows, state machines, nodes, tools
- Implements HITL (Human-in-the-Loop) patterns
- Creates workflow graphs with checkpointing
- Integrates with LLM service (via HTTP to API endpoint)
- Integrates with observability service (via HTTP to API endpoint)
- Makes architectural decisions for LangGraph code

**Mandatory Skills:**
- `execution-context-skill/` - ExecutionContext validation (MANDATORY)
- `transport-types-skill/` - A2A compliance (MANDATORY)
- `langgraph-architecture-skill/` - LangGraph file classification & validation (MANDATORY)

**Uses:**
- `langgraph-architecture-skill/` - For file classification and pattern validation
- `execution-context-skill/` - For ExecutionContext flow validation
- `transport-types-skill/` - For A2A protocol compliance
- Can call `agent-builder-agent` to register agents

**Key Patterns:**
- StateGraph with nodes and edges
- State annotation with ExecutionContext
- Postgres checkpointing for state persistence
- LLM service integration (HTTP client to API `/llm/generate` endpoint)
- Observability integration (HTTP client to API `/webhooks/status` endpoint)
- HITL patterns for human-in-the-loop workflows
- Custom tools for database, API, and external services

**Related:**
- `langgraph-architecture-skill/` - Classification & validation
- `langgraph-development-skill/` - Prescriptive LangGraph building patterns
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

**Mandatory Skills:**
- `execution-context-skill/` - ExecutionContext validation (MANDATORY)
- `transport-types-skill/` - A2A compliance (MANDATORY)

**Routes To:**
- Agent-type skills (context, rag, media, api, external, orchestrator)
- Framework-specific builders (for API agents)

**Agent Type Decision Logic:**
- **Context Agent**: Knowledge-based, markdown context, LLM calls
- **RAG Agent**: RAG collection integration, embedding/retrieval
- **Media Agent**: Image/video/audio generation
- **API Agent**: HTTP API calls, wraps LangGraph/N8N workflows
- **External Agent**: A2A protocol, external service integration
- **Orchestrator Agent**: Multi-agent coordination, workflow management

**Related:**
- All agent-type skills
- Framework-specific builders

### Agent Type Skills

#### `context-agent-skill/`
**Purpose:** How to build context agents  
**Capabilities:**
- Knowledge-based intelligence patterns
- Context retrieval patterns (plans, deliverables, conversation)
- Database requirements for context agents
- LLM configuration patterns

**Patterns:**
- Markdown context files
- Context source configuration
- Token budget optimization
- System prompt templates

**Related:**
- `agent-builder-agent.md` - Main orchestrator

#### `rag-agent-skill/`
**Purpose:** How to build RAG agents  
**Capabilities:**
- RAG collection setup
- Embedding patterns
- Retrieval patterns
- Database requirements for RAG agents

**Patterns:**
- RAG collection configuration
- Top-k retrieval
- Similarity thresholds
- Source citation

**Related:**
- `agent-builder-agent.md` - Main orchestrator

#### `media-agent-skill/`
**Purpose:** How to build media agents  
**Capabilities:**
- Image generation patterns
- Video generation patterns
- Audio generation patterns
- Media storage patterns

**Patterns:**
- Media type configuration
- Provider/model selection
- Storage bucket configuration
- Asset linking

**Related:**
- `agent-builder-agent.md` - Main orchestrator

#### `api-agent-skill/`
**Purpose:** How to build API agents  
**Capabilities:**
- Determines framework (LangGraph, N8N, future frameworks)
- Routes to appropriate framework-specific builder
- API endpoint patterns
- Database registration requirements

**Framework Decision Logic:**
- **LangGraph**: Complex workflows, HITL, state management, checkpointing
- **N8N**: Drag-and-drop, visual workflows, simpler integrations
- **Default**: LangGraph (primary framework)

**Routes To:**
- `langgraph-api-agent-builder.md` - For LangGraph agents
- `n8n-api-agent-builder.md` - For N8N agents

**Related:**
- `agent-builder-agent.md` - Main orchestrator
- Framework-specific builders

#### `external-agent-skill/`
**Purpose:** How to build external agents  
**Capabilities:**
- External service integration
- A2A protocol for external calls
- Discovery patterns (`.well-known/agent.json`)

**Patterns:**
- A2A endpoint configuration
- JSON-RPC 2.0 format
- Discovery URL configuration
- Authentication patterns

**Related:**
- `agent-builder-agent.md` - Main orchestrator
- `transport-types-skill/` - A2A protocol details

#### `orchestrator-agent-skill/`
**Purpose:** How to build orchestrator agents  
**Capabilities:**
- Workflow coordination patterns
- Multi-agent orchestration
- Delegation patterns

**Patterns:**
- Sequential execution
- Parallel execution
- Conditional execution
- Dependency management

**Related:**
- `agent-builder-agent.md` - Main orchestrator  
**Capabilities:**
- Image generation patterns
- Video generation patterns
- Audio generation patterns
- Media storage patterns

**Patterns:**
- Media type configuration
- Provider/model selection
- Storage bucket configuration
- Asset linking

**Related:**
- `agent-builder-agent.md` - Main orchestrator

#### `api-agent-skill/`
**Purpose:** How to build API agents  
**Capabilities:**
- Determines framework (LangGraph, N8N, future frameworks)
- Routes to appropriate framework-specific builder
- API endpoint patterns
- Database registration requirements

**Framework Decision Logic:**
- **LangGraph**: Complex workflows, HITL, state management, checkpointing
- **N8N**: Drag-and-drop, visual workflows, simpler integrations
- **Default**: LangGraph (primary framework)

**Routes To:**
- `langgraph-api-agent-builder.md` - For LangGraph agents
- `n8n-api-agent-builder.md` - For N8N agents

**Related:**
- `agent-builder-agent.md` - Main orchestrator
- Framework-specific builders

#### `external-agent-skill/`
**Purpose:** How to build external agents  
**Capabilities:**
- External service integration
- A2A protocol for external calls
- Discovery patterns (`.well-known/agent.json`)

**Patterns:**
- A2A endpoint configuration
- JSON-RPC 2.0 format
- Discovery URL configuration
- Authentication patterns

**Related:**
- `agent-builder-agent.md` - Main orchestrator
- `transport-types-skill/` - A2A protocol details

#### `orchestrator-agent-skill/`
**Purpose:** How to build orchestrator agents  
**Capabilities:**
- Workflow coordination patterns
- Multi-agent orchestration
- Delegation patterns

**Patterns:**
- Sequential execution
- Parallel execution
- Conditional execution
- Dependency management

**Related:**
- `agent-builder-agent.md` - Main orchestrator

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

## Testing System

### `/test`
**Purpose:** Run tests, generate tests, fix failing tests, or check coverage  
**Uses:** `testing-agent`  
**Workflow:**
1. Detects affected apps from changed files (or uses specified app)
2. Determines action (run, generate, fix, coverage, setup)
3. Delegates to `testing-agent` for execution
4. Reports results with actionable feedback

**Accepts:**
- App: `web`, `api`, `langgraph`, or `all` (default: auto-detect)
- Action: `run`, `generate`, `fix`, `coverage`, `setup` (default: `run`)
- Target: Specific file or pattern (for generate/fix)

**Examples:**
- `/test` - Run tests for affected apps
- `/test web` - Run tests for web app
- `/test generate src/services/my.service.ts` - Generate tests for file
- `/test fix` - Fix failing tests
- `/test coverage` - Check coverage

**Related:**
- `testing-agent.md` - Performs testing operations
- `web-testing-skill/` - Web app testing patterns
- `api-testing-skill/` - API app testing patterns
- `langgraph-testing-skill/` - LangGraph app testing patterns

### `testing-agent.md`
**Purpose:** Autonomous testing specialist  
**Capabilities:**
- Runs tests (unit, integration, E2E) for all apps
- Generates tests following app-specific patterns
- Fixes failing tests with analysis
- Analyzes test coverage and identifies gaps
- Sets up test infrastructure

**Mandatory Skills:**
- `execution-context-skill/` - ExecutionContext validation in tests (MANDATORY)
- `transport-types-skill/` - A2A protocol validation in tests (MANDATORY)
- App-specific testing skills (web-testing-skill, api-testing-skill, langgraph-testing-skill)
- App-specific architecture skills (for context)

**Test Execution:**
- **Web**: Vitest (unit), Cypress (E2E)
- **API**: Jest (unit), Jest + Supertest (E2E)
- **LangGraph**: Jest (unit), Jest (E2E)

**Smart Test Execution:**
- Detects changed files: `git diff --name-only HEAD`
- Runs tests only for affected apps
- Skips E2E tests if services aren't running
- Provides clear failure reports

**Related:**
- `web-testing-skill/` - Web app testing patterns
- `api-testing-skill/` - API app testing patterns
- `langgraph-testing-skill/` - LangGraph app testing patterns
- `web-architecture-skill/` - Web app structure (for context)
- `api-architecture-skill/` - API app structure (for context)
- `langgraph-architecture-skill/` - LangGraph app structure (for context)

### `e2e-testing-skill/`
**Purpose:** E2E testing principles emphasizing NO MOCKING, real database work, real API calls, and real authentication  
**Used By:** `testing-agent`, all app-specific testing skills  
**Core Principle:** **NO MOCKING IN E2E TESTS**

**Key Principles:**
- ✅ Real database connections and queries
- ✅ Real API calls (HTTP requests to actual endpoints)
- ✅ Real authentication (Supabase test user credentials from `.env`)
- ✅ Real services running (API server, database, etc.)
- ✅ Real data in database (test data, not mocks)
- ❌ NO mocks of database operations
- ❌ NO mocks of API calls
- ❌ NO mocks of authentication
- ❌ NO fake data or stubs

**Test User Credentials:**
- `SUPABASE_TEST_USER=demo.user@playground.com` (or `golfergeek@orchestratorai.io`)
- `SUPABASE_TEST_PASSWORD=demouser` (or `GolferGeek123!`)
- `SUPABASE_TEST_USERID=b29a590e-b07f-49df-a25b-574c956b5035`

**Related:**
- `testing-agent.md` - Uses this skill for all E2E tests
- `web-testing-skill/` - References this for E2E patterns
- `api-testing-skill/` - References this for E2E patterns
- `langgraph-testing-skill/` - References this for E2E patterns

### `web-testing-skill/`
**Purpose:** Web app testing patterns for Vue 3, Vitest, and Cypress  
**Used By:** `testing-agent`  
**Key Patterns:**
- Component testing with Vue Test Utils
- Store testing with Pinia testing utilities
- Service testing with Vitest
- Integration testing patterns
- E2E testing with Cypress (references `e2e-testing-skill/` for NO MOCKING principles)
- ExecutionContext validation in tests
- A2A protocol validation in tests

**Test Types:**
- **Unit Tests**: Vitest (components, stores, services, composables) - mocking acceptable
- **Integration Tests**: Component-service, store-service interactions
- **E2E Tests**: Cypress (critical user journeys) - **NO MOCKING** (see `e2e-testing-skill/`)

**Coverage Requirements:**
- Global: 75% minimum
- Critical Path: 90% minimum (validation, security, PII)
- Components: 80% minimum
- Stores: 85% minimum
- Services: 80% minimum

**Related:**
- `testing-agent.md`
- `e2e-testing-skill/` - **MANDATORY for E2E tests** (NO MOCKING)
- `web-architecture-skill/` - Web app structure
- `execution-context-skill/` - ExecutionContext validation
- `transport-types-skill/` - A2A protocol validation

### `api-testing-skill/`
**Purpose:** API app testing patterns for NestJS and Jest  
**Used By:** `testing-agent`  
**Key Patterns:**
- Service testing with NestJS testing utilities
- Controller testing with Supertest
- Agent runner testing patterns
- E2E testing with Jest + Supertest (references `e2e-testing-skill/` for NO MOCKING principles)
- ExecutionContext validation in tests
- A2A protocol validation in tests

**Test Types:**
- **Unit Tests**: Jest (services, controllers, runners) - mocking acceptable
- **Integration Tests**: Controller-service, database operations
- **E2E Tests**: Jest + Supertest (full request/response cycles) - **NO MOCKING** (see `e2e-testing-skill/`)

**Coverage Requirements:**
- Global: 75% minimum
- Critical Path: 90% minimum (security, validation, PII)
- Services: 80% minimum
- Controllers: 80% minimum
- Agent Runners: 85% minimum

**Related:**
- `testing-agent.md`
- `e2e-testing-skill/` - **MANDATORY for E2E tests** (NO MOCKING)
- `api-architecture-skill/` - API app structure
- `execution-context-skill/` - ExecutionContext validation
- `transport-types-skill/` - A2A protocol validation

### `langgraph-testing-skill/`
**Purpose:** LangGraph app testing patterns for Jest  
**Used By:** `testing-agent`  
**Key Patterns:**
- Agent service testing
- Tool testing
- Workflow and state machine testing
- HITL interaction testing
- E2E testing with Jest (references `e2e-testing-skill/` for NO MOCKING principles)
- ExecutionContext validation in tests
- A2A protocol validation in tests

**Test Types:**
- **Unit Tests**: Jest (agents, tools, services) - mocking acceptable
- **Integration Tests**: Workflow execution, state transitions
- **E2E Tests**: Jest (complete agent workflows) - **NO MOCKING** (see `e2e-testing-skill/`)

**Coverage Requirements:**
- Global: 75% minimum
- Critical Path: 90% minimum (workflows, state machines)
- Agents: 85% minimum
- Tools: 80% minimum
- Services: 80% minimum

**Related:**
- `testing-agent.md`
- `e2e-testing-skill/` - **MANDATORY for E2E tests** (NO MOCKING)
- `langgraph-architecture-skill/` - LangGraph app structure
- `execution-context-skill/` - ExecutionContext validation
- `transport-types-skill/` - A2A protocol validation

### `codebase-monitoring-agent.md`
**Purpose:** Analyze codebase files hierarchically, evaluate health, identify issues, generate monitoring reports  
**Capabilities:**
- Analyzes every file in system (or specified directories)
- Evaluates file purpose, job performance, issues, urgency
- Creates hierarchical reports (folder structure)
- Checks file necessity, location, test completeness
- Generates prioritized issue reports
- Incremental monitoring (only new/changed files)

**Uses:**
- `codebase-monitoring-skill/` - Monitoring patterns
- `execution-context-skill/` - ExecutionContext validation
- `transport-types-skill/` - A2A compliance validation
- Architecture skills (web, API, LangGraph) - For file classification
- `testing-agent.md` - To check test coverage

**Artifacts:**
- `.monitor/project.json` - Project-wide monitoring artifact
- `.monitor/apps-web.json` - Web app monitoring artifact
- `.monitor/apps-api.json` - API app monitoring artifact
- `.monitor/apps-langgraph.json` - LangGraph app monitoring artifact

**Related:**
- `codebase-monitoring-skill/` - Provides monitoring patterns
- `codebase-hardening-agent.md` - Uses monitoring artifacts

### `codebase-hardening-agent.md`
**Purpose:** Review monitoring reports, determine test adequacy, auto-fix issues (if tests adequate) or document issues (if not)  
**Capabilities:**
- Reviews monitoring reports
- Determines test adequacy
- Makes changes (if tests adequate) or documents (if not)
- Addresses architectural decisions (e.g., Supabase separation)
- Creates hardening plans

**Uses:**
- `codebase-hardening-skill/` - Hardening patterns
- `execution-context-skill/` - ExecutionContext validation
- `transport-types-skill/` - A2A compliance validation
- Architecture skills (web, API, LangGraph) - For making changes
- `testing-agent.md` - To check test adequacy and run tests
- `codebase-monitoring-agent.md` - To get monitoring reports

**Related:**
- `codebase-hardening-skill/` - Provides hardening patterns
- `codebase-monitoring-agent.md` - Provides monitoring artifacts

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
- Classifies files (workflow, state, node, tool, service, controller, module)
- Validates against LangGraph patterns (StateGraph, nodes, edges, checkpointing)
- Checks graph structure and state annotations
- Validates HITL implementation
- Validates LLM service integration (HTTP client to API endpoint)
- Validates observability integration (HTTP client to API endpoint)
- Validates ExecutionContext flow (from execution-context-skill)
- Validates A2A protocol usage (from transport-types-skill)

**Key Validations:**
- Workflow: StateGraph with nodes and edges, checkpointing configured
- State: Extends BaseStateAnnotation, includes ExecutionContext fields
- Node: Accesses ExecutionContext from state, passes to services
- LLM Service: Uses LLMHttpClientService, passes full ExecutionContext
- Observability: Uses ObservabilityService, passes full ExecutionContext, non-blocking
- HITL: Proper HITL state fields and node patterns
- Tools: Extends BaseTool, implements _call() method

**Documentation Files:**
- `SKILL.md` - Main skill definition
- `FILE_CLASSIFICATION.md` - File type classification
- `ARCHITECTURE.md` - Architecture patterns
- `PATTERNS.md` - LangGraph-specific patterns
- `VIOLATIONS.md` - Common violations and fixes
- `LLM_SERVICE.md` - LLM service integration (HTTP client to API endpoint)
- `OBSERVABILITY.md` - Observability integration (HTTP client to API endpoint)
- `DATABASE_STATE.md` - Database-driven state for complex flows (multi-phase, persistent state)

**Related:**
- `langgraph-architecture-agent.md`
- `execution-context-skill/` - ExecutionContext validation
- `transport-types-skill/` - A2A compliance

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

### `codebase-monitoring-skill/`
**Purpose:** Patterns and validation for codebase monitoring  
**Used By:** `codebase-monitoring-agent`  
**Capabilities:**
- File analysis patterns
- Hierarchical analysis patterns
- Issue detection and classification
- Report generation patterns

**Structure:**
- `SKILL.md` - Main skill definition
- `FILE_ANALYSIS.md` - File analysis patterns
- `HIERARCHY_ANALYSIS.md` - Hierarchical analysis patterns
- `ISSUE_CLASSIFICATION.md` - Issue detection and classification
- `REPORT_GENERATION.md` - Report structure and formats

**Related:**
- `codebase-monitoring-agent.md` - Uses this skill
- `codebase-hardening-agent.md` - Uses monitoring artifacts

### `codebase-hardening-skill/`
**Purpose:** Patterns and validation for codebase hardening  
**Used By:** `codebase-hardening-agent`  
**Capabilities:**
- Test adequacy determination
- Safe auto-fix patterns
- Issue documentation patterns
- Architectural hardening patterns

**Structure:**
- `SKILL.md` - Main skill definition
- `TEST_ADEQUACY.md` - Test adequacy determination
- `AUTO_FIX_PATTERNS.md` - Safe auto-fix patterns
- `DOCUMENTATION_PATTERNS.md` - Issue documentation patterns
- `ARCHITECTURAL_HARDENING.md` - Architectural improvement patterns

**Related:**
- `codebase-hardening-agent.md` - Uses this skill
- `codebase-monitoring-agent.md` - Provides monitoring artifacts

---

## Meta Skills (Builder Skills)

### `skill-builder-skill/`
**Purpose:** Guide creation of new Claude Code Skills following best practices and patterns  
**Used By:** When creating new skills, extending capabilities, or packaging domain expertise  
**Capabilities:**
- Guides skill creation workflow
- Ensures best practices and proper structure
- Provides templates for different skill types
- Validates skill structure
- Integrates with existing skills

**Structure:**
- `SKILL.md` - Main skill builder documentation
- `MULTI_FILE_PATTERNS.md` - Multi-file skill patterns
- `SKILL_STRUCTURE_CHECKLIST.md` - Quick reference checklist
- `ARCHITECTURE_SKILL_TEMPLATE.md` - Template for architecture skills
- `DEVELOPMENT_SKILL_TEMPLATE.md` - Template for development skills
- `UTILITY_SKILL_TEMPLATE.md` - Template for utility skills

**Related:**
- All skills (meta-skill for creating skills)
- `meta-skill/` - Original skill creation documentation

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

