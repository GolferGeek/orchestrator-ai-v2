# Linting Enforcement Rules

How to enforce hardcore linting rules and catch anti-patterns.

## Enforcement Strategy

### 1. Pre-Commit Checks

Before committing:
1. Run lint on all workspaces
2. Analyze violations
3. Check for anti-patterns
4. Block commit if workarounds found

### 2. Code Review

During code review:
1. Check for underscore variables
2. Verify unused code is removed
3. Check for suppressions without justification
4. Ensure errors are handled properly

### 3. Automated Detection

Use grep/pattern matching to find:
- Underscore variables: `^_[a-zA-Z]`
- Suppressions: `@ts-ignore`, `eslint-disable`
- Empty catch blocks: `catch.*\{\s*\}`

## Enforcement Commands

### Check for Underscore Variables

```bash
# Find underscore variables in API
grep -rn "const _[a-zA-Z]\|let _[a-zA-Z]\|var _[a-zA-Z]" apps/api/src/

# Find underscore parameters
grep -rn "function.*_[a-zA-Z]\|\(_[a-zA-Z]" apps/api/src/
```

### Check for Suppressions

```bash
# Find TypeScript suppressions
grep -rn "@ts-ignore\|@ts-expect-error" apps/

# Find ESLint suppressions
grep -rn "eslint-disable" apps/
```

### Check for Empty Catch Blocks

```bash
# Find potentially empty catch blocks
grep -A 5 "catch" apps/**/*.ts | grep -B 2 -A 2 "^\s*}\s*$"
```

## Violation Response

### Underscore Variables

**If found:**
1. Identify the unused variable/parameter
2. Check if it can be removed
3. Remove it
4. If required by interface, document why

**Block commit if:**
- Underscore variable can be removed
- No documentation for why it's needed

### Unused Imports/Variables

**If found:**
1. Remove unused code
2. Verify removal is safe
3. Re-run lint

**Block commit if:**
- Unused code remains
- Removal would break functionality (document why)

### Suppressions

**If found:**
1. Check if issue can be fixed
2. Fix if possible
3. Document if suppression is necessary

**Block commit if:**
- Suppression has no justification
- Issue can be fixed but isn't

### Empty Catch Blocks

**If found:**
1. Add proper error handling
2. Log errors appropriately
3. Handle errors meaningfully

**Block commit if:**
- Error is silently swallowed
- No logging or handling

## Integration with Quality Gates

This skill should be invoked:
1. After running lint commands
2. Before allowing commits
3. During code review
4. In CI/CD pipelines

## Reporting Violations

When violations are found:

```
❌ Linting Violations Found:

Anti-Patterns Detected:
- apps/api/src/service.ts:45 - Underscore variable '_unused' should be removed
- apps/web/src/component.vue:12 - Unused import 'UnusedService' should be removed
- apps/langgraph/src/graph.ts:23 - Suppression without justification

Fix these violations before committing.
```

