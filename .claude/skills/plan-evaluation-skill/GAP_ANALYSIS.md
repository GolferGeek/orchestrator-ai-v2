# Gap Analysis

How to identify and categorize gaps between planned and actual implementation.

## Gap Types

### 1. Missing Steps

**Definition:** Steps in the plan that were never started or executed.

**Detection:**
- Step status is `pending` or `not_started`
- No files created matching step deliverables
- No git commits associated with step
- No code changes related to step action

**Example:**
```json
{
  "step_id": "step-2-1",
  "action": "Add authentication endpoints",
  "status": "pending",
  "gap": {
    "type": "missing_step",
    "severity": "high",
    "description": "Step was never executed",
    "expected_deliverables": ["auth.controller.ts", "auth.service.ts"],
    "actual_deliverables": []
  }
}
```

### 2. Incomplete Steps

**Definition:** Steps that were started but not fully completed.

**Detection:**
- Step status is `in_progress`
- Some deliverables created, others missing
- Code partially written but not finished
- Tests or documentation missing

**Example:**
```json
{
  "step_id": "step-2-1",
  "status": "in_progress",
  "progress": 67,
  "gap": {
    "type": "incomplete_step",
    "severity": "medium",
    "description": "Controller and service created, but tests missing",
    "completed": ["auth.controller.ts", "auth.service.ts"],
    "missing": ["auth.spec.ts"]
  }
}
```

### 3. Missing Deliverables

**Definition:** Expected files or outputs that weren't created.

**Detection:**
- Step marked as completed
- Some deliverables exist, others don't
- Files referenced in plan but not found

**Example:**
```json
{
  "step_id": "step-1-1",
  "status": "completed",
  "gap": {
    "type": "missing_deliverable",
    "severity": "low",
    "description": "Main component created, but store file missing",
    "expected": ["landing-page.vue", "landing-store.ts"],
    "actual": ["landing-page.vue"],
    "missing": ["landing-store.ts"]
  }
}
```

### 4. Missing Validation

**Definition:** Validation checkpoints that weren't executed.

**Detection:**
- Checkpoint status is `pending`
- No quality gate results
- No test execution
- No ExecutionContext or A2A validation

**Example:**
```json
{
  "checkpoint_id": "checkpoint-1",
  "status": "pending",
  "gap": {
    "type": "missing_validation",
    "severity": "high",
    "description": "Quality gates not run after Phase 1",
    "expected": ["lint", "build", "test"],
    "actual": []
  }
}
```

### 5. Missing Dependencies

**Definition:** Steps executed before dependencies were satisfied.

**Detection:**
- Step executed but dependency step not completed
- Code references dependencies that don't exist
- Import errors or missing modules

**Example:**
```json
{
  "step_id": "step-3-1",
  "status": "completed",
  "gap": {
    "type": "missing_dependency",
    "severity": "high",
    "description": "Step executed before dependency step-2-1 completed",
    "depends_on": ["step-2-1"],
    "dependency_status": "in_progress"
  }
}
```

### 6. Quality Gaps

**Definition:** Work completed but doesn't meet quality standards.

**Detection:**
- Lint errors in created files
- Missing tests
- Missing documentation
- ExecutionContext violations
- A2A compliance issues

**Example:**
```json
{
  "step_id": "step-1-1",
  "status": "completed",
  "gap": {
    "type": "quality_gap",
    "severity": "medium",
    "description": "Component created but ExecutionContext not passed correctly",
    "issues": [
      {
        "type": "execution_context_violation",
        "file": "apps/web/src/components/landing/LandingPage.vue",
        "line": 45,
        "issue": "ExecutionContext not passed to service call"
      }
    ]
  }
}
```

## Gap Severity Levels

### High Severity
- **Missing critical steps** that block other work
- **Missing dependencies** that cause failures
- **Missing validation** that could hide bugs
- **Quality gaps** that violate core patterns (ExecutionContext, A2A)

**Action:** Must be addressed before continuing

### Medium Severity
- **Incomplete steps** that need finishing
- **Missing deliverables** that are important but not blocking
- **Quality gaps** that are fixable

**Action:** Should be addressed soon

### Low Severity
- **Missing optional deliverables** (documentation, comments)
- **Minor quality gaps** (formatting, naming)
- **Missing nice-to-have features**

**Action:** Can be addressed later

## Gap Detection Process

### 1. Identify All Gaps

**For Each Step:**
1. Check step status
2. Verify deliverables exist
3. Check code quality
4. Verify dependencies met
5. Check validation executed

**For Each Phase:**
1. Check all steps completed
2. Verify phase dependencies met
3. Check phase validation executed

**For Entire Plan:**
1. Check all phases completed
2. Verify final validation executed
3. Check overall quality

### 2. Categorize Gaps

**By Type:**
- Missing steps
- Incomplete steps
- Missing deliverables
- Missing validation
- Missing dependencies
- Quality gaps

**By Severity:**
- High (must fix)
- Medium (should fix)
- Low (nice to fix)

**By Phase:**
- Group gaps by phase
- Identify phase-level issues

### 3. Prioritize Gaps

**Priority Order:**
1. High severity gaps (blocking)
2. Missing dependencies (must fix first)
3. Medium severity gaps (important)
4. Low severity gaps (optional)

## Gap Reporting

### Gap Report Structure

```json
{
  "plan_id": "landing-page-plan",
  "evaluation_date": "2025-01-20T10:30:00Z",
  "gaps": [
    {
      "id": "gap-1",
      "type": "missing_step",
      "severity": "high",
      "step_id": "step-2-1",
      "phase_id": "phase-2",
      "description": "Authentication endpoints not created",
      "expected": ["auth.controller.ts", "auth.service.ts"],
      "actual": [],
      "suggestion": "Execute step-2-1 to create authentication endpoints"
    }
  ],
  "summary": {
    "total_gaps": 3,
    "high_severity": 1,
    "medium_severity": 2,
    "low_severity": 0
  }
}
```

## Related

- **`COMPARISON.md`**: How to compare implementation to plan
- **`CORRECTIONS.md`**: How to suggest fixes for gaps
- **`PROGRESS_TRACKING.md`**: How to update progress with gap information

