# API E2E Test Examples

Real-world examples of E2E tests for API endpoints using **NO MOCKING** - real database, real authentication, real API calls.

---

## Example 1: User Registration Flow

**Test:** Complete user registration with real Supabase authentication and database verification.

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../../app.module';
import { v4 as uuidv4 } from 'uuid';

describe('User Registration E2E', () => {
  let app: INestApplication;
  let supabase: SupabaseClient;
  const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
  const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

  beforeAll(async () => {
    // Real Supabase client - NO MOCKS
    supabase = createClient(supabaseUrl, supabaseKey);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should register a new user with real database', async () => {
    const testEmail = `test-${uuidv4()}@example.com`;
    const testPassword = 'TestPassword123!';

    // Real API call - NO MOCKS
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: testEmail,
        password: testPassword,
        name: 'Test User'
      })
      .expect(201);

    expect(response.body).toHaveProperty('user');
    expect(response.body.user.email).toBe(testEmail);

    // Verify real database entry
    const { data: userData, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', testEmail)
      .single();

    expect(error).toBeNull();
    expect(userData).toBeDefined();
    expect(userData.email).toBe(testEmail);

    // Cleanup: Delete test user
    await supabase.auth.admin.deleteUser(response.body.user.id);
  });
});
```

---

## Example 2: Agent Execution Flow

**Test:** Execute an agent with real API calls, real database, and real LLM service integration.

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../../app.module';
import { v4 as uuidv4 } from 'uuid';

describe('Agent Execution E2E', () => {
  let app: INestApplication;
  let supabase: SupabaseClient;
  let authToken: string;
  let testUserId: string;

  const testEmail = process.env.SUPABASE_TEST_USER || 'demo.user@playground.com';
  const testPassword = process.env.SUPABASE_TEST_PASSWORD || 'demouser';
  const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
  const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

  beforeAll(async () => {
    // Real Supabase client
    supabase = createClient(supabaseUrl, supabaseKey);

    // Real authentication - NO MOCKS
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    if (authError) {
      throw new Error(`Real authentication failed: ${authError.message}`);
    }

    authToken = authData.session.access_token;
    testUserId = authData.user.id;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should execute agent with real API and real database', async () => {
    const taskId = uuidv4();
    const conversationId = uuidv4();

    // Real API call - NO MOCKS
    const response = await request(app.getHttpServer())
      .post('/agents/marketing/blog_post/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        taskId,
        conversationId,
        content: 'Write a blog post about AI agents',
        context: {
          userPreferences: { tone: 'professional' }
        }
      })
      .expect(200);

    expect(response.body).toBeDefined();
    expect(response.body.taskId).toBe(taskId);

    // Verify real database entry was created
    const { data: taskData, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('task_id', taskId)
      .single();

    expect(error).toBeNull();
    expect(taskData).toBeDefined();
    expect(taskData.user_id).toBe(testUserId);
    expect(taskData.status).toBe('pending');

    // Verify real LLM service was called (check usage tracking)
    const { data: usageData } = await supabase
      .from('llm_usage')
      .select('*')
      .eq('task_id', taskId)
      .single();

    expect(usageData).toBeDefined();
    expect(usageData.tokens_used).toBeGreaterThan(0);
  });
});
```

---

## Example 3: LLM Service Integration

**Test:** Verify LLM service integration with real API calls and usage tracking.

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../../app.module';

describe('LLM Service E2E', () => {
  let app: INestApplication;
  let supabase: SupabaseClient;
  let authToken: string;

  const testEmail = process.env.SUPABASE_TEST_USER || 'demo.user@playground.com';
  const testPassword = process.env.SUPABASE_TEST_PASSWORD || 'demouser';
  const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
  const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

  beforeAll(async () => {
    supabase = createClient(supabaseUrl, supabaseKey);

    // Real authentication
    const { data: authData } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    authToken = authData.session.access_token;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should call LLM service and track usage', async () => {
    // Real API call to LLM endpoint - NO MOCKS
    const response = await request(app.getHttpServer())
      .post('/llm/generate')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        prompt: 'Write a short story about a robot',
        model: 'claude-3-sonnet-20240229',
        maxTokens: 100
      })
      .expect(200);

    expect(response.body).toHaveProperty('content');
    expect(response.body.content).toBeDefined();
    expect(response.body.usage).toBeDefined();
    expect(response.body.usage.tokens).toBeGreaterThan(0);

    // Verify real usage tracking in database
    const { data: usageData } = await supabase
      .from('llm_usage')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    expect(usageData).toBeDefined();
    expect(usageData.tokens_used).toBe(response.body.usage.tokens);
    expect(usageData.model).toBe('claude-3-sonnet-20240229');
  });
});
```

---

## Example 4: Observability Event Flow

**Test:** Verify observability events are emitted and stored in real database.

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../../app.module';
import { v4 as uuidv4 } from 'uuid';

describe('Observability E2E', () => {
  let app: INestApplication;
  let supabase: SupabaseClient;
  let authToken: string;
  let testUserId: string;

  const testEmail = process.env.SUPABASE_TEST_USER || 'demo.user@playground.com';
  const testPassword = process.env.SUPABASE_TEST_PASSWORD || 'demouser';
  const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
  const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

  beforeAll(async () => {
    supabase = createClient(supabaseUrl, supabaseKey);

    const { data: authData } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    authToken = authData.session.access_token;
    testUserId = authData.user.id;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should emit observability events to real database', async () => {
    const taskId = uuidv4();
    const conversationId = uuidv4();

    // Real API call that triggers observability
    await request(app.getHttpServer())
      .post('/agents/marketing/blog_post/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        taskId,
        conversationId,
        content: 'Test content'
      })
      .expect(200);

    // Wait for events to be processed
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify real observability events in database
    const { data: events, error } = await supabase
      .from('observability_events')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });

    expect(error).toBeNull();
    expect(events).toBeDefined();
    expect(events.length).toBeGreaterThan(0);

    // Verify event structure
    const firstEvent = events[0];
    expect(firstEvent).toHaveProperty('event_type');
    expect(firstEvent).toHaveProperty('task_id', taskId);
    expect(firstEvent).toHaveProperty('user_id', testUserId);
  });
});
```

---

## Example 5: Real Authentication Flow

**Test:** Complete authentication flow with real Supabase auth and JWT token usage.

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../../app.module';

describe('Authentication E2E', () => {
  let app: INestApplication;
  let supabase: SupabaseClient;

  const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
  const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

  beforeAll(async () => {
    supabase = createClient(supabaseUrl, supabaseKey);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should authenticate with real Supabase and return JWT token', async () => {
    const testEmail = process.env.SUPABASE_TEST_USER || 'demo.user@playground.com';
    const testPassword = process.env.SUPABASE_TEST_PASSWORD || 'demouser';

    // Real authentication via API - NO MOCKS
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: testEmail,
        password: testPassword
      })
      .expect(200);

    expect(response.body).toHaveProperty('access_token');
    expect(response.body.access_token).toBeDefined();

    // Verify token works with real protected endpoint
    const protectedResponse = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${response.body.access_token}`)
      .expect(200);

    expect(protectedResponse.body).toHaveProperty('id');
    expect(protectedResponse.body.email).toBe(testEmail);
  });

  it('should reject invalid credentials', async () => {
    // Real authentication failure - NO MOCKS
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'invalid@example.com',
        password: 'wrongpassword'
      })
      .expect(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toContain('Invalid');
  });
});
```

---

## Key Principles Demonstrated

1. **Real Authentication** - Using actual Supabase test user credentials
2. **Real Database** - Direct queries to verify data persistence
3. **Real API Calls** - HTTP requests to actual endpoints
4. **Real Services** - LLM service, Observability service integration
5. **No Mocks** - All services are real, no test doubles

---

## Setup Requirements

**Before running these tests:**

1. **Start Supabase:**
   ```bash
   npm run dev:supabase:start
   ```

2. **Start API Server:**
   ```bash
   cd apps/api && npm run start:dev
   ```

3. **Set Environment Variables:**
   ```bash
   SUPABASE_URL=http://127.0.0.1:54321
   SUPABASE_ANON_KEY=<your-anon-key>
   SUPABASE_TEST_USER=demo.user@playground.com
   SUPABASE_TEST_PASSWORD=demouser
   ```

4. **Run Tests:**
   ```bash
   cd apps/api && npm run test:e2e
   ```

---

## Related

- `e2e-testing-skill/SKILL.md` - Core E2E principles
- `api-testing-skill/SKILL.md` - API testing patterns
- `INTEGRATION_EXAMPLES.md` - Full integration flow examples

