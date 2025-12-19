# Test Adequacy Determination

## Purpose

This document provides patterns for determining if tests are adequate for safe code fixes.

## Criteria for "Adequate Tests"

### 1. Unit Tests

**Requirements:**
- Unit tests exist for affected functions/methods
- Tests cover normal cases
- Tests cover edge cases
- Tests are meaningful (not just "should be defined")

**Check:**
- Search for test file (`.spec.ts`, `.test.ts`)
- Verify affected functions are tested
- Assess test quality

**Example:**
```typescript
// File: apps/api/src/auth/auth.service.ts
// Function: validateCredentials()
// Test file: apps/api/src/auth/auth.service.spec.ts
// ✅ Test exists and covers validateCredentials()
```

### 2. Integration Tests

**Requirements:**
- Integration tests exist for affected services/modules
- Tests cover service interactions
- Tests cover module integration
- Tests are meaningful

**Check:**
- Search for integration test files
- Verify affected services are tested
- Assess test coverage

**Example:**
```typescript
// File: apps/api/src/auth/auth.service.ts
// Integration test: apps/api/test/auth/auth.integration.spec.ts
// ✅ Test exists and covers AuthService integration
```

### 3. E2E Tests

**Requirements:**
- E2E tests exist for affected user flows (if applicable)
- Tests cover complete user flows
- Tests use real services (NO MOCKING)
- Tests use real authentication

**Check:**
- Search for E2E test files
- Verify affected flows are tested
- Verify tests use real services (e2e-testing-skill)

**Example:**
```typescript
// Flow: User login
// E2E test: apps/web/tests/e2e/auth/login.spec.ts
// ✅ Test exists and covers login flow with real services
```

### 4. Coverage Thresholds

**Requirements:**
- Lines: ≥75% (adequate)
- Branches: ≥70% (adequate)
- Functions: ≥75% (adequate)
- Critical paths: ≥85% (required)

**Check:**
- Run coverage analysis
- Verify thresholds met
- Check critical path coverage

**Example:**
```json
{
  "lines": 85,
  "branches": 80,
  "functions": 90,
  "adequate": true
}
```

### 5. Test Quality

**Requirements:**
- Tests are meaningful (not just "should be defined")
- Tests cover edge cases
- Tests are maintainable
- Tests follow E2E principles (if E2E tests)

**Check:**
- Review test content
- Verify edge cases covered
- Assess maintainability
- Verify E2E principles (if applicable)

## Decision Logic

### If All Criteria Met

**Action:**
- ✅ Auto-fix the issue
- ✅ Run tests to verify
- ✅ Commit changes

**Process:**
1. Make fix
2. Run unit tests
3. Run integration tests
4. Run E2E tests (if applicable)
5. Verify all tests pass
6. Commit changes

### If Any Criteria Missing

**Action:**
- ❌ Document the issue
- ❌ Include fix plan
- ❌ Specify required test coverage
- ❌ Do NOT make changes

**Process:**
1. Document issue clearly
2. Provide fix plan
3. Specify test requirements
4. List implementation steps
5. Do NOT make changes

## Examples

### Example 1: Adequate Tests

**Issue:** Code duplication in auth service

**Test Check:**
- ✅ Unit tests exist for auth service
- ✅ Integration tests exist for auth module
- ✅ E2E tests exist for auth flows
- ✅ Coverage: 85% lines, 80% branches, 90% functions
- ✅ Tests are meaningful

**Decision:** Auto-fix (extract common code)

### Example 2: Inadequate Tests

**Issue:** Tight coupling to Supabase

**Test Check:**
- ✅ Unit tests exist
- ❌ Integration tests missing for Supabase abstraction
- ❌ E2E tests missing for auth with different providers
- ✅ Coverage: 75% lines, 70% branches, 75% functions
- ✅ Tests are meaningful

**Decision:** Document issue (tests inadequate for architectural refactoring)

## Related

- **`codebase-hardening-skill/SKILL.md`** - Main skill definition
- **`AUTO_FIX_PATTERNS.md`** - Safe auto-fix patterns
- **`e2e-testing-skill/`** - E2E testing principles

