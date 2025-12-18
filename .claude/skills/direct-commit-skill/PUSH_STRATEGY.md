# Push Strategy

How to handle pushing to remote, including handling remote changes and diverged branches. **This strategy is designed to be bulletproof - no prompts, no surprises, handles all edge cases.**

## Pre-Flight: Configure Git for Non-Interactive Mode

**CRITICAL:** Before any git operations, ensure git is configured for non-interactive operation:

```bash
# Set git to use default merge messages (avoid editor prompts)
export GIT_MERGE_AUTOEDIT=no
git config --global merge.commit no-edit || true

# Ensure git doesn't prompt for credentials
git config --global credential.helper store || true

# Set default merge strategy
git config --global merge.ff false  # Always create merge commit when needed
```

**For the skill implementation:**
- These settings should be applied at the start of the push workflow
- Use `git config` commands (not global if you want workspace-specific)
- Set environment variables to override git defaults

## Push Workflow

### 1. Fetch Remote Changes

**Always fetch first** to check if remote has changes:

```bash
# Fetch without merging
git fetch origin

# Verify fetch succeeded
if [ $? -ne 0 ]; then
  echo "❌ Failed to fetch from remote"
  exit 1
fi
```

### 2. Get Current Branch

```bash
# Get current branch name (bulletproof method)
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

if [ -z "$CURRENT_BRANCH" ] || [ "$CURRENT_BRANCH" = "HEAD" ]; then
  echo "❌ ERROR: Not on a valid branch (detached HEAD state)"
  exit 1
fi

echo "📍 Current branch: $CURRENT_BRANCH"
```

### 3. Check Remote Branch Status

Check if remote branch exists and compare with local:

```bash
# Check if remote branch exists
REMOTE_EXISTS=false
if git ls-remote --heads origin "$CURRENT_BRANCH" 2>/dev/null | grep -q "refs/heads/$CURRENT_BRANCH"; then
  REMOTE_EXISTS=true
fi

if [ "$REMOTE_EXISTS" = "true" ]; then
  # Remote branch exists - check status
  LOCAL=$(git rev-parse "$CURRENT_BRANCH" 2>/dev/null)
  REMOTE=$(git rev-parse "origin/$CURRENT_BRANCH" 2>/dev/null)
  
  if [ -z "$LOCAL" ] || [ -z "$REMOTE" ]; then
    echo "❌ ERROR: Failed to get branch references"
    exit 1
  fi
  
  # Get common ancestor
  BASE=$(git merge-base "$CURRENT_BRANCH" "origin/$CURRENT_BRANCH" 2>/dev/null || echo "")
  
  if [ "$LOCAL" = "$REMOTE" ]; then
    # Up to date - can push directly
    echo "✅ Local and remote are in sync"
    NEEDS_MERGE=false
  elif [ "$LOCAL" = "$BASE" ]; then
    # Behind - need to pull
    echo "⚠️  Local branch is behind remote - pulling and merging..."
    NEEDS_MERGE=true
  elif [ "$REMOTE" = "$BASE" ]; then
    # Ahead - can push directly
    echo "✅ Local branch is ahead - can push directly"
    NEEDS_MERGE=false
  else
    # Diverged - need to merge
    echo "⚠️  Branches have diverged - merging remote changes..."
    NEEDS_MERGE=true
  fi
else
  # Remote branch doesn't exist - push with upstream
  echo "📤 Remote branch doesn't exist - will set upstream on first push"
  NEEDS_MERGE=false
fi
```

### 4. Merge Remote Changes (If Needed)

If remote has changes, merge them **before** pushing:

```bash
if [ "$NEEDS_MERGE" = "true" ]; then
  echo "🔄 Merging remote changes..."
  
  # Use --no-edit to avoid merge commit message prompt
  # Use --no-rebase to preserve history (merge, not rebase)
  # Use --no-ff to always create merge commit (clear history)
  if git pull origin "$CURRENT_BRANCH" --no-rebase --no-edit --no-ff 2>&1; then
    echo "✅ Successfully merged remote changes"
  else
    # Check if merge conflicts occurred
    if [ -f .git/MERGE_HEAD ]; then
      echo "❌ MERGE CONFLICTS DETECTED"
      echo ""
      echo "📊 Conflicted files:"
      git diff --name-only --diff-filter=U
      echo ""
      echo "💡 Resolution required:"
      echo "   1. Resolve conflicts in the files listed above"
      echo "   2. Stage resolved files: git add <files>"
      echo "   3. Complete merge: git commit --no-edit"
      echo "   4. Retry: /commit-push"
      exit 1
    else
      echo "❌ Failed to merge remote changes"
      exit 1
    fi
  fi
fi
```

### 5. Push to Remote

After handling remote changes (or if none exist):

```bash
echo "📤 Pushing to origin/$CURRENT_BRANCH..."

if [ "$REMOTE_EXISTS" = "true" ]; then
  # Remote branch exists - push normally
  if git push origin "$CURRENT_BRANCH" 2>&1; then
    echo "✅ Successfully pushed to origin/$CURRENT_BRANCH"
  else
    # Check for specific errors
    PUSH_ERROR=$?
    if git push origin "$CURRENT_BRANCH" 2>&1 | grep -q "non-fast-forward"; then
      echo "❌ ERROR: Push rejected - remote has changes not in local"
      echo "💡 This shouldn't happen if merge step worked correctly"
      echo "💡 Try: git pull origin $CURRENT_BRANCH --no-rebase --no-edit"
      exit 1
    else
      echo "❌ Push failed with error code: $PUSH_ERROR"
      exit 1
    fi
  fi
else
  # Remote branch doesn't exist - push with upstream
  if git push -u origin "$CURRENT_BRANCH" 2>&1; then
    echo "✅ Successfully pushed to origin/$CURRENT_BRANCH (upstream set)"
  else
    echo "❌ Failed to push new branch"
    exit 1
  fi
fi
```

## Preventing All Prompts

### Git Configuration for Non-Interactive Mode

**CRITICAL:** Set these before any git operations:

```bash
# Environment variable (highest priority)
export GIT_MERGE_AUTOEDIT=no

# Git config (workspace-specific)
git config merge.commit no-edit
git config merge.ff false

# For merge strategy
git config pull.rebase false  # Use merge, not rebase
git config pull.ff only      # Only fast-forward if possible, otherwise merge
```

### Merge Commit Message

**By default, git will:**
- Use default merge message: `"Merge branch 'branch' of 'origin' into branch"`
- **With `--no-edit` flag:** Accepts default without opening editor
- **With `GIT_MERGE_AUTOEDIT=no`:** Prevents editor from opening

**For bulletproof workflow:**
```bash
# Use ALL of these together:
export GIT_MERGE_AUTOEDIT=no
git pull origin "$CURRENT_BRANCH" --no-rebase --no-edit --no-ff
```

This ensures:
- ✅ No editor opens
- ✅ Default merge message is used
- ✅ Merge commit is created (clear history)
- ✅ Non-fast-forward merge (preserves both histories)

### If Merge Conflicts Occur

If merge conflicts occur during pull:

```bash
❌ Merge Conflicts Detected

📊 Status:
   ⚠️  Cannot automatically merge remote changes
   ⚠️  Manual conflict resolution required

💡 Fix Options:
   1. Resolve conflicts manually
   2. Use: git status (to see conflicted files)
   3. Edit conflicted files to resolve conflicts
   4. Stage resolved files: git add <files>
   5. Complete merge: git commit
   6. Then retry: /commit-push
```

**DO NOT** force push or skip merge - conflicts must be resolved.

## Complete Bulletproof Push Implementation

### Bash Script Pattern (Production-Ready)

```bash
#!/bin/bash
set -e  # Exit on any error

# Configure git for non-interactive mode
export GIT_MERGE_AUTOEDIT=no
git config merge.commit no-edit 2>/dev/null || true
git config merge.ff false 2>/dev/null || true

# Get current branch (bulletproof)
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

if [ -z "$CURRENT_BRANCH" ] || [ "$CURRENT_BRANCH" = "HEAD" ]; then
  echo "❌ ERROR: Not on a valid branch (detached HEAD state)"
  echo "💡 Checkout a branch first: git checkout -b <branch-name>"
  exit 1
fi

echo "📍 Current branch: $CURRENT_BRANCH"

# Step 1: Fetch remote changes
echo "📡 Fetching remote changes..."
if ! git fetch origin 2>&1; then
  echo "❌ ERROR: Failed to fetch from remote"
  echo "💡 Check network connection and remote URL: git remote -v"
  exit 1
fi

# Step 2: Check if remote branch exists
REMOTE_EXISTS=false
if git ls-remote --heads origin "$CURRENT_BRANCH" 2>/dev/null | grep -q "refs/heads/$CURRENT_BRANCH"; then
  REMOTE_EXISTS=true
fi

# Step 3: Determine merge needs
NEEDS_MERGE=false
if [ "$REMOTE_EXISTS" = "true" ]; then
  LOCAL=$(git rev-parse "$CURRENT_BRANCH" 2>/dev/null)
  REMOTE=$(git rev-parse "origin/$CURRENT_BRANCH" 2>/dev/null)
  
  if [ -z "$LOCAL" ] || [ -z "$REMOTE" ]; then
    echo "❌ ERROR: Failed to get branch references"
    exit 1
  fi
  
  if [ "$LOCAL" != "$REMOTE" ]; then
    BASE=$(git merge-base "$CURRENT_BRANCH" "origin/$CURRENT_BRANCH" 2>/dev/null || echo "")
    
    if [ "$LOCAL" = "$BASE" ]; then
      echo "⚠️  Local branch is behind remote"
      NEEDS_MERGE=true
    elif [ "$REMOTE" != "$BASE" ] && [ -n "$BASE" ]; then
      echo "⚠️  Branches have diverged"
      NEEDS_MERGE=true
    else
      echo "✅ Local branch is ahead - can push directly"
    fi
  else
    echo "✅ Local and remote are in sync"
  fi
else
  echo "📤 Remote branch doesn't exist - will set upstream"
fi

# Step 4: Merge if needed
if [ "$NEEDS_MERGE" = "true" ]; then
  echo "🔄 Merging remote changes..."
  
  # Attempt merge with all non-interactive flags
  MERGE_OUTPUT=$(git pull origin "$CURRENT_BRANCH" --no-rebase --no-edit --no-ff 2>&1) || MERGE_FAILED=$?
  
  if [ -n "$MERGE_FAILED" ]; then
    # Check for merge conflicts
    if [ -f .git/MERGE_HEAD ]; then
      echo "❌ MERGE CONFLICTS DETECTED"
      echo ""
      echo "📊 Conflicted files:"
      git diff --name-only --diff-filter=U
      echo ""
      echo "💡 Manual resolution required:"
      echo "   1. Review conflicts: git status"
      echo "   2. Edit conflicted files to resolve conflicts"
      echo "   3. Stage resolved files: git add <files>"
      echo "   4. Complete merge: git commit --no-edit"
      echo "   5. Retry push: /commit-push"
      exit 1
    else
      echo "❌ Merge failed: $MERGE_OUTPUT"
      exit 1
    fi
  else
    echo "✅ Successfully merged remote changes"
  fi
fi

# Step 5: Push to remote
echo "📤 Pushing to origin/$CURRENT_BRANCH..."

if [ "$REMOTE_EXISTS" = "true" ]; then
  PUSH_OUTPUT=$(git push origin "$CURRENT_BRANCH" 2>&1) || PUSH_FAILED=$?
  
  if [ -n "$PUSH_FAILED" ]; then
    if echo "$PUSH_OUTPUT" | grep -q "non-fast-forward"; then
      echo "❌ ERROR: Push rejected - remote has changes not in local"
      echo "💡 This shouldn't happen if merge worked correctly"
      echo "💡 Try manually: git pull origin $CURRENT_BRANCH --no-rebase --no-edit"
      exit 1
    else
      echo "❌ Push failed: $PUSH_OUTPUT"
      exit 1
    fi
  else
    echo "✅ Successfully pushed to origin/$CURRENT_BRANCH"
  fi
else
  # First push - set upstream
  PUSH_OUTPUT=$(git push -u origin "$CURRENT_BRANCH" 2>&1) || PUSH_FAILED=$?
  
  if [ -n "$PUSH_FAILED" ]; then
    echo "❌ Failed to push new branch: $PUSH_OUTPUT"
    exit 1
  else
    echo "✅ Successfully pushed to origin/$CURRENT_BRANCH (upstream set)"
  fi
fi

echo ""
echo "✅ Push complete!"
```

### TypeScript/Node Pattern (for skill implementation - Bulletproof)

```typescript
import { execSync } from 'child_process';
import { existsSync } from 'fs';

function pushToRemote(): void {
  // Configure git for non-interactive mode
  process.env.GIT_MERGE_AUTOEDIT = 'no';
  
  try {
    execSync('git config merge.commit no-edit', { stdio: 'ignore' });
    execSync('git config merge.ff false', { stdio: 'ignore' });
  } catch {
    // Config might fail if not in a git repo, but that's ok
  }
  
  // Get current branch (bulletproof)
  let currentBranch: string;
  try {
    currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
  } catch (error) {
    throw new Error('Not on a valid branch (detached HEAD state)');
  }
  
  if (!currentBranch || currentBranch === 'HEAD') {
    throw new Error('Not on a valid branch');
  }
  
  console.log(`📍 Current branch: ${currentBranch}`);
  
  // Step 1: Fetch remote changes
  console.log('📡 Fetching remote changes...');
  try {
    execSync('git fetch origin', { stdio: 'inherit' });
  } catch (error) {
    throw new Error('Failed to fetch from remote. Check network connection.');
  }
  
  // Step 2: Check if remote branch exists
  let remoteExists = false;
  try {
    const remoteBranches = execSync('git ls-remote --heads origin', { encoding: 'utf-8' });
    remoteExists = remoteBranches.includes(`refs/heads/${currentBranch}`);
  } catch {
    // If ls-remote fails, assume remote doesn't exist
    remoteExists = false;
  }
  
  // Step 3: Determine if merge is needed
  let needsMerge = false;
  if (remoteExists) {
    try {
      const local = execSync(`git rev-parse ${currentBranch}`, { encoding: 'utf-8' }).trim();
      const remote = execSync(`git rev-parse origin/${currentBranch}`, { encoding: 'utf-8' }).trim();
      
      if (local !== remote) {
        // Check if behind or diverged
        try {
          const base = execSync(`git merge-base ${currentBranch} origin/${currentBranch}`, { encoding: 'utf-8' }).trim();
          if (local === base) {
            console.log('⚠️  Local branch is behind remote');
            needsMerge = true;
          } else if (remote !== base) {
            console.log('⚠️  Branches have diverged');
            needsMerge = true;
          } else {
            console.log('✅ Local branch is ahead - can push directly');
          }
        } catch {
          // If merge-base fails, assume diverged
          needsMerge = true;
        }
      } else {
        console.log('✅ Local and remote are in sync');
      }
    } catch (error) {
      throw new Error('Failed to compare branch status');
    }
  } else {
    console.log('📤 Remote branch doesn\'t exist - will set upstream');
  }
  
  // Step 4: Merge if needed
  if (needsMerge) {
    console.log('🔄 Merging remote changes...');
    try {
      execSync(
        `git pull origin ${currentBranch} --no-rebase --no-edit --no-ff`,
        { stdio: 'inherit' }
      );
      console.log('✅ Successfully merged remote changes');
    } catch (error) {
      // Check for merge conflicts
      if (existsSync('.git/MERGE_HEAD')) {
        const conflictedFiles = execSync('git diff --name-only --diff-filter=U', { encoding: 'utf-8' }).trim();
        throw new Error(
          `MERGE CONFLICTS DETECTED\n\nConflicted files:\n${conflictedFiles}\n\n` +
          'Resolution required:\n' +
          '1. Resolve conflicts in the files listed above\n' +
          '2. Stage resolved files: git add <files>\n' +
          '3. Complete merge: git commit --no-edit\n' +
          '4. Retry: /commit-push'
        );
      } else {
        throw new Error(`Merge failed: ${error}`);
      }
    }
  }
  
  // Step 5: Push to remote
  console.log(`📤 Pushing to origin/${currentBranch}...`);
  try {
    if (remoteExists) {
      execSync(`git push origin ${currentBranch}`, { stdio: 'inherit' });
    } else {
      execSync(`git push -u origin ${currentBranch}`, { stdio: 'inherit' });
    }
    console.log(`✅ Successfully pushed to origin/${currentBranch}`);
  } catch (error: any) {
    const errorOutput = error.stdout?.toString() || error.stderr?.toString() || error.message;
    if (errorOutput.includes('non-fast-forward')) {
      throw new Error(
        'Push rejected - remote has changes not in local.\n' +
        'This shouldn\'t happen if merge worked correctly.\n' +
        `Try manually: git pull origin ${currentBranch} --no-rebase --no-edit`
      );
    } else {
      throw new Error(`Push failed: ${errorOutput}`);
    }
  }
}
```

## Error Handling (Bulletproof)

### All Possible Errors and Solutions

#### 1. Detached HEAD State

```bash
❌ ERROR: Not on a valid branch (detached HEAD state)

💡 Solution:
   git checkout -b <branch-name>
   # Or checkout existing branch: git checkout <branch-name>
```

#### 2. Fetch Failed

```bash
❌ ERROR: Failed to fetch from remote

💡 Solutions:
   1. Check network connection
   2. Verify remote URL: git remote -v
   3. Check remote access: git ls-remote origin
   4. Verify credentials if using HTTPS
```

#### 3. Merge Conflicts

```bash
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

**DO NOT:**
- ❌ Use `--no-verify` to skip hooks
- ❌ Force push (`--force`)
- ❌ Skip merge (`--no-merge`)
- ❌ Abort without resolving

#### 4. Push Rejected (Non-Fast-Forward)

```bash
❌ ERROR: Push rejected - remote has changes not in local

💡 This shouldn't happen if merge worked correctly
💡 If it does:
   1. Verify merge completed: git status
   2. Check if merge commit exists: git log --oneline -5
   3. If merge incomplete, finish it: git commit --no-edit
   4. Retry push: git push origin <branch>
```

#### 5. Branch Reference Errors

```bash
❌ ERROR: Failed to get branch references

💡 Solutions:
   1. Verify branch exists: git branch
   2. Check remote tracking: git branch -vv
   3. Fetch again: git fetch origin
   4. Verify remote branch: git ls-remote origin
```

#### 6. Credential Prompts

```bash
❌ Git prompts for credentials

💡 Solutions:
   1. Use SSH instead of HTTPS: git remote set-url origin git@github.com:...
   2. Configure credential helper: git config credential.helper store
   3. Use SSH keys: ssh-add ~/.ssh/id_rsa
```

#### 7. Merge Commit Message Prompt

```bash
❌ Git opens editor for merge commit message

💡 Prevention (should be set before merge):
   export GIT_MERGE_AUTOEDIT=no
   git config merge.commit no-edit
   git pull --no-edit
```

**If editor opens anyway:**
- Save and close (accepts default message)
- Or set `EDITOR=:` to use no-op editor: `EDITOR=: git pull`

## Best Practices (Bulletproof Checklist)

### Pre-Push Configuration

1. ✅ **Set non-interactive git config** - Before any operations
   ```bash
   export GIT_MERGE_AUTOEDIT=no
   git config merge.commit no-edit
   git config merge.ff false
   ```

2. ✅ **Always fetch first** - Know what's on remote before pushing
   ```bash
   git fetch origin
   ```

3. ✅ **Check branch status** - Determine if merge is needed
   ```bash
   # Compare local vs remote
   git rev-parse HEAD
   git rev-parse origin/<branch>
   ```

### Merge Strategy

4. ✅ **Merge, don't rebase** - Preserve history for commit-push workflow
   ```bash
   git pull --no-rebase --no-edit --no-ff
   ```

5. ✅ **Use all non-interactive flags** - Prevent all prompts
   - `--no-rebase`: Use merge, not rebase
   - `--no-edit`: Accept default merge message
   - `--no-ff`: Always create merge commit

### Push Strategy

6. ✅ **Handle first push** - Set upstream automatically
   ```bash
   git push -u origin <branch>  # First push
   git push origin <branch>     # Subsequent pushes
   ```

7. ✅ **Verify push success** - Check exit code and output
   ```bash
   if git push origin <branch>; then
     echo "✅ Push succeeded"
   else
     echo "❌ Push failed"
     exit 1
   fi
   ```

### Error Recovery

8. ✅ **Handle conflicts gracefully** - Never force push
   - Detect conflicts: Check for `.git/MERGE_HEAD`
   - List conflicted files: `git diff --name-only --diff-filter=U`
   - Provide clear resolution steps

9. ✅ **Validate before push** - Ensure merge completed
   ```bash
   # Check if merge is in progress
   if [ -f .git/MERGE_HEAD ]; then
     echo "❌ Merge in progress - complete it first"
     exit 1
   fi
   ```

10. ✅ **Clear error messages** - Tell user exactly what to do
    - Show which files have conflicts
    - Provide step-by-step resolution
    - Suggest retry command

## Complete Bulletproof Workflow Summary

### The Complete Flow (No Prompts, All Edge Cases Handled)

```bash
# 1. Configure for non-interactive mode
export GIT_MERGE_AUTOEDIT=no
git config merge.commit no-edit
git config merge.ff false

# 2. Get current branch (validate)
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
[ -z "$CURRENT_BRANCH" ] || [ "$CURRENT_BRANCH" = "HEAD" ] && exit 1

# 3. Fetch remote
git fetch origin || exit 1

# 4. Check remote exists
REMOTE_EXISTS=$(git ls-remote --heads origin "$CURRENT_BRANCH" | grep -q "refs/heads/$CURRENT_BRANCH" && echo true || echo false)

# 5. Determine merge needs
if [ "$REMOTE_EXISTS" = "true" ]; then
  LOCAL=$(git rev-parse "$CURRENT_BRANCH")
  REMOTE=$(git rev-parse "origin/$CURRENT_BRANCH")
  if [ "$LOCAL" != "$REMOTE" ]; then
    # Merge needed
    git pull origin "$CURRENT_BRANCH" --no-rebase --no-edit --no-ff || {
      [ -f .git/MERGE_HEAD ] && echo "❌ Conflicts - resolve manually" && exit 1
      exit 1
    }
  fi
fi

# 6. Push
if [ "$REMOTE_EXISTS" = "true" ]; then
  git push origin "$CURRENT_BRANCH" || exit 1
else
  git push -u origin "$CURRENT_BRANCH" || exit 1
fi
```

## Related Documentation

- **REFERENCE.md**: Git command reference
- **QUALITY_GATES.md**: Quality checks before push
- **ERROR_HANDLING.md**: Error handling patterns

