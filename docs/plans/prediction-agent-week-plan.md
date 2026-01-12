# Prediction Agent Enhancement Plan - Week of January 12-18, 2026

## Executive Summary

The prediction system has a **mature architecture** with ~70,000+ lines of code across 180+ files. The API layer is fully implemented with 16 dashboard entity handlers. The frontend has 46 Vue components. This week focuses on verification, testing, and polish to make the agent "awesome."

## Current State Assessment

### API Status (✅ Verified Working)
| Entity | List | Get | Create | Update | Delete | Status |
|--------|------|-----|--------|--------|--------|--------|
| universes | ✅ | ✅ | ✅ | ✅ | ✅ | Working - 3 universes |
| targets | ✅ | ✅ | ✅ | ✅ | ✅ | Working - 13 targets |
| predictions | ✅ | ✅ | ✅ | ✅ | ✅ | Working - 0 active |
| sources | ✅ | ✅ | ✅ | ✅ | ✅ | Working - 0 sources |
| analysts | ✅ | ✅ | ✅ | ✅ | ✅ | Working |
| learnings | ✅ | ✅ | ✅ | ✅ | ✅ | Working |
| learning-queue | ✅ | ✅ | ✅ | ✅ | - | Working |
| review-queue | ✅ | ✅ | ✅ | ✅ | - | Working |
| strategies | ✅ | ✅ | ✅ | ✅ | ✅ | Working - 5 strategies |
| missed-opportunities | ⚠️ | ⚠️ | - | - | - | Requires targetId param |
| tool-requests | ❌ | ❌ | - | - | - | **Schema issue: missing priority column** |
| learning-promotion | ✅ | ✅ | ✅ | - | - | Working |
| test-scenarios | ✅ | ✅ | ✅ | ✅ | ✅ | Working |
| test-articles | ✅ | ✅ | ✅ | ✅ | ✅ | Working |
| test-price-data | ✅ | ✅ | ✅ | ✅ | ✅ | Working |
| test-target-mirrors | ✅ | ✅ | ✅ | ✅ | ✅ | Working |
| analytics | ✅ | ✅ | - | - | - | Working |

### Known Issues
1. **tool_requests table missing `priority` column** - needs migration
2. **missed-opportunities.list requires targetId** - may need "list all" endpoint

---

## Week Plan

### Day 1: Schema & API Fixes (Monday)

**Morning: Fix Schema Issues**
- [ ] Create migration to add `priority` column to `tool_requests` table
- [ ] Test tool-requests endpoint after fix
- [ ] Add `missed-opportunities.list-all` action that doesn't require targetId

**Afternoon: Expand E2E Test Coverage**
- [ ] Add tests for all CRUD operations (not just list)
- [ ] Add tests for predictions.create with mock signal
- [ ] Add tests for learning-queue workflow (create -> process -> promote)
- [ ] Target: 30+ E2E tests covering all major workflows

### Day 2: Frontend Integration Testing (Tuesday)

**Morning: Set Up Frontend Testing Infrastructure**
- [ ] Configure Vitest for component testing
- [ ] Add test utilities for mocking predictionDashboardService
- [ ] Create store testing helpers

**Afternoon: Component Tests**
- [ ] PredictionDashboard.vue test suite
- [ ] PredictionCard.vue test suite
- [ ] UniverseManagement.vue test suite
- [ ] Target: 15+ component tests

### Day 3: End-to-End User Workflows (Wednesday)

**Morning: Playwright/Cypress Setup**
- [ ] Install and configure Playwright for web app
- [ ] Create test fixtures for prediction data
- [ ] Set up test database seeding

**Afternoon: E2E User Journey Tests**
- [ ] Test: Create universe → Add target → Generate prediction
- [ ] Test: View prediction → Mark outcome → Create learning
- [ ] Test: Learning queue → Review → Promote to production
- [ ] Test: Test Lab → Create scenario → Run backtest
- [ ] Target: 10+ E2E user journey tests

### Day 4: Performance & Polish (Thursday)

**Morning: Performance Optimization**
- [ ] Profile dashboard loading times
- [ ] Add pagination to heavy endpoints if needed
- [ ] Implement caching for frequently accessed data (universe configs, strategies)
- [ ] Optimize database queries with proper indexes

**Afternoon: UI Polish**
- [ ] Review and fix responsive design issues
- [ ] Ensure loading states are consistent
- [ ] Add better error messages
- [ ] Implement optimistic updates where appropriate

### Day 5: Documentation & Demo (Friday)

**Morning: Documentation**
- [ ] Document API endpoints (add to prediction dashboard router docs)
- [ ] Create user guide for prediction dashboard
- [ ] Document test scenarios and backtest workflow
- [ ] Add inline JSDoc to key services

**Afternoon: Demo Preparation**
- [ ] Seed demo data (sample predictions, learnings, test scenarios)
- [ ] Create demo script walking through features
- [ ] Record quick demo video or screenshots
- [ ] Prepare for next week's development

---

## Detailed Task Breakdown

### Day 1 Tasks

#### 1.1 Fix tool_requests schema
```sql
-- Migration: Add priority column to tool_requests
ALTER TABLE predictions.tool_requests
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium'
CHECK (priority IN ('low', 'medium', 'high', 'critical'));
```

#### 1.2 Add missed-opportunities.list-all
File: `apps/api/src/prediction-runner/task-router/handlers/missed-opportunity.handler.ts`
- Add new action `list-all` that queries across all targets
- Update getSupportedActions() to include new action

#### 1.3 E2E Test Expansion
File: `apps/api/testing/test/integration/prediction-runner.e2e-spec.ts`

New test cases needed:
```typescript
// CRUD workflow tests
describe('Prediction CRUD Operations', () => {
  it('should create a prediction');
  it('should get prediction by ID');
  it('should update prediction status');
  it('should delete prediction');
});

describe('Learning Queue Workflow', () => {
  it('should add item to learning queue');
  it('should process queue item');
  it('should promote learning to production');
});

describe('Test Scenario Workflow', () => {
  it('should create test scenario');
  it('should generate test articles');
  it('should run scenario');
  it('should evaluate results');
});
```

### Day 2 Tasks

#### 2.1 Vitest Configuration
File: `apps/web/vitest.config.ts`
```typescript
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

#### 2.2 Component Test Examples
File: `apps/web/src/views/prediction/__tests__/PredictionDashboard.spec.ts`
```typescript
describe('PredictionDashboard', () => {
  it('renders loading state initially');
  it('displays universes after load');
  it('filters predictions by status');
  it('navigates to prediction detail on click');
  it('shows empty state when no predictions');
});
```

### Day 3 Tasks

#### 3.1 Playwright Setup
```bash
npx playwright init
```

#### 3.2 E2E User Journey Tests
File: `apps/web/e2e/prediction-workflow.spec.ts`
```typescript
test('complete prediction workflow', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.fill('[data-testid="email"]', 'test@example.com');

  // Navigate to prediction dashboard
  await page.goto('/prediction');

  // Create universe if needed
  // Add target
  // Generate prediction
  // Verify prediction appears
});
```

### Day 4 Tasks

#### 4.1 Performance Profiling Checklist
- [ ] Measure universe.list response time
- [ ] Measure predictions.list with 100+ items
- [ ] Check N+1 query issues in handlers
- [ ] Add database indexes for common queries

#### 4.2 UI Polish Checklist
- [ ] Check all views on mobile viewport
- [ ] Verify dark mode styling
- [ ] Test keyboard navigation
- [ ] Add aria-labels for accessibility

### Day 5 Tasks

#### 5.1 Documentation Structure
```
docs/
├── prediction-system/
│   ├── api-reference.md
│   ├── user-guide.md
│   ├── test-lab-guide.md
│   └── architecture.md
```

#### 5.2 Demo Data Seeding
```sql
-- Insert sample predictions
-- Insert sample learnings
-- Insert test scenarios with results
```

---

## Success Metrics

By end of week:
- [ ] 100% of dashboard endpoints working (16/16)
- [ ] 30+ API E2E tests passing
- [ ] 15+ component tests passing
- [ ] 10+ user journey E2E tests passing
- [ ] < 500ms dashboard load time
- [ ] Complete API documentation
- [ ] Demo-ready with sample data

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Schema migration breaks existing data | Test migration on backup first |
| Frontend tests flaky | Use proper test isolation, mock API calls |
| Performance issues discovered | Have backup plan to defer to next week |
| Time estimates wrong | Prioritize critical path (API fixes, E2E tests) |

---

## Notes

- Start each day with a quick check that API server and tests are passing
- Commit frequently with descriptive messages
- Don't gold-plate - ship working code, polish later
- Keep demo data separate from production (use test_scenario_id markers)
