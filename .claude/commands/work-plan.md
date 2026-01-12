---
description: "Create and execute a structured work plan from a task, PRD, or existing plan file. Delegates to sub-agents and tracks progress."
argument-hint: "[task description, PRD file path, or --plan path/to/plan.json]"
category: "development"
uses-skills: ["plan-evaluation-skill", "execution-context-skill", "transport-types-skill", "self-reporting-skill"]
uses-agents: ["web-architecture-agent", "api-architecture-agent", "langgraph-architecture-agent"]
related-commands: ["build-plan"]
---

# Work Plan Command

Create a structured work plan for a task, identifying which sub-agents will be used, how the work will be broken down, and the execution order.

## What This Does

1. **Accepts Input (Task, PRD, or Plan File):**
   - If `--plan` flag: Reads existing structured plan JSON file
   - If PRD file: Reads and parses PRD structure (creates plan on-the-fly)
   - If PRD content: Parses PRD sections (creates plan on-the-fly)
   - If task description: Analyzes requirements (creates plan on-the-fly)
   - Identifies affected domains (web, API, LangGraph, etc.)
   - Determines complexity and scope

2. **Extracts PRD Information (if PRD provided):**
   - Overview/Summary
   - Problem & Goals
   - Scope (in scope, out of scope)
   - Deliverables (Definition of Done)
   - Technical Plan (architecture, data model, APIs)
   - Development Roadmap (phases, milestones)
   - Logical Dependency Chain
   - Risks & Mitigations

3. **Identifies Required Agents:**
   - Architecture agents (web, API, LangGraph)
   - Agent builders (if creating agents)
   - Specialized agents (if needed)

4. **Creates Structured Plan:**
   - Breaks down work into phases (from PRD roadmap or task analysis)
   - Assigns agents to each phase
   - Defines dependencies between phases (from PRD dependency chain)
   - Estimates effort (from PRD or task analysis)

5. **Defines Execution Strategy:**
   - Sequential vs parallel execution
   - Coordination points
   - Validation checkpoints

6. **Auto-Adds Final Phases (unless skipped):**
   - Testing Phase: Run/add tests, verify coverage
   - Commit Phase: Run `/commit` for lint, build, safety review

7. **Optionally Executes:**
   - Can execute plan immediately
   - Or save for later execution
   - Or review and modify before execution

## Usage

### Execute Existing Plan File
```
/work-plan --plan plans/landing-page.plan.json
```
Reads structured plan and executes it, updating progress as it goes.

### Execute Specific Sprint/Phase
```
/work-plan sprint 4 @docs/plans/prediction-system.plan.json
/work-plan phase-1 @docs/plans/landing-page.plan.json
```
Execute a single phase from a plan file.

### Execute Multiple Sprints/Phases in Parallel (Comma-Delimited)
```
/work-plan sprint 5, sprint 6 @docs/plans/prediction-system.plan.json
/work-plan phase-1, phase-2, phase-3 @docs/plans/landing-page.plan.json
```
**When you provide a comma-delimited list of sprints/phases, they execute in parallel.**

The command:
1. Parses the comma-delimited list to identify phases
2. Verifies each phase exists in the plan
3. **Spawns a separate background agent for EACH phase**
4. Each agent runs independently and concurrently
5. Monitors completion and aggregates results

**Example - Running Sprint 5 and Sprint 6 in parallel:**
```
/work-plan sprint 5, sprint 6 @docs/plans/prediction-system.plan.json
```
This spawns:
- Agent 1: Executes Sprint 5 tasks (s5-1 through s5-8)
- Agent 2: Executes Sprint 6 tasks (s6-1 through s6-7)
Both agents run simultaneously, significantly reducing total execution time.

**Note:** Ensure phases don't have conflicting dependencies. Check the plan's `dependencies` section to verify phases can safely run in parallel.

### Create Plan from PRD and Execute
```
/work-plan docs/prd/active/landing-page-prd.md
/work-plan docs/prd/active/landing-page-prd.md --execute
```
Creates plan on-the-fly from PRD and executes immediately.

### Create Plan from Task and Execute
```
/work-plan "Build a new landing page for my organization with authentication"
/work-plan "Build a new landing page" --execute
```
Creates plan on-the-fly from task description and executes.

### Create Plan, Save, and Execute
```
/work-plan docs/prd/active/landing-page-prd.md --save-plan plans/landing-page.plan.json
```
Creates plan, saves it to file, then executes it.

### Create Plan and Review (Don't Execute)
```
/work-plan "Build a new landing page" --review
/work-plan docs/prd/active/landing-page-prd.md --review
```
Creates plan, displays it, waits for approval before execution.

## Plan Structure

The plan includes:

### 1. Task/PRD Analysis
- **Description:** What needs to be built (from PRD Overview or task)
- **Scope:** What's included/excluded (from PRD Scope section)
- **Complexity:** Simple, Medium, Complex
- **Estimated Effort:** Hours or story points
- **Goals:** Problem & Goals from PRD (if PRD provided)
- **Deliverables:** Definition of Done from PRD (if PRD provided)

### 2. Affected Domains
- **Web:** Vue components, stores, services, landing pages
- **API:** Endpoints, services, controllers
- **LangGraph:** Workflows, HITL, services
- **Database:** Migrations, schema changes
- **Other:** Documentation, tests, etc.

### 3. Agent Assignments
- **Primary Agents:** Main agents that will do the work
- **Supporting Agents:** Agents that assist
- **Validation Agents:** Agents that review/validate

### 4. Work Breakdown
- **Phase 1:** [Description] - Agent: [agent-name]
  - From PRD Development Roadmap (if PRD provided)
  - Or derived from task analysis
- **Phase 2:** [Description] - Agent: [agent-name]
- **Phase 3:** [Description] - Agent: [agent-name]

### 5. Dependencies
- **Phase 2 depends on:** Phase 1
- **Phase 3 depends on:** Phase 1, Phase 2
- **From PRD:** Logical Dependency Chain (if PRD provided)

### 6. Validation Checkpoints
- **After Phase 1:** Run quality gates
- **After Phase 2:** Validate ExecutionContext
- **After Phase 3:** Full review

## Example: Plan from PRD

```
/work-plan docs/prd/active/landing-page-prd.md

# Work Plan: Landing Page Redesign (from PRD)

## PRD Analysis
- **PRD:** landing-page-prd.md
- **Overview:** Redesign landing pages for better user experience
- **Goals:**
  - Improve conversion rates
  - Better mobile experience
  - Organization-specific customization
- **Scope:**
  - In scope: Landing page UI, organization switcher, responsive design
  - Out of scope: Backend API changes, database migrations

## Technical Plan (from PRD)
- **Services/Modules:** 
  - `apps/web/src/components/landing/`
  - `apps/web/src/stores/landingStore.ts`
  - `apps/web/src/services/landingService.ts`
- **Architecture:** Vue components, stores, services
- **Data Model:** No changes
- **APIs:** Uses existing organization endpoints

## Work Breakdown (from PRD Development Roadmap)

### Phase 1: Landing Page Components (web-architecture-agent)
- From PRD: "MVP - Basic landing page structure"
- Create new landing page components
- Add organization-specific styling
- **Dependencies:** None (foundation)
- **Validation:** Lint, build, visual review

### Phase 2: Organization Switcher (web-architecture-agent)
- From PRD: "Phase 2 - Organization customization"
- Enhance organization switcher component
- Add organization-specific content
- **Dependencies:** Phase 1 (uses landing page structure)
- **Validation:** ExecutionContext validation, A2A compliance

### Phase 3: Responsive Design (web-architecture-agent)
- From PRD: "Phase 3 - Mobile optimization"
- Implement responsive design
- Mobile-first approach
- **Dependencies:** Phase 1, Phase 2
- **Validation:** Responsive testing, quality gates
```

## Example: Plan from Task

```
# Work Plan: Build Organization Landing Page with Authentication

## Task Analysis
- **Description:** Create a new landing page for organizations with user authentication
- **Scope:** Landing page UI, authentication flow, API endpoints
- **Complexity:** Medium
- **Estimated Effort:** 4-6 hours

## Affected Domains
- ✅ Web (Vue components, stores, services)
- ✅ API (authentication endpoints)
- ❌ LangGraph (not needed)
- ❌ Database (uses existing schema)

## Agent Assignments

### Primary Agents
- `web-architecture-agent` - Build landing page components and authentication UI
- `api-architecture-agent` - Build authentication endpoints

### Supporting Agents
- `agent-builder-agent` - Register any new agents if needed

### Validation
- `pr-review-agent` - Review before merge

## Work Breakdown

### Phase 1: Landing Page UI (web-architecture-agent)
- Create landing page component
- Add organization-specific styling
- Implement responsive design
- **Dependencies:** None
- **Validation:** Lint, build, visual review

### Phase 2: Authentication UI (web-architecture-agent)
- Create login component
- Create registration component
- Add authentication store
- Add authentication service
- **Dependencies:** Phase 1 (uses landing page structure)
- **Validation:** ExecutionContext validation, A2A compliance

### Phase 3: Authentication API (api-architecture-agent)
- Create authentication endpoints
- Implement JWT token generation
- Add password hashing
- **Dependencies:** Phase 2 (needs UI to test)
- **Validation:** ExecutionContext validation, A2A compliance, tests

### Phase 4: Integration (web-architecture-agent + api-architecture-agent)
- Connect UI to API
- Add error handling
- Add loading states
- **Dependencies:** Phase 2, Phase 3
- **Validation:** End-to-end testing, quality gates

### Phase 5: Testing & Quality (AUTO-ADDED)
- Run and fix any existing tests
- Add new tests for new functionality
- Ensure test coverage for critical paths
- **Dependencies:** All previous phases
- **Validation:** All tests pass

### Phase 6: Final Commit (AUTO-ADDED)
- Run `/commit` to execute quality checks (lint, build, safety)
- Fix any linting issues
- Create commit with proper message
- **Dependencies:** Phase 5 (tests passing)
- **Validation:** Clean commit, no quality violations

## Execution Strategy

**Sequential Execution:**
1. Phase 1 → Validate → Phase 2 → Validate → Phase 3 → Validate → Phase 4 → Phase 5 (Testing) → Phase 6 (Commit)

**Coordination Points:**
- After Phase 1: Review landing page
- After Phase 2: Review authentication UI
- After Phase 3: Review API endpoints
- After Phase 4: Full integration review
- After Phase 5: All tests passing
- After Phase 6: Clean commit ready

## Validation Checkpoints

- **After each phase:** Quality gates (lint, build)
- **After Phase 2:** ExecutionContext validation
- **After Phase 3:** A2A compliance validation
- **After Phase 4:** Full PR review
- **After Phase 5:** Test coverage validation
- **After Phase 6:** Commit validation (lint, build, safety)

## Next Steps

1. Review this plan
2. Approve to execute
3. Or modify plan before execution
```

## Plan Execution

### Execute Immediately
```
/work-plan "Build landing page" --execute
```
Creates plan and executes immediately.

### Review First
```
/work-plan "Build landing page" --review
```
Creates plan, displays it, waits for approval.

### Save for Later
```
/work-plan "Build landing page" --save
```
Creates plan and saves to file for later execution.

## Parallel Execution (Comma-Delimited Phases)

When the user provides multiple phases separated by commas, execute them in parallel using background agents.

### Detection
Parse the input for comma-delimited phase identifiers:
- `sprint 5, sprint 6` → ["sprint-5", "sprint-6"]
- `phase-1, phase-2, phase-3` → ["phase-1", "phase-2", "phase-3"]
- `s5, s6` → ["sprint-5", "sprint-6"] (shorthand)

### Implementation
When comma-delimited phases are detected:

1. **Read the plan file** to get phase details
2. **For EACH phase in the list**, spawn a background agent using the Task tool:
   ```
   <Task>
     subagent_type: "api-architecture-agent" (or appropriate agent)
     run_in_background: true
     prompt: "Execute [phase-id] from plan file [path]. Tasks: [list tasks]..."
   </Task>
   ```
3. **Launch all agents in a SINGLE message** with multiple Task tool calls
4. **Report** the launched agents and their output file paths
5. **Optionally monitor** completion using TaskOutput tool

### Example Execution Flow

User: `/work-plan sprint 5, sprint 6 @docs/plans/prediction-system.plan.json`

Assistant Response:
```
Launching parallel execution for Sprint 5 and Sprint 6...

Spawning 2 background agents:

[Task: Sprint 5 - Setup Completion & Exploration]
  - Agent: api-architecture-agent
  - Tasks: s5-1 through s5-8
  - Output: /path/to/output-sprint5.log

[Task: Sprint 6 - Advanced Test Framework]
  - Agent: api-architecture-agent
  - Tasks: s6-1 through s6-7
  - Output: /path/to/output-sprint6.log

Both agents are running in parallel. Use TaskOutput to check progress.
```

### Monitoring Parallel Execution

After launching parallel agents:
- Use `TaskOutput` with `block: false` to check status
- Or wait for completion with `block: true`
- Aggregate results when all agents complete
- Update plan file with combined progress

## PRD Parsing

When a PRD is provided, the command:

1. **Reads PRD File or Content:**
   - Supports PRD file paths: `docs/prd/active/*.md`, `specs/prd-*.md`, `obsidian/docs/prd/**/*.md`
   - Supports PRD content directly in command

2. **Extracts Key Sections:**
   - **Overview/Summary** → Task description
   - **Problem & Goals** → Goals and objectives
   - **Scope** → In scope, out of scope
   - **Deliverables** → Definition of Done
   - **Technical Plan** → Architecture, data model, APIs, services/modules
   - **Development Roadmap** → Phases, milestones, MVP requirements
   - **Logical Dependency Chain** → Phase dependencies
   - **Risks & Mitigations** → Risk considerations

3. **Maps PRD Sections to Plan:**
   - Development Roadmap → Work Breakdown phases
   - Logical Dependency Chain → Phase dependencies
   - Technical Plan → Agent assignments (which domains affected)
   - Deliverables → Validation checkpoints

## Agent Selection Logic

The plan automatically identifies agents based on:

1. **PRD Technical Plan:**
   - Services/modules listed → Determines affected domains
   - Architecture section → Identifies components
   - Data model changes → May need API agent
   - API/contracts → API agent needed

2. **File Types Changed (if analyzing existing code):**
   - `.vue` files → `web-architecture-agent`
   - `.ts` files in `apps/api/` → `api-architecture-agent`
   - `.graph.ts` files → `langgraph-architecture-agent`

3. **Task Keywords:**
   - "landing page", "component", "Vue" → `web-architecture-agent`
   - "endpoint", "API", "controller" → `api-architecture-agent`
   - "workflow", "LangGraph", "HITL" → `langgraph-architecture-agent`

4. **Explicit Mentions:**
   - User says "use web agent" → `web-architecture-agent`
   - User says "use API agent" → `api-architecture-agent`

## Auto-Added Final Phases

**IMPORTANT:** Unless the user explicitly requests otherwise, `/work-plan` automatically adds two final phases to every development plan:

### Testing Phase (Auto-Added)

At the end of all development phases, before committing:

1. **Run existing tests** - Execute `npm run test` for affected apps
2. **Fix broken tests** - If tests fail due to changes, fix them
3. **Add new tests** - Create tests for new functionality:
   - Unit tests for new services/functions
   - Component tests for new Vue components
   - Integration tests for new API endpoints
4. **Verify coverage** - Ensure critical paths are covered

**Skip if:** User explicitly says "no tests", "skip tests", or tests were already added during development phases.

### Commit Phase (Auto-Added)

After tests pass:

1. **Run `/commit` command** - This executes:
   - `npm run lint` - Fix any linting issues
   - `npm run build` - Verify build passes
   - Safety review for sensitive changes
   - Creates properly formatted commit message
2. **Fix any issues** - If lint/build fails, fix and retry
3. **Commit changes** - With co-authored-by attribution

**Skip if:** User explicitly says "don't commit", "no commit", or requests separate PR handling.

### Example Auto-Added Phases

```
## Work Breakdown (Auto-Generated)

### Phase 1-N: [Development Phases]
... (as planned)

### Phase N+1: Testing & Quality (AUTO-ADDED)
- Run affected test suites
- Add tests for new functionality
- Verify test coverage
- **Dependencies:** All development phases
- **Validation:** All tests pass

### Phase N+2: Final Commit (AUTO-ADDED)
- Run /commit (lint, build, safety review)
- Fix any quality issues
- Create commit
- **Dependencies:** Testing phase
- **Validation:** Clean commit
```

## Plan Modification

After creating a plan, you can:
- **Add phases:** "Add a testing phase after Phase 3"
- **Change agents:** "Use langgraph-agent instead of api-agent for Phase 2"
- **Reorder phases:** "Move Phase 3 before Phase 2"
- **Add dependencies:** "Phase 4 depends on Phase 1 and Phase 3"

## PRD File Locations

PRDs are typically stored in:
- `docs/prd/active/*.md` - Active PRDs
- `docs/prd/history/*/PRD.md` - Archived PRDs
- `specs/prd-*.md` - Spec PRDs
- `obsidian/docs/prd/**/*.md` - Obsidian PRDs

The command will search these locations if a relative path is provided.

## Plan File Format

When using `--plan`, the command expects a JSON file matching the structure created by `/build-plan`:

- **Structure**: Matches `schemas/agent-platform/orchestration.schema.json`
- **Progress Tracking**: Includes `status`, `progress`, `started_at`, `completed_at` fields
- **Agent Assignments**: Each step has an `agent` field specifying which agent to use
- **Dependencies**: Steps and phases have `depends_on` arrays
- **Checkpoints**: Validation checkpoints are defined with `triggered_after` arrays

See `/build-plan` command for details on plan structure.

## Progress Updates

When executing a plan file, `/work-plan` updates progress fields:

- Sets `status` to `in_progress` when starting a phase/step
- Sets `status` to `completed` when finishing successfully
- Sets `status` to `failed` if execution fails
- Updates `progress` percentage (0-100)
- Sets `started_at` and `completed_at` timestamps
- Updates checkpoint `status` after validation

The plan file is updated in-place, so progress can be tracked across multiple executions.

## Related

- **`/build-plan`**: Creates structured plan files from PRDs
- **Base Agent**: Main orchestrator that executes plans
- **Architecture Agents**: Domain specialists that do the work
- **`plan-evaluation-skill/`**: Evaluates implementation vs plan, suggests corrections
- **`pr-review-agent.md`**: For final validation
- **`quality-gates-skill/`**: For quality checkpoints
- **`schemas/agent-platform/orchestration.schema.json`**: Plan structure schema
- **PRD Template**: `obsidian/docs/archive/prd/templates/prd-template.md`

## MANDATORY: Self-Reporting

**Log command invocation at START:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, details)
VALUES ('command', 'work-plan', 'invoked',
  '{\"input\": \"task or PRD\", \"triggered_by\": \"user\"}'::jsonb);"
```

**Log completion at END:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, success, details)
VALUES ('command', 'work-plan', 'completed', true,
  '{\"outcome\": \"Plan executed\", \"phases_completed\": N}'::jsonb);"
```

**If command fails:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, success, details)
VALUES ('command', 'work-plan', 'completed', false,
  '{\"error\": \"description of what went wrong\"}'::jsonb);"
```

## Notes

- Plans are structured and explicit about agent assignments
- Plans can be reviewed and modified before execution
- Plans support both sequential and parallel execution
- Plans include validation checkpoints at each phase
- Plan files are **machine-readable** (JSON) for use in Cursor and other tools
- Plan files include **progress tracking** for monitoring execution
- Plan files are **updated in-place** during execution (progress is preserved)
- **Testing and Commit phases are auto-added** unless explicitly skipped
- Use `--no-tests` to skip auto-added testing phase
- Use `--no-commit` to skip auto-added commit phase

