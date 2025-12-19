---
description: E2E testing principles emphasizing NO MOCKING, real database work, real API calls, and real authentication. Use when writing E2E tests, integration tests, or any tests that should use real services. Keywords: e2e test, integration test, real database, real api, no mocking, real authentication, supabase test user.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

# E2E Testing Skill

## Purpose

This skill provides **CRITICAL** principles for E2E (End-to-End) testing. The core principle is: **NO MOCKING IN E2E TESTS**. E2E tests must use real services, real databases, real API calls, and real authentication.

## Core Principle: NO MOCKING

### 🚫 ABSOLUTELY FORBIDDEN IN E2E TESTS

- ❌ **NO mocks** of database operations
- ❌ **NO mocks** of API calls
- ❌ **NO mocks** of authentication
- ❌ **NO mocks** of external services
- ❌ **NO fake data** or stubs
- ❌ **NO test doubles** or spies

### ✅ REQUIRED IN E2E TESTS

- ✅ **Real database** connections and queries
- ✅ **Real API calls** (HTTP requests to actual endpoints)
- ✅ **Real authentication** (Supabase test user credentials)
- ✅ **Real services** running (API server, database, etc.)
- ✅ **Real data** in database (test data, not mocks)
- ✅ **Real responses** from all services

## Why No Mocking?

**Mocking in E2E tests is horrendous because:**
1. **Hides real problems** - Tests pass but production fails
2. **False confidence** - System appears to work but doesn't
3. **Integration gaps** - Misses real integration issues
4. **Configuration errors** - Doesn't catch misconfigured services
5. **Data flow issues** - Doesn't validate real data transformations
6. **Authentication bugs** - Doesn't catch auth flow problems

**E2E tests must reveal REAL problems, not hide them.**

## Test User Credentials

**Always use real Supabase test user credentials from `.env`:**

```bash
# Required environment variables (from root .env)
SUPABASE_TEST_USER=demo.user@playground.com
SUPABASE_TEST_PASSWORD=demouser
SUPABASE_TEST_USERID=b29a590e-b07f-49df-a25b-574c956b5035

# Alternative credentials (some tests use these)
SUPABASE_TEST_USER=golfergeek@orchestratorai.io
SUPABASE_TEST_PASSWORD=GolferGeek123!
```

**Never hardcode credentials - always use environment variables:**

```typescript
// ✅ CORRECT: Use environment variables
const testEmail = process.env.SUPABASE_TEST_USER || 'demo.user@playground.com';
const testPassword = process.env.SUPABASE_TEST_PASSWORD || 'demouser';
const testUserId = process.env.SUPABASE_TEST_USERID || 'b29a590e-b07f-49df-a25b-574c956b5035';

// ❌ FORBIDDEN: Hardcoded credentials
const testEmail = 'test@example.com'; // NO!
const testPassword = 'password123'; // NO!
```

## Real Authentication Pattern

### Supabase Authentication

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Create real Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Real authentication - NO MOCKS
const testEmail = process.env.SUPABASE_TEST_USER || 'demo.user@playground.com';
const testPassword = process.env.SUPABASE_TEST_PASSWORD || 'demouser';

const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
  email: testEmail,
  password: testPassword,
});

if (authError) {
  throw new Error(`Real authentication failed: ${authError.message}`);
}

const authToken = authData.session.access_token;
const testUserId = authData.user.id;
```

### JWT Token Usage

```typescript
// Use real JWT token in API requests
const response = await axios.post(
  `${API_BASE}/agents/marketing/blog_post/tasks`,
  testRequest,
  {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}` // Real token from real auth
    }
  }
);
```

## Real Database Work

### Direct Database Queries

```typescript
// ✅ CORRECT: Real database queries
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Real service role key
);

// Real database query - NO MOCKS
const { data, error } = await supabase
  .from('agents')
  .select('*')
  .eq('user_id', testUserId);

expect(error).toBeNull();
expect(data).toBeDefined();
expect(data.length).toBeGreaterThan(0);
```

### Database Setup and Cleanup

```typescript
// Real database setup before tests
beforeAll(async () => {
  // Create real test data in database
  const { data, error } = await supabase
    .from('test_table')
    .insert([
      { user_id: testUserId, name: 'Test Item 1' },
      { user_id: testUserId, name: 'Test Item 2' }
    ]);
  
  if (error) {
    throw new Error(`Real database setup failed: ${error.message}`);
  }
});

// Real database cleanup after tests
afterAll(async () => {
  // Clean up real test data
  await supabase
    .from('test_table')
    .delete()
    .eq('user_id', testUserId);
});
```

## Real API Calls

### HTTP Requests to Real Endpoints

```typescript
// ✅ CORRECT: Real API calls
import axios from 'axios';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:6100';

// Real HTTP request - NO MOCKS
const response = await axios.post(
  `${API_BASE}/agents/marketing/blog_post/tasks`,
  {
    taskId: uuidv4(),
    conversationId: uuidv4(),
    content: 'Test content',
    userId: testUserId
  },
  {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  }
);

expect(response.status).toBe(200);
expect(response.data).toBeDefined();
```

### Real cURL Commands (for Shell Scripts)

```bash
# ✅ CORRECT: Real cURL commands
TEST_EMAIL="${SUPABASE_TEST_USER:-demo.user@playground.com}"
TEST_PASSWORD="${SUPABASE_TEST_PASSWORD:-demouser}"

# Real authentication
AUTH_RESPONSE=$(curl -s -X POST "${API_BASE}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}")

# Extract real token
AUTH_TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.access_token')

# Real API call with real token
RESPONSE=$(curl -s -X POST "${API_BASE}/agents/marketing/blog_post/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{"taskId":"test-task","content":"Test content"}')
```

## E2E Test Structure

### Complete E2E Test Example

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../../app.module';

describe('Agent E2E Tests', () => {
  let app: INestApplication;
  let supabase: SupabaseClient;
  let authToken: string;
  let testUserId: string;

  // Real credentials from environment
  const testEmail = process.env.SUPABASE_TEST_USER || 'demo.user@playground.com';
  const testPassword = process.env.SUPABASE_TEST_PASSWORD || 'demouser';
  const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
  const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

  beforeAll(async () => {
    // 1. Create real Supabase client
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

    // 3. Create real NestJS app
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    // Cleanup real resources
    if (app) {
      await app.close();
    }
  });

  it('should execute agent with real database and real API', async () => {
    // Real API call - NO MOCKS
    const response = await request(app.getHttpServer())
      .post('/agents/marketing/blog_post/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        taskId: uuidv4(),
        conversationId: uuidv4(),
        content: 'Test content',
        userId: testUserId
      })
      .expect(200);

    expect(response.body).toBeDefined();
    expect(response.body.taskId).toBeDefined();

    // Verify real database entry was created
    const { data: taskData } = await supabase
      .from('tasks')
      .select('*')
      .eq('task_id', response.body.taskId)
      .single();

    expect(taskData).toBeDefined();
    expect(taskData.user_id).toBe(testUserId);
  });
});
```

## Service Requirements

### Required Services Must Be Running

**E2E tests require real services:**

1. **Supabase Database** - Must be running and accessible
2. **API Server** - Must be running (e.g., `npm run start:dev`)
3. **Web Server** (for web E2E) - Must be running (e.g., `npm run dev`)
4. **Any external services** - Must be accessible

**Test Setup:**
```bash
# Terminal 1: Start API server
cd apps/api && npm run start:dev

# Terminal 2: Start web server (for web E2E)
cd apps/web && npm run dev

# Terminal 3: Run E2E tests
cd apps/api && npm run test:e2e
```

## When Mocking is Acceptable

**Mocking is ONLY acceptable in:**
- ✅ **Unit tests** - Testing individual functions/components in isolation
- ✅ **Service tests** - Testing service logic with mocked dependencies
- ✅ **Component tests** - Testing Vue components with mocked services

**Mocking is FORBIDDEN in:**
- ❌ **E2E tests** - Must use real services
- ❌ **Integration tests** - Must use real services
- ❌ **API tests** - Must use real API endpoints
- ❌ **Database tests** - Must use real database

## Common Violations

### ❌ FORBIDDEN: Mocking in E2E Tests

```typescript
// ❌ FORBIDDEN: Mocking database
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: [], error: null }))
      }))
    }))
  }))
}));

// ❌ FORBIDDEN: Mocking API calls
jest.mock('axios', () => ({
  post: jest.fn(() => Promise.resolve({ data: { success: true } }))
}));

// ❌ FORBIDDEN: Mocking authentication
jest.mock('../auth', () => ({
  authenticate: jest.fn(() => Promise.resolve('fake-token'))
}));
```

### ✅ CORRECT: Real Services in E2E Tests

```typescript
// ✅ CORRECT: Real Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ✅ CORRECT: Real authentication
const { data: authData } = await supabase.auth.signInWithPassword({
  email: process.env.SUPABASE_TEST_USER,
  password: process.env.SUPABASE_TEST_PASSWORD
});

// ✅ CORRECT: Real API call
const response = await axios.post(`${API_BASE}/endpoint`, data, {
  headers: { 'Authorization': `Bearer ${authToken}` }
});
```

## Test Data Management

### Real Test Data

**Use real test data in database:**
- Create test records before tests
- Use test user ID for all test data
- Clean up test data after tests
- Never use fake/mock data

```typescript
// Real test data setup
beforeAll(async () => {
  const { error } = await supabase
    .from('test_table')
    .insert([
      { user_id: testUserId, name: 'Test Item', status: 'active' }
    ]);
  
  if (error) {
    throw new Error(`Failed to create real test data: ${error.message}`);
  }
});

// Real test data cleanup
afterAll(async () => {
  await supabase
    .from('test_table')
    .delete()
    .eq('user_id', testUserId);
});
```

## Error Handling

### Real Error Scenarios

**Test real error scenarios:**
- Invalid credentials → Real authentication failure
- Missing data → Real database query returns empty
- API errors → Real API returns error response
- Network issues → Real network timeout

**Don't mock errors - test real error handling:**

```typescript
// ✅ CORRECT: Test real authentication failure
it('should handle invalid credentials', async () => {
  const { error } = await supabase.auth.signInWithPassword({
    email: 'invalid@example.com',
    password: 'wrongpassword'
  });

  expect(error).toBeDefined();
  expect(error.message).toContain('Invalid login credentials');
});
```

## Related Skills

- **web-testing-skill** - Web app E2E testing patterns
- **api-testing-skill** - API app E2E testing patterns
- **langgraph-testing-skill** - LangGraph app E2E testing patterns
- **execution-context-skill** - ExecutionContext validation (real ExecutionContext in tests)
- **transport-types-skill** - A2A protocol validation (real A2A calls in tests)

## Notes

- **E2E tests are slow by design** - They test real systems
- **E2E tests require services** - Must have services running
- **E2E tests reveal real problems** - That's their purpose
- **Mocking defeats the purpose** - E2E tests must be real
- **Use unit tests for fast feedback** - E2E tests are for integration validation

