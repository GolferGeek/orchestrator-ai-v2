---
description: "Daily update: Pull, Install, Migrate"
---

# /update

> Updating environment...

I want you to update the environment for daily work.

OBJECTIVE: Pull latest code, update dependencies, and apply database migrations.
DONE WHEN: The environment is up-to-date and ready for development.

## TODO
- [ ] **Git Pull**:
    - Run `git pull` to get the latest changes.
- [ ] **Dependencies**:
    - Run `npm install` to ensure packages are in sync.
- [ ] **Database Migration**:
    - Run `cd apps/api && supabase start` (ensure it's running).
    - Run `cd apps/api && supabase db push` (or `migration up` - verify which one applies pending migrations without reset).
- [ ] **Status Check**:
    - Report if any migrations failed or if there were conflicts.

EXECUTE NOW: Perform the update.
