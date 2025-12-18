# Claude Code Skills, Agents, and Commands

**Status:** Clean slate - rebuilding with focused, high-value Skills

## Current Structure

```
.claude/
├── agents/
│   └── pr-review-agent.md          # Good PR review pattern (to be enhanced)
├── skills/
│   ├── worktree-manager-skill/      # Mature, well-documented
│   ├── quality-gates-skill/         # Foundation for PR workflow
│   ├── supabase-management-skill/  # Critical for database sync
│   └── meta-skill/                  # Documentation about Skills
└── [reference docs]
```

## What Was Archived

All experimental and overlapping content has been moved to `.claude-archive/`. See that directory's README for details.

## Rebuild Plan

We're rebuilding with a focused approach:

1. **Core Domain Skills** (Subconversations 1-2)
   - ✅ `execution-context-skill/` - The critical "capsule" that flows through the system (COMPLETE)
   - ✅ `transport-types-skill/` - A2A compliance and transport types (COMPLETE)

2. **Architecture Skills** (Subconversations 5-7)
   - `front-end-architecture-skill/` - Front-end patterns and decisions
   - `api-architecture-skill/` - API patterns and decisions
   - `langgraph-architecture-skill/` - LangGraph app patterns

3. **Development Skills** (Subconversations 3-4, 8)
   - ✅ `langgraph-development-skill/` - Prescriptive LangGraph building (COMPLETE)
   - ✅ `n8n-development-skill/` - Prescriptive N8N building (COMPLETE)
   - `agent-creation-skill/` - Creating agents in the agent table

4. **Hardening Skills** (Subconversation 9)
   - `codebase-hardening-skill/` - Codebase auditing
   - `codebase-audit-agent/` - Comprehensive audits
   - Sub-agents for specific audit types

5. **Builder Skills** (Subconversations 10-11)
   - `skill-builder-skill/` - Building Claude Code Skills
   - `agent-builder-skill/` - Building Claude Code Agents

6. **Progressive PR Command**
   - `/create-pr` - Automatically invokes relevant Skills based on changed files

## Principles

- **Focused**: 12-15 high-value Skills (not 50+ commands)
- **Prescriptive**: Clear patterns that prevent mistakes
- **Progressive**: Skills only load what's needed
- **Maintainable**: Easy to update and extend
- **Effective**: Actually prevents common mistakes
- **Self-Improving**: Hardening system finds and fixes issues

## Progress

**Completed:**
- ✅ Subconversation 1: Execution Context Deep Dive - `execution-context-skill/` created
- ✅ Subconversation 2: Transport Types & A2A Compliance - `transport-types-skill/` created
- ✅ Subconversation 3: LangGraph Prescriptive Building Pattern - `langgraph-development-skill/` created
- ✅ Subconversation 4: N8N Prescriptive Building Pattern - `n8n-development-skill/` created

**Next:**
- ⏳ Subconversation 5: Web App Architecture

**Next Steps:**

See the plan: `.cursor/plans/claude_code_skills_cleanup_&_rebuild_plan_*.plan.md`

We'll work through 11 subconversations to understand the codebase and build these Skills systematically.

