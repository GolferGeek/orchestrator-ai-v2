---
description: "Approve a pull request. Use when PR has been reviewed and is ready to merge, or for quick approval after verifying CI passes. Can approve with optional comment."
argument-hint: "[PR number or branch name] [optional comment]"
---

# /approve-pr Command

## Purpose

Approve a pull request quickly. Use this when:
- PR has already been reviewed and is ready to merge
- CI checks are passing and you want to approve
- You've verified the changes manually and want to approve
- Following up after a review requested changes that have been addressed

## Usage

```
/approve-pr [PR number or branch name] [optional comment]
```

**Arguments:**
- `PR number or branch name` (optional): Specific PR to approve. If omitted, approves PR for current branch.
- `comment` (optional): Approval comment to post with the approval.

## Examples

```
/approve-pr
# Approves PR for current branch with default message

/approve-pr 123
# Approves PR #123 with default message

/approve-pr 123 "Looks good! All checks passed."
# Approves PR #123 with custom comment

/approve-pr feature/new-feature "Ready to merge after addressing review comments"
# Approves PR for feature/new-feature branch with custom comment
```

## Workflow

1. **Identify PR**
   - If PR number/branch provided, use that
   - Otherwise, detect PR for current branch using `gh pr view`

2. **Quick Verification** (Optional but recommended)
   - Check CI status: `gh pr checks <number>`
   - Verify PR is not draft
   - Check if PR is mergeable

3. **Approve PR**
   - Use `gh pr review <number> --approve --body "<comment>"`
   - Post approval comment

4. **Display Summary**
   - Show PR details
   - Show approval status
   - Show any warnings (e.g., CI still running)

## Quick Approval vs Full Review

**Use `/approve-pr` when:**
- ✅ PR has already been reviewed
- ✅ CI checks are passing
- ✅ You've manually verified the changes
- ✅ Following up after requested changes were addressed
- ✅ Quick approval needed

**Use `/review-pr` when:**
- 🔍 Need full code review
- 🔍 Want quality gates run
- 🔍 Want architecture validation
- 🔍 Want detailed feedback
- 🔍 Need to request changes

## Approval Comment

**Default Comment:**
```
✅ Approved

All checks passed. Ready to merge.
```

**Custom Comment:**
You can provide your own approval comment:
```
/approve-pr 123 "Great work! The refactoring looks clean and tests are comprehensive."
```

## Safety Checks

Before approving, the command will:
- ✅ Verify PR exists
- ✅ Check PR is not already approved
- ✅ Warn if CI checks are still running
- ✅ Warn if PR is in draft status
- ✅ Verify PR is mergeable

## GitHub CLI Commands

```bash
# View PR (if on PR branch)
gh pr view

# View specific PR
gh pr view <number>

# Check CI status
gh pr checks <number>

# Approve PR
gh pr review <number> --approve --body "Your comment here"
```

## Output

**Success:**
```
✅ PR Approved

PR: #123 - Add new feature
Author: @username
Status: Approved

Comment: "All checks passed. Ready to merge."
```

**Warning:**
```
⚠️ PR Approved (with warnings)

PR: #123 - Add new feature
Status: Approved

Warnings:
- CI checks still running (some may fail)
- PR is in draft status

Comment: "Approved, but please verify CI passes before merging."
```

## Related

- **`/review-pr`** - Full PR review with quality gates and architecture validation
- **`pr-review-agent.md`** - Agent that performs full reviews
- **GitHub CLI** - Required for PR operations

## Notes

- Requires GitHub CLI (`gh`) to be installed and authenticated
- Approval requires appropriate GitHub permissions
- Can approve your own PRs (if repository settings allow)
- Approval can be changed later if needed

