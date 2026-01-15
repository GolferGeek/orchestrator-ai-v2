# Prediction System - Production Readiness Verification Checklist

This checklist tracks manual verification tasks for the Prediction System implementation.

## Sprint Completion Status

| Sprint | Status | Progress |
|--------|--------|----------|
| Sprint 0: Hardening Foundation | Completed | 100% |
| Sprint 1: Core Demo Flow | Completed | 100% |
| Sprint 2: Evaluation & Learning | Completed | 100% |
| Sprint 3: Test Framework | Completed | 100% |
| Sprint 4: Monitoring & Polish | Completed | 100% |
| Sprint 5: Setup & Exploration | Completed | 100% |
| Sprint 6: Advanced Features | Completed | 100% |
| Sprint 7: Administration & Hardening | Completed | 100% |

---

## Service Integration Verification

### BackpressureService (s7-5)
- [ ] Verify rate limiting triggers when global concurrent crawls exceed 10
- [ ] Verify token bucket refill rate works correctly
- [ ] Verify per-source crawl limits are enforced
- [ ] Check observability events are emitted for backpressure events

### LlmUsageLimiterService (s7-6)
- [ ] Verify free tier limits: 100K daily tokens, 1M monthly tokens
- [ ] Verify pro tier limits: 1M daily tokens, 20M monthly tokens
- [ ] Verify warnings are emitted at 75%, 90%, 95% thresholds
- [ ] Verify daily/monthly counter reset works correctly

### ExternalIntegrationService (s7-7)
- [ ] Verify Firecrawl retry with exponential backoff (3 retries, 2x multiplier)
- [ ] Verify service health tracking updates on success/failure
- [ ] Verify timeout enforcement (30s default)

### DegradedModeService (s7-8)
- [ ] Verify degradation state tracking per service
- [ ] Verify cached content fallback for Firecrawl (60min TTL)
- [ ] Verify observability events for degradation changes

---

## UI/UX Verification

### New Routes Added
- [ ] `/prediction/alerts` - Alerts dashboard working
- [ ] `/prediction/crawl-status` - Source crawl status working

### Demo-Path Journeys (s7-10 E2E Tests)
- [ ] Create Universe journey works end-to-end
- [ ] Add Target journey works end-to-end
- [ ] View Predictions journey works end-to-end
- [ ] All prediction cards display correctly
- [ ] Filtering/pagination works

---

## A2A Protocol Verification

### Dashboard Mode Calls
- [ ] `universes.list` returns correct data
- [ ] `universes.create` creates new universe
- [ ] `targets.list` returns targets for universe
- [ ] `targets.create` creates new target
- [ ] `predictions.list` returns predictions
- [ ] `predictions.get` returns prediction details

### JSON-RPC 2.0 Format
- [ ] Verify `jsonrpc: "2.0"` in all requests
- [ ] Verify proper `id` generation (UUID)
- [ ] Verify `method` follows `dashboard.{action}` pattern
- [ ] Verify `ExecutionContext` passed correctly

---

## Background Runners Verification

### Source Crawler Runner
- [ ] 5-minute crawl interval working
- [ ] 10-minute crawl interval working
- [ ] 15-minute crawl interval working
- [ ] 30-minute crawl interval working
- [ ] 60-minute (hourly) crawl interval working
- [ ] Backpressure integration prevents overlapping runs

### Outcome Tracking Runner
- [ ] Predictions evaluated on schedule
- [ ] Snapshots captured correctly
- [ ] Outcomes recorded accurately

### Expiration Runner
- [ ] Expired predictions marked correctly
- [ ] Expired signals cleaned up

---

## Observability Verification

### Events Emitted
- [ ] `source.crawl.started` events
- [ ] `source.crawl.completed` events
- [ ] `prediction.generated` events
- [ ] `prediction.evaluated` events
- [ ] `llm.usage.warning` events
- [ ] Alert events (crawl failures, anomalies)

### Activity Feed
- [ ] Real-time events appear in feed
- [ ] Filtering by entity type works
- [ ] Pagination works

---

## Security Verification

### Config Validation (s7-9)
- [ ] Missing required secrets logged as warnings
- [ ] App starts with optional services missing
- [ ] Clear error messages for configuration issues

### API Security
- [ ] All routes require authentication
- [ ] Organization context properly scoped
- [ ] No sensitive data in logs

---

## Performance Verification

### Database Queries
- [ ] All queries use proper indexes
- [ ] No N+1 query patterns
- [ ] Bulk operations optimized

### API Response Times
- [ ] Dashboard list operations < 500ms
- [ ] Dashboard get operations < 200ms
- [ ] Crawl operations complete within timeout

---

## Human Checkpoint Approvals

### Demo Readiness Gate
- [ ] Core prediction flow demonstrated
- [ ] UI displays predictions correctly
- [ ] Activity feed shows events

### Production Readiness Gate
- [ ] All Sprint 0-7 tasks verified
- [ ] All services integrated
- [ ] All tests passing
- [ ] No critical bugs remaining

---

## Test Execution

```bash
# Run all prediction-runner tests
npm test -- --testPathPattern="prediction-runner"

# Run E2E tests
cd apps/web
npx playwright test tests/e2e/specs/prediction-agent/prediction-journeys.spec.ts

# Run with debug mode
DEBUG=true npx playwright test tests/e2e/specs/prediction-agent/prediction-journeys.spec.ts
```

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | | | |
| QA | | | |
| Product Owner | | | |

---

*Generated: 2026-01-13*
*Plan: docs/plans/2026-01-12-prediction-system.plan.json*
