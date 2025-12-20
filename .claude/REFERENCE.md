# Claude Code Reference Documentation

This directory contains reference documentation for Claude Code Skills, Agents, and Commands.

## Quick Reference Files

| File | Purpose |
|------|---------|
| [REFERENCE-skills-agents-commands.md](REFERENCE-skills-agents-commands.md) | Complete guide to Skills, Agents, and Commands - what they are, when to use each |
| [REFERENCE-best-practices.md](REFERENCE-best-practices.md) | Best practices for creating and maintaining Skills, Agents, and Commands |
| [REFERENCE-cursor-integration.md](REFERENCE-cursor-integration.md) | How to use Claude Code components from Cursor AI |

## Directory Structure

```
.claude/
├── agents/           # Specialized subagents for complex tasks
├── commands/         # User-invoked shortcuts (/command)
├── skills/           # Model-invoked capabilities (automatic)
├── docs/             # Additional documentation
├── plans/            # Work plans (archive when complete)
└── REFERENCE*.md     # Reference documentation
```

## Key Concepts

### Skills (Automatic)
- Model-invoked based on description matching
- Located in `.claude/skills/<skill-name>/SKILL.md`
- Use for domain expertise and reusable workflows

### Agents (Automatic)
- Model-invoked for specialized tasks
- Located in `.claude/agents/<agent-name>.md`
- Use for complex multi-step workflows

### Commands (Manual)
- User-invoked with `/command-name`
- Located in `.claude/commands/<command-name>.md`
- Use for frequently used shortcuts

## Current Skills

| Skill | Purpose |
|-------|---------|
| `worktree-manager-skill` | Git worktree management |
| `supabase-management-skill` | Database sync and migration |
| `quality-gates-skill` | Code quality checks |
| `direct-commit-skill` | Commit workflow |
| `api-architecture-skill` | NestJS API patterns |
| `web-architecture-skill` | Vue.js web patterns |
| `langgraph-architecture-skill` | LangGraph workflow patterns |
| `codebase-monitoring-skill` | Codebase health analysis |
| `codebase-hardening-skill` | Issue fixing patterns |

## Current Commands

| Command | Purpose |
|---------|---------|
| `/commit` | Commit with quality checks |
| `/commit-push` | Commit and push |
| `/create-pr` | Create pull request |
| `/review-pr` | Review pull request |
| `/approve-pr` | Approve pull request |
| `/monitor` | Run codebase monitoring |
| `/harden` | Fix codebase issues |
| `/test` | Run tests |
| `/worktree` | Manage git worktrees |

## Getting Started

1. **Read the reference docs** above to understand the concepts
2. **Explore existing Skills** in `.claude/skills/` for examples
3. **Try the commands** like `/commit` or `/monitor`
4. **Create new components** following the patterns in REFERENCE-best-practices.md
