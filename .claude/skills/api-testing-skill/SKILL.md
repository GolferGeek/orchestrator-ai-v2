---
name: api-testing-skill
description: API app testing patterns for NestJS and Jest. Use when testing API app files, generating NestJS service/controller tests, testing agent runners, or running Jest tests for API. Keywords: api test, nestjs test, jest, service test, controller test, agent runner test, api app testing.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
category: "testing"
type: "prescriptive"
used-by-agents: ["testing-agent"]
related-skills: ["e2e-testing-skill", "api-architecture-skill"]
---

# API Testing Skill

## Purpose

This skill provides patterns and validation for testing the API app (`apps/api/`). It covers NestJS service testing, controller testing, agent runner testing, and E2E testing patterns.

## Testing Framework

- **Unit Tests**: Jest (with ts-jest)
- **E2E Tests**: Jest + Supertest
- **Testing Utilities**: @nestjs/testing
- **Coverage**: jest --coverage

## Test Commands

```bash
# Unit tests
cd apps/api && npm test

# E2E tests (requires services running)
cd apps/api && npm run test:e2e

# Coverage
cd apps/api && npm run test:cov

# Watch mode
cd apps/api && npm run test:watch
```

## File Classification

### Service Tests (`*.spec.ts`)

**Location:** `src/**/*.service.spec.ts` or alongside service

**Pattern:**
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { MyService } from './my.service';

describe('MyService', () => {
  let service: MyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MyService],
    }).compile();

    service = module.get<MyService>(MyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should do something', () => {
    const result = service.doSomething('input');
    expect(result).toBe('expected output');
  });
});
```

### Controller Tests (`*.spec.ts`)

**Location:** `src/**/*.controller.spec.ts` or alongside controller

**Pattern:**
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { MyController } from './my.controller';
import { MyService } from './my.service';

describe('MyController', () => {
  let controller: MyController;
  let service: MyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MyController],
      providers: [
        {
          provide: MyService,
          useValue: {
            doSomething: jest.fn().mockResolvedValue('result'),
          },
        },
      ],
    }).compile();

    controller = module.get<MyController>(MyController);
    service = module.get<MyService>(MyService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call service method', async () => {
    const result = await controller.getSomething('input');
    expect(service.doSomething).toHaveBeenCalledWith('input');
    expect(result).toBe('result');
  });
});
```

### Agent Runner Tests (`*.spec.ts`)

**Location:** `src/agent2agent/services/**/*.spec.ts`

**Pattern:**
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { MyAgentRunner } from './my-agent-runner.service';
import { ExecutionContext } from '@orchestrator-ai/transport-types';

describe('MyAgentRunner', () => {
  let runner: MyAgentRunner;
  let mockExecutionContext: ExecutionContext;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MyAgentRunner],
    }).compile();

    runner = module.get<MyAgentRunner>(MyAgentRunner);
    
    mockExecutionContext = {
      userId: 'test-user-id',
      organizationId: 'test-org-id',
      // ... other required fields
    };
  });

  it('should process task with ExecutionContext', async () => {
    const task = { content: 'test task' };
    const result = await runner.processTask(task, mockExecutionContext);
    expect(result.executionContext).toEqual(mockExecutionContext);
  });
});
```

### E2E Tests (`*.e2e-spec.ts`)

**Location:** `testing/test/*.e2e-spec.ts` or `src/__tests__/e2e/*.e2e-spec.ts`

**⚠️ CRITICAL: NO MOCKING IN E2E TESTS**

E2E tests must use **real services, real database, real API calls, and real authentication**. See `e2e-testing-skill/` for complete E2E principles.

**Pattern:**
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../../src/app.module';

describe('MyController (e2e)', () => {
  let app: INestApplication;
  let supabase: SupabaseClient;
  let authToken: string;
  let testUserId: string;

  // ✅ CORRECT: Real credentials from environment
  const testEmail = process.env.SUPABASE_TEST_USER || 'demo.user@playground.com';
  const testPassword = process.env.SUPABASE_TEST_PASSWORD || 'demouser';
  const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
  const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

  beforeAll(async () => {
    // 1. Real Supabase client - NO MOCKS
    supabase = createClient(supabaseUrl, supabaseKey);

    // 2. Real authentication - NO MOCKS
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    if (authError) {
      throw new Error(`Real authentication failed: ${authError.message}`);
    }

    authToken = authData.session.access_token;
    testUserId = authData.user.id;

    // 3. Real NestJS app - NO MOCKS
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('/endpoint (GET) with real authentication', () => {
    // Real API call with real authentication - NO MOCKS
    return request(app.getHttpServer())
      .get('/endpoint')
      .set('Authorization', `Bearer ${authToken}`) // Real token
      .expect(200)
      .expect((res) => {
        expect(res.body).toBeDefined();
      });
  });

  it('should interact with real database', async () => {
    // Real database query - NO MOCKS
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .eq('user_id', testUserId);

    expect(error).toBeNull();
    expect(data).toBeDefined();
  });
});
```

**E2E Test Requirements:**
- ✅ Real Supabase authentication (use `SUPABASE_TEST_USER` and `SUPABASE_TEST_PASSWORD`)
- ✅ Real database queries (use Supabase client with service role key)
- ✅ Real API calls to actual endpoints
- ✅ Real services running (API server, database)
- ❌ NO mocks of any kind
- ❌ NO fake data or stubs

## Testing Standards

### Coverage Requirements

- **Global**: 75% minimum (lines, functions, branches, statements)
- **Critical Path**: 90% minimum (security, validation, PII)
- **Services**: 80% minimum
- **Controllers**: 80% minimum
- **Agent Runners**: 85% minimum

### Test Structure (AAA Pattern)

```typescript
it('should do something specific', () => {
  // Arrange - Set up test data and mocks
  const input = 'test input';
  const expected = 'test output';
  
  // Act - Execute the code being tested
  const result = service.doSomething(input);
  
  // Assert - Verify the result
  expect(result).toBe(expected);
});
```

### Naming Conventions

- **Test files**: `*.spec.ts` (unit tests) or `*.e2e-spec.ts` (E2E tests)
- **Test suites**: `describe('ServiceName', () => { ... })`
- **Test cases**: `it('should do something specific', () => { ... })`

### Best Practices

1. **One assertion per test** (when possible)
2. **Descriptive test names** using natural language
3. **Test behavior, not implementation**
4. **Use proper setup/teardown** (beforeEach, afterEach, beforeAll, afterAll)
5. **Mock external dependencies** (database, APIs, services)
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

### Testing with Mocks

```typescript
import { Test, TestingModule } from '@nestjs/testing';

describe('MyService', () => {
  let service: MyService;
  let mockDependency: jest.Mocked<MyDependency>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MyService,
        {
          provide: MyDependency,
          useValue: {
            doSomething: jest.fn().mockResolvedValue('mocked result'),
          },
        },
      ],
    }).compile();

    service = module.get<MyService>(MyService);
    mockDependency = module.get(MyDependency);
  });

  it('should call dependency', async () => {
    await service.doSomething();
    expect(mockDependency.doSomething).toHaveBeenCalled();
  });
});
```

### Testing Async Operations

```typescript
it('should handle async operation', async () => {
  const promise = service.asyncOperation();
  await expect(promise).resolves.toBe('result');
});

it('should handle async error', async () => {
  const promise = service.asyncOperation();
  await expect(promise).rejects.toThrow('Error message');
});
```

### Testing Error Handling

```typescript
it('should throw error on invalid input', () => {
  expect(() => service.doSomething(null)).toThrow('Invalid input');
});

it('should handle service error', async () => {
  jest.spyOn(dependency, 'doSomething').mockRejectedValue(new Error('Service error'));
  await expect(service.doSomething()).rejects.toThrow('Service error');
});
```

### Testing Database Operations

```typescript
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

describe('MyService', () => {
  let service: MyService;
  let repository: jest.Mocked<Repository<MyEntity>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MyService,
        {
          provide: getRepositoryToken(MyEntity),
          useValue: {
            find: jest.fn().mockResolvedValue([{ id: 1 }]),
            save: jest.fn().mockResolvedValue({ id: 1 }),
          },
        },
      ],
    }).compile();

    service = module.get<MyService>(MyService);
    repository = module.get(getRepositoryToken(MyEntity));
  });

  it('should query database', async () => {
    const result = await service.findAll();
    expect(repository.find).toHaveBeenCalled();
    expect(result).toEqual([{ id: 1 }]);
  });
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
- Not mocking external dependencies

### ✅ Good Practices

- Test behavior and outcomes
- Clear, focused test cases
- Independent, isolated tests
- Descriptive test names
- Single responsibility per test
- Fix failing tests immediately
- Mock all external dependencies

## Related Skills

- **e2e-testing-skill** - E2E testing principles (NO MOCKING, real services, real authentication) - **MANDATORY for E2E tests**
- **execution-context-skill** - ExecutionContext validation in tests
- **transport-types-skill** - A2A protocol validation in tests
- **api-architecture-skill** - API app structure and patterns

