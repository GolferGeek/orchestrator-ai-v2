# Plan Comparison Strategy

How to compare actual implementation against the original plan.

## Comparison Process

### 1. Load Plan Structure

**Read Plan File:**
```bash
# Read the .plan.json file
cat plans/landing-page.plan.json | jq '.'
```

**Extract Key Information:**
- Phases and their IDs
- Steps and their IDs, actions, agents, deliverables
- Dependencies between steps
- Validation checkpoints
- Expected deliverables per step

### 2. Analyze Actual Implementation

**Git Diff Analysis:**
```bash
# Get all changed files since plan start
git diff --name-status <plan-start-commit> HEAD

# Get detailed diff for specific files
git diff <plan-start-commit> HEAD -- apps/web/src/components/landing/

# Get new files created
git diff --diff-filter=A --name-only <plan-start-commit> HEAD
```

**File System Analysis:**
```bash
# Find new files matching expected deliverables
find apps/web/src -name "*landing*" -type f

# Check if expected files exist
test -f apps/web/src/components/landing/LandingPage.vue && echo "Exists" || echo "Missing"
```

**Code Analysis:**
```bash
# Search for specific patterns or implementations
grep -r "LandingPage" apps/web/src/components/
grep -r "landingStore" apps/web/src/stores/
```

### 3. Map Implementation to Plan

**Step-by-Step Mapping:**

For each step in the plan:
1. **Find Corresponding Changes:**
   - Search git diff for files matching step deliverables
   - Check if expected files were created
   - Verify code matches step action description

2. **Match to Step:**
   - Map file changes to step ID
   - Identify which step each change belongs to
   - Note changes that don't match any step

3. **Verify Agent Assignment:**
   - Check commit messages for agent used
   - Verify correct agent was used (if specified)
   - Note if different agent was used

4. **Check Deliverables:**
   - List actual files created vs expected deliverables
   - Identify missing deliverables
   - Identify unexpected deliverables

### 4. Compare Structure

**Phase Completion:**
- Count completed steps per phase
- Calculate phase progress percentage
- Identify phases that weren't started

**Dependency Satisfaction:**
- Check if step dependencies were met
- Verify steps executed in correct order
- Identify blocked steps (dependencies not met)

**Checkpoint Execution:**
- Verify validation checkpoints were run
- Check checkpoint results (passed/failed)
- Identify missing checkpoints

## Comparison Output

### Completed Steps

```json
{
  "step_id": "step-1-1",
  "status": "completed",
  "actual_files": [
    "apps/web/src/components/landing/LandingPage.vue",
    "apps/web/src/stores/landingStore.ts"
  ],
  "expected_deliverables": [
    "landing-page.vue",
    "landing-store.ts"
  ],
  "match": true,
  "agent_used": "web-architecture-agent",
  "agent_expected": "web-architecture-agent",
  "agent_match": true
}
```

### Missing Steps

```json
{
  "step_id": "step-2-1",
  "status": "not_started",
  "expected_deliverables": [
    "auth.controller.ts",
    "auth.service.ts",
    "auth.spec.ts"
  ],
  "actual_files": [],
  "missing": true
}
```

### Deviated Steps

```json
{
  "step_id": "step-3-1",
  "status": "completed",
  "expected": "LangGraph workflow",
  "actual": "N8N workflow",
  "deviation": true,
  "rationale": "User requested N8N instead"
}
```

## Tools and Commands

### Git Commands

```bash
# Get commit range for plan execution
git log --oneline --since="2025-01-20" --until="2025-01-21"

# Get all changed files
git diff --name-only <start-commit> <end-commit>

# Get detailed changes
git diff <start-commit> <end-commit> --stat

# Get new files
git diff --diff-filter=A --name-only <start-commit> <end-commit>

# Get deleted files
git diff --diff-filter=D --name-only <start-commit> <end-commit>
```

### File System Commands

```bash
# Find files matching pattern
find . -name "*pattern*" -type f

# Check file existence
test -f path/to/file && echo "Exists"

# Get file metadata
stat -f "%Sm %N" -t "%Y-%m-%d %H:%M:%S" path/to/file
```

### Code Analysis Commands

```bash
# Search for patterns
grep -r "pattern" apps/web/src/

# Count occurrences
grep -r "pattern" apps/web/src/ | wc -l

# Find imports
grep -r "^import.*from" apps/web/src/components/
```

## Edge Cases

### Partial Completion
- Step started but not finished
- Some deliverables created, others missing
- Code written but tests not added

### Unexpected Work
- Files created that weren't in plan
- Additional features added beyond scope
- Refactoring done that wasn't planned

### Plan Changes
- Plan modified during execution
- Steps added or removed mid-execution
- Dependencies changed

### Multiple Executions
- Plan executed multiple times
- Incremental progress across runs
- Merge conflicts or overwrites

