# LangGraph E2E Test Examples

Real-world examples of E2E tests for LangGraph workflows using **NO MOCKING** - real database, real workflows, real state machines, real HITL.

---

## Example 1: Workflow Execution with Real Database

**Test:** Execute LangGraph workflow with real database checkpointing and state persistence.

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { StateGraph } from '@langchain/langgraph';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { v4 as uuidv4 } from 'uuid';

describe('LangGraph Workflow E2E', () => {
  let supabase: SupabaseClient;
  let checkpointSaver: PostgresSaver;
  let workflow: StateGraph;

  const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  beforeAll(async () => {
    // Real Supabase client - NO MOCKS
    supabase = createClient(supabaseUrl, supabaseKey);

    // Real database checkpoint saver
    const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres';
    checkpointSaver = await PostgresSaver.fromConnString(dbUrl);

    // Real workflow setup
    workflow = new StateGraph({
      // ... workflow definition
    }).compile({ checkpointer: checkpointSaver });
  });

  it('should execute workflow with real database checkpointing', async () => {
    const threadId = uuidv4();
    const initialState = {
      taskId: uuidv4(),
      conversationId: uuidv4(),
      content: 'Test content',
      status: 'pending'
    };

    // Real workflow execution - NO MOCKS
    const result = await workflow.invoke(initialState, {
      configurable: { thread_id: threadId }
    });

    expect(result).toBeDefined();
    expect(result.status).toBe('completed');

    // Verify real checkpoint in database
    const { data: checkpoint } = await supabase
      .from('checkpoints')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    expect(checkpoint).toBeDefined();
    expect(checkpoint.checkpoint).toBeDefined();
  });
});
```

---

## Example 2: HITL Workflow with Real Task Creation

**Test:** HITL workflow that creates real tasks in database and waits for human approval.

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { StateGraph } from '@langchain/langgraph';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { v4 as uuidv4 } from 'uuid';

describe('HITL Workflow E2E', () => {
  let supabase: SupabaseClient;
  let workflow: StateGraph;
  let testUserId: string;

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

    testUserId = authData.user.id;

    const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres';
    const checkpointSaver = await PostgresSaver.fromConnString(dbUrl);

    workflow = new StateGraph({
      // ... workflow with HITL node
    }).compile({ checkpointer: checkpointSaver });
  });

  it('should create real HITL task and wait for approval', async () => {
    const threadId = uuidv4();
    const initialState = {
      taskId: uuidv4(),
      userId: testUserId,
      content: 'Content requiring approval',
      status: 'pending'
    };

    // Real workflow execution - NO MOCKS
    const result = await workflow.invoke(initialState, {
      configurable: { thread_id: threadId }
    });

    // Workflow should pause at HITL node
    expect(result.status).toBe('waiting_for_approval');

    // Verify real HITL task created in database
    const { data: hitlTask, error } = await supabase
      .from('hitl_tasks')
      .select('*')
      .eq('task_id', initialState.taskId)
      .single();

    expect(error).toBeNull();
    expect(hitlTask).toBeDefined();
    expect(hitlTask.status).toBe('pending');
    expect(hitlTask.user_id).toBe(testUserId);

    // Simulate real human approval
    const { error: updateError } = await supabase
      .from('hitl_tasks')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .eq('task_id', initialState.taskId);

    expect(updateError).toBeNull();

    // Continue workflow with approval
    const finalResult = await workflow.invoke(
      { ...result, approval: 'approved' },
      { configurable: { thread_id: threadId } }
    );

    expect(finalResult.status).toBe('completed');
  });
});
```

---

## Example 3: Database-Driven State Machine

**Test:** Complex workflow using database as state machine instead of in-memory LangGraph state.

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

describe('Database-Driven State Machine E2E', () => {
  let supabase: SupabaseClient;
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

    testUserId = authData.user.id;
  });

  afterAll(async () => {
    // Cleanup test data
    // ...
  });

  it('should use database as state machine for complex workflow', async () => {
    const swarmId = uuidv4();
    const conversationId = uuidv4();

    // Create real state machine entry in database - NO MOCKS
    const { error: createError } = await supabase
      .from('marketing_swarm')
      .insert({
        id: swarmId,
        conversation_id: conversationId,
        user_id: testUserId,
        status: 'pending',
        current_step: 'initialization',
        state: { step: 'initialization', data: {} }
      });

    expect(createError).toBeNull();

    // Verify initial state
    const { data: initialState } = await supabase
      .from('marketing_swarm')
      .select('*')
      .eq('id', swarmId)
      .single();

    expect(initialState.status).toBe('pending');
    expect(initialState.current_step).toBe('initialization');

    // Simulate workflow progression (processor service would do this)
    const { error: updateError } = await supabase
      .from('marketing_swarm')
      .update({
        status: 'processing',
        current_step: 'content_generation',
        state: { step: 'content_generation', data: { content: 'Generated content' } }
      })
      .eq('id', swarmId);

    expect(updateError).toBeNull();

    // Verify state progression
    const { data: updatedState } = await supabase
      .from('marketing_swarm')
      .select('*')
      .eq('id', swarmId)
      .single();

    expect(updatedState.status).toBe('processing');
    expect(updatedState.current_step).toBe('content_generation');
    expect(updatedState.state.step).toBe('content_generation');
  });
});
```

---

## Example 4: Observability with Real Event Emission

**Test:** Verify LangGraph workflows emit real observability events to API.

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { StateGraph } from '@langchain/langgraph';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

describe('LangGraph Observability E2E', () => {
  let supabase: SupabaseClient;
  let workflow: StateGraph;
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

    const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres';
    const checkpointSaver = await PostgresSaver.fromConnString(dbUrl);

    workflow = new StateGraph({
      // ... workflow with observability integration
    }).compile({ checkpointer: checkpointSaver });
  });

  it('should emit real observability events during workflow execution', async () => {
    const threadId = uuidv4();
    const taskId = uuidv4();

    // Real workflow execution - NO MOCKS
    await workflow.invoke({
      taskId,
      userId: testUserId,
      content: 'Test content'
    }, {
      configurable: { thread_id: threadId }
    });

    // Wait for events to be processed
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify real observability events in database
    const { data: events, error } = await supabase
      .from('observability_events')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });

    expect(error).toBeNull();
    expect(events).toBeDefined();
    expect(events.length).toBeGreaterThan(0);

    // Verify event types
    const eventTypes = events.map(e => e.event_type);
    expect(eventTypes).toContain('workflow_started');
    expect(eventTypes).toContain('node_executed');
    expect(eventTypes).toContain('workflow_completed');
  });
});
```

---

## Example 5: LLM Service Integration in Workflow

**Test:** LangGraph workflow that calls real LLM service via API.

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { StateGraph } from '@langchain/langgraph';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

describe('LangGraph LLM Integration E2E', () => {
  let supabase: SupabaseClient;
  let workflow: StateGraph;
  let authToken: string;

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

    const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres';
    const checkpointSaver = await PostgresSaver.fromConnString(dbUrl);

    workflow = new StateGraph({
      // ... workflow with LLM service node
    }).compile({ checkpointer: checkpointSaver });
  });

  it('should call real LLM service during workflow execution', async () => {
    const threadId = uuidv4();
    const taskId = uuidv4();

    // Real workflow execution - NO MOCKS
    const result = await workflow.invoke({
      taskId,
      prompt: 'Write a short story',
      userId: testUserId
    }, {
      configurable: { thread_id: threadId }
    });

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();

    // Verify real LLM usage was tracked
    const { data: usageData } = await supabase
      .from('llm_usage')
      .select('*')
      .eq('task_id', taskId)
      .single();

    expect(usageData).toBeDefined();
    expect(usageData.tokens_used).toBeGreaterThan(0);
    expect(usageData.model).toBeDefined();
  });
});
```

---

## Key Principles Demonstrated

1. **Real Database** - Direct database queries for state verification
2. **Real Workflows** - Actual LangGraph workflow execution
3. **Real Checkpointing** - Postgres checkpoint saver with real database
4. **Real HITL** - Actual task creation and approval flow
5. **Real Observability** - Actual event emission and storage
6. **Real LLM Service** - Actual API calls to LLM service
7. **No Mocks** - All services are real

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
   SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
   DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
   SUPABASE_TEST_USER=demo.user@playground.com
   SUPABASE_TEST_PASSWORD=demouser
   API_BASE_URL=http://localhost:6100
   ```

4. **Run Tests:**
   ```bash
   cd apps/langgraph && npm run test:e2e
   ```

---

## Related

- `e2e-testing-skill/SKILL.md` - Core E2E principles
- `langgraph-testing-skill/SKILL.md` - LangGraph testing patterns
- `langgraph-architecture-skill/DATABASE_STATE.md` - Database-driven state patterns
- `INTEGRATION_EXAMPLES.md` - Full integration flow examples

