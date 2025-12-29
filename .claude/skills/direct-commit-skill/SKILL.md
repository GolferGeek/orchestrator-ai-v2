---
name: direct-commit-skill
description: Commit changes directly to current branch after quality checks (lint, build, safety review). Use when user wants to commit without creating a PR, or when user mentions committing, committing changes, or direct commit.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
category: "utility"
type: "utility"
used-by-agents: []
related-skills: ["quality-gates-skill"]
---

**Claude Code Note:** With `allowed-tools: Bash` specified, ALL git commands (including `git diff` and `git fetch`) can be executed WITHOUT prompts. These are read-only operations essential for the workflow.

# Direct Commit Skill

Commit changes directly to the current branch after running quality gates and safety checks. This is for the architect's workflow - bypasses PR process but still ensures code quality.

## When to Use This Skill

Use this skill when:
- User wants to commit changes directly to current branch
- User mentions "commit", "commit these changes", "commit and push"
- User wants to bypass PR workflow
- User is working as the architect (direct commits allowed)

**Do NOT use this skill when:**
- User explicitly wants to create a PR
- User mentions "pull request" or "PR"
- User is an intern (should use PR workflow)

## Tool Permissions

**All tools are granted automatically** - no permission prompts needed when this skill is active.

- **Read**: Read changed files to analyze changes and generate commit messages
- **Write**: Write formatted code (if format command modifies files)
- **Edit**: Edit files if needed during safety review fixes
- **Bash**: Run ALL git commands (status, diff, add, commit, push, log, show, branch, checkout, merge, rebase, etc.) and ALL npm commands (format, lint, build, test, etc.)
- **Grep**: Search files for patterns during safety review
- **Glob**: Find files by pattern for analysis

**Git Commands (via Bash - FULL PERMISSION):**
The Bash tool has **complete, unrestricted permission** to execute **ANY and ALL git commands** without prompts. See [REFERENCE.md](REFERENCE.md) for complete git command reference.

**CRITICAL - No Approval Required (Claude Code):**
- ✅ `git diff` (all variations: `git diff`, `git diff HEAD`, `git diff --staged`, `git diff HEAD -- <path>`) - Used for commit message generation
- ✅ `git fetch` (all variations: `git fetch origin`, `git fetch origin main`) - Used to check remote status
- ✅ `git status` - Used to check changed files
- ✅ All other git commands - Full access without prompts

**Why No Prompts:**
- The `allowed-tools: Bash` frontmatter grants automatic permission for ALL bash commands
- `git diff` and `git fetch` are read-only operations (safe)
- These commands are essential for the commit workflow
- Claude Code should execute these automatically when the skill is active

**If Cursor prompts for approval on git commands, this is a bug** - the skill has explicit permission for all git operations.

## Quick Workflow

### For `/commit` (commit only):

1. **Check git status** - Verify there are changes to commit
2. **Run quality gates** - Format, lint (ALL workspaces: API, Web, LangGraph), tests (affected apps only), build (see [QUALITY_GATES.md](QUALITY_GATES.md))
3. **Safety review** - Check changed files for issues (see [SAFETY_REVIEW.md](SAFETY_REVIEW.md))
4. **Generate commit message** - Analyze changes and create message (see [COMMIT_MESSAGE.md](COMMIT_MESSAGE.md))
5. **Commit** - Stage and commit with generated or provided message

### For `/commit-push` (commit and push):

Same as `/commit`, but after successful commit:
6. **Push** - Push to origin/current-branch

## Detailed Documentation

- **[QUALITY_GATES.md](QUALITY_GATES.md)** - Quality gate commands and requirements
- **[TESTING.md](TESTING.md)** - Testing strategy: run tests only for affected apps
- **[PUSH_STRATEGY.md](PUSH_STRATEGY.md)** - **BULLETPROOF** push workflow: handling remote changes, merges, and all edge cases (no prompts, handles conflicts)
- **[COMMIT_MESSAGE.md](COMMIT_MESSAGE.md)** - Commit message generation process and examples
- **[SAFETY_REVIEW.md](SAFETY_REVIEW.md)** - Safety review patterns and checks
- **[EXAMPLES.md](EXAMPLES.md)** - Complete usage examples
- **[ERROR_HANDLING.md](ERROR_HANDLING.md)** - Error handling and troubleshooting (includes push-specific errors)
- **[REFERENCE.md](REFERENCE.md)** - Tool usage and git command reference

## Push Workflow (For `/commit-push` Command)

When pushing to remote, the skill follows a **bulletproof workflow** that:

1. **Configures git for non-interactive mode** - Prevents all prompts
2. **Fetches remote changes first** - Knows what's on remote before pushing
3. **Detects branch status** - Determines if merge is needed
4. **Merges automatically** - Uses `--no-edit --no-rebase --no-ff` to avoid prompts
5. **Handles conflicts gracefully** - Provides clear resolution steps
6. **Pushes safely** - Sets upstream on first push, handles all errors

**See [PUSH_STRATEGY.md](PUSH_STRATEGY.md) for complete implementation details.**

## Related Skills

- `execution-context-skill/` - For execution context validation (when available)
- `transport-types-skill/` - For A2A compliance checks (when available)
- `quality-gates-skill/` - For quality gate patterns
- `strict-linting-skill/` - For enforcing hardcore linting rules and catching anti-patterns

## Important Notes

- This skill is for the architect's direct commit workflow
- Interns should use PR workflow (`/create-pr` command)
- Always run quality gates before committing
- Progressive safety checks - only check what's relevant
- Fail fast - don't commit if checks fail
