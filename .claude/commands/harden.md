---
description: "Run codebase hardening on specific issues from monitoring report. Auto-fixes issues if tests are adequate, otherwise documents issues with fix plans."
argument-hint: "[scope] [target] - Scope: 'apps/web', 'apps/api', 'apps/langgraph', or project (default). Target: '#<issue-id>', '<refactoring-name>', or auto-identify most important (default)."
category: "quality"
uses-skills: ["codebase-hardening-skill", "codebase-monitoring-skill"]
uses-agents: ["codebase-hardening-agent", "codebase-monitoring-agent"]
related-commands: ["monitor", "test"]
---

# /harden Command

## Purpose

Run codebase hardening on specific issues from monitoring report. Auto-fixes issues if tests are adequate, otherwise documents issues with fix plans.

## Usage

```
/harden [scope] [target]
```

**Arguments:**
- `scope` (optional): Specific app scope
  - `apps/web` - Use web app monitoring artifact
  - `apps/api` - Use API app monitoring artifact
  - `apps/langgraph` - Use LangGraph app monitoring artifact
  - `project` - Use project-level monitoring artifact (excludes apps/)
  - (no scope) - Use all.json monitoring artifact (entire project, default)
- `target` (optional): Specific issue or refactoring to target
  - `#<issue-id>` - Fix specific issue by ID (e.g., `#42`)
  - `<refactoring-name>` - Target all issues for refactoring (e.g., `supabase-separation`)
  - (no target) - Auto-identify most important issue (default)

## Examples

```
/harden
# Use all.json artifact (entire project), auto-identify most important issue

/harden #42
# Fix issue #42 from all.json artifact

/harden supabase-separation
# Target all issues for 'supabase-separation' refactoring from all.json artifact

/harden project
# Use project-level artifact (excludes apps/), auto-identify most important issue

/harden project #42
# Fix issue #42 from project-level artifact

/harden apps/api
# Use API app artifact, auto-identify most important issue

/harden apps/api #42
# Fix issue #42 from API app artifact

/harden apps/web supabase-separation
# Target 'supabase-separation' refactoring from web app artifact
```

## Workflow

1. **Determine Artifact**
   - If `apps/web`: Use `.monitor/apps-web.json`
   - If `apps/api`: Use `.monitor/apps-api.json`
   - If `apps/langgraph`: Use `.monitor/apps-langgraph.json`
   - If `project`: Use `.monitor/project.json` (project-level files only)
   - If no scope: Use `.monitor/all.json` (entire project)
   - Load monitoring artifact

2. **Determine Target**
   - If issue ID provided (`#42`):
     - Find issue by ID in artifact
     - Target that specific issue
   - If refactoring name provided (`supabase-separation`):
     - Find all issues for that refactoring
     - Group and target those issues
   - If no target provided:
     - Identify most important issue (highest urgency + severity)
     - Target that issue

3. **Call Hardening Agent**
   - Call `codebase-hardening-agent` with:
     - Monitoring artifact
     - Targeted issue(s)

4. **Agent Hardening**
   - Agent reviews targeted issue(s)
   - Checks test adequacy for each issue
   - **If tests adequate:**
     - Auto-fixes the issue
     - Runs tests to verify
     - Commits changes
   - **If tests inadequate:**
     - Documents the issue
     - Includes fix plan
     - Specifies required test coverage
     - Does NOT make changes

5. **Display Summary**
   - Show hardening summary
   - Display actions taken
   - Show fixes made or issues documented

## Test Adequacy

**Criteria for Auto-Fix:**
- Unit tests exist for affected functions
- Integration tests exist for affected services
- E2E tests exist for affected flows (if applicable)
- Coverage thresholds met (≥75% lines, ≥70% branches, ≥75% functions)
- Tests are meaningful

**If Tests Adequate:**
- ✅ Auto-fix the issue
- ✅ Run tests to verify
- ✅ Commit changes

**If Tests Inadequate:**
- ❌ Document the issue
- ❌ Include fix plan
- ❌ Specify required test coverage
- ❌ Do NOT make changes

## Output

**Summary Display:**
- Target issue(s) identified
- Test adequacy check results
- Actions taken (fixed or documented)
- Changes made (if any)
- Issues documented (if any)

**Example (Auto-Fix):**
```
Hardening complete!

Target: Issue #1 - Supabase coupling in auth service
Test adequacy: ✅ Adequate (85% lines, 80% branches, 90% functions)

Actions taken:
  ✅ Auto-fixed: Extracted Supabase usage to provider
  ✅ Tests passed: All tests passing
  ✅ Committed: feat(api): extract Supabase auth to provider

Changes made:
  - Created apps/api/src/auth/providers/supabase-auth.service.ts
  - Updated apps/api/src/auth/auth.service.ts
  - Updated apps/api/src/auth/auth.module.ts
```

**Example (Documentation):**
```
Hardening complete!

Target: Issue #1 - Supabase coupling in auth service
Test adequacy: ❌ Inadequate (missing integration tests for provider abstraction)

Actions taken:
  ❌ Documented: Issue requires additional test coverage
  📝 Created: .monitor/issues/issue-1.md

Issue documented with:
  - Problem description
  - Proposed solution
  - Required test coverage
  - Implementation steps
```

## Related

- **`codebase-hardening-agent.md`** - Performs the hardening
- **`codebase-hardening-skill/`** - Provides hardening patterns
- **`/monitor`** - Generates monitoring artifacts used by this command

