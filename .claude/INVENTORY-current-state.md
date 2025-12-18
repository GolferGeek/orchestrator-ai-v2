# Current .claude Directory Inventory

This document catalogs what currently exists in the `.claude` directory to help plan cleanup and reorganization.

**Date:** 2025-01-XX  
**Purpose:** Understand current state before cleanup

---

## Current Structure

```
.claude/
├── agents/          (18 files)
├── commands/        (50+ files organized in subdirectories)
├── skills/          (15 skill directories)
├── hooks-templates/ (1 file)
├── output-styles/   (11 files)
├── scripts/         (1 file)
├── status_lines/    (2 files)
├── settings.json
└── settings.local.json
```

---

## Agents (18 total)

Located in `.claude/agents/`

### Development Agents
- `api-agent-development-agent.md`
- `back-end-coding-agent.md`
- `context-agent-development-agent.md`
- `external-agent-development-agent.md`
- `front-end-coding-agent.md`
- `function-agent-development-agent.md`
- `langgraph-development-agent.md`
- `n8n-development-agent.md`
- `orchestrator-agent-development-agent.md`

### Quality & Testing Agents
- `lint-build-fix-agent.md`
- `test-fix-agent.md`
- `pr-review-agent.md`

### Specialized Agents
- `docs-scraper.md`
- `fetch-docs-haiku45.md`
- `fetch-docs-sonnet45.md`
- `scout-report-suggest-fast.md`
- `scout-report-suggest.md`
- `worktree-processor-agent.md`
- `create_worktree_subagent.md`
- `meta-agent.md`

**Observations:**
- Many agents seem to overlap (e.g., multiple docs-scraper variants)
- Some agents might be better as Skills or Commands
- Development agents might be too granular

---

## Commands (50+ total)

Located in `.claude/commands/` with subdirectory organization

### API Agent Commands (`commands/api-agent/`)
- `create.md`
- `test.md`
- `wrap-crewai.md`
- `wrap-langgraph.md`
- `wrap-n8n.md`

### Backend Commands (`commands/backend/`)
- `controller.md`
- `module.md`
- `service.md`

### Bench Commands (`commands/bench/`)
- `find_and_summarize.md`
- `load_ai_docs.md`
- `plan_new_feature.md`

### Frontend Commands (`commands/frontend/`)
- `component.md`
- `service.md`
- `store.md`

### Git Commands (`commands/git/`)
- `commit.md`
- `pr.md`
- `pr/list.md`
- `pr/merge.md`
- `pr/review.md`
- `worktree/create.md`
- `worktree/list.md`
- `worktree/process.md`
- `worktree/remove.md`

### LangGraph Commands (`commands/langgraph/`)
- `create.md`
- `test.md`
- `update.md`
- `wrap.md`

### N8N Commands (`commands/n8n/`)
- `create.md`
- `create-from-file.md`
- `create-from-prd.md`
- `test.md`
- `update.md`
- `wrap.md`
- `README.md`

### Quality Commands (`commands/quality/`)
- `all.md`
- `build.md`
- `lint.md`
- `test.md`

### Supabase Commands (`commands/supabase/`)
- `backup.md`
- `restore.md`
- `agent/export.md`
- `agent/import.md`
- `migration/apply.md`
- `migration/propose.md`
- `n8n/export.md`
- `n8n/import.md`
- `snapshot/apply.md`
- `snapshot/export.md`

### Task Commands (`commands/task/`)
- `add.md`
- `done.md`
- `list.md`
- `view.md`
- `README.md`

### Other Commands
- `build.md`
- `convert_paths_absolute.md`
- `create_worktree_prompt.md`
- `list_worktrees_prompt.md`
- `load_ai_docs.md`
- `prime.md`
- `quick-plan.md`
- `remove_worktree_prompt.md`
- `start.md`
- `t_metaprompt_workflow.md`

**Observations:**
- Well-organized by category
- Some duplication (e.g., worktree commands in multiple places)
- Some commands might be better as Skills (automatic invocation)
- Good coverage of common workflows

---

## Skills (15 total)

Located in `.claude/skills/`

### Development Skills
- `api-agent-development-skill/`
- `back-end-structure-skill/`
- `crewai-development-skill/`
- `front-end-structure-skill/`
- `langgraph-development-skill/`
- `n8n-development-skill/`

### Workflow Skills
- `conventional-commits-skill/`
- `github-workflow-skill/`
- `orchestrator-git-standards-skill/`
- `quality-gates-skill/`
- `worktree-lifecycle-skill/`
- `worktree-manager-skill/`

### Management Skills
- `supabase-management-skill/`
- `meta-skill/` (contains documentation about Skills)

### Specialized Skills
- `video-processor/`

**Observations:**
- Good coverage of key workflows
- Some overlap with Commands (e.g., worktree)
- `meta-skill` contains useful documentation
- Skills seem more mature than Agents

---

## Other Files

### Hooks Templates
- `hooks-templates/observability.json`

### Output Styles (11 files)
- `bullet-points.md`
- `genui.md`
- `html-structured.md`
- `markdown-focused.md`
- `observable-tools-diffs-tts.md`
- `observable-tools-diffs.md`
- `table-based.md`
- `tts-summary-base.md`
- `tts-summary.md`
- `ultra-concise.md`
- `yaml-structured.md`

### Scripts
- `scripts/apply-observability-hooks.ts`

### Status Lines
- `status_lines/status_line_main.py`
- `status_lines/status_line_main.ts`

### Settings
- `settings.json`
- `settings.local.json`

---

## Patterns & Observations

### Strengths
1. **Well-organized Commands**: Good hierarchical structure
2. **Comprehensive Coverage**: Many common workflows covered
3. **Good Documentation**: Some Skills have detailed docs

### Concerns
1. **Overlap**: Some functionality exists in multiple forms (Agent + Command + Skill)
2. **Granularity**: Some Agents might be too specific
3. **Duplication**: Multiple variants of similar functionality
4. **Unclear Boundaries**: When to use Agent vs Skill vs Command
5. **Maintenance Burden**: Large number of files to maintain

### Potential Issues
- **Agents**: Many seem experimental or redundant
- **Commands**: Some might be better as Skills (automatic)
- **Skills**: Some overlap with Commands
- **Output Styles**: 11 files - are all needed?

---

## Questions for Discussion

1. **Which Agents are actually used?** Many seem experimental
2. **Should some Commands become Skills?** (automatic invocation)
3. **Are all Output Styles needed?** 11 seems like a lot
4. **What's the maintenance strategy?** How do we keep this organized?
5. **What's the vision?** What should this become?

---

## Next Steps

1. **Audit**: Determine which components are actually used
2. **Categorize**: Identify what to keep, archive, or rebuild
3. **Consolidate**: Merge overlapping functionality
4. **Document**: Create clear guidelines for future additions
5. **Archive**: Move unused/experimental items to `.claude-archive/`

