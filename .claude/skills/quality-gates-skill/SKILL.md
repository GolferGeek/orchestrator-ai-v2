---
name: Quality Gates
description: Ensure code quality before commits. Run lint, format, test, build. Use npm scripts: npm run lint, npm run format, npm test, npm run build. CRITICAL: All tests must pass, no lint errors, code must be formatted before committing.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

# Quality Gates Skill

**CRITICAL**: Code must pass all quality gates before committing: lint, format, test, build.

## When to Use This Skill

Use this skill when:
- Before committing code
- Setting up quality checks
- Verifying code quality
- Running tests
- Checking lint/format compliance

## Quality Gate Commands

From `package.json`:

```6:27:package.json
  "scripts": {
    "contracts:generate": "turbo run generate --filter=@orchestrator-ai/shared-contracts",
    "dev": "./start-dev-local.sh",
    "dev:api": "cd apps/api && ./start-dev.sh",
    "dev:observability": "cd apps/observability/server && npm run dev",
    "dev:observability:client": "cd apps/observability/client && npm run dev",
    "dev:observability:all": "concurrently \"npm run dev:observability\" \"npm run dev:observability:client\"",
    "n8n:up": "./apps/n8n/manage.sh up",
    "n8n:down": "./apps/n8n/manage.sh down",
    "n8n:logs": "./apps/n8n/manage.sh logs -f",
    "build:transport-types": "cd apps/transport-types && npm run build",
    "dev:web": "cd apps/web && npm run dev",
    "dev:start": "./start-dev-local.sh",
    "dev:ports": "./scripts/dev-ports.sh",
    "dev:supabase": "cd apps/api && supabase status",
    "dev:supabase:start": "cd apps/api && supabase start",
    "dev:supabase:stop": "cd apps/api && supabase stop",
    "dev:supabase:reset": "cd apps/api && supabase db reset",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint --filter=nestjs",
    "format": "turbo run format",
```

### Core Quality Gates

```bash
# 1. Format code (all workspaces)
npm run format

# 2. Lint code (ALL workspaces: API, Web, LangGraph)
npm run lint                    # API (nestjs)
cd apps/web && npm run lint && cd ../..      # Web
cd apps/langgraph && npm run lint && cd ../..  # LangGraph

# 3. Run tests (all workspaces)
npm test

# 4. Build (all workspaces: API, Web, LangGraph, transport-types)
npm run build
```

**CRITICAL:** The root `npm run lint` only lints the API (nestjs filter). You must lint ALL workspaces separately.

## Complete Quality Gate Checklist

Before committing, run:

```bash
# Step 1: Format code (all workspaces)
npm run format

# Step 2: Lint code (ALL workspaces - must pass with no errors)
npm run lint                    # API (nestjs)
cd apps/web && npm run lint && cd ../..      # Web
cd apps/langgraph && npm run lint && cd ../..  # LangGraph

# Step 3: Run tests (all workspaces - all must pass)
npm test

# Step 4: Build (all workspaces - verify compilation succeeds)
npm run build

# Step 5: Commit only if all gates pass
git add .
git commit -m "feat(module): your commit message"
```

**Note:** `transport-types` workspace does not have a lint script, so it's excluded from linting.

## Quality Gate Failures

### ❌ Format Failure

```bash
$ npm run format
# Errors: files need formatting
```

**Fix:**
```bash
npm run format
# Re-run until no changes
```

### ❌ Lint Failure

**If lint fails in any workspace:**

```bash
# API lint errors
$ npm run lint
# Errors: unused imports, type errors, etc.

# Web lint errors
$ cd apps/web && npm run lint
# Errors: ...

# LangGraph lint errors
$ cd apps/langgraph && npm run lint
# Errors: ...
```

**Fix:**
```bash
# Fix lint errors in the affected workspace
# API
npm run lint -- --fix

# Web
cd apps/web && npm run lint -- --fix && cd ../..

# LangGraph
cd apps/langgraph && npm run lint -- --fix && cd ../..
```

**Check for Anti-Patterns:**
After linting, use `strict-linting-skill` to catch workarounds:
- Underscore variables (should be removed, not silenced)
- Unused imports/variables (should be removed)
- Suppressions without justification (should be fixed or documented)
- Empty catch blocks (should handle errors properly)

**CRITICAL:** 
- All workspaces (API, Web, LangGraph) must pass lint before committing
- **NO WORKAROUNDS** - Fix root causes, don't silence errors
- Anti-patterns (underscore variables, suppressions) are forbidden

### ❌ Test Failure

```bash
$ npm test
# Errors: tests failing
```

**Fix:**
```bash
# Fix failing tests
# Re-run tests until all pass
npm test
```

### ❌ Build Failure

```bash
$ npm run build
# Errors: TypeScript compilation errors in one or more workspaces
# - apps/api: ...
# - apps/web: ...
# - apps/langgraph: ...
```

**Fix:**
```bash
# Fix TypeScript errors in the affected workspace(s)
# Re-run build until all workspaces succeed
npm run build
```

**CRITICAL:** Build must succeed in ALL workspaces (API, Web, LangGraph, transport-types) before committing.

## Pre-Commit Workflow

### Recommended Workflow

```bash
# 1. Make your changes
# ... edit files ...

# 2. Stage files
git add .

# 3. Run quality gates (ALL workspaces)
npm run format && \
npm run lint && \
cd apps/web && npm run lint && cd ../.. && \
cd apps/langgraph && npm run lint && cd ../.. && \
npm test && \
npm run build

# 4. If all pass, commit
git commit -m "feat(module): description"
```

### One-Line Quality Gate

```bash
npm run format && \
npm run lint && \
cd apps/web && npm run lint && cd ../.. && \
cd apps/langgraph && npm run lint && cd ../.. && \
npm test && \
npm run build && \
git commit -m "feat(module): description"
```

## Per-Workspace Quality Gates

### API Workspace

```bash
cd apps/api
npm run lint
npm test
npm run build
```

### Web Workspace

```bash
cd apps/web
npm run lint
npm test:unit
npm run build
```

### LangGraph Workspace

```bash
cd apps/langgraph
npm run lint
npm test
npm run build
```

## All Workspaces Quality Gates

**To run quality gates on ALL workspaces:**

```bash
# Format (all workspaces)
npm run format

# Lint (all workspaces)
npm run lint                    # API
cd apps/web && npm run lint && cd ../..      # Web
cd apps/langgraph && npm run lint && cd ../..  # LangGraph

# Test (all workspaces)
npm test

# Build (all workspaces)
npm run build
```

## Quality Gate Examples

### Example 1: Before Feature Commit

```bash
# Edit feature code
vim apps/api/src/feature/feature.service.ts

# Run quality gates (ALL workspaces)
npm run format
npm run lint                    # API
cd apps/web && npm run lint && cd ../..      # Web
cd apps/langgraph && npm run lint && cd ../..  # LangGraph
npm test
npm run build

# All pass - commit
git add .
git commit -m "feat(feature): add new feature service"
```

### Example 2: Before Bug Fix Commit

```bash
# Fix bug
vim apps/api/src/bug/bug.service.ts

# Run quality gates (ALL workspaces)
npm run format && \
npm run lint && \
cd apps/web && npm run lint && cd ../.. && \
cd apps/langgraph && npm run lint && cd ../.. && \
npm test && \
npm run build

# All pass - commit
git add .
git commit -m "fix(bug): resolve service bug"
```

## CI/CD Integration

Quality gates should also run in CI/CD:

```yaml
# .github/workflows/quality.yml
name: Quality Gates

on: [push, pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run format -- --check
      - run: npm run lint                    # API
      - run: cd apps/web && npm run lint     # Web
      - run: cd apps/langgraph && npm run lint  # LangGraph
      - run: npm test
      - run: npm run build
```

## Common Quality Issues

### Unused Imports

```typescript
// ❌ WRONG
import { UnusedService } from './unused.service';

// ✅ CORRECT - Remove unused imports
```

### Type Errors

```typescript
// ❌ WRONG
const result: string = await service.getNumber();

// ✅ CORRECT
const result: number = await service.getNumber();
```

### Formatting Issues

```typescript
// ❌ WRONG - Inconsistent spacing
if(condition){
  doSomething();
}

// ✅ CORRECT - Formatted
if (condition) {
  doSomething();
}
```

## Checklist for Quality Gates

Before committing:

- [ ] `npm run format` - Code formatted (all workspaces)
- [ ] `npm run lint` - No lint errors in API
- [ ] `cd apps/web && npm run lint` - No lint errors in Web
- [ ] `cd apps/langgraph && npm run lint` - No lint errors in LangGraph
- [ ] `npm test` - All tests pass (all workspaces)
- [ ] `npm run build` - Build succeeds (all workspaces: API, Web, LangGraph, transport-types)
- [ ] All quality gates pass in ALL workspaces before commit

## Related Documentation

- **Conventional Commits**: See Conventional Commits Skill for commit message format
- **Git Standards**: See Orchestrator Git Standards Skill for git workflow
- **Strict Linting**: See `strict-linting-skill` for hardcore linting rules and anti-pattern detection

