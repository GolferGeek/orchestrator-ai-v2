# Quality Gates

Before committing, **ALWAYS** run these checks in order. All must pass before committing.

## Quality Gate Commands

### 1. Format Code
```bash
npm run format
```
- Formats all code according to project standards
- May modify files (uses Write tool)
- Must complete successfully

### 2. Lint Code (ALL Workspaces)

**CRITICAL:** The root `npm run lint` only lints the API (nestjs filter). You must lint ALL workspaces:

```bash
# Lint API (nestjs)
npm run lint

# Lint Web
cd apps/web && npm run lint && cd ../..

# Lint LangGraph
cd apps/langgraph && npm run lint && cd ../..
```

**OR use a single command sequence:**
```bash
npm run lint && \
cd apps/web && npm run lint && cd ../.. && \
cd apps/langgraph && npm run lint && cd ../..
```

**CRITICAL: Must pass with no errors in ALL workspaces (API, Web, LangGraph)** - if lint fails in any workspace, fix issues before committing.

**Note:** `transport-types` workspace does not have a lint script, so it's excluded.

### 3. Run Tests (Affected Apps Only)

**CRITICAL:** Run tests **only for apps that have changed files**. See [TESTING.md](TESTING.md) for details.

**Process:**
1. Detect changed files: `git diff --name-only HEAD`
2. Determine affected apps (api, web, langgraph)
3. Run tests for affected apps only

**Test Commands:**
```bash
# API tests (if apps/api/** changed)
cd apps/api && npm test && cd ../..

# Web tests (if apps/web/** changed)
cd apps/web && npm run test:unit && cd ../..

# LangGraph tests (if apps/langgraph/** changed)
cd apps/langgraph && npm test && cd ../..
```

**Special Cases:**
- **Root config changes** (package.json, turbo.json, .env): Run all tests (`npm test`)
- **No app-specific changes**: Skip tests (nothing to test)
- **Only documentation** (.md files): Skip tests

**CRITICAL: Must pass** - if tests fail in any affected app, fix issues before committing.

### 4. Build (ALL Workspaces)
```bash
npm run build
```
- Runs `turbo run build` which builds ALL workspaces (API, Web, LangGraph, transport-types)
- **CRITICAL: Must pass** - if build fails in any workspace, fix issues before committing

## Quality Gate Workflow

```bash
# Step 1: Format code (all workspaces)
npm run format

# Step 2: Lint code (all workspaces - must pass)
npm run lint                    # API
cd apps/web && npm run lint && cd ../..      # Web
cd apps/langgraph && npm run lint && cd ../..  # LangGraph

# Step 3: Run tests (affected apps only - must pass)
# [See TESTING.md for implementation - detects changed files and runs appropriate tests]

# Step 4: Build (all workspaces - must pass)
npm run build

# Step 5: Only commit if all gates pass
```

**Note:** The root `npm run lint` only lints the API (nestjs filter). You must also lint Web and LangGraph separately.

## Quality Gate Failures

### ❌ Format Failure
If format command fails or reports issues:
- Re-run `npm run format` until no changes
- Ensure all files are properly formatted

### ❌ Lint Failure
If lint reports errors in any workspace:
- Fix lint errors manually in the affected workspace
- Or run auto-fix: `npm run lint -- --fix` (if available)
- **Check for anti-patterns** using `strict-linting-skill`:
  - Underscore variables (should be removed, not silenced)
  - Unused imports/variables (should be removed)
  - Suppressions without justification (should be fixed or documented)
  - Empty catch blocks (should handle errors properly)
- **DO NOT commit** until lint passes in ALL workspaces (API, Web, LangGraph)
- **DO NOT commit** if anti-patterns are found (workarounds are forbidden)
- Report which workspace(s) have lint errors

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
   3. Re-run tests for affected app: cd apps/api && npm test
   4. DO NOT commit until all tests pass
```

**Fix:**
- Review test output to identify failures
- Fix the code or tests
- Re-run tests for the affected app: `cd apps/api && npm test` (or web/langgraph)
- **DO NOT commit** until all tests pass

**Note:** See [TESTING.md](TESTING.md) for details on which tests run for which apps.

### ❌ Build Failure
If build fails:
- Fix TypeScript compilation errors
- Fix import/export issues
- Fix type errors
- **DO NOT commit** until build succeeds

## Integration with Other Skills

- **quality-gates-skill**: For detailed quality gate patterns and troubleshooting
- **strict-linting-skill**: For enforcing hardcore linting rules and catching anti-patterns (workarounds, underscore variables, etc.)

## Checklist

Before committing, verify:
- [ ] `npm run format` - Code formatted (all workspaces)
- [ ] `npm run lint` - No lint errors in API
- [ ] `cd apps/web && npm run lint` - No lint errors in Web
- [ ] `cd apps/langgraph && npm run lint` - No lint errors in LangGraph
- [ ] Tests pass for affected apps (see [TESTING.md](TESTING.md) for which apps to test)
- [ ] `npm run build` - Build succeeds (all workspaces)
- [ ] All quality gates pass in ALL workspaces (API, Web, LangGraph)

## Related Documentation

- **[TESTING.md](TESTING.md)** - Testing strategy: run tests only for affected apps
- **quality-gates-skill**: For detailed quality gate patterns and troubleshooting
- **strict-linting-skill**: For enforcing hardcore linting rules and catching anti-patterns

