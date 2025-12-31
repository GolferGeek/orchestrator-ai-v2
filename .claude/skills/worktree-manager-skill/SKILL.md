---
name: worktree-manager-skill
description: Comprehensive git worktree management. Use when the user wants to create, remove, list, or manage worktrees. Handles all worktree operations including creation, deletion, and status checking.
allowed-tools: SlashCommand, Bash, Read, Write, Edit, Glob, Grep
category: "utility"
type: "utility"
used-by-agents: []
related-skills: []
---

# Worktree Manager Skill

Complete worktree lifecycle management for parallel development environments with isolated ports, databases, and configuration.

## Configuration

```yaml
# Worktree slots (3 available)
slots: [wt-1, wt-2, wt-3]

# Branch naming convention
branch_format: "golfergeek-{slot}/{feature}"

# Directory location (gitignored)
worktree_dir: "worktrees/"

# Main branch to sync against
main_branch: "main"
```

## When to use this skill

Use this skill when the user wants to:
- **Create** a new worktree for parallel development
- **Remove** an existing worktree
- **List** all worktrees and their status
- **Sync** worktrees to latest main
- **Switch** between worktrees
- **Check** worktree configuration or status

**Do NOT use this skill when:**
- User asks for a specific subagent or skill delegation
- User wants to manually use git commands directly
- The task is unrelated to worktree management

## Operations Overview

| Operation | Command | When to Use |
|-----------|---------|-------------|
| **Create** | `/worktree create <slot> [feature]` | Create new parallel environment |
| **List** | `/worktree list` | See all worktrees with status |
| **Remove** | `/worktree remove <slot>` | Delete a worktree |
| **Sync** | `/worktree sync [slot\|all]` | Update worktree(s) to main |
| **Switch** | `/worktree switch <slot>` | Change working directory |
| **Status** | `/worktree status` | Show current worktree info |

## Sync Flow

When syncing a worktree:
```bash
cd worktrees/{slot}
git fetch origin main
git rebase origin/main
# If package.json changed: npm install
# Copy .env from main: cp ../../.env .env
```

## Branch Naming Convention

Format: `golfergeek-{slot}/{feature}`

Examples:
- `golfergeek-wt-1/video-generation`
- `golfergeek-wt-2/auth-refactor`
- `golfergeek-wt-3/bug-fix`

## Quick Start

For step-by-step operation instructions, see [OPERATIONS.md](OPERATIONS.md).

For detailed examples and usage patterns, see [EXAMPLES.md](EXAMPLES.md).

For troubleshooting and common issues, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

For technical details and quick reference, see [REFERENCE.md](REFERENCE.md).

## Important Notes

### Always use the slash commands because they:
- Handle all configuration automatically
- Ensure port uniqueness
- Copy .env and run npm install on sync
- Validate operations
- Provide comprehensive error handling
- Clean up properly on removal

## Self-Reporting

**When this skill is loaded, the agent using it should log the event:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, details)
VALUES ('skill', 'worktree-manager-skill', 'loaded',
  '{\"loaded_by\": \"agent-name\", \"context\": \"description\"}'::jsonb);"
```

**After using the skill's patterns, log if they helped:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, success, details)
VALUES ('skill', 'worktree-manager-skill', 'helped', true,
  '{\"outcome\": \"what the skill helped with\"}'::jsonb);"
```
