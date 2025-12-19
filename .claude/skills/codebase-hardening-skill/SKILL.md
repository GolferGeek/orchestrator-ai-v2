---
description: Patterns and validation for codebase hardening. Use when fixing issues, addressing architectural problems, or improving code quality. Keywords: hardening, auto-fix, issue fixing, architectural refactoring, code quality.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

# Codebase Hardening Skill

## Purpose

This skill provides patterns and validation for codebase hardening. It enables agents to determine test adequacy, safely auto-fix issues, document issues when tests are inadequate, and address architectural decisions.

## When to Use

- **Test Adequacy Checking**: When determining if tests are sufficient for safe fixes
- **Auto-Fixing**: When making automated fixes to code
- **Issue Documentation**: When documenting issues that can't be fixed yet
- **Architectural Hardening**: When addressing architectural decisions

## Core Principles

### 1. Test Adequacy Determination

**Criteria for "Adequate Tests":**
1. **Unit Tests**: Exist for affected functions/methods
2. **Integration Tests**: Exist for affected services/modules
3. **E2E Tests**: Exist for affected user flows (if applicable)
4. **Coverage Thresholds**:
   - Lines: ≥75%
   - Branches: ≥70%
   - Functions: ≥75%
5. **Test Quality**: Tests are meaningful (not just "should be defined")

**If Tests Adequate:**
- ✅ Auto-fix the issue
- ✅ Run tests to verify
- ✅ Commit changes

**If Tests Inadequate:**
- ❌ Document the issue
- ❌ Include fix plan
- ❌ Specify required test coverage
- ❌ Do NOT make changes

### 2. Auto-Fix Safety

**Only Fix If:**
- Tests are adequate (see criteria above)
- Tests can verify the change
- Fix maintains ExecutionContext flow
- Fix maintains A2A compliance
- Fix follows architecture patterns

**Safety Checks:**
- ✅ ExecutionContext flow maintained (execution-context-skill)
- ✅ A2A compliance maintained (transport-types-skill)
- ✅ Architecture patterns followed (architecture skills)
- ✅ Tests pass after fix
- ✅ No breaking changes

### 3. Issue Documentation

**When Tests Inadequate:**
- Document the issue clearly
- Provide detailed fix plan
- Specify required test coverage
- List implementation steps
- Identify related files

**Documentation Format:**
- Problem description
- Proposed solution
- Required test coverage
- Implementation steps
- Related files

### 4. Architectural Hardening

**For Architectural Refactorings:**
- Understand current state
- Design solution
- Check test adequacy
- If adequate: Implement incrementally
- If inadequate: Document with test requirements

**Example: Supabase Separation**
- Create abstraction interfaces
- Implement providers
- Use dependency injection
- Migrate incrementally
- Remove direct usage

## Auto-Fix Patterns

### Pattern 1: Code Smell Fixes

**If Tests Adequate:**
- Fix long methods (extract functions)
- Fix deep nesting (refactor logic)
- Fix code duplication (extract common code)
- Fix poor naming (rename for clarity)

**Safety:**
- Run tests after each fix
- Verify behavior unchanged
- Maintain patterns

### Pattern 2: Architecture Fixes

**If Tests Adequate:**
- Fix misplaced files (move to correct location)
- Fix layer violations (move logic to correct layer)
- Fix missing abstractions (create interfaces)
- Fix tight coupling (introduce dependency injection)

**Safety:**
- Maintain ExecutionContext flow
- Maintain A2A compliance
- Follow architecture patterns
- Run tests after fix

### Pattern 3: Security Fixes

**If Tests Adequate:**
- Fix exposed secrets (move to environment variables)
- Fix unsafe operations (add validation)
- Fix missing authentication (add auth checks)
- Fix vulnerable dependencies (update dependencies)

**Safety:**
- Verify security improvement
- Run security tests
- Maintain functionality
- Document security changes

## Documentation Patterns

### Issue Documentation Structure

```markdown
# Issue #[id]: [Issue Title]

## Problem
[Detailed problem description]

## Proposed Solution
[Detailed solution approach]

## Required Test Coverage
- Unit tests: [requirements]
- Integration tests: [requirements]
- E2E tests: [requirements]

## Implementation Steps
1. [Step 1]
2. [Step 2]
3. [Step 3]

## Related Files
- [file1.ts]
- [file2.ts]
```

### Refactoring Documentation Structure

```markdown
# Refactoring: [Name]

## Current State
[Description of current implementation]

## Target State
[Description of desired implementation]

## Required Test Coverage
[Test requirements for refactoring]

## Implementation Phases
1. Phase 1: [Description]
2. Phase 2: [Description]
3. Phase 3: [Description]

## Related Issues
- Issue #[id]: [Description]
- Issue #[id]: [Description]
```

## Related

- **`codebase-hardening-agent.md`** - Uses this skill
- **`TEST_ADEQUACY.md`** - Test adequacy determination
- **`AUTO_FIX_PATTERNS.md`** - Safe auto-fix patterns
- **`DOCUMENTATION_PATTERNS.md`** - Issue documentation patterns
- **`ARCHITECTURAL_HARDENING.md`** - Architectural improvement patterns

