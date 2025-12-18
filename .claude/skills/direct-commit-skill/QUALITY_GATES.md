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

### 3. Build (ALL Workspaces)
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

# Step 3: Build (all workspaces - must pass)
npm run build

# Step 4: Only commit if all gates pass
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
- [ ] `npm run build` - Build succeeds (all workspaces)
- [ ] All quality gates pass in ALL workspaces (API, Web, LangGraph)

