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

**Error:** Push fails (e.g., remote not configured, authentication fails, non-fast-forward)

**Action:**
- Report error clearly
- Check if merge is needed (see PUSH_STRATEGY.md)
- Suggest checking remote configuration
- Suggest checking authentication
- **DO NOT force push** - always merge first

**Common Push Errors:**

1. **Non-Fast-Forward Rejection:**
   ```
   ❌ ERROR: Push rejected - remote has changes not in local
   
   💡 Solution:
      This means remote has changes you don't have.
      The workflow should have pulled first - this shouldn't happen.
      If it does: git pull origin <branch> --no-rebase --no-edit
   ```

2. **Remote Not Configured:**
   ```
   ❌ ERROR: No remote configured
   
   💡 Solution:
      Check remote: git remote -v
      Add remote: git remote add origin <url>
   ```

3. **Authentication Failed:**
   ```
   ❌ ERROR: Authentication failed
   
   💡 Solutions:
      1. Use SSH instead of HTTPS: git remote set-url origin git@github.com:...
      2. Configure credentials: git config credential.helper store
      3. Check SSH keys: ssh-add ~/.ssh/id_rsa
   ```

4. **Branch Not Found on Remote:**
   ```
   ❌ ERROR: Remote branch doesn't exist
   
   💡 Solution:
      This is normal for first push - use: git push -u origin <branch>
   ```

### ❌ Merge Conflicts During Push

**Error:** Merge conflicts detected when pulling remote changes

**Error Message:**
```
❌ MERGE CONFLICTS DETECTED

📊 Conflicted files:
   apps/api/src/service.ts
   apps/web/src/component.vue

💡 Resolution Steps:
   1. Review conflicts: git status
   2. View conflicts: git diff
   3. Edit files to resolve conflicts (remove <<<<<<, =======, >>>>>>> markers)
   4. Stage resolved files: git add <files>
   5. Complete merge: git commit --no-edit
   6. Retry push: /commit-push
```

**Action:**
- **DO NOT commit** until conflicts are resolved
- List all conflicted files clearly
- Provide step-by-step resolution instructions
- **DO NOT force push** or skip merge

### ❌ Merge Prompt Opened

**Error:** Git opens editor for merge commit message

**Prevention (should be set before merge):**
```bash
export GIT_MERGE_AUTOEDIT=no
git config merge.commit no-edit
git pull --no-edit
```

**If editor opens anyway:**
- Save and close (accepts default message)
- Or set no-op editor: `EDITOR=: git pull`

**Action:**
- Report that merge prompt appeared
- Suggest setting `GIT_MERGE_AUTOEDIT=no` for future
- Continue if user accepts default message

## General Error Handling Principles

1. **Fail Fast** - Stop immediately if any critical check fails
2. **Clear Messages** - Report errors with specific details
3. **No Auto-Fix** - Don't automatically fix issues without user approval
4. **Suggest Fixes** - Provide actionable suggestions
5. **Preserve State** - Don't commit if any check fails

