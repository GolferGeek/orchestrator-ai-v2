# Security Audit Checklist - Workstream 1C

**Quick Reference for Development Team**

---

## Critical Rules

- [ ] DO NOT modify security-critical files without adequate test coverage
- [ ] DO NOT merge PRs that reduce test coverage
- [ ] DO NOT disable security tests
- [ ] DO NOT commit real PII in test data
- [ ] DO fail-closed on errors (block, not allow)

---

## Files Under Security Review

### Cannot Be Modified (Inadequate Coverage)

- [ ] `/apps/api/src/auth/guards/jwt-auth.guard.ts` (15% coverage)
- [ ] `/apps/api/src/auth/guards/roles.guard.ts` (0% coverage)
- [ ] `/apps/api/src/llms/pii/pii.service.ts` (6% coverage)
- [ ] `/apps/api/src/llms/pii/dictionary-pseudonymizer.service.ts` (3% coverage)
- [ ] `/apps/api/src/llms/pii/pattern-redaction.service.ts` (6% coverage)

### Can Be Modified (Adequate Coverage)

- [X] `/apps/api/src/agent2agent/guards/api-key.guard.ts` (85% coverage)
  - But still needs branch coverage improvement

---

## Test Development Checklist

### Phase 1: Auth Guards Tests (Week 1)

#### JWT Auth Guard Tests
- [ ] Create `jwt-auth.guard.spec.ts`
- [ ] Token extraction tests (10+ cases)
- [ ] Token validation tests (15+ cases)
- [ ] API key authentication tests (10+ cases)
- [ ] Stream token tests (10+ cases)
- [ ] Public endpoint tests (5+ cases)
- [ ] Error handling tests (10+ cases)
- [ ] Integration tests (5+ cases)
- [ ] Achieve 90%+ lines coverage
- [ ] Achieve 85%+ branches coverage
- [ ] Run tests and verify passing

#### Roles Guard Tests
- [ ] Create `roles.guard.spec.ts`
- [ ] Role authorization tests (10+ cases)
- [ ] User profile validation tests (10+ cases)
- [ ] Database security tests (10+ cases)
- [ ] Role bypass prevention tests (10+ cases)
- [ ] Implicit role tests (10+ cases)
- [ ] Role decorator tests (10+ cases)
- [ ] Error handling tests (10+ cases)
- [ ] Integration tests (5+ cases)
- [ ] Achieve 90%+ lines coverage
- [ ] Achieve 85%+ branches coverage
- [ ] Run tests and verify passing

### Phase 2: PII Services Tests (Week 2)

#### PII Service Tests
- [ ] Create `pii.service.spec.ts`
- [ ] PII detection tests (15+ cases)
- [ ] Showstopper detection tests (10+ cases)
- [ ] Local provider tests (10+ cases)
- [ ] External provider tests (10+ cases)
- [ ] Error handling tests (10+ cases)
- [ ] Metadata generation tests (15+ cases)
- [ ] Integration tests (5+ cases)
- [ ] Achieve 85%+ lines coverage
- [ ] Achieve 80%+ branches coverage
- [ ] Run tests and verify passing

#### Dictionary Pseudonymizer Tests
- [ ] Create `dictionary-pseudonymizer.service.spec.ts`
- [ ] Dictionary loading tests (15+ cases)
- [ ] Pseudonymization tests (15+ cases)
- [ ] Reversal tests (10+ cases)
- [ ] Round-trip tests (10+ cases)
- [ ] Security tests (10+ cases)
- [ ] Achieve 85%+ lines coverage
- [ ] Achieve 80%+ branches coverage
- [ ] Run tests and verify passing

#### Pattern Redaction Tests
- [ ] Create `pattern-redaction.service.spec.ts`
- [ ] Pattern detection tests (10+ cases)
- [ ] Redaction tests (15+ cases)
- [ ] Reversal tests (10+ cases)
- [ ] Integration tests (10+ cases)
- [ ] Security tests (10+ cases)
- [ ] Achieve 85%+ lines coverage
- [ ] Achieve 80%+ branches coverage
- [ ] Run tests and verify passing

#### PII Integration Tests
- [ ] Create `__tests__/pii-integration.spec.ts`
- [ ] Full flow tests (10+ cases)
- [ ] Service coordination tests (10+ cases)
- [ ] Edge case tests (10+ cases)
- [ ] Performance tests (5+ cases)
- [ ] Error recovery tests (5+ cases)
- [ ] Run tests and verify passing

### Phase 3: Security Review (3-5 days)

- [ ] Schedule security expert review
- [ ] Provide all audit documents
- [ ] Review test cases for completeness
- [ ] Verify attack vectors covered
- [ ] Validate test quality
- [ ] Get approval to proceed with fixes

### Phase 4: Implement Fixes (Week 3)

#### JWT Auth Guard Fixes
- [ ] Fix token extraction validation
- [ ] Fix API key timing attack vulnerability
- [ ] Fix error handling information leakage
- [ ] Run tests after each fix
- [ ] Verify no regressions
- [ ] Update documentation

#### Roles Guard Fixes
- [ ] Fix role bypass vulnerability
- [ ] Fix user profile validation
- [ ] Fix database query security
- [ ] Fix implicit role logic
- [ ] Run tests after each fix
- [ ] Verify no regressions
- [ ] Update documentation

#### PII Service Fixes
- [ ] Fix local provider spoofing
- [ ] Fix fail-open error handling (make fail-closed)
- [ ] Fix PII detection validation
- [ ] Fix showstopper timing leaks
- [ ] Run tests after each fix
- [ ] Verify no regressions
- [ ] Update documentation

#### Dictionary Pseudonymizer Fixes
- [ ] Fix case-insensitive replacement issues
- [ ] Fix silent reversal failures
- [ ] Fix cache invalidation
- [ ] Fix dictionary merge conflicts
- [ ] Run tests after each fix
- [ ] Verify no regressions
- [ ] Update documentation

#### Pattern Redaction Fixes
- [ ] Fix index manipulation vulnerability
- [ ] Fix placeholder predictability
- [ ] Fix reversal ordering issues
- [ ] Run tests after each fix
- [ ] Verify no regressions
- [ ] Update documentation

### Phase 5: Security Regression Suite

- [ ] Create regression test suite
- [ ] Add to CI/CD pipeline
- [ ] Run on every commit
- [ ] Monitor coverage metrics
- [ ] Alert on coverage drops

---

## Coverage Requirements

### Minimum Thresholds

| Metric | Auth Guards | PII Services | Critical Paths |
|--------|-------------|--------------|----------------|
| Lines | 90%+ | 85%+ | 100% |
| Branches | 85%+ | 80%+ | 100% |
| Functions | 90%+ | 85%+ | 100% |

### Verification Commands

```bash
# Run tests with coverage
cd apps/api
npm test -- --coverage

# Check specific file coverage
npm test -- --coverage --collectCoverageFrom="src/auth/guards/jwt-auth.guard.ts"

# View coverage report
open coverage/lcov-report/index.html
```

---

## Security Testing Guidelines

### Do's

- ✓ Test all identified vulnerabilities
- ✓ Test error paths thoroughly
- ✓ Test edge cases and boundaries
- ✓ Test attack vectors explicitly
- ✓ Use realistic but fake PII
- ✓ Mock external dependencies
- ✓ Test concurrent scenarios
- ✓ Test performance under load
- ✓ Verify fail-closed behavior
- ✓ Audit all security decisions

### Don'ts

- ✗ Use real PII in tests
- ✗ Skip error path tests
- ✗ Assume happy path is enough
- ✗ Mock security-critical logic
- ✗ Disable security tests
- ✗ Commit sensitive data
- ✗ Skip integration tests
- ✗ Reduce coverage for convenience
- ✗ Trust user input
- ✗ Fail open on errors

---

## Test Quality Checklist

For each test case, verify:

- [ ] Clear test name describes what is tested
- [ ] Test is isolated (no dependencies on other tests)
- [ ] Test uses proper mocks
- [ ] Test verifies expected behavior
- [ ] Test verifies error cases
- [ ] Test uses realistic data
- [ ] Test runs quickly (<100ms)
- [ ] Test is repeatable (same result every time)
- [ ] Test cleans up after itself
- [ ] Test documents security concern if applicable

---

## Pre-Commit Checklist

Before committing changes to security files:

- [ ] All tests passing
- [ ] Coverage meets thresholds
- [ ] No real PII in code or tests
- [ ] No secrets in code
- [ ] Security review completed (if required)
- [ ] Documentation updated
- [ ] CHANGELOG updated
- [ ] No console.log statements left
- [ ] No TODO comments without tickets
- [ ] Linter passing
- [ ] Type checker passing

---

## Pre-PR Checklist

Before creating PR for security changes:

- [ ] All pre-commit items checked
- [ ] PR description explains changes
- [ ] PR references audit findings
- [ ] PR includes test results
- [ ] PR shows coverage improvements
- [ ] PR has no merge conflicts
- [ ] PR passes CI/CD checks
- [ ] Security review scheduled
- [ ] Screenshots/evidence attached
- [ ] Breaking changes documented

---

## Post-Deployment Checklist

After deploying security fixes:

- [ ] Monitor error logs for 24 hours
- [ ] Monitor authentication metrics
- [ ] Monitor PII processing metrics
- [ ] Verify no increase in auth failures
- [ ] Verify no increase in errors
- [ ] Verify performance not degraded
- [ ] Run smoke tests
- [ ] Update runbooks
- [ ] Notify security team
- [ ] Schedule follow-up review

---

## Emergency Contacts

### Security Issues
- **Security Team**: For vulnerability reports
- **On-Call**: For production incidents
- **Development Lead**: For technical decisions

### Escalation Path
1. Development team member discovers issue
2. Notify development lead immediately
3. Development lead notifies security team
4. Security team assesses severity
5. Incident response team activated if critical

---

## References

- [Security Audit Report](./SECURITY-AUDIT-REPORT.md) - Detailed findings
- [Auth Guards Test Requirements](./TEST-REQUIREMENTS-AUTH-GUARDS.md) - Test specs
- [PII Services Test Requirements](./TEST-REQUIREMENTS-PII-SERVICES.md) - Test specs
- [Security Audit Summary](./SECURITY-AUDIT-SUMMARY.md) - Executive summary

---

## Status Tracking

### Overall Progress

- [ ] Phase 1: Auth Guards Tests (0%)
- [ ] Phase 2: PII Services Tests (0%)
- [ ] Phase 3: Security Review (0%)
- [ ] Phase 4: Implement Fixes (0%)
- [ ] Phase 5: Regression Suite (0%)

### Test Coverage Status

| Component | Current | Target | Status |
|-----------|---------|--------|--------|
| jwt-auth.guard.ts | 15% | 90% | 🔴 |
| roles.guard.ts | 0% | 90% | 🔴 |
| api-key.guard.ts | 85% | 90% | 🟡 |
| pii.service.ts | 6% | 85% | 🔴 |
| dictionary-pseudonymizer | 3% | 85% | 🔴 |
| pattern-redaction | 6% | 85% | 🔴 |

Legend: 🔴 Inadequate | 🟡 Needs improvement | 🟢 Adequate

---

**Last Updated:** 2025-12-29
**Next Update:** After Phase 1 completion
