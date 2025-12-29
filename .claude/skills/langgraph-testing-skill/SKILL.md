---
name: langgraph-testing-skill
description: LangGraph app testing patterns for Jest. Use when testing LangGraph app files, generating LangGraph agent tests, testing workflows and state machines, or running Jest tests for LangGraph. Keywords: langgraph test, jest, agent test, workflow test, state machine test, langgraph app testing.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
category: "testing"
type: "prescriptive"
used-by-agents: ["testing-agent"]
related-skills: ["e2e-testing-skill", "langgraph-architecture-skill"]
---

# LangGraph Testing Skill

## Purpose

This skill provides patterns and validation for testing the LangGraph app (`apps/langgraph/`). It covers LangGraph agent testing, workflow testing, state machine testing, and E2E testing patterns.

## Testing Framework

- **Unit Tests**: Jest (with ts-jest)
- **E2E Tests**: Jest
- **Testing Utilities**: @nestjs/testing
- **Coverage**: jest --coverage

## Test Commands

```bash
# Unit tests
cd apps/langgraph && npm test

# E2E tests (requires services running)
cd apps/langgraph && npm run test:e2e

# Coverage
cd apps/langgraph && npm run test:cov

# Watch mode
cd apps/langgraph && npm run test:watch
```

## File Classification

### Agent Service Tests (`*.spec.ts`)

**Location:** `src/agents/**/*.service.spec.ts` or alongside service

**Pattern:**
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { MyAgentService } from './my-agent.service';

describe('MyAgentService', () => {
  let service: MyAgentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MyAgentService],
    }).compile();

    service = module.get<MyAgentService>(MyAgentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should process agent workflow', async () => {
    const input = { content: 'test input' };
    const result = await service.process(input);
    expect(result).toBeDefined();
  });
});
```

### Tool Tests (`*.spec.ts`)

**Location:** `src/tools/**/*.tool.spec.ts` or alongside tool

**Pattern:**
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { MyTool } from './my.tool';

describe('MyTool', () => {
  let tool: MyTool;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MyTool],
    }).compile();

    tool = module.get<MyTool>(MyTool);
  });

  it('should execute tool correctly', async () => {
    const result = await tool.execute({ input: 'test' });
    expect(result).toBeDefined();
  });
});
```

### Workflow Tests (`*.spec.ts`)

**Location:** `src/agents/**/*.workflow.spec.ts` or `src/__tests__/**/*.spec.ts`

**Pattern:**
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { MyWorkflow } from './my.workflow';

describe('MyWorkflow', () => {
  let workflow: MyWorkflow;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MyWorkflow],
    }).compile();

    workflow = module.get<MyWorkflow>(MyWorkflow);
  });

  it('should execute workflow steps', async () => {
    const state = { step: 'start' };
    const result = await workflow.execute(state);
    expect(result.step).toBe('next');
  });
});
```

### E2E Tests (`*.e2e-spec.ts`)

**Location:** `src/__tests__/e2e/*.e2e-spec.ts`

**⚠️ CRITICAL: NO MOCKING IN E2E TESTS**

E2E tests must use **real services, real database, real API calls, and real authentication**. See `e2e-testing-skill/` for complete E2E principles.

**Pattern:**
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../../app.module';

describe('MyAgent (e2e)', () => {
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

  it('/agent/endpoint (POST) with real authentication and real database', () => {
    // Real API call with real authentication - NO MOCKS
    return request(app.getHttpServer())
      .post('/agent/endpoint')
      .set('Authorization', `Bearer ${authToken}`) // Real token
      .send({ 
        input: 'test',
        userId: testUserId // Real user ID
      })
      .expect(200)
      .expect((res) => {
        expect(res.body).toBeDefined();
        
        // Verify real database entry was created
        return supabase
          .from('tasks')
          .select('*')
          .eq('task_id', res.body.taskId)
          .single()
          .then(({ data }) => {
            expect(data).toBeDefined();
            expect(data.user_id).toBe(testUserId);
          });
      });
  });
});
```

**E2E Test Requirements:**
- ✅ Real Supabase authentication (use `SUPABASE_TEST_USER` and `SUPABASE_TEST_PASSWORD`)
- ✅ Real database queries (use Supabase client with service role key)
- ✅ Real API calls to actual endpoints
- ✅ Real LangGraph workflows and state machines
- ✅ Real services running (API server, database, LangGraph)
- ❌ NO mocks of any kind
- ❌ NO fake data or stubs

## Testing Standards

### Coverage Requirements

- **Global**: 75% minimum (lines, functions, branches, statements)
- **Critical Path**: 90% minimum (workflows, state machines)
- **Agents**: 85% minimum
- **Tools**: 80% minimum
- **Services**: 80% minimum

### Test Structure (AAA Pattern)

```typescript
it('should do something specific', async () => {
  // Arrange - Set up test data and mocks
  const input = { content: 'test input' };
  const expected = { result: 'test output' };
  
  // Act - Execute the code being tested
  const result = await service.process(input);
  
  // Assert - Verify the result
  expect(result).toEqual(expected);
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
5. **Mock external dependencies** (LLM calls, database, APIs)
6. **Test both happy and error paths**
7. **Test state transitions** in workflows

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

it('should pass ExecutionContext through workflow', async () => {
  const result = await workflow.execute({}, mockExecutionContext);
  expect(result.executionContext).toEqual(mockExecutionContext);
});
```

## Common Patterns

### Testing State Transitions

```typescript
describe('Workflow State Transitions', () => {
  it('should transition from start to processing', async () => {
    const initialState = { step: 'start', data: {} };
    const result = await workflow.execute(initialState);
    expect(result.step).toBe('processing');
  });

  it('should transition from processing to complete', async () => {
    const processingState = { step: 'processing', data: { processed: true } };
    const result = await workflow.execute(processingState);
    expect(result.step).toBe('complete');
  });
});
```

### Testing HITL Interactions

```typescript
describe('HITL Interactions', () => {
  it('should pause workflow for HITL', async () => {
    const state = { step: 'hitl_required', data: {} };
    const result = await workflow.execute(state);
    expect(result.step).toBe('paused');
    expect(result.hitlRequired).toBe(true);
  });

  it('should resume workflow after HITL', async () => {
    const pausedState = { step: 'paused', hitlResponse: 'approved', data: {} };
    const result = await workflow.execute(pausedState);
    expect(result.step).toBe('processing');
  });
});
```

### Testing Tool Execution

```typescript
describe('Tool Execution', () => {
  it('should execute tool with correct parameters', async () => {
    const tool = new MyTool();
    const result = await tool.execute({ input: 'test', context: {} });
    expect(result).toBeDefined();
    expect(result.output).toBe('expected output');
  });

  it('should handle tool errors', async () => {
    const tool = new MyTool();
    jest.spyOn(tool, 'execute').mockRejectedValue(new Error('Tool error'));
    await expect(tool.execute({ input: 'test' })).rejects.toThrow('Tool error');
  });
});
```

### Testing LLM Integration

```typescript
describe('LLM Integration', () => {
  it('should call LLM service correctly', async () => {
    const mockLLMService = {
      generate: jest.fn().mockResolvedValue({ content: 'LLM response' }),
    };
    
    const service = new MyAgentService(mockLLMService);
    const result = await service.process({ input: 'test' });
    
    expect(mockLLMService.generate).toHaveBeenCalled();
    expect(result).toContain('LLM response');
  });
});
```

### Testing Database Persistence

```typescript
describe('Database Persistence', () => {
  it('should save workflow state', async () => {
    const mockRepository = {
      save: jest.fn().mockResolvedValue({ id: 1, state: {} }),
    };
    
    const service = new MyAgentService(mockRepository);
    await service.saveState({ step: 'processing' });
    
    expect(mockRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ step: 'processing' })
    );
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
- Not mocking LLM calls or external APIs
- Not testing state transitions

### ✅ Good Practices

- Test behavior and outcomes
- Clear, focused test cases
- Independent, isolated tests
- Descriptive test names
- Single responsibility per test
- Fix failing tests immediately
- Mock all external dependencies (LLM, database, APIs)
- Test state transitions explicitly

## Related Skills

- **e2e-testing-skill** - E2E testing principles (NO MOCKING, real services, real authentication) - **MANDATORY for E2E tests**
- **execution-context-skill** - ExecutionContext validation in tests
- **transport-types-skill** - A2A protocol validation in tests
- **langgraph-architecture-skill** - LangGraph app structure and patterns

