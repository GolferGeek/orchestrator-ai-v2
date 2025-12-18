# Testing Strategy

Run tests **only for apps that have changed files**. This ensures fast feedback while maintaining quality.

## Process

### 1. Detect Changed Files

```bash
# Get list of changed files (staged and unstaged)
git diff --name-only --staged
git diff --name-only

# Or combined
git diff --name-only HEAD
```

### 2. Determine Affected Apps

Analyze file paths to determine which apps are affected:

- `apps/api/**` → **API** affected
- `apps/web/**` → **Web** affected
- `apps/langgraph/**` → **LangGraph** affected
- `apps/transport-types/**` → **Transport Types** affected (no tests, skip)
- Root config files → May affect multiple apps (run all tests)

### 3. Run Tests for Affected Apps

**API Tests:**
```bash
cd apps/api && npm test && cd ../..
```

**Web Tests:**
```bash
cd apps/web && npm run test:unit && cd ../..
# Note: E2E tests (test:e2e) require running services, skip for commit workflow
```

**LangGraph Tests:**
```bash
cd apps/langgraph && npm test && cd ../..
```

## Test Commands by App

### API (`apps/api/`)

```bash
cd apps/api
npm test              # Unit tests (Jest)
npm run test:e2e      # E2E tests (requires services running - skip for commit)
```

**For commit workflow:** Run `npm test` only (unit tests)

### Web (`apps/web/`)

```bash
cd apps/web
npm run test:unit    # Unit tests (Vitest)
npm run test:e2e     # E2E tests (Cypress - requires services running - skip for commit)
```

**For commit workflow:** Run `npm run test:unit` only (unit tests)

### LangGraph (`apps/langgraph/`)

```bash
cd apps/langgraph
npm test             # Unit tests (Jest)
npm run test:e2e     # E2E tests (requires services running - skip for commit)
```

**For commit workflow:** Run `npm test` only (unit tests)

## Implementation Pattern

### Bash Script Pattern

```bash
#!/bin/bash
set -e

# Get changed files
CHANGED_FILES=$(git diff --name-only HEAD)

# Determine affected apps
AFFECTED_APPS=()

if echo "$CHANGED_FILES" | grep -q "^apps/api/"; then
  AFFECTED_APPS+=("api")
fi

if echo "$CHANGED_FILES" | grep -q "^apps/web/"; then
  AFFECTED_APPS+=("web")
fi

if echo "$CHANGED_FILES" | grep -q "^apps/langgraph/"; then
  AFFECTED_APPS+=("langgraph")
fi

# If no app-specific changes, or root config changed, run all tests
if [ ${#AFFECTED_APPS[@]} -eq 0 ] || echo "$CHANGED_FILES" | grep -qE "^(package\.json|turbo\.json|\.env)"; then
  echo "📦 Running all tests (root config or no app-specific changes)"
  npm test
else
  # Run tests for affected apps only
  for app in "${AFFECTED_APPS[@]}"; do
    echo "🧪 Running tests for $app..."
    case $app in
      api)
        cd apps/api && npm test && cd ../..
        ;;
      web)
        cd apps/web && npm run test:unit && cd ../..
        ;;
      langgraph)
        cd apps/langgraph && npm test && cd ../..
        ;;
    esac
  done
fi
```

### TypeScript/Node Pattern (for skill implementation)

```typescript
// Get changed files
const changedFiles = execSync('git diff --name-only HEAD', { encoding: 'utf-8' })
  .split('\n')
  .filter(Boolean);

// Determine affected apps
const affectedApps = new Set<string>();

if (changedFiles.some(f => f.startsWith('apps/api/'))) {
  affectedApps.add('api');
}

if (changedFiles.some(f => f.startsWith('apps/web/'))) {
  affectedApps.add('web');
}

if (changedFiles.some(f => f.startsWith('apps/langgraph/'))) {
  affectedApps.add('langgraph');
}

// Check if root config changed
const rootConfigChanged = changedFiles.some(f => 
  f === 'package.json' || f === 'turbo.json' || f.startsWith('.env')
);

// Run tests
if (affectedApps.size === 0 || rootConfigChanged) {
  // Run all tests
  execSync('npm test', { stdio: 'inherit' });
} else {
  // Run tests for affected apps
  for (const app of affectedApps) {
    switch (app) {
      case 'api':
        execSync('cd apps/api && npm test && cd ../..', { stdio: 'inherit' });
        break;
      case 'web':
        execSync('cd apps/web && npm run test:unit && cd ../..', { stdio: 'inherit' });
        break;
      case 'langgraph':
        execSync('cd apps/langgraph && npm test && cd ../..', { stdio: 'inherit' });
        break;
    }
  }
}
```

## Test Execution Order

1. **Format** (all workspaces)
2. **Lint** (all workspaces)
3. **Tests** (affected apps only) ← **NEW**
4. **Build** (all workspaces)

## Handling Test Failures

### ❌ Test Failure

If tests fail in any affected app:

```bash
❌ Tests Failed

📊 Results:
   ❌ API tests: 2 failed, 5 passed
   ✅ Web tests: All passed
   ✅ LangGraph tests: All passed

💡 Fix Options:
   1. Review failing tests above
   2. Fix test code or implementation
   3. Re-run tests: cd apps/api && npm test
   4. DO NOT commit until all tests pass
```

**Fix:**
- Review test output to identify failures
- Fix the code or tests
- Re-run tests for the affected app
- **DO NOT commit** until all tests pass

## Edge Cases

### No Changed Files

If `git diff --name-only HEAD` returns empty:
- Skip tests (nothing to test)
- Still run format, lint, build

### Only Documentation Changed

If only `.md` files changed:
- Skip tests (documentation doesn't affect code)
- Still run format, lint, build

### Only Test Files Changed

If only `*.spec.ts`, `*.test.ts`, `*.cy.ts` files changed:
- **Still run tests** (test changes need validation)
- Run tests for the app containing the test files

### Root Config Changes

If `package.json`, `turbo.json`, or `.env` files changed:
- **Run all tests** (config changes may affect all apps)
- Use `npm test` to run all workspace tests

## Integration with Quality Gates

Add testing step **after lint, before build**:

```bash
# Step 1: Format
npm run format

# Step 2: Lint (all workspaces)
npm run lint
cd apps/web && npm run lint && cd ../..
cd apps/langgraph && npm run lint && cd ../..

# Step 3: Tests (affected apps only)
# [Run tests based on changed files - see implementation above]

# Step 4: Build (all workspaces)
npm run build
```

## Performance Considerations

- **Fast feedback**: Only test what changed
- **Comprehensive coverage**: Root config changes trigger full test suite
- **E2E tests excluded**: Too slow for commit workflow, run in CI/CD

## Related Skills

- **quality-gates-skill**: Overall quality gate patterns
- **strict-linting-skill**: Linting rules and anti-patterns

