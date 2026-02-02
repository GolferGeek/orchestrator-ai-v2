# Codebase Hardening Work Plan

**Created:** 2026-02-02
**Target Completion:** 2026-04-01 (8 weeks)
**Current Health Score:** 72/100
**Target Health Score:** 90/100

---

## Executive Summary

This plan addresses 5 documented issues requiring development work. The primary gap is test coverage (API 17%, Web 24%), followed by PII security enhancements and architectural cleanup.

**Total Estimated Effort:** 12-14 weeks of work (can be parallelized)

---

## Phase 1: Security Foundation (Week 1-2)

### 1.1 Auth Service Tests (CRITICAL)
**Issue:** `api-16-services-no-tests`
**Priority:** P0 - Security boundary

**Tasks:**
- [ ] Create `apps/api/src/auth/auth.service.spec.ts`
  - [ ] Test login flow (valid/invalid credentials)
  - [ ] Test signup flow (validation, duplicates)
  - [ ] Test token refresh flow
  - [ ] Test password reset flow
  - [ ] Test session management
- [ ] Create `apps/api/src/auth/services/stream-token.service.spec.ts`
  - [ ] Test token generation
  - [ ] Test token validation
  - [ ] Test expiration handling
- [ ] Create `apps/api/src/rbac/rbac.service.spec.ts`
  - [ ] Test role assignment/removal
  - [ ] Test permission checks
  - [ ] Test privilege escalation prevention

**Acceptance Criteria:**
- 100% coverage for auth.service.ts
- 100% coverage for stream-token.service.ts
- 100% coverage for rbac.service.ts
- All security edge cases tested

**Estimated Effort:** 3-4 days

---

### 1.2 ExecutionContext Fix (HIGH)
**Issue:** `api-execution-context-flow`
**Priority:** P1 - Architecture compliance
**Blocked By:** 1.1 (needs WebhooksController tests)

**Tasks:**
- [ ] Create `apps/api/src/webhooks/webhooks.controller.spec.ts`
  - [ ] Test handleStatusUpdate with full context
  - [ ] Test storeAndBroadcastObservabilityEvent
  - [ ] Verify context passed without destructuring
- [ ] Create `apps/api/src/agent2agent/plans/services/plan-versions.service.spec.ts`
  - [ ] Test all public methods
  - [ ] Verify ExecutionContext usage
- [ ] Refactor WebhooksController (lines 125, 286)
  - [ ] Remove destructuring `const { userId, conversationId } = update.context`
  - [ ] Pass `update.context` directly to services
- [ ] Refactor PlanVersionsService (lines 47, 86, 104, 253)
  - [ ] Either pass full context or document as exception

**Acceptance Criteria:**
- No ExecutionContext destructuring in WebhooksController
- 80%+ coverage for both files
- All tests pass

**Estimated Effort:** 2-3 days

---

## Phase 2: PII Security (Week 3-4)

### 2.1 Column Encryption
**Issue:** `api-pii-pipeline-audit`
**Priority:** P1 - Data protection

**Tasks:**
- [ ] Add pgsodium extension to Supabase
- [ ] Create migration for `pseudonym_dictionaries` encryption
  ```sql
  ALTER TABLE pseudonym_dictionaries
  ADD COLUMN original_value_encrypted bytea;
  ```
- [ ] Update DictionaryPseudonymizerService to encrypt/decrypt
- [ ] Migrate existing data (encrypt then drop plaintext)
- [ ] Add tests for encryption/decryption

**Acceptance Criteria:**
- No plaintext PII in `pseudonym_dictionaries`
- Encryption/decryption transparent to service layer
- Migration reversible

**Estimated Effort:** 3-4 days

---

### 2.2 Data Retention Policy
**Issue:** `api-pii-pipeline-audit`
**Priority:** P1 - GDPR compliance

**Tasks:**
- [ ] Add `expires_at` column to `pseudonym_mappings`
  ```sql
  ALTER TABLE pseudonym_mappings
  ADD COLUMN expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '90 days';
  ```
- [ ] Create cleanup job (daily cron or pg_cron)
- [ ] Add retention policy configuration
- [ ] Create user deletion endpoint `DELETE /api/llm/sanitization/delete-my-data`
- [ ] Add tests for retention and deletion

**Acceptance Criteria:**
- Mappings auto-expire after 90 days
- Users can delete their data
- Cleanup job runs daily

**Estimated Effort:** 2-3 days

---

### 2.3 Fail-Closed in Production
**Issue:** `api-pii-pipeline-audit`
**Priority:** P1 - Security posture

**Tasks:**
- [ ] Update `PIIService.checkPolicy()` to fail closed
  ```typescript
  catch (error) {
    if (process.env.NODE_ENV === 'production') {
      throw new ServiceUnavailableException('PII service unavailable');
    }
    return this.allowRequest(); // Dev only
  }
  ```
- [ ] Add alerting for PII service failures
- [ ] Create incident runbook
- [ ] Add tests for fail-closed behavior

**Acceptance Criteria:**
- Production blocks requests on PII check failure
- Alerts fire on service errors
- Runbook documented

**Estimated Effort:** 1 day

---

## Phase 3: API Test Coverage (Week 5-8)

### 3.1 Prediction Runner Tests
**Issue:** `api-16-services-no-tests`
**Priority:** P1 - Core business logic
**Services:** 59 (0% coverage)

**Week 5 Tasks:**
- [ ] prediction-generation.service.spec.ts
- [ ] analyst-ensemble.service.spec.ts
- [ ] signal-detection.service.spec.ts
- [ ] outcome-tracking.service.spec.ts

**Week 6 Tasks:**
- [ ] baseline-prediction.service.spec.ts
- [ ] learning.service.spec.ts
- [ ] predictor-management.service.spec.ts
- [ ] evaluation.service.spec.ts

**Target:** 60% coverage for prediction-runner module

**Estimated Effort:** 8-10 days

---

### 3.2 Risk Runner Tests
**Issue:** `api-16-services-no-tests`
**Priority:** P1 - Core business logic
**Services:** 16 (0% coverage)

**Tasks:**
- [ ] risk-analysis.service.spec.ts
- [ ] portfolio-risk.service.spec.ts
- [ ] risk-evaluation.service.spec.ts
- [ ] score-aggregation.service.spec.ts
- [ ] monte-carlo.service.spec.ts
- [ ] scenario-analysis.service.spec.ts

**Target:** 60% coverage for risk-runner module

**Estimated Effort:** 4-5 days

---

### 3.3 LLM Service Tests
**Issue:** `api-16-services-no-tests`
**Priority:** P2 - Foundation services
**Services:** 32 untested

**Tasks:**
- [ ] llm.service.spec.ts (orchestration)
- [ ] base-llm.service.spec.ts
- [ ] anthropic-llm.service.spec.ts
- [ ] openai-llm.service.spec.ts
- [ ] google-llm.service.spec.ts
- [ ] memory-manager.service.spec.ts

**Target:** 50% coverage for llm module

**Estimated Effort:** 5-6 days

---

### 3.4 RAG Service Tests
**Issue:** `api-16-services-no-tests`
**Priority:** P2 - Data processing
**Services:** 10 (0% coverage)

**Tasks:**
- [ ] document-processor.service.spec.ts
- [ ] chunking.service.spec.ts
- [ ] embedding.service.spec.ts
- [ ] query.service.spec.ts
- [ ] collections.service.spec.ts

**Target:** 60% coverage for rag module

**Estimated Effort:** 3-4 days

---

## Phase 4: Web Test Coverage (Week 7-10)

### 4.1 Critical Services
**Issue:** `web-low-test-coverage`
**Priority:** P1 - Core functionality

**Tasks:**
- [ ] apiService.spec.ts (1,183 lines)
- [ ] predictionDashboardService.spec.ts (3,607 lines)
- [ ] riskDashboardService.spec.ts (1,042 lines)
- [ ] privacyService.spec.ts (971 lines)

**Target:** 60% coverage for services directory

**Estimated Effort:** 6-8 days

---

### 4.2 Critical Stores
**Issue:** `web-low-test-coverage`
**Priority:** P2 - State management

**Tasks:**
- [ ] privacyStore.spec.ts (1,050 lines)
- [ ] llmPreferencesStore.spec.ts (952 lines)
- [ ] riskDashboardStore.spec.ts (742 lines)
- [ ] analyticsStore.spec.ts (709 lines)

**Target:** 50% coverage for stores directory

**Estimated Effort:** 4-5 days

---

### 4.3 Store Architecture Refactor
**Issue:** `web-async-in-stores`
**Priority:** P3 - Architecture cleanup

**Tasks:**
- [ ] Refactor adminEvaluationStore (30 API refs → service)
- [ ] Refactor llmPreferencesStore (28 API refs → service)
- [ ] Refactor llmAnalyticsStore (22 API refs → service)
- [ ] Refactor evaluationsStore (9 API refs → service)
- [ ] Update all callers

**Target:** All stores follow state-only pattern

**Estimated Effort:** 4-5 days

---

## Milestone Summary

| Milestone | Week | Deliverable | Health Impact |
|-----------|------|-------------|---------------|
| Phase 1 Complete | 2 | Auth tested, ExecutionContext fixed | +5 points |
| Phase 2 Complete | 4 | PII secured, GDPR compliant | +5 points |
| Phase 3 Complete | 8 | API 50%+ coverage | +5 points |
| Phase 4 Complete | 10 | Web 40%+ coverage, stores clean | +3 points |
| **Total** | **10** | **All issues resolved** | **72 → 90** |

---

## Resource Requirements

### Parallelization Options

**Option A: Sequential (1 developer)**
- Total: 10-12 weeks
- Lower risk, easier coordination

**Option B: Parallel (2 developers)**
- Dev 1: Phase 1 + Phase 3 (API focus)
- Dev 2: Phase 2 + Phase 4 (Web + PII focus)
- Total: 5-6 weeks

**Option C: Swarm (3+ developers)**
- Can complete in 3-4 weeks
- Requires coordination overhead

### Tools Needed
- Jest for unit tests
- Supabase pgsodium for encryption
- Coverage reporting (already in CI)

---

## Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| API Test Coverage | 17% | 60% | `npm run test:cov --workspace=api` |
| Web Test Coverage | 24% | 50% | `npm run test:cov --workspace=web` |
| Security Issues | 5 | 0 | Hardening scan |
| Health Score | 72 | 90 | `/monitor` command |

---

## Risk Register

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Test writing slower than estimated | Medium | Schedule slip | Start with critical paths |
| PII migration data loss | Low | High | Backup before migration |
| Breaking changes during refactor | Medium | Medium | Run tests after each change |
| Scope creep | Medium | Schedule slip | Strict PR scope |

---

## Weekly Checkpoints

- **Week 2:** Phase 1 complete, security foundation solid
- **Week 4:** Phase 2 complete, PII hardened
- **Week 6:** API coverage at 40%+
- **Week 8:** API coverage at 50%+, Phase 3 complete
- **Week 10:** All phases complete, health score 90+

---

## Commands

```bash
# Run API tests with coverage
npm run test:cov --workspace=api

# Run Web tests with coverage
npm run test:cov --workspace=web

# Check hardening status
/monitor --quality

# View quality issues
/quality-status
```

---

## Approval

- [ ] Work plan reviewed
- [ ] Resources allocated
- [ ] Timeline accepted
- [ ] Start date confirmed

**Plan Owner:** Engineering Team
**Review Date:** ___________
**Start Date:** ___________
