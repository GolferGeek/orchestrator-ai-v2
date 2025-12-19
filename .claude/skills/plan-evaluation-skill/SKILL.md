---
name: plan-evaluation-skill
description: "Evaluate plan implementation against original plan, identify gaps and deviations, suggest corrections, and update plan with actual progress. Use when executing plans or reviewing completed work."
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

# Plan Evaluation Skill

Evaluate the implementation of a structured execution plan, comparing what was actually done against what was planned, identifying gaps and deviations, suggesting corrections, and updating the plan with actual progress.

## Purpose

This skill enables the base agent to:
1. **Compare Implementation to Plan**: Analyze what was actually done vs what was planned
2. **Identify Gaps**: Find missing deliverables, incomplete steps, or skipped phases
3. **Detect Deviations**: Identify work that was done differently than planned
4. **Suggest Corrections**: Propose fixes for gaps and deviations
5. **Update Plan**: Reflect actual progress, completed work, and any necessary plan adjustments

## When to Use

- **During Plan Execution**: After each phase or step completes
- **After Plan Completion**: Final evaluation of entire plan
- **On Plan Review**: When reviewing a completed plan's implementation
- **On Plan Resumption**: When resuming a partially completed plan

## Core Workflow

### 1. Load Plan and Analyze Implementation

**Read Original Plan:**
- Load the `.plan.json` file or plan structure
- Understand phases, steps, dependencies, deliverables, checkpoints
- Note expected agents, actions, and validation points

**Analyze Actual Implementation:**
- Use `git diff` to see what files were changed
- Use `grep` to find new files created
- Analyze code structure to understand what was built
- Check for deliverables (files, endpoints, components, etc.)
- Review commit messages for context

**Compare:**
- Map actual changes to planned steps
- Identify which steps were completed
- Identify which steps were skipped or modified
- Identify unexpected work done

### 2. Identify Gaps and Deviations

**Gaps (Missing Work):**
- Planned steps that weren't executed
- Expected deliverables that weren't created
- Validation checkpoints that weren't run
- Dependencies that weren't satisfied

**Deviations (Different Work):**
- Steps executed differently than planned
- Different agents used than assigned
- Different approach taken than specified
- Additional work done beyond plan

**Quality Issues:**
- Code that doesn't meet quality gates
- Missing tests or documentation
- ExecutionContext violations
- A2A compliance issues

### 3. Evaluate Progress

**Calculate Actual Progress:**
- Count completed steps vs total steps
- Calculate phase completion percentages
- Identify blocked steps (dependencies not met)
- Note failed steps and reasons

**Update Status Fields:**
- Set `status` to `completed`, `failed`, `blocked`, or `skipped`
- Update `progress` percentages (0-100)
- Set `started_at` and `completed_at` timestamps
- Add `notes` or `issues` for problematic steps

### 4. Suggest Corrections

**For Gaps:**
- Propose steps to complete missing work
- Suggest additional phases if needed
- Recommend validation checkpoints
- Identify blockers and dependencies

**For Deviations:**
- Evaluate if deviation is acceptable or needs correction
- Suggest alignment with original plan if needed
- Propose plan updates if deviation is better approach
- Document rationale for deviations

**For Quality Issues:**
- Suggest fixes for ExecutionContext violations
- Recommend A2A compliance corrections
- Propose missing tests or documentation
- Identify architectural improvements

### 5. Update Plan

**Progress Updates:**
- Update `status`, `progress`, `started_at`, `completed_at` fields
- Mark completed steps and phases
- Update checkpoint statuses

**Plan Adjustments:**
- Add new steps if unexpected work is needed
- Remove obsolete steps if approach changed
- Update dependencies if order changed
- Add new phases if scope expanded
- Update agent assignments if different agents needed

**Documentation:**
- Add `implementation_notes` to steps
- Document deviations and rationale
- Record issues and resolutions
- Note lessons learned

## Detailed Documentation

For specific aspects of plan evaluation, see:

- **`COMPARISON.md`**: How to compare implementation to plan
- **`GAP_ANALYSIS.md`**: Identifying and categorizing gaps
- **`DEVIATION_ANALYSIS.md`**: Detecting and evaluating deviations
- **`CORRECTIONS.md`**: Suggesting and applying corrections
- **`PROGRESS_TRACKING.md`**: Updating progress fields
- **`PLAN_UPDATES.md`**: Modifying plan structure (adding improvements, sub-plans)

## Integration with Base Agent

The base agent should use this skill:

1. **After Each Phase:**
   ```
   Base Agent:
   1. Executes phase using architecture agents
   2. Invokes plan-evaluation-skill
   3. Skill evaluates phase implementation
   4. Skill updates plan with progress
   5. Base agent continues to next phase
   ```

2. **After Plan Completion:**
   ```
   Base Agent:
   1. All phases executed
   2. Invokes plan-evaluation-skill for final evaluation
   3. Skill performs comprehensive comparison
   4. Skill suggests any remaining corrections
   5. Skill updates plan with final status
   ```

3. **On Plan Review:**
   ```
   Base Agent:
   1. User requests plan review
   2. Invokes plan-evaluation-skill
   3. Skill analyzes current state vs plan
   4. Skill generates evaluation report
   5. Base agent presents findings
   ```

4. **For Complex Steps (Sub-Plan Creation):**
   ```
   Base Agent:
   1. Identifies step is too complex for single execution
   2. Creates sub-plan for that step (using /build-plan or internal planning)
   3. Executes sub-plan
   4. Invokes plan-evaluation-skill when sub-plan completes
   5. Skill evaluates sub-plan implementation
   6. Skill updates parent plan step with sub-plan results
   7. Base agent continues with parent plan
   ```

5. **Adding Improvements to Existing Plan:**
   ```
   Base Agent:
   1. Skill identifies improvements needed (better structure, dependencies, validation)
   2. Skill suggests adding improvements directly to existing plan
   3. Base agent adds new steps/phases/checkpoints to existing plan
   4. Plan is updated in-place (no separate sub-plan)
   5. Base agent continues execution with improved plan
   ```

## Example: Phase Evaluation

**Original Plan (Phase 1):**
```json
{
  "id": "phase-1",
  "label": "Landing Page Components",
  "steps": [
    {
      "id": "step-1-1",
      "action": "Create landing page components",
      "agent": "web-architecture-agent",
      "deliverables": ["landing-page.vue", "landing-store.ts"]
    }
  ]
}
```

**After Implementation:**
- Files created: `apps/web/src/components/landing/LandingPage.vue`, `apps/web/src/stores/landingStore.ts`
- Agent used: `web-architecture-agent` ✓
- ExecutionContext: Passed correctly ✓
- A2A compliance: All calls compliant ✓

**Evaluation Result:**
```json
{
  "id": "phase-1",
  "status": "completed",
  "progress": 100,
  "completed_at": "2025-01-20T10:30:00Z",
  "steps": [
    {
      "id": "step-1-1",
      "status": "completed",
      "progress": 100,
      "completed_at": "2025-01-20T10:30:00Z",
      "deliverables": [
        "apps/web/src/components/landing/LandingPage.vue",
        "apps/web/src/stores/landingStore.ts"
      ],
      "implementation_notes": "Created as planned. Files follow Vue patterns. ExecutionContext passed correctly."
    }
  ]
}
```

## Example: Gap Detection

**Original Plan:**
```json
{
  "steps": [
    {
      "id": "step-2-1",
      "action": "Add authentication endpoints",
      "deliverables": ["auth.controller.ts", "auth.service.ts", "auth.spec.ts"]
    }
  ]
}
```

**Actual Implementation:**
- Files created: `auth.controller.ts`, `auth.service.ts`
- Missing: `auth.spec.ts` (tests not created)

**Evaluation Result:**
```json
{
  "steps": [
    {
      "id": "step-2-1",
      "status": "in_progress",
      "progress": 67,
      "issues": [
        {
          "type": "gap",
          "severity": "medium",
          "description": "Missing test file: auth.spec.ts",
          "suggestion": "Create test file with unit tests for auth endpoints"
        }
      ]
    }
  ]
}
```

## Example: Deviation Detection

**Original Plan:**
```json
{
  "steps": [
    {
      "id": "step-3-1",
      "action": "Create LangGraph workflow",
      "agent": "langgraph-architecture-agent"
    }
  ]
}
```

**Actual Implementation:**
- Created N8N workflow instead of LangGraph workflow
- Used `n8n-api-agent-builder` instead of `langgraph-architecture-agent`

**Evaluation Result:**
```json
{
  "steps": [
    {
      "id": "step-3-1",
      "status": "completed",
      "progress": 100,
      "deviation": {
        "type": "approach_change",
        "original": "LangGraph workflow",
        "actual": "N8N workflow",
        "rationale": "User requested N8N for easier customer customization",
        "acceptable": true,
        "plan_update_needed": true
      },
      "suggestions": [
        "Update plan to reflect N8N workflow approach",
        "Update agent assignment to n8n-api-agent-builder"
      ]
    }
  ]
}
```

## Related

- **`/build-plan`**: Creates structured plans from PRDs
- **`/work-plan`**: Executes plans (uses this skill for evaluation)
- **Base Agent**: Main orchestrator that uses this skill
- **Architecture Agents**: Domain specialists that execute plan steps
- **`quality-gates-skill/`**: Quality validation
- **`execution-context-skill/`**: ExecutionContext validation
- **`transport-types-skill/`**: A2A compliance validation

## Notes

- This skill is **progressive** - detailed documentation in supporting files
- Evaluation happens **during and after** plan execution
- Plan updates are **non-destructive** - original plan preserved, updates tracked
- Corrections are **suggestions** - base agent decides whether to apply them
- Progress tracking is **automatic** - updates plan file in-place
- **Sub-plans** can be created for complex steps, then evaluated and results fed back to parent plan
- **Improvements** can be added directly to existing plan (no separate sub-plan needed)
- Plan updates preserve existing progress and maintain plan continuity

