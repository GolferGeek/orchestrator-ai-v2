# Error Handling

How to handle errors and failures during the commit process.

## Quality Gate Failures

### ❌ Lint Fails

**Error Message:**
```
❌ Lint check failed. Please fix lint errors before committing.

Errors:
- apps/api/src/service.ts:5 - Unused import
- apps/web/src/component.vue:12 - Missing type annotation

Run: npm run lint -- --fix
```

**Action:**
- Report failures clearly
- **DO NOT commit**
- Suggest fixes
- Wait for user to fix issues

### ❌ Build Fails

**Error Message:**
```
❌ Build check failed. Please fix build errors before committing.

Errors:
- TypeScript compilation errors in apps/api/src/service.ts

Fix build errors and try again.
```

**Action:**
- Report failures clearly
- **DO NOT commit**
- Suggest fixes
- Wait for user to fix issues

### ❌ Format Issues

**Error Message:**
```
⚠️ Format check found issues. Running format command...
```

**Action:**
- Run `npm run format` automatically
- Re-check if issues remain
- Continue if format succeeds

## Safety Review Issues

### ⚠️ Safety Issues Found

**Error Message:**
```
⚠️ Safety review found potential issues:

- Execution context not passed in apps/api/src/handler.ts:45
- Transport type violation in apps/web/src/service.ts:23

Review these issues. Commit anyway? (Use --force to override)
```

**Action:**
- Report issues clearly with file paths and line numbers
- Suggest fixes
- **DO NOT commit** if critical issues found
- Allow user to review and decide

## Git Command Failures

### ❌ Git Status Fails

**Error:** Not in a git repository or git not available

**Action:**
- Report error clearly
- **DO NOT proceed** with commit
- Suggest checking git setup

### ❌ Git Add Fails

**Error:** Files cannot be staged

**Action:**
- Report error clearly
- **DO NOT proceed** with commit
- Suggest checking file permissions or git state

### ❌ Git Commit Fails

**Error:** Commit fails (e.g., no changes staged, pre-commit hook fails)

**Action:**
- Report error clearly
- **DO NOT retry** automatically
- Suggest checking git state

### ❌ Git Push Fails

**Error:** Push fails (e.g., remote not configured, authentication fails)

**Action:**
- Report error clearly
- Suggest checking remote configuration
- Suggest checking authentication

## General Error Handling Principles

1. **Fail Fast** - Stop immediately if any critical check fails
2. **Clear Messages** - Report errors with specific details
3. **No Auto-Fix** - Don't automatically fix issues without user approval
4. **Suggest Fixes** - Provide actionable suggestions
5. **Preserve State** - Don't commit if any check fails

