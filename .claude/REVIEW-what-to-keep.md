# Review: What to Keep from Current .claude Directory

**Date:** 2025-01-XX  
**Purpose:** Identify valuable content to preserve during cleanup

---

## Summary

After reviewing the current `.claude` directory, here's what should be **kept** vs **archived**:

### ✅ KEEP (4 Skills + 1 Agent + Reference Docs)

**Skills to Keep:**
1. **`worktree-manager-skill/`** - ✅ **KEEP**
   - Mature and well-documented
   - Referenced in workspace rules
   - Has comprehensive documentation (OPERATIONS.md, EXAMPLES.md, TROUBLESHOOTING.md, REFERENCE.md)
   - Actively used pattern

2. **`quality-gates-skill/`** - ✅ **KEEP**
   - Useful for PR workflow
   - Will be enhanced with hardening system
   - Good foundation

3. **`supabase-management-skill/`** - ✅ **KEEP**
   - Critical for preventing database sync issues
   - Well-documented with enforcement patterns
   - Has TROUBLESHOOTING.md

4. **`meta-skill/`** - ✅ **KEEP**
   - Contains valuable documentation about Skills
   - Has comprehensive docs/ directory
   - Useful reference for creating new Skills

**Agents to Keep:**
1. **`pr-review-agent.md`** - ✅ **KEEP**
   - Good pattern for PR review workflow
   - Will be enhanced with hardening system
   - Useful reference

**Reference Documents to Keep:**
1. **`REFERENCE-skills-agents-commands.md`** - ✅ **KEEP** (just created)
2. **`REFERENCE-best-practices.md`** - ✅ **KEEP** (just created)
3. **`INVENTORY-current-state.md`** - ✅ **KEEP** (useful for reference)

**Commands to Evaluate:**
- `commands/quality/*` - May keep as shortcuts, or merge into Skills
- `commands/supabase/*` - May keep as shortcuts to supabase-management-skill

---

## ❌ ARCHIVE (Everything Else)

### Agents to Archive (17 of 18)

**Development Agents** (too granular, will be replaced by Skills):
- `api-agent-development-agent.md`
- `back-end-coding-agent.md`
- `context-agent-development-agent.md`
- `external-agent-development-agent.md`
- `front-end-coding-agent.md`
- `function-agent-development-agent.md`
- `langgraph-development-agent.md`
- `n8n-development-agent.md`
- `orchestrator-agent-development-agent.md`

**Quality Agents** (will be replaced by hardening system):
- `lint-build-fix-agent.md` - Will be part of hardening system
- `test-fix-agent.md` - Will be part of hardening system

**Experimental/Specialized Agents**:
- `docs-scraper.md`
- `fetch-docs-haiku45.md`
- `fetch-docs-sonnet45.md`
- `scout-report-suggest-fast.md`
- `scout-report-suggest.md`
- `worktree-processor-agent.md` - Overlaps with worktree-manager-skill
- `create_worktree_subagent.md` - Overlaps with worktree-manager-skill
- `meta-agent.md`

### Commands to Archive (Most of 50+)

**Will be replaced by Skills:**
- Most API agent commands (will use agent-creation-skill)
- Most backend/frontend commands (will use architecture Skills)
- Most LangGraph/N8N commands (will use development Skills)

**May keep as shortcuts:**
- `commands/quality/*` - Evaluate if shortcuts are needed
- `commands/supabase/*` - Evaluate if shortcuts are needed

**Archive:**
- All other commands (experimental, duplicate, or replaced)

### Skills to Archive (11 of 15)

**Will be rebuilt better:**
- `api-agent-development-skill/` - Will be replaced by focused Skills
- `back-end-structure-skill/` - Will be replaced by api-architecture-skill
- `front-end-structure-skill/` - Will be replaced by front-end-architecture-skill
- `langgraph-development-skill/` - Will be rebuilt with execution context focus
- `n8n-development-skill/` - Will be rebuilt with execution context focus
- `crewai-development-skill/` - Future, not needed now

**Overlapping/Experimental:**
- `conventional-commits-skill/` - May merge into PR workflow
- `github-workflow-skill/` - May merge into PR workflow
- `orchestrator-git-standards-skill/` - May merge into PR workflow
- `worktree-lifecycle-skill/` - Overlaps with worktree-manager-skill
- `video-processor/` - Specialized, archive unless actively used

### Other to Archive

- **`output-styles/`** (11 files) - Archive unless actively used
- **`hooks-templates/`** - Archive unless actively used
- **`scripts/`** - Archive unless actively used
- **`status_lines/`** - Archive unless actively used

---

## Migration Strategy

1. **Keep the 4 Skills** - Move to new structure
2. **Keep pr-review-agent** - Move to new structure, enhance later
3. **Keep reference docs** - Already in place
4. **Archive everything else** - Move to `.claude-archive/`
5. **Create README in archive** - Explain what's archived and why

---

## Notes

- **worktree-manager-skill** is the gold standard - well-documented, mature, referenced in rules
- **meta-skill** documentation is valuable for understanding Skills
- Most other content is experimental or will be rebuilt better
- Focus on quality over quantity - 12-15 focused Skills vs 50+ commands

