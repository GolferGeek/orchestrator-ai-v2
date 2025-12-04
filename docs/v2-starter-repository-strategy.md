# V2 Starter Repository Strategy

## Overview

The `orchestrator-ai-v2-starter` will be a **GitHub Template Repository** designed for:
- **Customers** - Fork/clone to build their own systems
- **Students** - Clone for educational purposes (bootcamps, corporate training, college courses)
- **You** - Keep client-specific work separate in private repos

---

## Repository Structure

### 1. Public Template Repository: `orchestrator-ai-v2-starter`

**Purpose:** Clean, educational starter template  
**Visibility:** Public  
**Type:** GitHub Template Repository

**What's Included:**
- ✅ Core framework code
- ✅ Demo agents (educational examples)
- ✅ Documentation and setup guides
- ✅ Example workflows
- ✅ Sample data and seeds
- ✅ `.env.example` files

**What's Excluded (via `.gitignore`):**
- ❌ Client-specific agents (`apps/api/src/agents/my-org/`, `apps/api/src/agents/saas/`)
- ❌ Client-specific landing pages
- ❌ Production secrets/API keys
- ❌ Client database backups/snapshots
- ❌ Private Obsidian notes
- ❌ TaskMaster files (`.taskmaster/`)

### 2. Private Working Repository: `orchestrator-ai-v2` (Your Current Repo)

**Purpose:** Your active development with client work  
**Visibility:** Private  
**Type:** Regular repository

**What's Included:**
- ✅ Everything from starter template
- ✅ Client-specific agents and configurations
- ✅ Client database snapshots/backups
- ✅ Private documentation (Obsidian)
- ✅ Client-specific workflows

---

## GitHub Template Repository Setup

### Step 1: Enable Template Repository

1. Go to your `orchestrator-ai-v2-starter` repository settings
2. Scroll to "Template repository"
3. Check ✅ "Template repository"
4. Save

### Step 2: Create Clean Starter Branch

```bash
# In your private working repo
git checkout -b starter-template
git push origin starter-template

# Create a clean version without client-specific code
# (Already handled by .gitignore, but verify)
```

### Step 3: Create Public Template Repo

```bash
# Create new public repo on GitHub: orchestrator-ai-v2-starter
# Then push starter-template branch
git remote add template https://github.com/golfergeek/orchestrator-ai-v2-starter.git
git push template starter-template:main
```

---

## How Students/Customers Use It

### Option 1: Use Template (Recommended)

**For Students:**
1. Go to `https://github.com/golfergeek/orchestrator-ai-v2-starter`
2. Click **"Use this template"** → **"Create a new repository"**
3. Creates their own repo (not a fork)
4. Clone their new repo: `git clone https://github.com/student/their-repo.git`

**Benefits:**
- ✅ No fork relationship (cleaner)
- ✅ They own their repo completely
- ✅ Can make it private/public as needed
- ✅ No confusion about what's "theirs" vs "yours"

### Option 2: Clone Directly

**For Quick Start:**
```bash
git clone https://github.com/golfergeek/orchestrator-ai-v2-starter.git
cd orchestrator-ai-v2-starter
```

**Benefits:**
- ✅ Fastest way to get started
- ✅ Good for one-off experiments
- ✅ No GitHub repo needed

### Option 3: Fork (For Contributing)

**Only if they want to contribute back:**
- Fork creates a link back to your repo
- Good for open-source contributions
- **Not recommended** for students/customers (creates confusion)

---

## What Gets Excluded from Starter Template

### Already in `.gitignore`:

```gitignore
# Private agent namespaces (keep internal agents out of public forks)
apps/api/src/agents/my-org/
apps/api/src/agents/saas/

# Private landing variants
apps/web/src/views/landing/my-org/
apps/web/src/views/landing/saas/
apps/web/src/components/landing/my-org/
apps/web/src/components/landing/saas/

# TaskMaster files
.taskmaster/

# Obsidian history files
obsidian/efforts/matt/history/

# Storage backups
storage/backups/
storage/images/

# Environment files (but keep .example files)
.env
.env.production
.env.server
```

### Additional Exclusions to Consider:

```gitignore
# Client-specific database snapshots
apps/api/supabase/snapshots/*/seed.sql  # Keep schema.sql, exclude seed data
apps/api/supabase/backups/

# Client-specific workflows
apps/n8n/workflows/client-*.json

# Private documentation
obsidian/Team Vaults/
obsidian/efforts/Matt/current/  # Your active work

# GitHub workflows (if they contain secrets)
.github/workflows/deploy-*.yml
```

---

## Workflow: Adding Client-Specific Code

### When Working on Client Projects:

1. **Work in Private Repo** (`orchestrator-ai-v2`)
   - Add client agents to `apps/api/src/agents/client-name/`
   - Add client workflows to `apps/n8n/workflows/client-name/`
   - Add client-specific configs

2. **Update `.gitignore`** if needed
   - Add new client-specific paths
   - Ensures they never get committed

3. **Keep Starter Template Clean**
   - Only push generic improvements to starter template
   - Never push client-specific code

### Example Client Agent Structure:

```
apps/api/src/agents/
├── demo/              # ✅ Included in starter (educational)
├── blog-post-writer/  # ✅ Included in starter (example)
├── hr-policy-agent/   # ✅ Included in starter (example)
├── my-org/            # ❌ Excluded (your internal)
├── saas/              # ❌ Excluded (your internal)
└── client-acme/       # ❌ Excluded (client-specific)
```

---

## Student/Customer Setup Instructions

### For Students (Educational Use):

```markdown
## Getting Started

### Option 1: Use Template (Recommended)
1. Click "Use this template" on GitHub
2. Create your own repository
3. Clone: `git clone https://github.com/YOUR-USERNAME/YOUR-REPO.git`

### Option 2: Clone Directly
```bash
git clone https://github.com/golfergeek/orchestrator-ai-v2-starter.git
cd orchestrator-ai-v2-starter
```

### Setup
1. Copy `.env.example` to `.env`
2. Add your API keys
3. Run `npm install`
4. Start services: `npm run dev`
```

### For Customers (Production Use):

```markdown
## Getting Started

1. **Use Template Repository**
   - Click "Use this template" on GitHub
   - Create a private repository for your organization
   - Clone: `git clone https://github.com/YOUR-ORG/orchestrator-ai-v2.git`

2. **Customize for Your Organization**
   - Add your agents to `apps/api/src/agents/your-org/`
   - Configure branding in `apps/web/src/config/branding.ts`
   - Set up your database and environment variables

3. **Deploy**
   - Follow deployment guide in `deployment/`
   - Set up your domain and SSL
   - Configure monitoring and backups
```

---

## Maintaining Two Repos

### Daily Workflow:

**Working on Client Project:**
```bash
cd orchestrator-ai-v2  # Private repo
# Make client-specific changes
git commit -m "Add client-specific agent"
git push origin main
```

**Improving Starter Template:**
```bash
cd orchestrator-ai-v2-starter  # Public template repo
# Make generic improvements
git commit -m "Improve documentation"
git push origin main
```

### Syncing Generic Improvements:

When you make improvements that should be in the starter:

```bash
# In private repo
git checkout -b sync-to-starter
# Cherry-pick or merge generic commits
git checkout starter-template
git merge sync-to-starter
git push origin starter-template

# In public template repo
git pull origin main
```

---

## Benefits of This Approach

### ✅ For You:
- **Separation of Concerns**: Client work stays private
- **Clean Starter**: Students get clean, educational version
- **Control**: You decide what goes in starter template
- **Flexibility**: Can have multiple client repos

### ✅ For Students:
- **Clean Start**: No client-specific code to confuse them
- **Ownership**: They own their repo (not a fork)
- **Privacy**: Can make their repo private
- **Learning**: Focus on learning, not cleaning up client code

### ✅ For Customers:
- **Professional**: Clean starting point
- **Customizable**: Easy to add their own agents/configs
- **Private**: Can keep their repo private
- **Support**: Clear separation from educational version

---

## FAQ

### Q: Do students fork or clone?
**A:** Students should **clone** (or use template). Forking is for contributing back to open source. For educational use, cloning or using the template is cleaner.

### Q: Can I exclude files from template but keep them in my private repo?
**A:** Yes! `.gitignore` controls what gets committed. Files in `.gitignore` won't be in the template, but you can keep them in your private repo.

### Q: What if I accidentally commit client code?
**A:** 
1. Remove it: `git rm --cached path/to/client-code`
2. Update `.gitignore` to prevent future commits
3. Force push to template repo (if already pushed)

### Q: How do I update the starter template?
**A:** 
1. Make improvements in your private repo
2. Cherry-pick generic commits to `starter-template` branch
3. Push to public template repo

### Q: Can customers contribute back?
**A:** Yes! They can fork the template repo and submit PRs for generic improvements. But most will just use it as a starting point.

---

## Recommended `.gitignore` Additions for Starter Template

Add these to ensure client-specific code never gets into the starter:

```gitignore
# Client-specific agents (add as you create them)
apps/api/src/agents/client-*/
apps/api/src/agents/my-org/
apps/api/src/agents/saas/

# Client-specific workflows
apps/n8n/workflows/client-*.json
apps/n8n/workflows/*-client-*.json

# Client database data
apps/api/supabase/backups/
apps/api/supabase/snapshots/*/seed.sql  # Keep schema, exclude data

# Private documentation
obsidian/Team Vaults/
obsidian/efforts/Matt/current/
obsidian/efforts/Matt/history/

# Client-specific configs
apps/web/src/config/client-*.ts
apps/api/src/config/client-*.ts
```

---

## Next Steps

1. ✅ Review current `.gitignore` - ensure all client-specific paths are excluded
2. ✅ Create `starter-template` branch in your private repo
3. ✅ Create public `orchestrator-ai-v2-starter` repository
4. ✅ Enable "Template repository" in GitHub settings
5. ✅ Push `starter-template` branch to public repo as `main`
6. ✅ Update README with "Use this template" instructions
7. ✅ Test: Create a new repo from template to verify it's clean

