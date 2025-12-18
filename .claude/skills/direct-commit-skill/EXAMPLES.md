# Usage Examples

Complete examples of using the direct commit skill.

## Example 1: Simple Commit (Auto-Generated Message)

**User:** "Commit these changes"

**Workflow:**
1. Check git status: `git status`
2. Get git diff: `git diff` (or `git diff --staged`)
3. Analyze changes:
   - Read changed files to understand modifications
   - See new file: `apps/api/src/services/validation.service.ts`
   - Determine: This is a new feature (feat), in API scope
   - Generate: `feat(api): add validation service`
4. Run `npm run format`
5. Run `npm run lint` (must pass)
6. Run `npm run build` (must pass)
7. Quick safety review
8. Stage: `git add .`
9. Commit: `git commit -m "feat(api): add validation service"`

## Example 2: Commit with Custom Message

**User:** "Commit with message 'fix: resolve bug'"

**Workflow:**
1. Run quality gates (format, lint, build)
2. Safety review
3. Use provided message: `git commit -m "fix: resolve bug"`
   - Note: User provided message, so use it exactly as given

## Example 3: Commit and Push (Auto-Generated Message)

**User:** "Commit and push"

**Workflow:**
1. Get git diff and analyze changes
2. Generate commit message from changes
3. Run quality gates (format, lint, build)
4. Safety review
5. Commit: `git commit -m "<generated-message>"`
6. Push: `git push`

## Example 4: Multiple Scope Changes

**User:** "Commit these changes"

**Scenario:** Changes span both API and web for execution context integration

**Generated message:** `feat(api,web): integrate execution context throughout system`

## Example 5: Refactoring

**User:** "Commit these changes"

**Scenario:** Refactored state management in LangGraph marketing agent

**Generated message:** `refactor(langgraph): improve marketing agent state management`

## Example 6: Bug Fix

**User:** "Commit these changes"

**Scenario:** Fixed execution context store update issue in web

**Generated message:** `fix(web): resolve execution context store update issue`

## Example 7: Documentation

**User:** "Commit these changes"

**Scenario:** Added cursor integration reference guide

**Generated message:** `docs(claude): add cursor integration reference guide`

