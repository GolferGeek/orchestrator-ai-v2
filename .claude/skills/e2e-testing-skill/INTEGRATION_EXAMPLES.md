# Integration E2E Test Examples

Real-world examples of full integration E2E tests spanning multiple systems: **Web → API → LangGraph → Database** using **NO MOCKING**.

---

## Example 1: Full User Flow (Web → API → LangGraph)

**Test:** Complete user flow from frontend component through API to LangGraph workflow.

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import ConversationWindow from '@/components/conversation-window.vue';
import { useConversationStore } from '@/stores/conversation.store';

describe('Full User Flow E2E', () => {
  let supabase: SupabaseClient;
  let authToken: string;
  let testUserId: string;

  const testEmail = process.env.SUPABASE_TEST_USER || 'demo.user@playground.com';
  const testPassword = process.env.SUPABASE_TEST_PASSWORD || 'demouser';
  const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
  const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
  const API_BASE = process.env.API_BASE_URL || 'http://localhost:6100';

  beforeAll(async () => {
    supabase = createClient(supabaseUrl, supabaseKey);

    // Real authentication - NO MOCKS
    const { data: authData } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    authToken = authData.session.access_token;
    testUserId = authData.user.id;

    setActivePinia(createPinia());
  });

  it('should complete full flow: frontend → API → LangGraph → database', async () => {
    const conversationId = uuidv4();
    const taskId = uuidv4();

    // 1. Frontend: User sends message via component
    const store = useConversationStore();
    store.setExecutionContext({
      orgSlug: 'test-org',
      userId: testUserId,
      conversationId
    });

    const wrapper = mount(ConversationWindow, {
      global: {
        plugins: [createPinia()]
      }
    });

    // 2. Frontend: Component calls service
    const messageInput = wrapper.find('[data-testid="message-input"]');
    await messageInput.setValue('Create a blog post about AI');
    await wrapper.find('[data-testid="send-button"]').trigger('click');

    // Wait for API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 3. API: Verify real API call was made
    const { data: apiTasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(1);

    expect(apiTasks).toBeDefined();
    expect(apiTasks.length).toBeGreaterThan(0);

    const apiTask = apiTasks[0];
    expect(apiTask.user_id).toBe(testUserId);
    expect(apiTask.status).toBe('pending');

    // 4. LangGraph: Verify workflow started
    const { data: workflowState } = await supabase
      .from('marketing_swarm')
      .select('*')
      .eq('conversation_id', conversationId)
      .single();

    expect(workflowState).toBeDefined();
    expect(workflowState.status).toBe('processing');

    // 5. Observability: Verify events emitted
    const { data: events } = await supabase
      .from('observability_events')
      .select('*')
      .eq('task_id', apiTask.task_id)
      .order('created_at', { ascending: true });

    expect(events).toBeDefined();
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].event_type).toBe('task_created');
  });
});
```

---

## Example 2: Agent Execution Flow (API → LangGraph → Database)

**Test:** Complete agent execution from API endpoint through LangGraph workflow to database.

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../../app.module';
import { v4 as uuidv4 } from 'uuid';

describe('Agent Execution Flow E2E', () => {
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

  it('should execute agent: API → LangGraph → Database', async () => {
    const taskId = uuidv4();
    const conversationId = uuidv4();

    // 1. API: Create task via endpoint - NO MOCKS
    const apiResponse = await request(app.getHttpServer())
      .post('/agents/marketing/blog_post/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        taskId,
        conversationId,
        content: 'Write a blog post about testing',
        context: {
          userPreferences: { tone: 'professional' }
        }
      })
      .expect(200);

    expect(apiResponse.body.taskId).toBe(taskId);

    // 2. Database: Verify task created
    const { data: taskData } = await supabase
      .from('tasks')
      .select('*')
      .eq('task_id', taskId)
      .single();

    expect(taskData).toBeDefined();
    expect(taskData.user_id).toBe(testUserId);
    expect(taskData.status).toBe('pending');

    // 3. LangGraph: Verify workflow state
    const { data: workflowState } = await supabase
      .from('marketing_swarm')
      .select('*')
      .eq('conversation_id', conversationId)
      .single();

    expect(workflowState).toBeDefined();
    expect(workflowState.status).toBe('processing');

    // 4. Observability: Verify events
    await new Promise(resolve => setTimeout(resolve, 2000));

    const { data: events } = await supabase
      .from('observability_events')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });

    expect(events.length).toBeGreaterThan(0);
    expect(events.some(e => e.event_type === 'workflow_started')).toBe(true);

    // 5. LLM: Verify usage tracked
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

## Example 3: Observability Flow (LangGraph → API → Frontend)

**Test:** Verify observability events flow from LangGraph through API to frontend SSE stream.

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../../app.module';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

describe('Observability Flow E2E', () => {
  let app: INestApplication;
  let supabase: SupabaseClient;
  let authToken: string;
  let testUserId: string;

  const testEmail = process.env.SUPABASE_TEST_USER || 'demo.user@playground.com';
  const testPassword = process.env.SUPABASE_TEST_PASSWORD || 'demouser';
  const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
  const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
  const API_BASE = process.env.API_BASE_URL || 'http://localhost:6100';

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

  it('should flow observability events: LangGraph → API → Frontend SSE', async () => {
    const taskId = uuidv4();
    const conversationId = uuidv4();

    // 1. LangGraph: Start workflow (emits events)
    await request(app.getHttpServer())
      .post('/agents/marketing/blog_post/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        taskId,
        conversationId,
        content: 'Test content'
      })
      .expect(200);

    // Wait for events
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 2. API: Verify events stored in database
    const { data: dbEvents } = await supabase
      .from('observability_events')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });

    expect(dbEvents).toBeDefined();
    expect(dbEvents.length).toBeGreaterThan(0);

    // 3. API: Verify SSE endpoint returns events
    const sseResponse = await request(app.getHttpServer())
      .get(`/observability/stream?taskId=${taskId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(sseResponse.text).toBeDefined();
    expect(sseResponse.text).toContain('data:');

    // 4. Frontend: Verify events can be consumed via SSE
    // (In real frontend, this would be EventSource)
    const events = sseResponse.text
      .split('\n')
      .filter(line => line.startsWith('data:'))
      .map(line => JSON.parse(line.replace('data: ', '')));

    expect(events.length).toBeGreaterThan(0);
    expect(events[0]).toHaveProperty('event_type');
    expect(events[0]).toHaveProperty('task_id', taskId);
  });
});
```

---

## Example 4: ExecutionContext Flow (Frontend → API → LangGraph)

**Test:** Verify ExecutionContext flows correctly through entire system.

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../../app.module';
import { v4 as uuidv4 } from 'uuid';

describe('ExecutionContext Flow E2E', () => {
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

  it('should flow ExecutionContext: Frontend → API → LangGraph', async () => {
    const conversationId = uuidv4();
    const taskId = uuidv4();
    const orgSlug = 'test-org';

    // 1. Frontend: ExecutionContext created in store
    // (Simulated via API call with ExecutionContext in headers/body)
    const apiResponse = await request(app.getHttpServer())
      .post('/agents/marketing/blog_post/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .set('X-Org-Slug', orgSlug)
      .send({
        taskId,
        conversationId,
        content: 'Test content',
        context: {
          orgSlug,
          userId: testUserId,
          conversationId
        }
      })
      .expect(200);

    expect(apiResponse.body.taskId).toBe(taskId);

    // 2. API: Verify ExecutionContext stored in task
    const { data: taskData } = await supabase
      .from('tasks')
      .select('*')
      .eq('task_id', taskId)
      .single();

    expect(taskData).toBeDefined();
    expect(taskData.user_id).toBe(testUserId);
    expect(taskData.org_slug).toBe(orgSlug);
    expect(taskData.conversation_id).toBe(conversationId);

    // 3. LangGraph: Verify ExecutionContext in workflow state
    const { data: workflowState } = await supabase
      .from('marketing_swarm')
      .select('*')
      .eq('conversation_id', conversationId)
      .single();

    expect(workflowState).toBeDefined();
    expect(workflowState.user_id).toBe(testUserId);
    expect(workflowState.org_slug).toBe(orgSlug);

    // 4. Verify ExecutionContext used in all operations
    const { data: usageData } = await supabase
      .from('llm_usage')
      .select('*')
      .eq('task_id', taskId)
      .single();

    expect(usageData).toBeDefined();
    expect(usageData.user_id).toBe(testUserId);
  });
});
```

---

## Key Principles Demonstrated

1. **Full Stack Integration** - Tests span multiple systems
2. **Real Data Flow** - Data flows through entire system
3. **Real State Verification** - Verify state at each layer
4. **Real Event Flow** - Events flow through observability system
5. **Real ExecutionContext** - ExecutionContext flows correctly
6. **No Mocks** - All systems are real

---

## Setup Requirements

**Before running these tests:**

1. **Start All Services:**
   ```bash
   # Terminal 1: Supabase
   npm run dev:supabase:start

   # Terminal 2: API Server
   cd apps/api && npm run start:dev

   # Terminal 3: Web Server (for web tests)
   cd apps/web && npm run dev

   # Terminal 4: LangGraph (if separate)
   cd apps/langgraph && npm run start:dev
   ```

2. **Set Environment Variables:**
   ```bash
   SUPABASE_URL=http://127.0.0.1:54321
   SUPABASE_ANON_KEY=<your-anon-key>
   SUPABASE_TEST_USER=demo.user@playground.com
   SUPABASE_TEST_PASSWORD=demouser
   API_BASE_URL=http://localhost:6100
   DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
   ```

3. **Run Tests:**
   ```bash
   # API integration tests
   cd apps/api && npm run test:e2e

   # Web integration tests
   cd apps/web && npm run test:e2e

   # LangGraph integration tests
   cd apps/langgraph && npm run test:e2e
   ```

---

## Related

- `e2e-testing-skill/SKILL.md` - Core E2E principles
- `API_EXAMPLES.md` - API-specific examples
- `WEB_EXAMPLES.md` - Web-specific examples
- `LANGGRAPH_EXAMPLES.md` - LangGraph-specific examples
- `execution-context-skill/` - ExecutionContext patterns
- `transport-types-skill/` - A2A protocol patterns

