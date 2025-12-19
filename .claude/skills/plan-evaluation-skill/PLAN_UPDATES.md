# Plan Updates

How to modify plan structure by adding improvements, sub-plans, and corrections directly to the existing plan.

## Update Strategies

### 1. Add Improvements to Existing Plan

**When to Use:**
- Improvements are enhancements to the current plan
- New steps/phases fit into existing structure
- No need for separate sub-plan
- Improvements can be executed as part of main plan

**Process:**
1. Identify improvement needed (from evaluation)
2. Determine where to add it (which phase, which step)
3. Add new steps/phases/checkpoints to existing plan
4. Update dependencies if needed
5. Update plan file in-place

**Example: Adding Missing Validation Checkpoint**

**Original Plan:**
```json
{
  "phases": [
    {
      "id": "phase-1",
      "steps": [
        {
          "id": "step-1-1",
          "action": "Create landing page components"
        }
      ]
    }
  ],
  "checkpoints": []
}
```

**After Evaluation:**
- Identified: Missing validation checkpoint after step-1-1

**Updated Plan:**
```json
{
  "phases": [
    {
      "id": "phase-1",
      "steps": [
        {
          "id": "step-1-1",
          "action": "Create landing page components"
        }
      ]
    }
  ],
  "checkpoints": [
    {
      "id": "checkpoint-1",
      "label": "Quality Gates - Phase 1",
      "description": "Run lint, build, and ExecutionContext validation",
      "status": "pending",
      "triggered_after": ["step-1-1"]
    }
  ]
}
```

**Example: Adding Missing Step**

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
          "added_at": "2025-01-20T10:30:00Z",
          "rationale": "Tests were missing from original plan but are required"
        }
      ]
    }
  ]
}
```

### 2. Create Sub-Plan for Complex Steps

**When to Use:**
- Step is too complex for single execution
- Step needs detailed breakdown
- Sub-plan can be tracked separately
- Sub-plan results feed back into parent step

**Process:**
1. Identify complex step that needs sub-plan
2. Create sub-plan using `/build-plan` or internal planning
3. Execute sub-plan
4. Evaluate sub-plan completion
5. Update parent step with sub-plan results
6. Mark parent step as completed

**Example: Complex Step Requiring Sub-Plan**

**Original Plan:**
```json
{
  "steps": [
    {
      "id": "step-3-1",
      "action": "Build complete authentication system",
      "agent": "api-architecture-agent",
      "status": "pending"
    }
  ]
}
```

**Sub-Plan Created:**
```json
{
  "metadata": {
    "parent_step_id": "step-3-1",
    "parent_plan_id": "landing-page-plan",
    "created_at": "2025-01-20T10:30:00Z"
  },
  "summary": "Sub-plan for authentication system",
  "phases": [
    {
      "id": "sub-phase-1",
      "label": "Authentication Endpoints",
      "steps": [
        {
          "id": "sub-step-1-1",
          "action": "Create auth controller",
          "agent": "api-architecture-agent"
        },
        {
          "id": "sub-step-1-2",
          "action": "Create auth service",
          "agent": "api-architecture-agent"
        }
      ]
    },
    {
      "id": "sub-phase-2",
      "label": "Authentication Tests",
      "steps": [
        {
          "id": "sub-step-2-1",
          "action": "Create auth tests",
          "agent": "api-architecture-agent",
          "depends_on": ["sub-step-1-1", "sub-step-1-2"]
        }
      ]
    }
  ]
}
```

**After Sub-Plan Execution:**
- Sub-plan completed successfully
- All sub-steps completed

**Parent Plan Updated:**
```json
{
  "steps": [
    {
      "id": "step-3-1",
      "action": "Build complete authentication system",
      "agent": "api-architecture-agent",
      "status": "completed",
      "progress": 100,
      "completed_at": "2025-01-20T11:00:00Z",
      "sub_plan": {
        "id": "auth-system-sub-plan",
        "file": "plans/sub-plans/auth-system-sub-plan.plan.json",
        "status": "completed",
        "completed_at": "2025-01-20T11:00:00Z"
      },
      "deliverables": [
        "auth.controller.ts",
        "auth.service.ts",
        "auth.spec.ts"
      ]
    }
  ]
}
```

### 3. Update Plan Structure

**When to Use:**
- Dependencies need adjustment
- Phases need reordering
- Agent assignments need changes
- Execution strategy needs update

**Process:**
1. Identify structural issue
2. Determine required changes
3. Update plan structure
4. Preserve existing progress
5. Update dependencies

**Example: Reordering Phases**

**Original Plan:**
```json
{
  "phases": [
    {
      "id": "phase-1",
      "label": "Backend API"
    },
    {
      "id": "phase-2",
      "label": "Frontend UI"
    }
  ],
  "dependencies": {
    "phase-2": ["phase-1"]
  }
}
```

**After Evaluation:**
- Identified: Frontend can be built in parallel with backend (no dependency)

**Updated Plan:**
```json
{
  "phases": [
    {
      "id": "phase-1",
      "label": "Backend API"
    },
    {
      "id": "phase-2",
      "label": "Frontend UI"
    }
  ],
  "dependencies": {},
  "execution_strategy": {
    "mode": "parallel",
    "parallel_phases": ["phase-1", "phase-2"]
  },
  "updated_by": "plan-evaluation-skill",
  "updated_at": "2025-01-20T10:30:00Z",
  "update_rationale": "Frontend and backend can be built in parallel for faster execution"
}
```

## Update Metadata

All plan updates should include metadata:

```json
{
  "updated_by": "plan-evaluation-skill",
  "updated_at": "2025-01-20T10:30:00Z",
  "update_type": "add_step" | "add_phase" | "add_checkpoint" | "update_dependency" | "restructure",
  "update_rationale": "Why the update was made",
  "original_plan_version": "1.0",
  "updated_plan_version": "1.1"
}
```

## Preserving Progress

When updating plans, preserve existing progress:

**Before Update:**
```json
{
  "phases": [
    {
      "id": "phase-1",
      "status": "completed",
      "progress": 100,
      "completed_at": "2025-01-20T10:00:00Z"
    }
  ]
}
```

**After Adding New Step:**
```json
{
  "phases": [
    {
      "id": "phase-1",
      "status": "in_progress",  // Updated because new step added
      "progress": 67,  // Recalculated: 1 of 2 steps completed
      "completed_at": null,  // Reset because not fully complete
      "steps": [
        {
          "id": "step-1-1",
          "status": "completed",
          "progress": 100
        },
        {
          "id": "step-1-2",  // New step added
          "status": "pending",
          "progress": 0,
          "added_by": "plan-evaluation-skill"
        }
      ]
    }
  ]
}
```

## Sub-Plan Evaluation

When sub-plan completes, evaluate and update parent:

**Sub-Plan Completion:**
1. Load sub-plan file
2. Evaluate sub-plan implementation (using plan-evaluation-skill)
3. Map sub-plan results to parent step
4. Update parent step status
5. Add sub-plan deliverables to parent step
6. Update parent plan progress

**Example:**
```json
{
  "step_id": "step-3-1",
  "sub_plan_evaluation": {
    "sub_plan_id": "auth-system-sub-plan",
    "evaluation_date": "2025-01-20T11:00:00Z",
    "status": "completed",
    "phases_completed": 2,
    "steps_completed": 3,
    "deliverables": [
      "auth.controller.ts",
      "auth.service.ts",
      "auth.spec.ts"
    ],
    "gaps": [],
    "deviations": [],
    "quality_issues": []
  }
}
```

## Related

- **`COMPARISON.md`**: How to compare implementation to plan
- **`GAP_ANALYSIS.md`**: Identifying gaps that need plan updates
- **`CORRECTIONS.md`**: Suggesting corrections that become plan updates
- **`/build-plan`**: Creating sub-plans for complex steps

