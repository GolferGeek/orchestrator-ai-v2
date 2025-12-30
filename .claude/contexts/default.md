# Orchestrator AI - Default Context

You are working on the **Orchestrator AI** monorepo.

## Repository Structure

```
orchestrator-ai-v2/
├── apps/
│   ├── web/              # Vue.js web application
│   ├── api/              # NestJS API backend
│   ├── langgraph/        # LangGraph agent workflows
│   ├── orch-flow/        # React task management app
│   └── observability/    # Observability dashboard
├── .claude/
│   ├── skills/           # Claude Code skills
│   ├── agents/           # Claude Code agents
│   ├── commands/         # Claude Code commands
│   └── contexts/         # Source-specific contexts (this file)
└── docs/                 # Documentation
```

## Available Skills (Load When Needed)

### Architecture Skills
- `web-architecture-skill` - Vue.js web app patterns
- `api-architecture-skill` - NestJS API patterns
- `langgraph-architecture-skill` - LangGraph workflow patterns

### Development Skills
- `langgraph-development-skill` - Prescriptive LangGraph patterns
- `n8n-development-skill` - Prescriptive N8N patterns

### Core Domain Skills
- `execution-context-skill` - ExecutionContext "capsule" pattern
- `transport-types-skill` - A2A protocol compliance

### Testing Skills
- `web-testing-skill` - Vue 3, Vitest, Cypress
- `api-testing-skill` - NestJS, Jest
- `langgraph-testing-skill` - LangGraph, Jest
- `e2e-testing-skill` - E2E testing principles (no mocking)

### Quality Skills
- `quality-gates-skill` - Lint, format, test, build
- `strict-linting-skill` - Hardcore linting rules

### Operations Skills
- `supabase-management-skill` - Database operations via storage scripts
- `worktree-manager-skill` - Git worktree management

### Agent Building Skills
- `agent-builder-skill` - Create Claude Code agents
- `skill-builder-skill` - Create Claude Code skills
- `context-agent-skill`, `rag-agent-skill`, `media-agent-skill`, `api-agent-skill`, `external-agent-skill`, `orchestrator-agent-skill` - Agent type patterns

## Determining Which App to Work On

If the user doesn't specify, ask which app they're working on:
- **web** - Vue.js frontend
- **api** - NestJS backend
- **langgraph** - Agent workflows
- **orch-flow** - Task management

## Key Principles

1. **ExecutionContext flows as a capsule** - Never cherry-pick fields
2. **Three-layer architecture** - Store → Service → Component (web) or Module → Service → Controller (API)
3. **A2A uses JSON-RPC 2.0** - All agent-to-agent communication
4. **Progressive skill loading** - Only load skills when needed

## Available Commands

- `/commit` - Commit changes (no push)
- `/commit-push` - Commit and push
- `/create-pr` - Create PR with validation
- `/review-pr` - Review a PR
- `/test` - Run/generate/fix tests
- `/monitor` - Codebase health analysis
- `/harden` - Fix issues from monitoring
- `/worktree` - Manage git worktrees
