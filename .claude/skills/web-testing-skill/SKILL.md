---
description: Web app testing patterns for Vue 3, Vitest, and Cypress. Use when testing web app files, generating Vue component tests, testing stores/services/composables, or running Vitest/Cypress tests. Keywords: web test, vue test, vitest, cypress, component test, store test, service test, web app testing.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

# Web Testing Skill

## Purpose

This skill provides patterns and validation for testing the web app (`apps/web/`). It covers Vue 3 component testing, Vitest unit tests, Cypress E2E tests, and integration testing patterns.

## Testing Framework

- **Unit Tests**: Vitest (fast, modern, Vite-native)
- **E2E Tests**: Cypress (comprehensive browser automation)
- **Component Testing**: Vue Test Utils
- **Store Testing**: Pinia Testing utilities
- **Coverage**: @vitest/coverage-v8

## Test Commands

```bash
# Unit tests
cd apps/web && npm run test:unit

# E2E tests (requires services running)
cd apps/web && npm run test:e2e

# Coverage
cd apps/web && npm run test:coverage

# Watch mode
cd apps/web && npm run test:watch
```

## File Classification

### Component Tests (`*.test.ts` or `*.spec.ts`)

**Location:** `src/components/**/__tests__/*.test.ts` or alongside component

**Pattern:**
```typescript
import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import MyComponent from '../MyComponent.vue';

describe('MyComponent', () => {
  it('should render correctly', () => {
    const wrapper = mount(MyComponent, {
      props: { title: 'Test Title' }
    });
    expect(wrapper.text()).toContain('Test Title');
  });
});
```

### Store Tests (`*.test.ts`)

**Location:** `src/stores/__tests__/*.test.ts`

**Pattern:**
```typescript
import { setActivePinia, createPinia } from 'pinia';
import { describe, it, expect, beforeEach } from 'vitest';
import { useMyStore } from '../myStore';

describe('MyStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('should initialize with default state', () => {
    const store = useMyStore();
    expect(store.count).toBe(0);
  });
});
```

### Service Tests (`*.test.ts`)

**Location:** `src/services/__tests__/*.test.ts` or `src/tests/unit/*.test.ts`

**Pattern:**
```typescript
import { describe, it, expect, vi } from 'vitest';
import { myService } from '../myService';

describe('MyService', () => {
  it('should call API correctly', async () => {
    const mockResponse = { data: 'test' };
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockResponse
    } as Response);

    const result = await myService.fetchData();
    expect(result).toEqual(mockResponse);
  });
});
```

### Composable Tests (`*.test.ts`)

**Location:** `src/composables/__tests__/*.test.ts`

**Pattern:**
```typescript
import { describe, it, expect } from 'vitest';
import { useMyComposable } from '../useMyComposable';

describe('useMyComposable', () => {
  it('should return reactive value', () => {
    const { value, increment } = useMyComposable();
    expect(value.value).toBe(0);
    increment();
    expect(value.value).toBe(1);
  });
});
```

### Integration Tests (`*.test.ts`)

**Location:** `src/tests/integration/*.test.ts`

**Pattern:**
```typescript
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import MyComponent from '@/components/MyComponent.vue';
import { useMyStore } from '@/stores/myStore';

describe('Component-Store Integration', () => {
  it('should update store when component action triggered', async () => {
    const wrapper = mount(MyComponent);
    const store = useMyStore();
    
    await wrapper.find('button').trigger('click');
    expect(store.count).toBe(1);
  });
});
```

### E2E Tests (`*.cy.ts`)

**Location:** `tests/e2e/*.cy.ts`

**⚠️ CRITICAL: NO MOCKING IN E2E TESTS**

E2E tests must use **real services, real database, real API calls, and real authentication**. See `e2e-testing-skill/` for complete E2E principles.

**Pattern:**
```typescript
import { describe, it } from 'cypress';

describe('User Journey', () => {
  // ✅ CORRECT: Use real test credentials from environment
  const testEmail = Cypress.env('SUPABASE_TEST_USER') || 'demo.user@playground.com';
  const testPassword = Cypress.env('SUPABASE_TEST_PASSWORD') || 'demouser';

  it('should complete authentication flow with real authentication', () => {
    // Real authentication - NO MOCKS
    cy.visit('/login');
    cy.get('[data-cy=email]').type(testEmail); // Real credentials
    cy.get('[data-cy=password]').type(testPassword); // Real credentials
    cy.get('[data-cy=submit]').click();
    
    // Real API call - NO MOCKS
    cy.url().should('include', '/dashboard');
    
    // Verify real data loaded
    cy.get('[data-cy=user-name]').should('be.visible');
  });

  it('should interact with real API endpoints', () => {
    // Real API call - NO MOCKS
    cy.request({
      method: 'POST',
      url: `${Cypress.env('API_BASE_URL')}/agents/marketing/blog_post/tasks`,
      headers: {
        'Authorization': `Bearer ${Cypress.env('AUTH_TOKEN')}` // Real token
      },
      body: {
        taskId: 'test-task-id',
        content: 'Test content'
      }
    }).then((response) => {
      expect(response.status).toBe(200);
      expect(response.body).to.have.property('taskId');
    });
  });
});
```

**E2E Test Requirements:**
- ✅ Real Supabase authentication (use `SUPABASE_TEST_USER` and `SUPABASE_TEST_PASSWORD`)
- ✅ Real API calls to actual endpoints
- ✅ Real database queries and data
- ✅ Real services running (API server, web server, database)
- ❌ NO mocks of any kind
- ❌ NO fake data or stubs

## Testing Standards

### Coverage Requirements

- **Global**: 75% minimum (lines, functions, branches, statements)
- **Critical Path**: 90% minimum (validation, security, PII)
- **Components**: 80% minimum
- **Stores**: 85% minimum
- **Services**: 80% minimum

### Test Structure (AAA Pattern)

```typescript
it('should do something specific', () => {
  // Arrange - Set up test data and mocks
  const input = 'test input';
  const expected = 'test output';
  
  // Act - Execute the code being tested
  const result = functionUnderTest(input);
  
  // Assert - Verify the result
  expect(result).toBe(expected);
});
```

### Naming Conventions

- **Test files**: `ComponentName.test.ts` or `serviceName.test.ts`
- **Test suites**: `describe('ComponentName', () => { ... })`
- **Test cases**: `it('should do something specific', () => { ... })`

### Best Practices

1. **One assertion per test** (when possible)
2. **Descriptive test names** using natural language
3. **Test behavior, not implementation**
4. **Use proper setup/teardown** (beforeEach, afterEach)
5. **Mock external dependencies** (API calls, services)
6. **Test both happy and error paths**

## ExecutionContext in Tests

**From execution-context-skill:**
- Tests must validate ExecutionContext flow
- Mock ExecutionContext with proper structure
- Test ExecutionContext validation logic

**Pattern:**
```typescript
import { ExecutionContext } from '@orchestrator-ai/transport-types';

const mockExecutionContext: ExecutionContext = {
  userId: 'test-user-id',
  organizationId: 'test-org-id',
  conversationId: 'test-conversation-id',
  // ... other required fields
};

it('should pass ExecutionContext through service calls', async () => {
  const result = await service.doSomething(mockExecutionContext);
  expect(result.executionContext).toEqual(mockExecutionContext);
});
```

## Common Patterns

### Testing Reactive State

```typescript
import { nextTick } from 'vue';

it('should update reactive state', async () => {
  const wrapper = mount(MyComponent);
  await wrapper.setData({ count: 5 });
  await nextTick();
  expect(wrapper.text()).toContain('5');
});
```

### Testing Events

```typescript
it('should emit event on action', async () => {
  const wrapper = mount(MyComponent);
  await wrapper.find('button').trigger('click');
  expect(wrapper.emitted('action')).toBeTruthy();
  expect(wrapper.emitted('action')[0]).toEqual([{ value: 'test' }]);
});
```

### Testing Async Operations

```typescript
it('should handle async operation', async () => {
  const wrapper = mount(MyComponent);
  await wrapper.find('button').trigger('click');
  await wrapper.vm.$nextTick();
  expect(wrapper.text()).toContain('Loading...');
  
  // Wait for async to complete
  await new Promise(resolve => setTimeout(resolve, 100));
  expect(wrapper.text()).toContain('Complete');
});
```

### Testing Pinia Stores

```typescript
import { setActivePinia, createPinia } from 'pinia';
import { createTestingPinia } from '@pinia/testing';

it('should update store state', () => {
  const pinia = createTestingPinia({ createSpy: vi.fn });
  setActivePinia(pinia);
  
  const store = useMyStore();
  store.increment();
  expect(store.count).toBe(1);
});
```

## Violations

### ❌ Bad Practices

- Testing implementation details instead of behavior
- Overly complex test setup
- Tests that depend on external state
- Generic test names like "should work"
- Testing multiple concerns in single test
- Ignoring test failures

### ✅ Good Practices

- Test behavior and outcomes
- Clear, focused test cases
- Independent, isolated tests
- Descriptive test names
- Single responsibility per test
- Fix failing tests immediately

## Related Skills

- **e2e-testing-skill** - E2E testing principles (NO MOCKING, real services, real authentication) - **MANDATORY for E2E tests**
- **execution-context-skill** - ExecutionContext validation in tests
- **transport-types-skill** - A2A protocol validation in tests
- **web-architecture-skill** - Web app structure and patterns

