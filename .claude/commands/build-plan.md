---
description: "Build a structured, machine-readable execution plan from PRD(s), optimized for agent delegation and progress tracking."
argument-hint: "[PRD file path(s) or PRD content]"
---

# Build Plan Command

Build a structured, machine-readable execution plan from one or more Product Requirements Documents (PRDs). The plan is optimized for the base agent to delegate work to sub-agents and includes progress tracking fields for monitoring execution.

## What This Does

1. **Parses PRD(s):**
   - Accepts one or more PRD file paths
   - Accepts PRD content directly
   - Extracts all relevant sections (Overview, Technical Plan, Development Roadmap, etc.)

2. **Creates Structured Plan:**
   - Generates JSON plan matching the `plan_json` structure (compatible with database `plans.plan_json`)
   - Breaks work into phases and steps
   - Assigns agents to each step
   - Defines dependencies between steps
   - Includes validation checkpoints
   - Adds progress tracking fields (status, completion, timestamps)

3. **Outputs Machine-Readable Format:**
   - Saves as JSON file (`.plan.json`) for use in Cursor or other tools
   - Can output to stdout for piping
   - Includes metadata (PRD source, created date, version)

## Usage

### Build Plan from Single PRD
```
/build-plan docs/prd/active/landing-page-prd.md
```

### Build Plan from Multiple PRDs
```
/build-plan docs/prd/active/landing-page-prd.md docs/prd/active/auth-prd.md
```

### Build Plan and Save to File
```
/build-plan docs/prd/active/landing-page-prd.md --output plans/landing-page.plan.json
```

### Build Plan and Output to Stdout
```
/build-plan docs/prd/active/landing-page-prd.md --stdout
```

### Build Plan from PRD Content
```
/build-plan "PRD: Build landing page. Overview: ... Technical Plan: ..."
```

## Plan Structure

The generated plan follows this JSON structure (compatible with `plans.plan_json`):

```json
{
  "metadata": {
    "version": "1.0",
    "created_at": "2025-01-20T10:00:00Z",
    "prd_sources": ["docs/prd/active/landing-page-prd.md"],
    "title": "Landing Page Redesign",
    "summary": "Redesign landing pages for better user experience"
  },
  "summary": "Redesign landing pages for better user experience",
  "phases": [
    {
      "id": "phase-1",
      "label": "Landing Page Components",
      "status": "pending",
      "progress": 0,
      "started_at": null,
      "completed_at": null,
      "steps": [
        {
          "id": "step-1-1",
          "action": "Create landing page components",
          "agent": "web-architecture-agent",
          "status": "pending",
          "progress": 0,
          "started_at": null,
          "completed_at": null,
          "depends_on": [],
          "deliverables": ["landing-page.vue", "landing-store.ts"],
          "validation_checkpoint": "quality-gates",
          "human_checkpoint_id": null
        }
      ]
    }
  ],
  "checkpoints": [
    {
      "id": "checkpoint-1",
      "label": "Quality Gates",
      "description": "Run lint, build, and tests",
      "status": "pending",
      "triggered_after": ["step-1-1"]
    }
  ],
  "dependencies": {
    "phase-2": ["phase-1"],
    "phase-3": ["phase-1", "phase-2"]
  },
  "execution_strategy": {
    "mode": "sequential",
    "parallel_phases": []
  }
}
```

### Key Fields

- **`metadata`**: Plan metadata (version, sources, timestamps)
- **`phases`**: Array of work phases, each with:
  - `id`: Unique phase identifier
  - `label`: Human-readable phase name
  - `status`: `pending` | `in_progress` | `completed` | `blocked` | `failed`
  - `progress`: 0-100 percentage
  - `started_at` / `completed_at`: Timestamps for tracking
  - `steps`: Array of work steps
- **`steps`**: Individual work items, each with:
  - `id`: Unique step identifier
  - `action`: Description of work to be done
  - `agent`: Agent assigned to execute this step
  - `status`: Progress status
  - `depends_on`: Array of step IDs that must complete first
  - `deliverables`: Expected outputs
  - `validation_checkpoint`: Checkpoint ID to run after completion
- **`checkpoints`**: Validation points, each with:
  - `id`: Unique checkpoint identifier
  - `label`: Human-readable name
  - `status`: `pending` | `passed` | `failed`
  - `triggered_after`: Array of step IDs that trigger this checkpoint
- **`dependencies`**: Phase-level dependencies (for visualization)
- **`execution_strategy`**: How phases should be executed (sequential, parallel)

## PRD Parsing

The command extracts information from PRD sections:

### From PRD → Plan Mapping

- **Overview/Summary** → `metadata.title`, `summary`
- **Problem & Goals** → `metadata.goals` (array)
- **Scope** → `metadata.scope` (in_scope, out_of_scope arrays)
- **Technical Plan** → Agent assignments (determines which agents needed)
  - Services/Modules → Affected domains (web, API, LangGraph)
  - Architecture → Component structure
  - Data Model → Database changes
  - APIs/Contracts → API endpoints
- **Development Roadmap** → `phases` array
  - Each roadmap phase → Plan phase
  - MVP requirements → First phase
- **Logical Dependency Chain** → `dependencies` object
- **Deliverables** → `steps[].deliverables` arrays
- **Risks & Mitigations** → `metadata.risks` array
- **Test & Verification** → `checkpoints` array

## Agent Assignment Logic

Agents are assigned based on:

1. **PRD Technical Plan:**
   - Services/modules in `apps/web/` → `web-architecture-agent`
   - Services/modules in `apps/api/` → `api-architecture-agent`
   - Services/modules in `apps/langgraph/` → `langgraph-architecture-agent`
   - Database migrations → `api-architecture-agent`
   - Agent creation → `agent-builder-agent`

2. **Step Action Keywords:**
   - "component", "Vue", "store", "service" (web) → `web-architecture-agent`
   - "endpoint", "API", "controller", "migration" → `api-architecture-agent`
   - "workflow", "LangGraph", "HITL" → `langgraph-architecture-agent`
   - "agent", "register agent" → `agent-builder-agent`

3. **Explicit Mentions:**
   - PRD says "use web agent" → `web-architecture-agent`
   - PRD says "use API agent" → `api-architecture-agent`

## Progress Tracking

The plan includes progress tracking fields:

- **Phase/Step Status:**
  - `pending`: Not started
  - `in_progress`: Currently executing
  - `completed`: Finished successfully
  - `blocked`: Waiting on dependency
  - `failed`: Execution failed

- **Progress Percentage:**
  - `progress`: 0-100 integer
  - Calculated from completed steps

- **Timestamps:**
  - `started_at`: ISO 8601 timestamp when phase/step started
  - `completed_at`: ISO 8601 timestamp when phase/step completed

## Integration with `/work-plan`

The `/work-plan` command can:

1. **Execute Existing Plan:**
   ```
   /work-plan --plan plans/landing-page.plan.json
   ```
   Reads the structured plan and executes it, updating progress as it goes.

2. **Create Plan On-the-Fly:**
   ```
   /work-plan docs/prd/active/landing-page-prd.md
   ```
   Creates plan internally and executes immediately (current behavior).

3. **Create and Save Plan:**
   ```
   /work-plan docs/prd/active/landing-page-prd.md --save-plan plans/landing-page.plan.json
   ```
   Creates plan, saves it, then executes it.

## Output Options

### Save to File (Default)
```
/build-plan docs/prd/active/landing-page-prd.md --output plans/landing-page.plan.json
```
Saves plan to specified file path. Creates directory if needed.

### Output to Stdout
```
/build-plan docs/prd/active/landing-page-prd.md --stdout
```
Outputs JSON to stdout for piping or inspection.

### Auto-Generated Filename
```
/build-plan docs/prd/active/landing-page-prd.md
```
If no `--output` specified, generates filename from PRD:
- `docs/prd/active/landing-page-prd.md` → `plans/landing-page.plan.json`

## Example: Complete Workflow

### Step 1: Build Plan
```
/build-plan docs/prd/active/landing-page-prd.md --output plans/landing-page.plan.json
```

**Output:**
```
✅ Plan created: plans/landing-page.plan.json
📋 3 phases, 8 steps, 4 checkpoints
🎯 Agents: web-architecture-agent, api-architecture-agent
```

### Step 2: Review Plan (Optional)
```bash
cat plans/landing-page.plan.json | jq '.phases[] | {id, label, steps: [.steps[] | {id, action, agent}]}'
```

### Step 3: Execute Plan
```
/work-plan --plan plans/landing-page.plan.json
```

The `/work-plan` command will:
- Read the structured plan
- Execute phases in order (respecting dependencies)
- Update progress fields as it goes
- Run validation checkpoints
- Report completion status

## Use in Cursor

Since the plan is JSON, it can be used in Cursor:

1. **Read Plan:**
   ```typescript
   import plan from './plans/landing-page.plan.json';
   // Access plan.phases, plan.steps, etc.
   ```

2. **Track Progress:**
   ```typescript
   // Update step status
   plan.phases[0].steps[0].status = 'completed';
   plan.phases[0].steps[0].completed_at = new Date().toISOString();
   ```

3. **Check Dependencies:**
   ```typescript
   const canExecute = (step) => {
     return step.depends_on.every(depId => 
       findStep(depId).status === 'completed'
     );
   };
   ```

## Related

- **`/work-plan`**: Executes plans (can read `.plan.json` files)
- **`base-agent.md`**: Main orchestrator that delegates based on plan
- **Architecture Agents**: Domain specialists that execute plan steps
- **`schemas/agent-platform/orchestration.schema.json`**: Plan structure schema
- **`plans.plan_json`**: Database column that stores plan structure

## Notes

- Plans are **machine-readable** (JSON) for use in Cursor and other tools
- Plans include **progress tracking** for monitoring execution
- Plans are **optimized for agent delegation** (clear agent assignments, dependencies)
- Plans can be **saved, reviewed, and executed multiple times**
- Plans follow the **orchestration schema** structure (compatible with database)

