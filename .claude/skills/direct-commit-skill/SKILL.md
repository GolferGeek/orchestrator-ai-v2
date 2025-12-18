---
name: Direct Commit
description: Commit changes directly to current branch after quality checks (lint, build, safety review). Use when user wants to commit without creating a PR, or when user mentions committing, committing changes, or direct commit.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

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

## Quick Workflow

### For `/commit` (commit only):

1. **Check git status** - Verify there are changes to commit
2. **Run quality gates** - Format, lint (ALL workspaces: API, Web, LangGraph), build (see [QUALITY_GATES.md](QUALITY_GATES.md))
3. **Safety review** - Check changed files for issues (see [SAFETY_REVIEW.md](SAFETY_REVIEW.md))
4. **Generate commit message** - Analyze changes and create message (see [COMMIT_MESSAGE.md](COMMIT_MESSAGE.md))
5. **Commit** - Stage and commit with generated or provided message

### For `/commit-push` (commit and push):

Same as `/commit`, but after successful commit:
6. **Push** - Push to origin/current-branch

## Detailed Documentation

- **[QUALITY_GATES.md](QUALITY_GATES.md)** - Quality gate commands and requirements
- **[COMMIT_MESSAGE.md](COMMIT_MESSAGE.md)** - Commit message generation process and examples
- **[SAFETY_REVIEW.md](SAFETY_REVIEW.md)** - Safety review patterns and checks
- **[EXAMPLES.md](EXAMPLES.md)** - Complete usage examples
- **[ERROR_HANDLING.md](ERROR_HANDLING.md)** - Error handling and troubleshooting
- **[REFERENCE.md](REFERENCE.md)** - Tool usage and git command reference

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
