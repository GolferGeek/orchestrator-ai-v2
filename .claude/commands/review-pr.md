---
description: "Review a pull request systematically. Runs quality checks, analyzes code quality and architecture, and generates review comments."
argument-hint: "[PR number or branch name]"
category: "pr-workflow"
uses-skills: ["execution-context-skill", "transport-types-skill", "web-architecture-skill", "api-architecture-skill", "langgraph-architecture-skill", "quality-gates-skill", "self-reporting-skill"]
uses-agents: ["pr-review-agent"]
related-commands: ["create-pr", "approve-pr"]
---

# Review Pull Request

Systematically review a pull request by running quality checks, analyzing code quality and architecture, and generating actionable feedback.

## What This Does

1. **Gets PR Information:**
   - PR number, title, author, base branch, head branch, status
   - Checks if PR is draft or ready for review

2. **Reads PR Diff:**
   - Analyzes all changed files
   - Identifies file types (TypeScript, Vue, YAML, etc.)

3. **Checks CI Status:**
   - Verifies all CI/CD checks are passing
   - Notes any failing checks

4. **Runs Quality Checks:**
   - Lints code (`npm run lint`)
   - Builds code (`npm run build`)
   - Runs tests (`npm test`)
   - Fixes issues if appropriate

5. **Analyzes Code Quality:**
   - **Architecture**: Does code follow Orchestrator AI patterns?
   - **ExecutionContext**: Is ExecutionContext passed correctly?
   - **Transport Types**: Are A2A calls compliant?
   - **Code Quality**: Error handling, type safety, organization
   - **Tests**: Coverage and quality

6. **Generates Review:**
   - Actionable feedback
   - Approval or change requests
   - Comments on specific lines/files

## Usage

### Review Current Branch PR
```
/review-pr
```
Reviews the PR for the current branch (if on a PR branch).

### Review Specific PR
```
/review-pr 123
```
Reviews PR #123.

### Review Specific Branch
```
/review-pr feature/new-feature
```
Reviews the PR for the specified branch.

## Quality Checks

All quality checks must pass:
- ✅ **Lint**: No lint errors
- ✅ **Build**: Build succeeds
- ✅ **Tests**: All tests pass
- ✅ **Architecture**: Follows patterns
- ✅ **ExecutionContext**: Passed correctly
- ✅ **A2A Compliance**: Transport types followed

## Architecture Validation

The review checks:
- **Web Code**: Vue patterns, store-service-component separation
- **API Code**: NestJS patterns, runner types, module structure
- **LangGraph Code**: Workflow patterns, HITL, checkpointing
- **ExecutionContext**: Flow validation (mandatory)
- **Transport Types**: A2A protocol compliance (mandatory)

## Review Output

The review includes:
- **Summary**: Overall assessment
- **Quality Checks**: Status of lint, build, tests
- **Architecture**: Compliance with patterns
- **Specific Issues**: Line-by-line feedback
- **Recommendations**: Suggested improvements
- **Decision**: Approve or request changes

## Examples

### Basic Review
```
/review-pr
```
Reviews the PR for the current branch.

### Review with Focus
```
/review-pr 123
```
Reviews PR #123 with full analysis.

## Related

- `pr-review-agent.md` - The agent that performs the review
- `quality-gates-skill/` - Quality check patterns
- `execution-context-skill/` - ExecutionContext validation
- `transport-types-skill/` - A2A compliance validation
- All architecture skills - For domain-specific validation

## MANDATORY: Self-Reporting

**Log command invocation at START:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, details)
VALUES ('command', 'review-pr', 'invoked',
  '{\"pr\": \"PR number\", \"triggered_by\": \"user\"}'::jsonb);"
```

**Log completion at END:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, success, details)
VALUES ('command', 'review-pr', 'completed', true,
  '{\"outcome\": \"PR reviewed\", \"decision\": \"approve/request-changes\"}'::jsonb);"
```

**If command fails:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, success, details)
VALUES ('command', 'review-pr', 'completed', false,
  '{\"error\": \"description of what went wrong\"}'::jsonb);"
```

## Notes

- Uses GitHub CLI (`gh`) for PR access
- Automatically checks out PR branch for quality checks
- Can fix lint/build issues automatically if appropriate
- Provides actionable feedback, not just criticism

