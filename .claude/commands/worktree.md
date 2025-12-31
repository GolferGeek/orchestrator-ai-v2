---
description: "Manage git worktrees for parallel development"
category: "development"
uses-skills: ["worktree-manager-skill", "self-reporting-skill"]
uses-agents: []
related-commands: []
---

# Git Worktree Management

Manage git worktrees for parallel development. Worktrees allow you to work on multiple branches simultaneously in separate directories.

## Usage

```
/worktree <action> [args]
```

## Actions

### Create a Worktree
```
/worktree create <slot> [feature-name]
```
- `slot`: `wt-1`, `wt-2`, or `wt-3`
- `feature-name`: Optional feature name for the branch

Creates: `worktrees/<slot>/` with branch `golfergeek-<slot>/<feature-name>`

**Example:**
```
/worktree create wt-1 video-generation
```
Creates branch `golfergeek-wt-1/video-generation` in `worktrees/wt-1/`

### List Worktrees
```
/worktree list
```
Shows all worktrees with:
- Directory path
- Branch name
- Last commit
- Sync status (ahead/behind main)

### Remove a Worktree
```
/worktree remove <slot>
```
Removes the worktree directory. Does NOT delete the branch by default.

Add `--delete-branch` to also delete the branch:
```
/worktree remove wt-1 --delete-branch
```

### Sync Worktrees
```
/worktree sync [slot|all]
```
Syncs worktree(s) to latest main:
1. `git fetch origin main`
2. `git rebase origin/main`
3. `npm install` (if package.json changed)
4. Copy `.env` from main worktree

**Examples:**
```
/worktree sync wt-1     # Sync specific worktree
/worktree sync all      # Sync all idle worktrees
```

### Switch to Worktree
```
/worktree switch <slot>
```
Changes Claude's working directory to the worktree. Auto-syncs before switching.

### Show Status
```
/worktree status
```
Shows current worktree info:
- Which worktree you're in (or main)
- Branch name
- Commits ahead/behind main
- Modified files

## Configuration

| Setting | Value |
|---------|-------|
| Worktree slots | `wt-1`, `wt-2`, `wt-3` |
| Branch format | `golfergeek-<slot>/<feature-name>` |
| Location | `worktrees/` (gitignored) |
| Auto-sync | On switch, copies .env and runs npm install if needed |

## Directory Structure

```
orchestrator-ai-v2/
├── .git/                    # Shared git database
├── worktrees/               # Gitignored
│   ├── wt-1/                # Worktree 1
│   ├── wt-2/                # Worktree 2
│   └── wt-3/                # Worktree 3
├── apps/                    # Main worktree (main branch)
└── ...
```

## Important Notes

- **Branch exclusivity**: No two worktrees can have the same branch checked out
- **Shared .git**: All worktrees share the same git database (commits, refs, config)
- **Independent node_modules**: Each worktree needs its own `npm install`
- **Sync .env**: The `.env` file is copied from main on sync (not tracked in git)

## Troubleshooting

### "Branch already checked out"
Another worktree has this branch. Use `/worktree list` to find it, then either:
- Switch to that worktree instead
- Create a new branch for the conflicting worktree

### Merge conflicts during sync
If rebase fails due to conflicts:
1. The worktree is left in rebase state
2. Resolve conflicts manually
3. Run `git rebase --continue` or `git rebase --abort`

### Missing node_modules
Run `npm install` in the worktree directory, or use `/worktree sync <slot>`.

## Implementation

This command uses the `worktree-manager-skill`. See `.claude/skills/worktree-manager-skill/SKILL.md` for details.

## MANDATORY: Self-Reporting

**Log command invocation at START:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, details)
VALUES ('command', 'worktree', 'invoked',
  '{\"action\": \"action\", \"slot\": \"slot\", \"triggered_by\": \"user\"}'::jsonb);"
```

**Log completion at END:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, success, details)
VALUES ('command', 'worktree', 'completed', true,
  '{\"outcome\": \"Worktree action completed\"}'::jsonb);"
```

**If command fails:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, success, details)
VALUES ('command', 'worktree', 'completed', false,
  '{\"error\": \"description of what went wrong\"}'::jsonb);"
```
