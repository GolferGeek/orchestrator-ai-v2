# Corrections and Improvements

How to suggest corrections for gaps and deviations, and propose plan improvements.

## Correction Types

### 1. Complete Missing Work

**For Missing Steps:**
- Suggest executing the missing step
- Recommend appropriate agent
- Provide step details (action, deliverables, dependencies)

**Example:**
```json
{
  "correction": {
    "type": "execute_missing_step",
    "step_id": "step-2-1",
    "action": "Execute step-2-1: Add authentication endpoints",
    "agent": "api-architecture-agent",
    "deliverables": ["auth.controller.ts", "auth.service.ts", "auth.spec.ts"],
    "dependencies": ["step-1-1"],
    "priority": "high"
  }
}
```

### 2. Finish Incomplete Work

**For Incomplete Steps:**
- Identify what's missing
- Suggest completing the step
- Recommend specific actions

**Example:**
```json
{
  "correction": {
    "type": "complete_step",
    "step_id": "step-2-1",
    "missing": ["auth.spec.ts"],
    "action": "Create test file auth.spec.ts with unit tests for auth endpoints",
    "agent": "api-architecture-agent",
    "priority": "medium"
  }
}
```

### 3. Fix Quality Issues

**For Quality Gaps:**
- Identify specific issues
- Suggest fixes using appropriate skills
- Recommend validation

**Example:**
```json
{
  "correction": {
    "type": "fix_quality_issue",
    "step_id": "step-1-1",
    "issue": {
      "type": "execution_context_violation",
      "file": "apps/web/src/components/landing/LandingPage.vue",
      "line": 45,
      "description": "ExecutionContext not passed to service call"
    },
    "fix": {
      "action": "Pass ExecutionContext to landingService.getData() call",
      "skill": "execution-context-skill",
      "priority": "high"
    }
  }
}
```

### 4. Align Deviations

**For Acceptable Deviations:**
- Update plan to reflect actual approach
- Document rationale
- Adjust future steps if needed

**Example:**
```json
{
  "correction": {
    "type": "update_plan_for_deviation",
    "step_id": "step-3-1",
    "deviation": {
      "original": "LangGraph workflow",
      "actual": "N8N workflow",
      "rationale": "User requested N8N for easier customer customization"
    },
    "updates": [
      {
        "field": "agent",
        "old": "langgraph-architecture-agent",
        "new": "n8n-api-agent-builder"
      },
      {
        "field": "action",
        "old": "Create LangGraph workflow",
        "new": "Create N8N workflow"
      }
    ],
    "priority": "low"
  }
}
```

**For Unacceptable Deviations:**
- Suggest reverting to planned approach
- Recommend corrections to align with plan
- Identify impact of deviation

**Example:**
```json
{
  "correction": {
    "type": "revert_deviation",
    "step_id": "step-3-1",
    "deviation": {
      "original": "LangGraph workflow with HITL",
      "actual": "Simple API endpoint",
      "rationale": "Faster to implement",
      "impact": "Missing HITL capability required by PRD"
    },
    "action": "Revert to LangGraph workflow approach as specified in plan",
    "agent": "langgraph-architecture-agent",
    "priority": "high"
  }
}
```

### 5. Add Missing Validation

**For Missing Checkpoints:**
- Suggest running validation
- Recommend appropriate checks
- Identify what to validate

**Example:**
```json
{
  "correction": {
    "type": "run_validation",
    "checkpoint_id": "checkpoint-1",
    "action": "Run quality gates: lint, build, test",
    "checks": [
      "npm run lint (all apps)",
      "npm run build (all apps)",
      "npm test (affected apps)"
    ],
    "priority": "high"
  }
}
```

### 6. Fix Dependency Issues

**For Missing Dependencies:**
- Identify blocking dependencies
- Suggest completing dependencies first
- Recommend execution order

**Example:**
```json
{
  "correction": {
    "type": "fix_dependency",
    "step_id": "step-3-1",
    "blocking_dependency": "step-2-1",
    "action": "Complete step-2-1 (authentication endpoints) before executing step-3-1",
    "priority": "high"
  }
}
```

## Adding Improvements to Existing Plan

When improvements are identified, they can be added directly to the existing plan rather than creating separate sub-plans. This keeps everything in one place and maintains plan continuity.

**Process:**
1. Identify improvement needed
2. Determine where to add it (which phase, which step)
3. Add new steps/phases/checkpoints to existing plan
4. Update dependencies if needed
5. Update plan file in-place

**Example: Adding Missing Step to Existing Plan**

**Original Plan:**
```json
{
  "phases": [
    {
      "id": "phase-2",
      "steps": [
        {
          "id": "step-2-1",
          "action": "Add authentication endpoints",
          "deliverables": ["auth.controller.ts", "auth.service.ts"]
        }
      ]
    }
  ]
}
```

**After Evaluation:**
- Identified: Missing test file (auth.spec.ts)

**Correction Applied:**
```json
{
  "correction": {
    "type": "add_step_to_plan",
    "phase_id": "phase-2",
    "new_step": {
      "id": "step-2-2",
      "action": "Add authentication tests",
      "agent": "api-architecture-agent",
      "deliverables": ["auth.spec.ts"],
      "depends_on": ["step-2-1"],
      "added_by": "plan-evaluation-skill",
      "added_at": "2025-01-20T10:30:00Z",
      "rationale": "Tests were missing from original plan but are required"
    }
  }
}
```

**Updated Plan:**
```json
{
  "phases": [
    {
      "id": "phase-2",
      "steps": [
        {
          "id": "step-2-1",
          "action": "Add authentication endpoints",
          "deliverables": ["auth.controller.ts", "auth.service.ts"]
        },
        {
          "id": "step-2-2",
          "action": "Add authentication tests",
          "agent": "api-architecture-agent",
          "deliverables": ["auth.spec.ts"],
          "depends_on": ["step-2-1"],
          "status": "pending",
          "added_by": "plan-evaluation-skill",
          "added_at": "2025-01-20T10:30:00Z"
        }
      ]
    }
  ]
}
```

See **`PLAN_UPDATES.md`** for detailed documentation on updating plans.

## Improvement Suggestions

### 1. Plan Structure Improvements

**Better Phase Organization:**
- Suggest combining related steps
- Recommend splitting large phases
- Propose better dependency structure

**Example:**
```json
{
  "improvement": {
    "type": "restructure_phases",
    "suggestion": "Combine steps 1-1 and 1-2 into single phase for better cohesion",
    "rationale": "Both steps work on same component and can be done together"
  }
}
```

### 2. Agent Assignment Improvements

**Better Agent Selection:**
- Suggest more appropriate agent
- Recommend agent specialization
- Propose agent coordination

**Example:**
```json
{
  "improvement": {
    "type": "better_agent_assignment",
    "step_id": "step-2-1",
    "current_agent": "web-architecture-agent",
    "suggested_agent": "api-architecture-agent",
    "rationale": "Step involves API endpoints, not web components"
  }
}
```

### 3. Dependency Optimization

**Better Dependency Structure:**
- Suggest parallel execution opportunities
- Recommend dependency reduction
- Propose faster execution paths

**Example:**
```json
{
  "improvement": {
    "type": "optimize_dependencies",
    "suggestion": "Steps 2-1 and 2-2 can run in parallel (no dependencies)",
    "rationale": "Both steps are independent and can be executed simultaneously"
  }
}
```

### 4. Validation Improvements

**Better Checkpoint Placement:**
- Suggest additional checkpoints
- Recommend checkpoint timing
- Propose validation scope

**Example:**
```json
{
  "improvement": {
    "type": "add_checkpoint",
    "suggestion": "Add checkpoint after step-2-1 to validate ExecutionContext",
    "rationale": "Early validation prevents issues from propagating"
  }
}
```

## Correction Application

### Automatic Corrections

**Safe, Non-Destructive Updates:**
- Progress field updates
- Status changes
- Timestamp additions
- Implementation notes

**Example:**
```json
{
  "auto_apply": true,
  "updates": [
    {
      "step_id": "step-1-1",
      "status": "completed",
      "progress": 100,
      "completed_at": "2025-01-20T10:30:00Z"
    }
  ]
}
```

### Suggested Corrections

**Require User/Agent Approval:**
- Plan structure changes
- Agent reassignments
- Step additions/removals
- Major deviations

**Example:**
```json
{
  "auto_apply": false,
  "requires_approval": true,
  "suggestions": [
    {
      "type": "add_step",
      "step": {
        "id": "step-2-2",
        "action": "Add authentication tests",
        "agent": "api-architecture-agent"
      },
      "rationale": "Tests were missing from original plan but are required"
    }
  ]
}
```

## Correction Workflow

### 1. Identify Corrections

- Analyze gaps and deviations
- Categorize by type and severity
- Prioritize corrections

### 2. Generate Suggestions

- Create correction objects
- Provide rationale
- Estimate effort

### 3. Apply or Propose

- Auto-apply safe updates
- Propose changes requiring approval
- Document all corrections

### 4. Track Corrections

- Record applied corrections
- Track suggested corrections
- Monitor correction effectiveness

## Related

- **`GAP_ANALYSIS.md`**: Identifying gaps
- **`DEVIATION_ANALYSIS.md`**: Detecting deviations
- **`PLAN_UPDATES.md`**: Updating plan structure
- **`PROGRESS_TRACKING.md`**: Updating progress

