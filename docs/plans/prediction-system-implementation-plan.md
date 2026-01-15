# Prediction System Implementation Plan

## Document Metadata
- **PRD Source:** `docs/prds/prediction-system-scenarios-prd.md`
- **Generated:** 2026-01-12
- **Status:** Ready for Implementation
- **Target Branch:** feature/FinanceAgent

---

## Sprint 1: Core Demo Flow

### S1.1 - Universe CRUD E2E Tests
**Priority:** High
**Status:** Not Started
**Dependencies:** None

| Task ID | Task Description | File(s) | Type | Effort |
|---------|------------------|---------|------|--------|
| S1.1.1 | Create E2E test for universe.create action | `apps/api/testing/test/integration/prediction-universe.e2e-spec.ts` | Create | S |
| S1.1.2 | Create E2E test for universe.update action | `apps/api/testing/test/integration/prediction-universe.e2e-spec.ts` | Modify | S |
| S1.1.3 | Create E2E test for universe.delete action | `apps/api/testing/test/integration/prediction-universe.e2e-spec.ts` | Modify | S |
| S1.1.4 | Add domain validation (stocks, crypto, elections, polymarket) | `apps/api/src/prediction-runner/task-router/handlers/universe.handler.ts` | Modify | S |

### S1.2 - Target CRUD with T_ Mirror Verification
**Priority:** High
**Status:** Not Started
**Dependencies:** S1.1

| Task ID | Task Description | File(s) | Type | Effort |
|---------|------------------|---------|------|--------|
| S1.2.1 | Create E2E test for target.create action | `apps/api/testing/test/integration/prediction-target.e2e-spec.ts` | Create | S |
| S1.2.2 | Create E2E test verifying T_ mirror auto-creation | `apps/api/testing/test/integration/prediction-target.e2e-spec.ts` | Modify | M |
| S1.2.3 | Verify database trigger `auto_create_test_mirror` fires correctly | `apps/api/testing/test/integration/prediction-target.e2e-spec.ts` | Modify | S |
| S1.2.4 | Test T_ mirror appears in `test-target-mirrors.list` | `apps/api/testing/test/integration/prediction-target.e2e-spec.ts` | Modify | S |

### S1.3 - Source CRUD E2E Tests
**Priority:** High
**Status:** Not Started
**Dependencies:** S1.2

| Task ID | Task Description | File(s) | Type | Effort |
|---------|------------------|---------|------|--------|
| S1.3.1 | Create E2E test for source.create (RSS feed) | `apps/api/testing/test/integration/prediction-source.e2e-spec.ts` | Create | M |
| S1.3.2 | Create E2E test for source.create (news site via Firecrawl) | `apps/api/testing/test/integration/prediction-source.e2e-spec.ts` | Modify | M |
| S1.3.3 | Add crawl_frequency_minutes support verification | `apps/api/testing/test/integration/prediction-source.e2e-spec.ts` | Modify | S |
| S1.3.4 | Test source.testCrawl action | `apps/api/testing/test/integration/prediction-source.e2e-spec.ts` | Modify | S |

### S1.4 - Source Seen Items Handler (Deduplication Visibility)
**Priority:** Medium
**Status:** Not Started
**Dependencies:** S1.3

| Task ID | Task Description | File(s) | Type | Effort |
|---------|------------------|---------|------|--------|
| S1.4.1 | Create source-seen-items.handler.ts | `apps/api/src/prediction-runner/task-router/handlers/source-seen-items.handler.ts` | Create | M |
| S1.4.2 | Implement `source-seen-items.list` action | `apps/api/src/prediction-runner/task-router/handlers/source-seen-items.handler.ts` | Modify | S |
| S1.4.3 | Implement `source-seen-items.stats` action | `apps/api/src/prediction-runner/task-router/handlers/source-seen-items.handler.ts` | Modify | S |
| S1.4.4 | Register handler in prediction-dashboard.router.ts | `apps/api/src/prediction-runner/task-router/prediction-dashboard.router.ts` | Modify | S |
| S1.4.5 | E2E test for deduplication flow | `apps/api/testing/test/integration/prediction-source-dedup.e2e-spec.ts` | Create | M |
| S1.4.6 | Verify `check_content_hash_for_target` RPC function exists | Database migration verification | Verify | S |

### S1.5 - Signals Handler for Dashboard Access
**Priority:** High
**Status:** Not Started
**Dependencies:** S1.4

| Task ID | Task Description | File(s) | Type | Effort |
|---------|------------------|---------|------|--------|
| S1.5.1 | Create signals.handler.ts | `apps/api/src/prediction-runner/task-router/handlers/signals.handler.ts` | Create | M |
| S1.5.2 | Implement `signals.list` action with filters | `apps/api/src/prediction-runner/task-router/handlers/signals.handler.ts` | Modify | S |
| S1.5.3 | Implement `signals.get` action with fingerprint | `apps/api/src/prediction-runner/task-router/handlers/signals.handler.ts` | Modify | S |
| S1.5.4 | Register handler in prediction-dashboard.router.ts | `apps/api/src/prediction-runner/task-router/prediction-dashboard.router.ts` | Modify | S |

### S1.6 - Real-time Event Emission (Backend)
**Priority:** High
**Status:** Not Started
**Dependencies:** S1.5

| Task ID | Task Description | File(s) | Type | Effort |
|---------|------------------|---------|------|--------|
| S1.6.1 | Add ObservabilityEventsService to source-crawler.runner.ts | `apps/api/src/prediction-runner/runners/source-crawler.runner.ts` | Modify | M |
| S1.6.2 | Emit `source.crawl.started` event | `apps/api/src/prediction-runner/runners/source-crawler.runner.ts` | Modify | S |
| S1.6.3 | Emit `source.crawl.completed` event | `apps/api/src/prediction-runner/runners/source-crawler.runner.ts` | Modify | S |
| S1.6.4 | Emit `article.discovered` event in source-crawler.service.ts | `apps/api/src/prediction-runner/services/source-crawler.service.ts` | Modify | M |
| S1.6.5 | Emit `article.duplicate` event for dedup | `apps/api/src/prediction-runner/services/source-crawler.service.ts` | Modify | S |
| S1.6.6 | Emit `signal.detected` event in signal-detection.service.ts | `apps/api/src/prediction-runner/services/signal-detection.service.ts` | Modify | M |
| S1.6.7 | Emit `predictor.ready` event in predictor-management.service.ts | `apps/api/src/prediction-runner/services/predictor-management.service.ts` | Modify | S |
| S1.6.8 | Emit `prediction.created` event in prediction-generation.service.ts | `apps/api/src/prediction-runner/services/prediction-generation.service.ts` | Modify | M |

### S1.7 - Real-time Prediction Activity Feed (Frontend)
**Priority:** High
**Status:** Not Started
**Dependencies:** S1.6

| Task ID | Task Description | File(s) | Type | Effort |
|---------|------------------|---------|------|--------|
| S1.7.1 | Create PredictionActivityFeed.vue component | `apps/web/src/components/prediction/PredictionActivityFeed.vue` | Create | L |
| S1.7.2 | Add event type filter toggles (Articles, Signals, Predictors, Predictions) | `apps/web/src/components/prediction/PredictionActivityFeed.vue` | Modify | M |
| S1.7.3 | Add "Watch Activity" button to PredictionDashboard.vue | `apps/web/src/views/prediction/PredictionDashboard.vue` | Modify | S |
| S1.7.4 | Reuse AdminEventRow pattern with yellow highlight animation | `apps/web/src/components/prediction/PredictionActivityFeed.vue` | Modify | S |
| S1.7.5 | Add row click to open appropriate detail modal | `apps/web/src/components/prediction/PredictionActivityFeed.vue` | Modify | M |
| S1.7.6 | Add "Clear" and "Pause/Resume" controls | `apps/web/src/components/prediction/PredictionActivityFeed.vue` | Modify | S |
| S1.7.7 | Ensure mobile-responsive design | `apps/web/src/components/prediction/PredictionActivityFeed.vue` | Modify | S |

### S1.8 - Prediction Deep-Dive with Full Lineage
**Priority:** Medium
**Status:** Partial
**Dependencies:** S1.7

| Task ID | Task Description | File(s) | Type | Effort |
|---------|------------------|---------|------|--------|
| S1.8.1 | Ensure prediction.get includes source article reference | `apps/api/src/prediction-runner/task-router/handlers/prediction.handler.ts` | Modify | S |
| S1.8.2 | Include signal fingerprint in prediction response | `apps/api/src/prediction-runner/task-router/handlers/prediction.handler.ts` | Modify | S |
| S1.8.3 | Include analyst reasoning and strategy used | `apps/api/src/prediction-runner/task-router/handlers/prediction.handler.ts` | Modify | M |
| S1.8.4 | Create E2E test for prediction deep-dive | `apps/api/testing/test/integration/prediction-deep-dive.e2e-spec.ts` | Create | M |

---

## Sprint 2: Evaluation & Learning

### S2.1 - Review Queue & Evaluation Workflow
**Priority:** High
**Status:** Partial
**Dependencies:** Sprint 1

| Task ID | Task Description | File(s) | Type | Effort |
|---------|------------------|---------|------|--------|
| S2.1.1 | Verify review-queue.handler exists and has list action | `apps/api/src/prediction-runner/task-router/handlers/review-queue.handler.ts` | Verify | S |
| S2.1.2 | Add filter by ready-for-evaluation status | `apps/api/src/prediction-runner/task-router/handlers/review-queue.handler.ts` | Modify | S |
| S2.1.3 | Create E2E test for review queue | `apps/api/testing/test/integration/prediction-review-queue.e2e-spec.ts` | Create | M |
| S2.1.4 | Emit `prediction.evaluated` event in evaluation.service.ts | `apps/api/src/prediction-runner/services/evaluation.service.ts` | Modify | M |

### S2.2 - Manual Evaluation Override
**Priority:** Medium
**Status:** Not Started
**Dependencies:** S2.1

| Task ID | Task Description | File(s) | Type | Effort |
|---------|------------------|---------|------|--------|
| S2.2.1 | Add `predictions.override-evaluation` action | `apps/api/src/prediction-runner/task-router/handlers/prediction.handler.ts` | Modify | M |
| S2.2.2 | Create ManualEvaluationModal.vue component | `apps/web/src/components/prediction/ManualEvaluationModal.vue` | Create | M |
| S2.2.3 | E2E test for manual evaluation override | `apps/api/testing/test/integration/prediction-evaluation.e2e-spec.ts` | Modify | S |

### S2.3 - Learning Queue Review Flow
**Priority:** High
**Status:** Partial
**Dependencies:** S2.1

| Task ID | Task Description | File(s) | Type | Effort |
|---------|------------------|---------|------|--------|
| S2.3.1 | Verify learning-queue.handler actions | `apps/api/src/prediction-runner/task-router/handlers/learning-queue.handler.ts` | Verify | S |
| S2.3.2 | E2E test for learning-queue.list | `apps/api/testing/test/integration/prediction-learning-queue.e2e-spec.ts` | Create | M |
| S2.3.3 | E2E test for learning-queue.respond | `apps/api/testing/test/integration/prediction-learning-queue.e2e-spec.ts` | Modify | M |

### S2.4 - Missed Opportunity Detection
**Priority:** Medium
**Status:** Partial
**Dependencies:** S2.1

| Task ID | Task Description | File(s) | Type | Effort |
|---------|------------------|---------|------|--------|
| S2.4.1 | Verify missed-opportunity.handler actions | `apps/api/src/prediction-runner/task-router/handlers/missed-opportunity.handler.ts` | Verify | S |
| S2.4.2 | E2E test for missed opportunity detection | `apps/api/testing/test/integration/prediction-missed-opportunity.e2e-spec.ts` | Create | M |
| S2.4.3 | Unit tests for missed-opportunity-analysis.service | `apps/api/src/prediction-runner/services/__tests__/missed-opportunity-analysis.service.spec.ts` | Create | M |

### S2.5 - Learning Promotion with Lineage Tracking
**Priority:** High
**Status:** Partial
**Dependencies:** S2.3, S2.4

| Task ID | Task Description | File(s) | Type | Effort |
|---------|------------------|---------|------|--------|
| S2.5.1 | E2E test for learning-promotion.validate | `apps/api/testing/test/integration/prediction-learning-promotion.e2e-spec.ts` | Create | M |
| S2.5.2 | E2E test for learning-promotion.promote | `apps/api/testing/test/integration/prediction-learning-promotion.e2e-spec.ts` | Modify | M |
| S2.5.3 | E2E test for learning-promotion.reject | `apps/api/testing/test/integration/prediction-learning-promotion.e2e-spec.ts` | Modify | S |
| S2.5.4 | Emit `learning.promoted` event | `apps/api/src/prediction-runner/services/learning-promotion.service.ts` | Modify | S |
| S2.5.5 | E2E test for lineage tracking via learning-lineage.repository | `apps/api/testing/test/integration/prediction-learning-lineage.e2e-spec.ts` | Create | M |

### S2.6 - Analytics by Analyst/Strategy/Target
**Priority:** Medium
**Status:** Partial
**Dependencies:** S2.5

| Task ID | Task Description | File(s) | Type | Effort |
|---------|------------------|---------|------|--------|
| S2.6.1 | Add accuracy-by-strategy to analytics.handler | `apps/api/src/prediction-runner/task-router/handlers/analytics.handler.ts` | Modify | M |
| S2.6.2 | Add accuracy-by-target to analytics.handler | `apps/api/src/prediction-runner/task-router/handlers/analytics.handler.ts` | Modify | M |
| S2.6.3 | Add learning impact metrics to analytics | `apps/api/src/prediction-runner/task-router/handlers/analytics.handler.ts` | Modify | M |
| S2.6.4 | E2E test for analytics endpoints | `apps/api/testing/test/integration/prediction-analytics.e2e-spec.ts` | Create | M |

---

## Sprint 3: Test Framework

### S3.1 - Test Scenario Creation and Execution
**Priority:** High
**Status:** Partial
**Dependencies:** Sprint 2

| Task ID | Task Description | File(s) | Type | Effort |
|---------|------------------|---------|------|--------|
| S3.1.1 | E2E test for test-scenarios.create | `apps/api/testing/test/integration/prediction-test-scenarios.e2e-spec.ts` | Create | M |
| S3.1.2 | Verify test-scenarios.create action works correctly | `apps/api/src/prediction-runner/task-router/handlers/test-scenario.handler.ts` | Verify | S |
| S3.1.3 | E2E test for test-scenarios.run | `apps/api/testing/test/integration/prediction-test-scenarios.e2e-spec.ts` | Modify | M |
| S3.1.4 | Emit `test.completed` event | `apps/api/src/prediction-runner/services/scenario-run.service.ts` | Modify | S |

### S3.2 - Synthetic Data Injection
**Priority:** High
**Status:** Partial
**Dependencies:** S3.1

| Task ID | Task Description | File(s) | Type | Effort |
|---------|------------------|---------|------|--------|
| S3.2.1 | E2E test for test-articles.create (synthetic article injection) | `apps/api/testing/test/integration/prediction-test-articles.e2e-spec.ts` | Create | M |
| S3.2.2 | E2E test for test-price-data.create (price data injection) | `apps/api/testing/test/integration/prediction-test-price-data.e2e-spec.ts` | Create | M |
| S3.2.3 | Verify AI article generation via ai-article-generator.service | `apps/api/src/prediction-runner/services/__tests__/ai-article-generator.service.spec.ts` | Create | M |
| S3.2.4 | E2E test for scenario variation creation | `apps/api/testing/test/integration/prediction-test-scenarios.e2e-spec.ts` | Modify | M |

### S3.3 - T_ Prediction Verification
**Priority:** High
**Status:** Partial
**Dependencies:** S3.2

| Task ID | Task Description | File(s) | Type | Effort |
|---------|------------------|---------|------|--------|
| S3.3.1 | E2E test verifying T_ predictions are created from test scenarios | `apps/api/testing/test/integration/prediction-test-flow.e2e-spec.ts` | Create | L |
| S3.3.2 | E2E test for scenario evaluation against T_ targets | `apps/api/testing/test/integration/prediction-test-flow.e2e-spec.ts` | Modify | M |

### S3.4 - Scenario vs Production Comparison
**Priority:** Medium
**Status:** Not Started
**Dependencies:** S3.3

| Task ID | Task Description | File(s) | Type | Effort |
|---------|------------------|---------|------|--------|
| S3.4.1 | Add `test-scenarios.compare` action | `apps/api/src/prediction-runner/task-router/handlers/test-scenario.handler.ts` | Modify | L |
| S3.4.2 | Create ScenarioComparisonView.vue component | `apps/web/src/views/prediction/test/ScenarioComparisonView.vue` | Create | L |
| S3.4.3 | E2E test for scenario comparison | `apps/api/testing/test/integration/prediction-test-comparison.e2e-spec.ts` | Create | M |

### S3.5 - Batch Scenario Variations
**Priority:** Low
**Status:** Not Started
**Dependencies:** S3.4

| Task ID | Task Description | File(s) | Type | Effort |
|---------|------------------|---------|------|--------|
| S3.5.1 | Add `test-scenarios.batch-run` action | `apps/api/src/prediction-runner/task-router/handlers/test-scenario.handler.ts` | Modify | M |
| S3.5.2 | Create batch runner service | `apps/api/src/prediction-runner/services/scenario-batch-runner.service.ts` | Create | L |
| S3.5.3 | E2E test for batch scenario runs | `apps/api/testing/test/integration/prediction-test-batch.e2e-spec.ts` | Create | M |

---

## Sprint 4: Monitoring & Polish

### S4.1 - Source Crawl Status Dashboard
**Priority:** Medium
**Status:** Not Started
**Dependencies:** Sprint 3

| Task ID | Task Description | File(s) | Type | Effort |
|---------|------------------|---------|------|--------|
| S4.1.1 | Add `sources.crawl-status` action | `apps/api/src/prediction-runner/task-router/handlers/source.handler.ts` | Modify | M |
| S4.1.2 | Create SourceCrawlStatus.vue component | `apps/web/src/components/prediction/SourceCrawlStatus.vue` | Create | M |
| S4.1.3 | Show last_crawl_at, next_crawl_at per source | `apps/web/src/components/prediction/SourceCrawlStatus.vue` | Modify | S |
| S4.1.4 | Add signal detection rate metric | `apps/api/src/prediction-runner/task-router/handlers/analytics.handler.ts` | Modify | M |

### S4.2 - Prediction Volume Metrics
**Priority:** Medium
**Status:** Partial
**Dependencies:** S4.1

| Task ID | Task Description | File(s) | Type | Effort |
|---------|------------------|---------|------|--------|
| S4.2.1 | Add predictions-per-day to analytics.handler | `apps/api/src/prediction-runner/task-router/handlers/analytics.handler.ts` | Modify | S |
| S4.2.2 | Add accuracy trends to analytics.handler | `apps/api/src/prediction-runner/task-router/handlers/analytics.handler.ts` | Modify | M |
| S4.2.3 | E2E test for trend analytics | `apps/api/testing/test/integration/prediction-analytics.e2e-spec.ts` | Modify | S |

### S4.3 - Alert System for Failures
**Priority:** Medium
**Status:** Not Started
**Dependencies:** S4.1

| Task ID | Task Description | File(s) | Type | Effort |
|---------|------------------|---------|------|--------|
| S4.3.1 | Create alert.service.ts | `apps/api/src/prediction-runner/services/alert.service.ts` | Create | M |
| S4.3.2 | Add alert for crawl failures (consecutive errors threshold) | `apps/api/src/prediction-runner/services/alert.service.ts` | Modify | M |
| S4.3.3 | Add alert for unusual patterns (anomaly detection) | `apps/api/src/prediction-runner/services/alert.service.ts` | Modify | L |
| S4.3.4 | Integrate alerts with notification.service | `apps/api/src/prediction-runner/services/notification.service.ts` | Modify | M |

### S4.4 - Administration Features
**Priority:** Low
**Status:** Partial
**Dependencies:** S4.2

| Task ID | Task Description | File(s) | Type | Effort |
|---------|------------------|---------|------|--------|
| S4.4.1 | Add pause/resume crawling for sources | `apps/api/src/prediction-runner/task-router/handlers/source.handler.ts` | Modify | S |
| S4.4.2 | E2E test for target deactivation | `apps/api/testing/test/integration/prediction-admin.e2e-spec.ts` | Create | S |
| S4.4.3 | Add export predictions endpoint | `apps/api/src/prediction-runner/task-router/handlers/prediction.handler.ts` | Modify | M |
| S4.4.4 | Create audit-log.handler for dashboard visibility | `apps/api/src/prediction-runner/task-router/handlers/audit-log.handler.ts` | Create | M |

### S4.5 - Slack Notifications Integration
**Priority:** Low
**Status:** Not Started
**Dependencies:** S4.3

| Task ID | Task Description | File(s) | Type | Effort |
|---------|------------------|---------|------|--------|
| S4.5.1 | Research Slack Incoming Webhooks setup | Documentation | Research | S |
| S4.5.2 | Add slack section to notification.service.ts | `apps/api/src/prediction-runner/services/notification.service.ts` | Modify | M |
| S4.5.3 | Add Slack webhook URL to universe config | `apps/api/src/prediction-runner/interfaces/universe.interface.ts` | Modify | S |
| S4.5.4 | Format Slack messages with emoji and links | `apps/api/src/prediction-runner/services/notification.service.ts` | Modify | M |
| S4.5.5 | E2E test with mock Slack webhook | `apps/api/testing/test/integration/prediction-slack.e2e-spec.ts` | Create | M |

### S4.6 - Handler Unit Tests
**Priority:** Medium
**Status:** Not Started
**Dependencies:** All above

| Task ID | Task Description | File(s) | Type | Effort |
|---------|------------------|---------|------|--------|
| S4.6.1 | Unit tests for analyst.handler | `apps/api/src/prediction-runner/task-router/handlers/__tests__/analyst.handler.spec.ts` | Create | M |
| S4.6.2 | Unit tests for strategy.handler | `apps/api/src/prediction-runner/task-router/handlers/__tests__/strategy.handler.spec.ts` | Create | M |
| S4.6.3 | Unit tests for source.handler | `apps/api/src/prediction-runner/task-router/handlers/__tests__/source.handler.spec.ts` | Create | M |
| S4.6.4 | Unit tests for prediction.handler | `apps/api/src/prediction-runner/task-router/handlers/__tests__/prediction.handler.spec.ts` | Create | M |

---

## Task Effort Legend
- **S (Small):** 1-2 hours
- **M (Medium):** 2-4 hours
- **L (Large):** 4-8 hours

## Task Type Legend
- **Create:** New file creation
- **Modify:** Existing file modification
- **Verify:** Verification/testing of existing functionality
- **Research:** Investigation and documentation

---

## Summary Statistics

| Sprint | Total Tasks | Create | Modify | Verify | Estimated Hours |
|--------|-------------|--------|--------|--------|-----------------|
| Sprint 1 | 37 | 10 | 25 | 2 | 60-80 |
| Sprint 2 | 22 | 7 | 13 | 2 | 40-55 |
| Sprint 3 | 16 | 7 | 9 | 0 | 35-50 |
| Sprint 4 | 21 | 8 | 13 | 0 | 40-55 |
| **Total** | **96** | **32** | **60** | **4** | **175-240** |

---

## Critical Path

The following tasks are on the critical path and should be prioritized:

1. **Sprint 1: S1.6 (Real-time Event Emission)** - Foundation for all real-time features
2. **Sprint 1: S1.7 (Activity Feed)** - Primary demo feature for watching the pipeline
3. **Sprint 2: S2.5 (Learning Promotion)** - Core learning loop for system improvement
4. **Sprint 3: S3.3 (T_ Verification)** - Test framework validation

---

## Critical Files Reference

| File | Purpose |
|------|---------|
| `apps/api/src/prediction-runner/task-router/prediction-dashboard.router.ts` | Central routing for all dashboard handlers |
| `apps/api/src/observability/observability-events.service.ts` | Core SSE infrastructure for real-time events |
| `apps/api/src/prediction-runner/runners/source-crawler.runner.ts` | Main crawling runner - needs event emission |
| `apps/api/src/prediction-runner/services/source-crawler.service.ts` | Crawling logic - needs event emission |
| `apps/api/src/prediction-runner/services/signal-detection.service.ts` | Signal detection - needs event emission |
| `apps/api/src/prediction-runner/services/prediction-generation.service.ts` | Prediction generation - needs event emission |
| `apps/web/src/views/prediction/PredictionDashboard.vue` | Entry point for Activity Feed |
| `apps/web/src/components/admin/AdminEventRow.vue` | Pattern to reuse for event rows |
| `apps/web/src/composables/useAdminObservabilityStream.ts` | SSE composable to reuse |
| `apps/api/testing/test/integration/prediction-runner.e2e-spec.ts` | Pattern to follow for E2E tests |

---

## Quick Start: First 5 Tasks

To start implementation, complete these tasks first:

1. **S1.1.1** - Create prediction-universe.e2e-spec.ts with create test
2. **S1.6.1** - Add ObservabilityEventsService to source-crawler.runner.ts
3. **S1.6.2** - Emit `source.crawl.started` event
4. **S1.6.3** - Emit `source.crawl.completed` event
5. **S1.7.1** - Create PredictionActivityFeed.vue component

These establish the foundation for watching the pipeline in real-time.
