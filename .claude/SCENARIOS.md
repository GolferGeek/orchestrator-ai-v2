# Claude Code Ecosystem Scenarios

**Purpose:** Teaching scenarios for interns and clients to understand when and how to use each component.

---

## Table of Contents

1. [Web Development Scenarios](#web-development-scenarios)
2. [API Development Scenarios](#api-development-scenarios)
3. [LangGraph Development Scenarios](#langgraph-development-scenarios)
4. [Testing Scenarios](#testing-scenarios)
5. [Agent Building Scenarios](#agent-building-scenarios)
6. [Code Quality Scenarios](#code-quality-scenarios)
7. [Workflow Management Scenarios](#workflow-management-scenarios)
8. [Ecosystem Maintenance Scenarios](#ecosystem-maintenance-scenarios)

---

## Web Development Scenarios

### Scenario 1: Building a New Vue Component
**When:** User wants to create a new Vue component for the web app.

**What Happens:**
1. User says: "Create a new user profile component"
2. Base agent detects "component" keyword → triggers `web-architecture-agent`
3. Agent loads:
   - `execution-context-skill` - To ensure ExecutionContext flows correctly
   - `transport-types-skill` - To ensure A2A calls are compliant (if needed)
   - `web-architecture-skill` - To classify file and validate patterns
4. Agent creates component following:
   - Vue 3 Composition API (`<script setup>`)
   - Three-layer architecture (component uses store/service)
   - ExecutionContext received from store, not created
   - Proper file naming (kebab-case)

**Files Created:**
- `apps/web/src/components/user-profile.vue`

**Skills Used:**
- `web-architecture-skill` - File classification and validation
- `execution-context-skill` - ExecutionContext flow validation
- `transport-types-skill` - A2A compliance (if component makes agent calls)

---

### Scenario 2: Creating a New Store
**When:** User needs to add state management for a new feature.

**What Happens:**
1. User says: "Create a store for managing user preferences"
2. Base agent detects "store" keyword → triggers `web-architecture-agent`
3. Agent loads `web-architecture-skill` to validate:
   - Store contains ONLY state (no async, no API calls, no business logic)
   - Uses Pinia `defineStore()` with Composition API
   - Synchronous mutations only
   - Services call mutations after API success
4. Agent creates store following patterns

**Files Created:**
- `apps/web/src/stores/user-preferences.store.ts`

**Skills Used:**
- `web-architecture-skill` - Store pattern validation
- `execution-context-skill` - ExecutionContext in store state

---

### Scenario 3: Building a Landing Page
**When:** User wants to create a new landing page.

**What Happens:**
1. User says: "Build a landing page for the new feature"
2. Base agent detects "landing page" → triggers `web-architecture-agent`
3. Agent creates:
   - View component (`apps/web/src/views/landing-page.vue`)
   - Associated components
   - Services for API calls
   - Store for state (if needed)
4. Agent ensures ExecutionContext flows correctly

**Files Created:**
- `apps/web/src/views/landing-page.vue`
- `apps/web/src/components/landing-page/*.vue` (if needed)

**Skills Used:**
- `web-architecture-skill` - Landing page patterns
- `execution-context-skill` - ExecutionContext flow

---

## API Development Scenarios

### Scenario 4: Creating a New API Endpoint
**When:** User wants to add a new API endpoint.

**What Happens:**
1. User says: "Create an endpoint to fetch user data"
2. Base agent detects "endpoint" or "API" → triggers `api-architecture-agent`
3. Agent loads:
   - `execution-context-skill` - ExecutionContext validation
   - `transport-types-skill` - A2A compliance
   - `api-architecture-skill` - File classification and validation
4. Agent creates:
   - Controller (thin, delegates to service)
   - Service (business logic)
   - Module (wires everything together)
   - DTO (data transfer object)
5. Agent ensures:
   - NestJS patterns followed
   - ExecutionContext passed correctly
   - A2A calls compliant (if applicable)

**Files Created:**
- `apps/api/src/user/user.controller.ts`
- `apps/api/src/user/user.service.ts`
- `apps/api/src/user/user.module.ts`
- `apps/api/src/user/dto/user.dto.ts`

**Skills Used:**
- `api-architecture-skill` - NestJS patterns
- `execution-context-skill` - ExecutionContext flow
- `transport-types-skill` - A2A compliance

---

### Scenario 5: Creating an Agent Runner
**When:** User wants to create a new agent runner.

**What Happens:**
1. User says: "Create a runner for the marketing agent"
2. Base agent detects "runner" → triggers `api-architecture-agent`
3. Agent loads `api-architecture-skill` to understand runner patterns:
   - Runner extends `BaseAgentRunner`
   - Runner handles agent execution
   - Runner integrates with LLM service
   - Runner sends observability events
4. Agent creates runner following patterns

**Files Created:**
- `apps/api/src/agents/marketing/marketing.runner.ts`

**Skills Used:**
- `api-architecture-skill` - Runner patterns (RUNNERS.md)
- `execution-context-skill` - ExecutionContext in runner
- `transport-types-skill` - A2A protocol

---

### Scenario 6: Integrating LLM Service
**When:** User needs to call the LLM service from API code.

**What Happens:**
1. User says: "Add LLM generation to this service"
2. Base agent detects "LLM" → triggers `api-architecture-agent`
3. Agent loads `api-architecture-skill` → reads `LLM_SERVICE.md`:
   - Use `LLMHttpClientService` to call `/llm/generate`
   - Automatic usage/cost tracking
   - PII processing handled automatically
   - Provider routing handled automatically
4. Agent integrates LLM service following patterns

**Files Modified:**
- Service file (adds LLM service injection and usage)

**Skills Used:**
- `api-architecture-skill` - LLM service patterns (LLM_SERVICE.md)
- `execution-context-skill` - ExecutionContext in LLM calls

---

## LangGraph Development Scenarios

### Scenario 7: Creating a New LangGraph Workflow
**When:** User wants to create a new LangGraph workflow.

**What Happens:**
1. User says: "Create a LangGraph workflow for processing orders"
2. Base agent detects "LangGraph" or "workflow" → triggers `langgraph-architecture-agent`
3. Agent loads:
   - `execution-context-skill` - ExecutionContext validation
   - `transport-types-skill` - A2A compliance
   - `langgraph-architecture-skill` - Workflow patterns
   - `langgraph-development-skill` - Prescriptive building patterns
4. Agent creates:
   - StateGraph with proper state annotations
   - Nodes following patterns
   - Edges with conditions
   - Checkpointing configuration
   - HITL integration (if needed)
5. Agent ensures:
   - LLM service integration (via `LLMHttpClientService`)
   - Observability integration (via `ObservabilityService`)
   - Database-driven state (if complex/long-running)

**Files Created:**
- `apps/langgraph/src/workflows/order-processing.workflow.ts`
- `apps/langgraph/src/workflows/order-processing.state.ts`
- `apps/langgraph/src/workflows/order-processing.nodes.ts`

**Skills Used:**
- `langgraph-architecture-skill` - Workflow patterns
- `langgraph-development-skill` - Prescriptive patterns
- `execution-context-skill` - ExecutionContext in workflow state
- `transport-types-skill` - A2A compliance

---

### Scenario 8: Adding HITL to Workflow
**When:** User wants to add human-in-the-loop to a workflow.

**What Happens:**
1. User says: "Add approval step to this workflow"
2. Base agent detects "HITL" or "approval" → triggers `langgraph-architecture-agent`
3. Agent loads `langgraph-development-skill` → reads `HITL.md`:
   - HITL patterns for approval workflows
   - Task creation and management
   - Human response handling
4. Agent adds HITL node following patterns

**Files Modified:**
- Workflow file (adds HITL node and edges)

**Skills Used:**
- `langgraph-development-skill` - HITL patterns (HITL.md)
- `langgraph-architecture-skill` - Workflow structure

---

### Scenario 9: Using Database-Driven State
**When:** User has a complex, long-running workflow that needs database state.

**What Happens:**
1. User says: "This workflow needs to track state in the database"
2. Base agent detects "database state" → triggers `langgraph-architecture-agent`
3. Agent loads `langgraph-architecture-skill` → reads `DATABASE_STATE.md`:
   - When to use database-driven state (complex, long-running, parallel)
   - Database schema patterns
   - Database service patterns
   - Processor service patterns
   - "Fat" SSE messages for observability
4. Agent implements database-driven state following patterns

**Files Created:**
- Database schema migration
- Database service
- Processor service
- Updates to workflow

**Skills Used:**
- `langgraph-architecture-skill` - Database state patterns (DATABASE_STATE.md)
- `langgraph-development-skill` - Implementation patterns

---

## Testing Scenarios

### Scenario 10: Running Tests
**When:** User wants to run tests.

**What Happens:**
1. User says: `/test`
2. Command detects changed files → determines affected apps
3. Command calls `testing-agent`
4. Agent loads app-specific testing skills:
   - `web-testing-skill` (if web files changed)
   - `api-testing-skill` (if API files changed)
   - `langgraph-testing-skill` (if LangGraph files changed)
5. Agent runs tests for affected apps
6. Agent reports results

**Command:** `/test`

**Skills Used:**
- `web-testing-skill` - Web test patterns
- `api-testing-skill` - API test patterns
- `langgraph-testing-skill` - LangGraph test patterns
- `e2e-testing-skill` - E2E principles (NO MOCKING)

---

### Scenario 11: Generating Tests
**When:** User wants to generate tests for a file.

**What Happens:**
1. User says: `/test generate src/services/user.service.ts`
2. Command detects file type → determines app (API)
3. Command calls `testing-agent` with generate action
4. Agent loads `api-testing-skill`:
   - NestJS test patterns
   - Service test patterns
   - Mocking patterns (for unit tests)
5. Agent generates test file following patterns

**Command:** `/test generate <file>`

**Skills Used:**
- `api-testing-skill` - Test generation patterns
- App-specific testing skill based on file location

---

### Scenario 12: Writing E2E Tests
**When:** User wants to write E2E tests.

**What Happens:**
1. User says: "Write E2E tests for the user registration flow"
2. Base agent detects "E2E" → triggers `testing-agent`
3. Agent loads `e2e-testing-skill`:
   - **NO MOCKING** principle
   - Real database interactions
   - Real API calls (HTTP/cURL)
   - Real authentication (Supabase test user from ENV)
   - Real services running
4. Agent writes E2E tests using real services

**Files Created:**
- `apps/api/test/user-registration.e2e-spec.ts`

**Skills Used:**
- `e2e-testing-skill` - E2E principles (NO MOCKING)
- `api-testing-skill` - API E2E patterns
- `web-testing-skill` - Web E2E patterns (if testing frontend)

---

## Agent Building Scenarios

### Scenario 13: Building a New Agent
**When:** User wants to create a new agent.

**What Happens:**
1. User says: "Create a new agent for handling customer support"
2. Base agent detects "create agent" → triggers `agent-builder-agent`
3. Builder agent:
   - Determines agent type (context, RAG, media, API, external, orchestrator)
   - Routes to appropriate agent type skill
   - If API agent, determines framework (LangGraph vs N8N)
   - Routes to framework-specific builder (if API agent)
4. Framework builder (e.g., `langgraph-api-agent-builder`):
   - Creates agent files following patterns
   - Registers agent in database
   - Ensures mandatory skills referenced
5. Agent is created and registered

**Files Created:**
- Agent definition files
- Database registration

**Skills Used:**
- `agent-builder-skill` - Agent creation patterns
- Agent type skill (e.g., `context-agent-skill`)
- Framework builder (if API agent)

---

### Scenario 14: Building a LangGraph API Agent
**When:** User wants to create a LangGraph API agent.

**What Happens:**
1. User says: "Create a LangGraph agent for processing invoices"
2. Base agent detects "LangGraph agent" → triggers `agent-builder-agent`
3. Builder agent determines: API agent → LangGraph framework
4. Builder agent calls `langgraph-api-agent-builder`
5. LangGraph builder:
   - Creates LangGraph workflow
   - Creates agent runner
   - Registers agent in database
   - Ensures LLM service integration
   - Ensures Observability integration
6. Agent is created and ready to use

**Files Created:**
- LangGraph workflow files
- Agent runner
- Database registration

**Skills Used:**
- `api-agent-skill` - API agent patterns
- `langgraph-api-agent-builder` - LangGraph-specific patterns
- `langgraph-architecture-agent` - For workflow creation

---

## Code Quality Scenarios

### Scenario 15: Monitoring Codebase Health
**When:** User wants to check codebase health.

**What Happens:**
1. User says: `/monitor`
2. Command calls `codebase-monitoring-agent`
3. Agent loads `codebase-monitoring-skill`:
   - File analysis patterns
   - Hierarchy analysis patterns
   - Issue classification patterns
   - Report generation patterns
4. Agent analyzes files hierarchically:
   - Evaluates each file's purpose
   - Checks job performance
   - Identifies issues
   - Assesses urgency
   - Checks test completeness
5. Agent generates monitoring artifact (per app and project-wide)
6. Artifact stored in `.monitor/` directory

**Command:** `/monitor [scope] [--full]`

**Skills Used:**
- `codebase-monitoring-skill` - Monitoring patterns
- Architecture skills - For file classification

---

### Scenario 16: Hardening Codebase
**When:** User wants to fix issues found in monitoring.

**What Happens:**
1. User says: `/harden #123` (targeting specific issue)
2. Command loads monitoring artifact
3. Command calls `codebase-hardening-agent` with issue ID
4. Agent loads `codebase-hardening-skill`:
   - Test adequacy criteria
   - Auto-fix patterns
   - Documentation patterns
   - Architectural hardening patterns
5. Agent checks test adequacy:
   - If tests adequate → auto-fixes issue
   - If tests inadequate → documents issue with fix plan
6. Agent reports actions taken

**Command:** `/harden [scope] [target]`

**Skills Used:**
- `codebase-hardening-skill` - Hardening patterns
- Architecture skills - For making changes
- `testing-agent` - To check test adequacy

---

### Scenario 17: Architectural Refactoring
**When:** User wants to address architectural issues (e.g., Supabase separation).

**What Happens:**
1. User says: `/harden supabase-separation`
2. Command loads monitoring artifact
3. Command calls `codebase-hardening-agent` with refactoring name
4. Agent loads `codebase-hardening-skill` → reads `ARCHITECTURAL_HARDENING.md`:
   - Dependency injection patterns
   - Service abstraction patterns
   - Migration strategies
5. Agent creates refactoring plan:
   - Identifies all affected files
   - Creates abstraction layer
   - Updates dependencies
   - Migrates code incrementally
6. Agent executes refactoring (if tests adequate) or documents plan

**Command:** `/harden <refactoring-name>`

**Skills Used:**
- `codebase-hardening-skill` - Architectural hardening patterns
- Architecture skills - For making changes

---

## Workflow Management Scenarios

### Scenario 18: Creating a Work Plan from PRD
**When:** User has a PRD and wants to execute it.

**What Happens:**
1. User says: `/work-plan docs/prd/active/landing-page-prd.md`
2. Command reads PRD file
3. Command parses PRD sections:
   - Overview → High-level understanding
   - Goals → Success criteria
   - Scope → Boundaries
   - Technical Plan → Affected domains
   - Development Roadmap → Work breakdown
   - Dependencies → Phase dependencies
4. Command creates structured plan:
   - Phases from roadmap
   - Steps within phases
   - Agent assignments per step
   - Dependencies between steps
   - Validation checkpoints
5. Command executes plan:
   - Delegates to architecture agents
   - Updates progress fields
   - Evaluates against plan (using `plan-evaluation-skill`)

**Command:** `/work-plan <PRD file or task>`

**Skills Used:**
- `plan-evaluation-skill` - Plan evaluation and updates
- Architecture agents - For execution

---

### Scenario 19: Building a Plan from PRD
**When:** User wants to create a plan without executing it.

**What Happens:**
1. User says: `/build-plan docs/prd/active/landing-page-prd.md`
2. Command reads PRD file
3. Command parses PRD sections
4. Command creates structured JSON plan:
   - Phases and steps
   - Agent assignments
   - Dependencies
   - Validation checkpoints
   - Progress tracking fields
5. Command outputs `.plan.json` file
6. Plan can be used later with `/work-plan --plan`

**Command:** `/build-plan <PRD file>`

**Output:** `.plan.json` file (machine-readable)

---

### Scenario 20: Reviewing a Pull Request
**When:** User wants to review a PR.

**What Happens:**
1. User says: `/review-pr 123`
2. Command calls `pr-review-agent`
3. Agent:
   - Gets PR information via GitHub CLI
   - Reads PR diff
   - Checks CI status
   - Runs quality gates (lint, build, test)
   - Analyzes code quality and architecture
   - Validates ExecutionContext and A2A compliance
   - Generates review comments
   - Approves or requests changes
4. Agent posts review via GitHub CLI

**Command:** `/review-pr [PR number or branch]`

**Skills Used:**
- `pr-review-agent` - Review workflow
- `quality-gates-skill` - Quality checks
- Architecture skills - Architecture validation
- `execution-context-skill` - ExecutionContext validation
- `transport-types-skill` - A2A compliance

---

### Scenario 21: Approving a PR
**When:** User wants to quickly approve a PR.

**What Happens:**
1. User says: `/approve-pr 123 "Looks good!"`
2. Command uses GitHub CLI directly
3. Command:
   - Verifies PR exists and is mergeable
   - Checks CI status (warns if still running)
   - Approves PR with comment
4. Command displays summary

**Command:** `/approve-pr [PR number or branch] [comment]`

**Note:** This is a quick approval path. Use `/review-pr` for full review.

---

### Scenario 22: Committing Changes
**When:** User wants to commit changes.

**What Happens:**
1. User says: `/commit`
2. Command calls `direct-commit-skill`
3. Skill:
   - Runs quality gates (format, lint, build)
   - Performs safety review (ExecutionContext, transport types, architecture)
   - Generates commit message (or uses provided)
   - Commits to current branch
4. Skill reports completion

**Command:** `/commit [message]`

**Skills Used:**
- `direct-commit-skill` - Commit workflow
- `quality-gates-skill` - Quality checks
- Architecture skills - Safety review

---

### Scenario 23: Committing and Pushing
**When:** User wants to commit and push.

**What Happens:**
1. User says: `/commit-push`
2. Command calls `direct-commit-skill`
3. Skill:
   - Runs quality gates
   - Performs safety review
   - Generates commit message
   - Commits to current branch
   - Fetches and merges remote changes
   - Pushes to remote
4. Skill reports completion

**Command:** `/commit-push [message]`

**Skills Used:**
- `direct-commit-skill` - Commit and push workflow
- `quality-gates-skill` - Quality checks

---

## Ecosystem Maintenance Scenarios

### Scenario 24: Fixing Skill Discovery
**When:** A skill isn't being picked up when it should be.

**What Happens:**
1. User says: `/fix-claude "the web-architecture-skill is not being picked up when I ask about Vue components"`
2. Command calls `claude-code-ecosystem-agent`
3. Agent:
   - Reads skill's SKILL.md
   - Analyzes description for trigger keywords
   - Compares with working skills
   - Identifies missing keywords
   - Updates description with better keywords
   - Improves specificity
4. Agent reports fixes applied

**Command:** `/fix-claude "<issue description>"`

**Skills Used:**
- `claude-code-ecosystem-agent` - Ecosystem maintenance
- `skill-builder-skill` - Skill structure patterns

---

### Scenario 25: Documenting Anti-Pattern
**When:** An agent did something wrong that should be prevented.

**What Happens:**
1. User says: `/fix-claude "the testing-agent created ExecutionContext in a component, that's wrong"`
2. Command calls `claude-code-ecosystem-agent`
3. Agent:
   - Identifies which skill needs the anti-pattern (web-architecture-skill)
   - Adds anti-pattern to VIOLATIONS.md
   - Updates agent workflow to prevent violation
   - Adds example showing wrong vs right
4. Agent reports fixes applied

**Command:** `/fix-claude "<issue description>"`

**Skills Used:**
- `claude-code-ecosystem-agent` - Ecosystem maintenance
- Architecture skills - For adding violations

---

### Scenario 26: Documenting Good Pattern
**When:** An agent did something well that should be repeated.

**What Happens:**
1. User says: `/fix-claude "the api-architecture-agent did a great job with dependency injection, we should document that pattern"`
2. Command calls `claude-code-ecosystem-agent`
3. Agent:
   - Identifies which skill needs the pattern (api-architecture-skill)
   - Adds good pattern to PATTERNS.md
   - Updates agent workflow to include pattern
   - Adds example showing the pattern
4. Agent reports fixes applied

**Command:** `/fix-claude "<issue description>"`

**Skills Used:**
- `claude-code-ecosystem-agent` - Ecosystem maintenance
- Architecture skills - For adding patterns

---

## Summary: When to Use What

### Commands (User-Invoked)
- `/commit` - Commit changes (no push)
- `/commit-push` - Commit and push
- `/review-pr` - Full PR review
- `/approve-pr` - Quick PR approval
- `/build-plan` - Create plan from PRD
- `/work-plan` - Execute plan from PRD/task
- `/test` - Run/generate/fix tests
- `/monitor` - Monitor codebase health
- `/harden` - Fix issues from monitoring
- `/fix-claude` - Fix ecosystem components

### Agents (Auto-Discovered)
- `web-architecture-agent` - Web development
- `api-architecture-agent` - API development
- `langgraph-architecture-agent` - LangGraph development
- `testing-agent` - Testing operations
- `pr-review-agent` - PR reviews
- `codebase-monitoring-agent` - Codebase monitoring
- `codebase-hardening-agent` - Codebase hardening
- `agent-builder-agent` - Agent creation
- `claude-code-ecosystem-agent` - Ecosystem maintenance

### Skills (Auto-Loaded)
- Architecture skills - File classification and validation
- Development skills - Prescriptive building patterns
- Testing skills - Test patterns (unit, integration, E2E)
- Builder skills - Creation patterns
- Utility skills - Workflow patterns

---

## Teaching Tips

1. **Start with Commands** - Commands are explicit and easy to understand
2. **Explain Auto-Discovery** - Agents and skills are discovered automatically
3. **Show Real Examples** - Use actual scenarios from the codebase
4. **Emphasize Mandatory Skills** - ExecutionContext and Transport Types are always checked
5. **Demonstrate Self-Improvement** - Show how `/fix-claude` improves the ecosystem
6. **Cover Testing Principles** - E2E tests use NO MOCKING
7. **Explain Workflow** - How commands → agents → skills work together

---

**Last Updated:** 2025-01-XX

---

## Quick Reference: Command → Agent → Skill Flow

### Commands Trigger Agents
- `/create-pr` → Progressive validation → Creates PR
- `/review-pr` → `pr-review-agent` → Architecture skills + quality gates
- `/test` → `testing-agent` → App-specific testing skills
- `/monitor` → `codebase-monitoring-agent` → Monitoring skill
- `/harden` → `codebase-hardening-agent` → Hardening skill
- `/fix-claude` → `claude-code-ecosystem-agent` → Builder skills

### Agents Use Skills
- Architecture agents → Architecture skills (classification + validation)
- Testing agent → Testing skills (patterns + E2E principles)
- Monitoring agent → Monitoring skill (file analysis + hierarchy)
- Hardening agent → Hardening skill (auto-fix + documentation)
- Ecosystem agent → Builder skills (creation patterns)

### Skills Provide Patterns
- Architecture skills → File classification + pattern validation
- Testing skills → Test patterns + E2E principles
- Builder skills → Creation templates + checklists
- Utility skills → Workflow patterns + best practices

