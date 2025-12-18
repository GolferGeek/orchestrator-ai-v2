# Reference Guide

Technical reference for tool usage and git commands.

## Tool Usage

### Git Operations (Bash - Complete Permission)

The Bash tool has **complete, unrestricted permission** to execute **ANY and ALL git commands** without prompts.

**Primary Commands Used:**
- `git status` - Check what files have changed
- `git diff` / `git diff --staged` / `git diff HEAD -- <path>` - View changes for commit message generation (NEVER prompts)
- `git fetch origin` / `git fetch origin <branch>` - Fetch remote changes (NEVER prompts)
- `git add .` / `git add <files>` / `git add -A` - Stage all changes or specific files
- `git commit -m "message"` - Commit with generated or provided message
- `git push` / `git push origin <branch>` - Push to remote (for `/commit-push`)

**CRITICAL: These commands NEVER require approval:**
- ✅ `git diff` (any variation: `git diff`, `git diff HEAD`, `git diff --staged`, `git diff HEAD -- <path>`, etc.)
- ✅ `git fetch` (any variation: `git fetch origin`, `git fetch origin main`, etc.)
- ✅ `git status`
- ✅ `git log`
- ✅ `git show`
- ✅ `git branch`
- ✅ `git rev-parse`
- ✅ `git ls-remote`
- ✅ `git merge-base`
- ✅ All read-only git commands

**Additional Commands Available:**
- `git log` - View commit history (if needed for context)
- `git show` - View specific commits (if needed)
- `git branch` - List or create branches
- `git checkout` - Switch branches
- `git merge` - Merge branches
- `git rebase` - Rebase branches
- `git reset` - Reset changes
- `git stash` - Stash changes
- **Any other git command** - Full access to entire git command-line interface

**No restrictions** - All git commands are available and can be executed without permission prompts.

**IMPORTANT (Claude Code):** When executing git commands via Bash, Claude Code should NEVER prompt for approval because:
- The skill has `allowed-tools: Bash` in its frontmatter
- This grants automatic permission for ALL bash commands (including all git commands)
- `git diff` and `git fetch` are read-only operations (safe)
- These commands are essential for the commit workflow

**If Claude Code prompts for approval on these commands, it's unexpected** - the `allowed-tools: Bash` permission should prevent all prompts.

**Commands that should NEVER prompt:**
- `git diff` (all variations) - Used to analyze changes for commit message generation
- `git fetch` (all variations) - Used to check remote status before pushing
- `git status` - Used to check what files have changed
- All other git commands - Full access without prompts

### Quality Gates (Bash)
- `npm run format` - Format code (may modify files, uses Write tool)
- `npm run lint` - Lint code (must pass)
- `npm run build` - Build code (must pass)

### Analysis Operations
- **Read**: Read changed files to understand modifications
- **Grep**: Search for patterns (execution context usage, transport types, etc.)
- **Glob**: Find related files by pattern

### File Operations
- **Write**: Write formatted code if format command modifies files
- **Edit**: Edit files if safety review finds fixable issues (optional)

## Tool Permissions Summary

**All tools are granted automatically** - no permission prompts needed when this skill is active.

- **Read**: Read changed files to analyze changes and generate commit messages
- **Write**: Write formatted code (if format command modifies files)
- **Edit**: Edit files if needed during safety review fixes
- **Bash**: Run ALL git commands and ALL npm commands
- **Grep**: Search files for patterns during safety review
- **Glob**: Find files by pattern for analysis

