# Web E2E Test Examples

Real-world examples of E2E tests for Vue web applications using **NO MOCKING** - real components, real stores, real services, real API calls.

---

## Example 1: Component with Real Store Interaction

**Test:** Vue component that interacts with real Pinia store and real API service.

```typescript
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import UserProfile from '@/components/user-profile.vue';
import { useUserStore } from '@/stores/user.store';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

describe('UserProfile Component E2E', () => {
  let supabase: SupabaseClient;
  let authToken: string;
  let testUserId: string;

  const testEmail = process.env.SUPABASE_TEST_USER || 'demo.user@playground.com';
  const testPassword = process.env.SUPABASE_TEST_PASSWORD || 'demouser';
  const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
  const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

  beforeAll(async () => {
    // Real Supabase client - NO MOCKS
    supabase = createClient(supabaseUrl, supabaseKey);

    // Real authentication
    const { data: authData } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    authToken = authData.session.access_token;
    testUserId = authData.user.id;

    // Real Pinia store setup
    setActivePinia(createPinia());
  });

  it('should render user profile with real store data', async () => {
    const store = useUserStore();
    
    // Real API call to fetch user - NO MOCKS
    await store.fetchUser(testUserId);

    // Verify real store state
    expect(store.user).toBeDefined();
    expect(store.user.id).toBe(testUserId);
    expect(store.user.email).toBe(testEmail);

    // Mount component with real store
    const wrapper = mount(UserProfile, {
      global: {
        plugins: [createPinia()]
      }
    });

    // Verify component renders real data
    expect(wrapper.find('.user-name').text()).toBe(store.user.name);
    expect(wrapper.find('.user-email').text()).toBe(store.user.email);
  });
});
```

---

## Example 2: Service with Real API Calls

**Test:** Vue service that makes real API calls to backend endpoints.

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { UserService } from '@/services/user.service';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import axios from 'axios';

describe('UserService E2E', () => {
  let supabase: SupabaseClient;
  let authToken: string;
  let userService: UserService;

  const testEmail = process.env.SUPABASE_TEST_USER || 'demo.user@playground.com';
  const testPassword = process.env.SUPABASE_TEST_PASSWORD || 'demouser';
  const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
  const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
  const API_BASE = process.env.API_BASE_URL || 'http://localhost:6100';

  beforeAll(async () => {
    supabase = createClient(supabaseUrl, supabaseKey);

    // Real authentication
    const { data: authData } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    authToken = authData.session.access_token;

    // Real service instance - NO MOCKS
    userService = new UserService();
  });

  it('should fetch user data with real API call', async () => {
    // Real API call via service - NO MOCKS
    const user = await userService.getUser(authToken);

    expect(user).toBeDefined();
    expect(user.id).toBeDefined();
    expect(user.email).toBe(testEmail);
  });

  it('should update user with real API call', async () => {
    const updates = {
      name: 'Updated Name',
      bio: 'Updated bio'
    };

    // Real API call via service - NO MOCKS
    const updatedUser = await userService.updateUser(authToken, updates);

    expect(updatedUser.name).toBe(updates.name);
    expect(updatedUser.bio).toBe(updates.bio);

    // Verify real database was updated
    const { data: dbUser } = await supabase
      .from('users')
      .select('*')
      .eq('id', updatedUser.id)
      .single();

    expect(dbUser.name).toBe(updates.name);
  });
});
```

---

## Example 3: Conversation Window with Real Agent Calls

**Test:** Conversation window component that makes real agent calls and displays real responses.

```typescript
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { describe, it, expect, beforeAll } from 'vitest';
import ConversationWindow from '@/components/conversation-window.vue';
import { useConversationStore } from '@/stores/conversation.store';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

describe('ConversationWindow E2E', () => {
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

    setActivePinia(createPinia());
  });

  it('should send message and receive real agent response', async () => {
    const conversationId = uuidv4();
    const store = useConversationStore();

    // Set real ExecutionContext - NO MOCKS
    store.setExecutionContext({
      orgSlug: 'test-org',
      userId: testUserId,
      conversationId
    });

    // Mount component with real store
    const wrapper = mount(ConversationWindow, {
      global: {
        plugins: [createPinia()]
      }
    });

    // Send real message - NO MOCKS
    const messageInput = wrapper.find('[data-testid="message-input"]');
    await messageInput.setValue('Hello, agent!');
    
    const sendButton = wrapper.find('[data-testid="send-button"]');
    await sendButton.trigger('click');

    // Wait for real API response
    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify real response displayed
    const messages = wrapper.findAll('[data-testid="message"]');
    expect(messages.length).toBeGreaterThan(1);
    
    const lastMessage = messages[messages.length - 1];
    expect(lastMessage.text()).toBeTruthy();
  });
});
```

---

## Example 4: ExecutionContext Flow with Real Backend

**Test:** Verify ExecutionContext flows correctly from frontend through services to backend.

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { useExecutionContextStore } from '@/stores/execution-context.store';
import { AgentService } from '@/services/agent.service';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

describe('ExecutionContext Flow E2E', () => {
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
  });

  it('should flow ExecutionContext from store through service to API', async () => {
    const store = useExecutionContextStore();
    const agentService = new AgentService();

    const conversationId = uuidv4();
    const orgSlug = 'test-org';

    // Set real ExecutionContext in store - NO MOCKS
    store.setExecutionContext({
      orgSlug,
      userId: testUserId,
      conversationId
    });

    // Verify store has ExecutionContext
    expect(store.context).toBeDefined();
    expect(store.context.orgSlug).toBe(orgSlug);
    expect(store.context.userId).toBe(testUserId);

    // Service receives ExecutionContext from store
    const taskId = uuidv4();
    const response = await agentService.executeAgent('marketing', 'blog_post', {
      taskId,
      content: 'Test content'
    }, store.context);

    // Verify real API call included ExecutionContext
    expect(response).toBeDefined();
    expect(response.taskId).toBe(taskId);

    // Verify backend received ExecutionContext (check database)
    const { data: taskData } = await supabase
      .from('tasks')
      .select('*')
      .eq('task_id', taskId)
      .single();

    expect(taskData).toBeDefined();
    expect(taskData.user_id).toBe(testUserId);
    expect(taskData.org_slug).toBe(orgSlug);
  });
});
```

---

## Example 5: Real Component Rendering with Real Data

**Test:** Component that fetches and displays real data from backend.

```typescript
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { describe, it, expect, beforeAll } from 'vitest';
import UserList from '@/components/user-list.vue';
import { useUserStore } from '@/stores/user.store';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

describe('UserList Component E2E', () => {
  let supabase: SupabaseClient;
  let authToken: string;

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
    setActivePinia(createPinia());
  });

  it('should render list of users from real API', async () => {
    const store = useUserStore();

    // Fetch real users - NO MOCKS
    await store.fetchUsers();

    // Verify real store state
    expect(store.users).toBeDefined();
    expect(store.users.length).toBeGreaterThan(0);

    // Mount component with real store
    const wrapper = mount(UserList, {
      global: {
        plugins: [createPinia()]
      }
    });

    // Wait for component to render
    await wrapper.vm.$nextTick();

    // Verify component displays real users
    const userItems = wrapper.findAll('[data-testid="user-item"]');
    expect(userItems.length).toBe(store.users.length);

    // Verify first user data is displayed
    const firstUser = userItems[0];
    expect(firstUser.find('.user-name').text()).toBe(store.users[0].name);
    expect(firstUser.find('.user-email').text()).toBe(store.users[0].email);
  });
});
```

---

## Key Principles Demonstrated

1. **Real Components** - Actual Vue components, not mocked
2. **Real Stores** - Pinia stores with real state
3. **Real Services** - Services making real API calls
4. **Real API Calls** - HTTP requests to actual endpoints
5. **Real ExecutionContext** - Actual ExecutionContext flow
6. **No Mocks** - All interactions are real

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

3. **Start Web Server:**
   ```bash
   cd apps/web && npm run dev
   ```

4. **Set Environment Variables:**
   ```bash
   SUPABASE_URL=http://127.0.0.1:54321
   SUPABASE_ANON_KEY=<your-anon-key>
   SUPABASE_TEST_USER=demo.user@playground.com
   SUPABASE_TEST_PASSWORD=demouser
   API_BASE_URL=http://localhost:6100
   ```

5. **Run Tests:**
   ```bash
   cd apps/web && npm run test:e2e
   ```

---

## Related

- `e2e-testing-skill/SKILL.md` - Core E2E principles
- `web-testing-skill/SKILL.md` - Web testing patterns
- `INTEGRATION_EXAMPLES.md` - Full integration flow examples

