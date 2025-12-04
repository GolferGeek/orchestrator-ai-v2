#!/bin/bash
# Update Starter Template Script
# Syncs generic improvements from main branch to public starter template
# Excludes client-specific code automatically

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEMPLATE_BRANCH="starter-template"
TEMPLATE_REMOTE="template"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

cd "$REPO_ROOT"

echo -e "${BLUE}🔄 Updating starter template...${NC}"

# Check if template remote exists
if ! git remote | grep -q "^${TEMPLATE_REMOTE}$"; then
    echo -e "${YELLOW}⚠️  Template remote '${TEMPLATE_REMOTE}' not found.${NC}"
    echo -e "${YELLOW}   Add it with: git remote add ${TEMPLATE_REMOTE} https://github.com/golfergeek/orchestrator-ai-v2-starter.git${NC}"
    exit 1
fi

# Check if .gitignore.template exists
if [ ! -f ".gitignore.template" ]; then
    echo -e "${YELLOW}⚠️  .gitignore.template not found. Creating from .gitignore...${NC}"
    cp .gitignore .gitignore.template
    echo -e "${YELLOW}   Please add template-specific exclusions to .gitignore.template${NC}"
fi

# 1. Ensure we're on main and up to date
echo -e "${BLUE}📦 Checking out main branch...${NC}"
git checkout main
git pull origin main || echo -e "${YELLOW}   (No remote changes)${NC}"

# 2. Checkout or create starter-template branch
if git show-ref --verify --quiet refs/heads/$TEMPLATE_BRANCH; then
    echo -e "${BLUE}📦 Checking out existing ${TEMPLATE_BRANCH} branch...${NC}"
    git checkout $TEMPLATE_BRANCH
    echo -e "${BLUE}📦 Merging changes from main...${NC}"
    git merge main --no-edit || {
        echo -e "${RED}❌ Merge conflict! Resolve conflicts and run script again.${NC}"
        exit 1
    }
else
    echo -e "${BLUE}📦 Creating new ${TEMPLATE_BRANCH} branch...${NC}"
    git checkout -b $TEMPLATE_BRANCH
fi

# 3. Apply template-specific .gitignore
echo -e "${BLUE}📝 Applying template-specific .gitignore...${NC}"
cp .gitignore.template .gitignore
git add .gitignore

# 4. Remove any client-specific files that might have been committed
echo -e "${BLUE}🧹 Removing client-specific files...${NC}"

# Client-specific agents
git rm -r --cached apps/api/src/agents/my-org/ 2>/dev/null && echo "   Removed: apps/api/src/agents/my-org/" || true
git rm -r --cached apps/api/src/agents/saas/ 2>/dev/null && echo "   Removed: apps/api/src/agents/saas/" || true

# Client-specific landing pages
git rm -r --cached apps/web/src/views/landing/my-org/ 2>/dev/null && echo "   Removed: apps/web/src/views/landing/my-org/" || true
git rm -r --cached apps/web/src/views/landing/saas/ 2>/dev/null && echo "   Removed: apps/web/src/views/landing/saas/" || true
git rm -r --cached apps/web/src/components/landing/my-org/ 2>/dev/null && echo "   Removed: apps/web/src/components/landing/my-org/" || true
git rm -r --cached apps/web/src/components/landing/saas/ 2>/dev/null && echo "   Removed: apps/web/src/components/landing/saas/" || true

# Client database backups
git rm -r --cached apps/api/supabase/backups/ 2>/dev/null && echo "   Removed: apps/api/supabase/backups/" || true

# Private documentation
git rm -r --cached "obsidian/Team Vaults/" 2>/dev/null && echo "   Removed: obsidian/Team Vaults/" || true

# 5. Commit template-specific changes
if ! git diff --cached --quiet; then
    echo -e "${BLUE}💾 Committing template updates...${NC}"
    git commit -m "chore(template): Update starter template exclusions"
else
    echo -e "${GREEN}✅ No template-specific changes needed${NC}"
fi

# 6. Push to template remote
echo -e "${BLUE}🚀 Pushing to template repository...${NC}"
if git push $TEMPLATE_REMOTE $TEMPLATE_BRANCH:main --force-with-lease; then
    echo -e "${GREEN}✅ Template updated successfully!${NC}"
else
    echo -e "${RED}❌ Push failed. Check if template repo exists and you have access.${NC}"
    echo -e "${YELLOW}   Template repo: https://github.com/golfergeek/orchestrator-ai-v2-starter${NC}"
    exit 1
fi

# 7. Return to main branch
git checkout main

echo -e "${GREEN}✅ Done! Template updated at: https://github.com/golfergeek/orchestrator-ai-v2-starter${NC}"

