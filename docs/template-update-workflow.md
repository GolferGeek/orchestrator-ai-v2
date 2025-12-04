# Template Update Workflow

## Problem Statement

- **Working Repo**: Interns need to see client-specific code (can't exclude in `.gitignore`)
- **Template Repo**: Must exclude client-specific code (clean starter template)
- **Challenge**: How to maintain both without manual `.gitignore` switching?

---

## Solution: Separate `.gitignore` Files

### Strategy: Two `.gitignore` Files

1. **`.gitignore`** - For your working repo (minimal exclusions, interns can see client code)
2. **`.gitignore.template`** - For template repo (excludes all client-specific code)

### Workflow: Update Template Script

Create a script that:
1. Switches to `starter-template` branch
2. Merges generic improvements from `main`
3. Applies template-specific `.gitignore`
4. Removes any client-specific files
5. Pushes to public template repo

---

## Implementation

### Step 1: Create `.gitignore.template`

Copy your current `.gitignore` and add template-specific exclusions:

```gitignore
# .gitignore.template
# This is the .gitignore for the public starter template
# It excludes client-specific code that shouldn't be in the template

# Include everything from base .gitignore
# (copy all current .gitignore content)

# ADDITIONAL exclusions for template only:
# Client-specific agents (add as you create them)
apps/api/src/agents/my-org/
apps/api/src/agents/saas/
apps/api/src/agents/client-*/

# Client-specific workflows
apps/n8n/workflows/client-*.json
apps/n8n/workflows/*-client-*.json

# Client database data
apps/api/supabase/backups/
apps/api/supabase/snapshots/*/seed.sql

# Private documentation
obsidian/Team Vaults/
obsidian/efforts/Matt/current/
obsidian/efforts/Matt/history/

# Client-specific configs
apps/web/src/config/client-*.ts
apps/api/src/config/client-*.ts
```

### Step 2: Create Update Script

```bash
#!/bin/bash
# scripts/update-template.sh
# Updates the public starter template from your working repo

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEMPLATE_BRANCH="starter-template"
TEMPLATE_REMOTE="template"  # Add this: git remote add template https://github.com/golfergeek/orchestrator-ai-v2-starter.git

cd "$REPO_ROOT"

echo "🔄 Updating starter template..."

# 1. Ensure we're on main and up to date
git checkout main
git pull origin main

# 2. Checkout or create starter-template branch
if git show-ref --verify --quiet refs/heads/$TEMPLATE_BRANCH; then
    echo "📦 Checking out existing $TEMPLATE_BRANCH branch..."
    git checkout $TEMPLATE_BRANCH
    git merge main --no-edit
else
    echo "📦 Creating new $TEMPLATE_BRANCH branch..."
    git checkout -b $TEMPLATE_BRANCH
fi

# 3. Apply template-specific .gitignore
echo "📝 Applying template-specific .gitignore..."
cp .gitignore.template .gitignore
git add .gitignore

# 4. Remove any client-specific files that might have been committed
echo "🧹 Removing client-specific files..."
git rm -r --cached apps/api/src/agents/my-org/ 2>/dev/null || true
git rm -r --cached apps/api/src/agents/saas/ 2>/dev/null || true
git rm -r --cached apps/web/src/views/landing/my-org/ 2>/dev/null || true
git rm -r --cached apps/web/src/views/landing/saas/ 2>/dev/null || true
git rm -r --cached apps/web/src/components/landing/my-org/ 2>/dev/null || true
git rm -r --cached apps/web/src/components/landing/saas/ 2>/dev/null || true
git rm -r --cached apps/api/supabase/backups/ 2>/dev/null || true
git rm -r --cached obsidian/Team\ Vaults/ 2>/dev/null || true

# 5. Commit template-specific changes
if ! git diff --cached --quiet; then
    echo "💾 Committing template updates..."
    git commit -m "chore(template): Update starter template exclusions"
fi

# 6. Push to template remote
echo "🚀 Pushing to template repository..."
git push $TEMPLATE_REMOTE $TEMPLATE_BRANCH:main --force

# 7. Return to main branch
git checkout main

echo "✅ Template updated successfully!"
echo "📋 Template repo: https://github.com/golfergeek/orchestrator-ai-v2-starter"
```

### Step 3: Make Script Executable

```bash
chmod +x scripts/update-template.sh
```

---

## Daily Workflow

### Working on Generic Improvements:

```bash
# In your working repo (main branch)
# Make improvements that should be in template
git checkout main
# ... make changes ...
git commit -m "feat: Add new feature"
git push origin main

# Update template (runs script)
./scripts/update-template.sh
```

### Working on Client-Specific Code:

```bash
# In your working repo (main branch)
# Add client-specific code (interns can see it)
git checkout main
# ... add client agents to apps/api/src/agents/client-acme/ ...
git commit -m "feat(client): Add Acme Corp agent"
git push origin main

# DON'T run update-template.sh
# Client code stays in your private repo only
```

---

## How Often to Update Template?

### Recommended Schedule:

**After Generic Improvements:**
- ✅ New features that benefit everyone
- ✅ Bug fixes
- ✅ Documentation updates
- ✅ Example agents/workflows
- ✅ Framework improvements

**Don't Update For:**
- ❌ Client-specific agents
- ❌ Client-specific configurations
- ❌ Client database snapshots
- ❌ Private documentation

### Update Frequency:

- **Weekly**: If you're actively developing generic features
- **Monthly**: For minor improvements
- **Per Release**: When you tag a new version
- **On-Demand**: When students/customers request features

---

## Alternative: Simpler Approach

If you don't want to maintain two `.gitignore` files, you can:

### Option A: Keep Client Code in Separate Directories

Structure your repo so client code is clearly separated:

```
apps/api/src/agents/
├── demo/              # ✅ Always in template
├── blog-post-writer/  # ✅ Always in template
├── clients/          # ❌ Never in template
│   ├── acme-corp/
│   └── widget-inc/
```

Then your script just excludes `apps/api/src/agents/clients/`:

```bash
# In update-template.sh
git rm -r --cached apps/api/src/agents/clients/ 2>/dev/null || true
```

### Option B: Use Git Attributes

Create `.gitattributes` file:

```
# .gitattributes
apps/api/src/agents/clients/* export-ignore
apps/n8n/workflows/client-* export-ignore
```

Then use `git archive` to create template:

```bash
git archive --format=tar --prefix=orchestrator-ai-v2-starter/ \
  --output=template.tar starter-template
```

---

## Recommended Approach

**Best Practice: Separate Branch + Script**

1. **Keep `main` branch** - Working repo with all code (interns see everything)
2. **Maintain `starter-template` branch** - Clean version for template
3. **Use update script** - Automatically syncs generic changes, excludes client code
4. **Update template** - Run script whenever you have generic improvements

**Benefits:**
- ✅ Interns see all code in `main` branch
- ✅ Template stays clean automatically
- ✅ No manual `.gitignore` switching
- ✅ Script handles exclusions consistently
- ✅ Can review changes before pushing to template

---

## Quick Reference

### Update Template (After Generic Changes):

```bash
./scripts/update-template.sh
```

### Check What Would Be Excluded:

```bash
git checkout starter-template
git diff main --name-only | grep -E "(my-org|saas|client-|backups)"
```

### Manual Template Update (If Script Fails):

```bash
git checkout starter-template
git merge main
cp .gitignore.template .gitignore
git rm -r --cached apps/api/src/agents/my-org/ apps/api/src/agents/saas/
git commit -m "chore(template): Update exclusions"
git push template starter-template:main --force
git checkout main
```

---

## FAQ

### Q: How easy is it to update templates?
**A:** Very easy! Run `./scripts/update-template.sh` - takes ~10 seconds.

### Q: What if I forget to exclude something?
**A:** The script removes common client paths. Review the template repo after updating to verify.

### Q: Can interns see the template repo?
**A:** Yes, if it's public. But they work in your private repo (`main` branch) where they can see client code.

### Q: What if client code accidentally gets into template?
**A:** 
1. Remove it: `git rm --cached path/to/client-code`
2. Update `.gitignore.template` to prevent future commits
3. Force push: `git push template starter-template:main --force`

### Q: How do I add new client exclusion patterns?
**A:** Add them to `.gitignore.template` and update the script's `git rm` commands.

