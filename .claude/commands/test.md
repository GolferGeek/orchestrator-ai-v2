---
description: Run tests, generate tests, fix failing tests, or check coverage. Supports all apps (web, API, LangGraph) and test types (unit, integration, E2E).
argument-hint: "[app] [action] [target]" - Examples: "web unit", "api generate src/services/my.service.ts", "langgraph fix", "coverage"
category: "quality"
uses-skills: ["web-testing-skill", "api-testing-skill", "langgraph-testing-skill", "e2e-testing-skill"]
uses-agents: ["testing-agent"]
related-commands: ["monitor", "harden"]
---

# Test Command

## Purpose

Run tests, generate tests, fix failing tests, or check test coverage across all apps (web, API, LangGraph).

## Usage

```bash
/test [app] [action] [target]
```

### Arguments

- **`app`** (optional): Which app to test (`web`, `api`, `langgraph`, or `all`)
  - If omitted, detects from changed files or prompts user
- **`action`** (optional): What to do (`run`, `generate`, `fix`, `coverage`, or `setup`)
  - Default: `run`
- **`target`** (optional): Specific file or pattern to test/generate
  - Examples: `src/services/my.service.ts`, `src/components/MyComponent.vue`

### Examples

```bash
# Run all tests for affected apps
/test

# Run tests for specific app
/test web
/test api
/test langgraph

# Run specific test type
/test web unit
/test api e2e

# Generate tests for a file
/test generate src/services/my.service.ts
/test web generate src/components/MyComponent.vue

# Fix failing tests
/test fix
/test api fix

# Check coverage
/test coverage
/test web coverage

# Set up test infrastructure
/test setup
/test api setup
```

## Workflow

### 1. Detect Context

**If app not specified:**
- Check git diff for changed files
- Determine affected apps from file paths
- If multiple apps affected, run tests for all
- If no changes, prompt user for app

**If app specified:**
- Use specified app directly

### 2. Execute Action

**Run Tests:**
1. Determine test type (unit, integration, e2e)
2. Run appropriate test command for app
3. Report results (passed, failed, skipped)
4. If failures, offer to fix

**Generate Tests:**
1. Identify file type (component, service, controller, etc.)
2. Load appropriate testing skill (web-testing-skill, api-testing-skill, langgraph-testing-skill)
3. Generate test file following app-specific patterns
4. Ensure ExecutionContext and A2A compliance (from skills)
5. Create test file with proper structure

**Fix Tests:**
1. Run tests to identify failures
2. Analyze failure messages and stack traces
3. Determine root cause (code bug vs test bug)
4. Fix the issue
5. Re-run tests to verify fix
6. Ensure all tests pass

**Check Coverage:**
1. Run coverage report for app(s)
2. Analyze coverage metrics
3. Identify uncovered code
4. Report coverage against thresholds
5. Suggest tests for uncovered critical paths

**Set Up Tests:**
1. Check if test infrastructure exists
2. Set up test framework if missing
3. Configure test environment
4. Create test utilities and helpers
5. Add test scripts to package.json

### 3. Report Results

**Success:**
```
✅ Tests Passed

📊 Results:
   ✅ Web tests: 45 passed, 0 failed
   ✅ API tests: 32 passed, 0 failed
   ✅ LangGraph tests: 18 passed, 0 failed
```

**Failures:**
```
❌ Tests Failed

📊 Results:
   ❌ Web tests: 2 failed, 43 passed
   ✅ API tests: All passed
   ✅ LangGraph tests: All passed

💡 Fix Options:
   1. Review failing tests above
   2. Run: /test fix
   3. Or manually fix and re-run tests
```

**Coverage:**
```
📊 Coverage Report

Web App:
   Lines: 78% ✅ (threshold: 75%)
   Functions: 82% ✅ (threshold: 75%)
   Branches: 71% ✅ (threshold: 70%)
   Statements: 79% ✅ (threshold: 75%)

API App:
   Lines: 76% ✅ (threshold: 75%)
   Functions: 80% ✅ (threshold: 75%)
   Branches: 72% ✅ (threshold: 70%)
   Statements: 77% ✅ (threshold: 75%)
```

## App-Specific Commands

### Web App (`apps/web/`)

```bash
# Unit tests (Vitest)
cd apps/web && npm run test:unit

# E2E tests (Cypress - requires services)
cd apps/web && npm run test:e2e

# Coverage
cd apps/web && npm run test:coverage
```

**Uses:** `web-testing-skill`, `web-architecture-skill`

### API App (`apps/api/`)

```bash
# Unit tests (Jest)
cd apps/api && npm test

# E2E tests (Jest - requires services)
cd apps/api && npm run test:e2e

# Coverage
cd apps/api && npm run test:cov
```

**Uses:** `api-testing-skill`, `api-architecture-skill`

### LangGraph App (`apps/langgraph/`)

```bash
# Unit tests (Jest)
cd apps/langgraph && npm test

# E2E tests (Jest - requires services)
cd apps/langgraph && npm run test:e2e

# Coverage
cd apps/langgraph && npm run test:cov
```

**Uses:** `langgraph-testing-skill`, `langgraph-architecture-skill`

## Integration with Testing Agent

This command delegates to `testing-agent` for:
- Complex test generation
- Test fixing with analysis
- Coverage analysis and recommendations
- Test infrastructure setup

The testing agent uses:
- `execution-context-skill` - ExecutionContext validation
- `transport-types-skill` - A2A protocol validation
- App-specific testing skills (web-testing-skill, api-testing-skill, langgraph-testing-skill)
- App-specific architecture skills (for context)

## Related Commands

- `/commit` - Runs tests as part of quality gates
- `/commit-push` - Runs tests as part of quality gates
- `/review-pr` - Runs tests as part of PR review

## Related Skills and Agents

**Skills:**
- `web-testing-skill` - Web app testing patterns
- `api-testing-skill` - API app testing patterns
- `langgraph-testing-skill` - LangGraph app testing patterns
- `execution-context-skill` - ExecutionContext validation
- `transport-types-skill` - A2A protocol validation

**Agents:**
- `testing-agent` - Autonomous testing specialist

