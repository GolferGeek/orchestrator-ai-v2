# Orch-Flow Application Context

You are being invoked from the **Orch-Flow application** (`apps/orch-flow`).

## Your Role

You are helping a developer work on the Orch-Flow React application - a task management and sprint planning tool with Pomodoro support.

## Application Overview

- **Framework**: React 18 with TypeScript
- **State Management**: React Context + custom hooks
- **UI Library**: Tailwind CSS + shadcn/ui components
- **Location**: `apps/orch-flow/src/`

## Progressive Skills

Load these skills **only when needed** for the specific task:

### When Working with Database Operations
Use `orch-flow-skill`:
- Team files in `orch_flow.team_files`
- Shared tasks in `orch_flow.shared_tasks`
- Team notes in `orch_flow.team_notes`
- Sprint data in `orch_flow.sprints`

### When Working with ExecutionContext
Use `execution-context-skill`:
- ExecutionContext is a complete "capsule"
- NEVER cherry-pick fields
- ALWAYS pass as a whole object

### When Writing Tests
Use `web-testing-skill` (React patterns are similar to Vue):
- Jest for unit tests
- React Testing Library for component tests

## Key Files to Know

| Purpose | Location |
|---------|----------|
| Claude Code Context | `apps/orch-flow/src/contexts/ClaudeCodeContext.tsx` |
| Claude Code Panel | `apps/orch-flow/src/components/claude/ClaudeCodePanel.tsx` |
| Claude Code Service | `apps/orch-flow/src/services/claudeCodeService.ts` |
| Task Detail Dialog | `apps/orch-flow/src/components/TaskDetailDialog.tsx` |
| Main Entry | `apps/orch-flow/src/App.tsx` |

## Database Schema

The orch-flow app uses the `orch_flow` schema in Supabase:

```sql
-- Team files (shared documents)
orch_flow.team_files (id, org_id, name, content, file_type, created_by, ...)

-- Shared tasks (kanban board)
orch_flow.shared_tasks (id, org_id, title, description, status, assignee, ...)

-- Team notes (collaborative notes)
orch_flow.team_notes (id, org_id, title, content, created_by, ...)

-- Sprints (sprint planning)
orch_flow.sprints (id, org_id, name, start_date, end_date, goals, ...)
```

## React Patterns

- Use functional components with hooks
- Use `useState`, `useEffect`, `useContext` appropriately
- Extract reusable logic into custom hooks (`useXxx`)
- Keep components focused on UI presentation

## Quick Reference Commands

```bash
# Run orch-flow app
npm run dev:orch-flow

# Build orch-flow app
npm run build:orch-flow

# Test orch-flow app
npm run test:orch-flow
```

## When in Doubt

If you're unsure which pattern to follow:
1. Check existing similar files in `apps/orch-flow/src/`
2. Load relevant skills for detailed guidance
3. Ask the user for clarification
