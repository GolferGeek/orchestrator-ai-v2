# .claude Archive

**Date Archived:** 2025-01-XX  
**Reason:** Cleanup and rebuild of Claude Code Skills, Agents, and Commands

## What's Archived

This archive contains the initial experimental implementation of Claude Code Skills, Agents, and Commands. The content was archived to start fresh with a more focused, high-value approach.

### Contents

- **agents/** (17 agents) - Experimental and overlapping agents
- **commands/** (50+ commands) - Will be replaced by focused Skills
- **skills/** (11 skills) - Will be rebuilt better with execution context focus
- **output-styles/** (11 files) - Experimental output formatting
- **hooks-templates/** (1 file) - May be needed later
- **scripts/** (1 file) - May be needed later
- **status_lines/** (2 files) - Experimental status line functionality
- **settings.json** - Claude Code settings
- **settings.local.json** - Local Claude Code settings

## What Was Kept

The following items were kept in `.claude/` because they are mature, well-documented, and actively used:

**Skills:**
- `worktree-manager-skill/` - Mature, referenced in workspace rules
- `quality-gates-skill/` - Useful foundation for PR workflow
- `supabase-management-skill/` - Critical for preventing database sync issues
- `meta-skill/` - Contains valuable documentation about Skills

**Agents:**
- `pr-review-agent.md` - Good pattern for PR review workflow

**Reference Documents:**
- `REFERENCE-skills-agents-commands.md` - Comprehensive reference guide
- `REFERENCE-best-practices.md` - Best practices guide
- `INVENTORY-current-state.md` - Inventory of what was archived
- `REVIEW-what-to-keep.md` - Review of what to keep

## Why Archive?

The initial implementation was overly ambitious and created:
- Too many overlapping components (18 agents, 50+ commands, 15 skills)
- Unclear boundaries between Agents, Skills, and Commands
- Experimental content that didn't pan out
- Maintenance burden with too many files

## New Approach

The rebuild focuses on:
- **12-15 focused, high-value Skills** (not 50+ commands)
- **Prescriptive patterns** that prevent mistakes
- **Progressive disclosure** - Skills only load what's needed
- **Execution context awareness** - Critical for system integrity
- **Codebase hardening** - System to find and fix violations
- **Self-improving** - Skills for building Skills and Agents

## Reference

If you need to reference archived content:
- Check this README for what's in each directory
- Most content will be rebuilt better in the new structure
- Some patterns may be useful as reference

## Restoration

If you need to restore something:
1. Check if it's been rebuilt in the new structure first
2. If not, restore from this archive
3. Update the new structure accordingly

---

**Note:** This archive is preserved for reference but the new structure should be the source of truth going forward.

