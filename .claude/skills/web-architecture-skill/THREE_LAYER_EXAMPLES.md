# Three-Layer Architecture Examples

Complete examples demonstrating the three-layer architecture: Store → Service → Component interactions.

---

## Example 1: User Profile Component Flow

**Complete flow:** Component → Service → API → Store → Component

### Component Layer

```vue
<!-- apps/web/src/components/user-profile.vue -->
<template>
  <div class="user-profile">
    <div v-if="loading">Loading...</div>
    <div v-else>
      <h1>{{ userStore.user?.name }}</h1>
      <p>{{ userStore.user?.email }}</p>
      <button @click="handleUpdate">Update Profile</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useUserStore } from '@/stores/user.store';
import { useUserService } from '@/services/user.service';
import { useExecutionContextStore } from '@/stores/executionContextStore';

// Store: Read state
const userStore = useUserStore();
const executionContextStore = useExecutionContextStore();

// Service: For operations
const userService = useUserService();

const loading = computed(() => userStore.loading);

// Component: Uses store for state, service for operations
onMounted(async () => {
  const context = executionContextStore.current;
  await userService.fetchUser(context); // Service handles API call
});

async function handleUpdate() {
  const context = executionContextStore.current;
  await userService.updateUser(context, {
    name: 'Updated Name'
  }); // Service handles API call, updates store
}
</script>
```

### Store Layer

```typescript
// apps/web/src/stores/user.store.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useUserStore = defineStore('user', () => {
  // State ONLY - no async, no API calls, no business logic
  const user = ref<User | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Computed properties
  const isAuthenticated = computed(() => user.value !== null);
  const userName = computed(() => user.value?.name || '');

  // Synchronous mutations ONLY
  function setUser(newUser: User) {
    user.value = newUser;
  }

  function setLoading(isLoading: boolean) {
    loading.value = isLoading;
  }

  function setError(errorMessage: string | null) {
    error.value = errorMessage;
  }

  function clearUser() {
    user.value = null;
  }

  return {
    // State
    user,
    loading,
    error,
    // Computed
    isAuthenticated,
    userName,
    // Mutations
    setUser,
    setLoading,
    setError,
    clearUser
  };
});
```

### Service Layer

```typescript
// apps/web/src/services/user.service.ts
import { useUserStore } from '@/stores/user.store';
import { ExecutionContext } from '@orchestrator-ai/transport-types';
import axios from 'axios';

export function useUserService() {
  const userStore = useUserStore();

  // All async operations
  async function fetchUser(context: ExecutionContext) {
    try {
      userStore.setLoading(true);
      userStore.setError(null);

      // API call
      const response = await axios.get(`/api/users/${context.userId}`, {
        headers: {
          'X-Org-Slug': context.orgSlug,
          'Authorization': `Bearer ${token}`
        }
      });

      // Update store after success
      userStore.setUser(response.data);
      userStore.setLoading(false);
    } catch (error) {
      userStore.setError(error.message);
      userStore.setLoading(false);
      throw error;
    }
  }

  async function updateUser(context: ExecutionContext, updates: Partial<User>) {
    try {
      userStore.setLoading(true);
      userStore.setError(null);

      // API call
      const response = await axios.put(`/api/users/${context.userId}`, updates, {
        headers: {
          'X-Org-Slug': context.orgSlug,
          'Authorization': `Bearer ${token}`
        }
      });

      // Update store after success
      userStore.setUser(response.data);
      userStore.setLoading(false);
    } catch (error) {
      userStore.setError(error.message);
      userStore.setLoading(false);
      throw error;
    }
  }

  return {
    fetchUser,
    updateUser
  };
}
```

**Key Points:**
- ✅ Component uses store for state, service for operations
- ✅ Store contains ONLY state (no async, no API calls)
- ✅ Service handles ALL async operations and API calls
- ✅ Service updates store after API success

---

## Example 2: Order List with Filtering

**Complete flow:** Component → Store → Service → API → Store → Component

### Component Layer

```vue
<!-- apps/web/src/components/order-list.vue -->
<template>
  <div class="order-list">
    <input v-model="filter" @input="handleFilter" placeholder="Filter orders" />
    <div v-if="orderStore.loading">Loading orders...</div>
    <div v-else>
      <div v-for="order in filteredOrders" :key="order.id">
        {{ order.id }} - {{ order.total }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useOrderStore } from '@/stores/order.store';
import { useOrderService } from '@/services/order.service';
import { useExecutionContextStore } from '@/stores/executionContextStore';

const orderStore = useOrderStore();
const orderService = useOrderService();
const executionContextStore = useExecutionContextStore();

const filter = ref('');

// Component: Computed from store state
const filteredOrders = computed(() => {
  if (!filter.value) return orderStore.orders;
  return orderStore.orders.filter(order => 
    order.id.includes(filter.value) || 
    order.status.includes(filter.value)
  );
});

onMounted(async () => {
  const context = executionContextStore.current;
  await orderService.fetchOrders(context); // Service fetches, updates store
});

function handleFilter() {
  // No API call - just filtering local state
  // Store already has all orders
}
</script>
```

### Store Layer

```typescript
// apps/web/src/stores/order.store.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useOrderStore = defineStore('order', () => {
  // State ONLY
  const orders = ref<Order[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Computed
  const totalOrders = computed(() => orders.value.length);
  const pendingOrders = computed(() => 
    orders.value.filter(o => o.status === 'pending')
  );

  // Synchronous mutations
  function setOrders(newOrders: Order[]) {
    orders.value = newOrders;
  }

  function addOrder(order: Order) {
    orders.value.push(order);
  }

  function updateOrder(orderId: string, updates: Partial<Order>) {
    const index = orders.value.findIndex(o => o.id === orderId);
    if (index !== -1) {
      orders.value[index] = { ...orders.value[index], ...updates };
    }
  }

  function setLoading(isLoading: boolean) {
    loading.value = isLoading;
  }

  function setError(errorMessage: string | null) {
    error.value = errorMessage;
  }

  return {
    orders,
    loading,
    error,
    totalOrders,
    pendingOrders,
    setOrders,
    addOrder,
    updateOrder,
    setLoading,
    setError
  };
});
```

### Service Layer

```typescript
// apps/web/src/services/order.service.ts
import { useOrderStore } from '@/stores/order.store';
import { ExecutionContext } from '@orchestrator-ai/transport-types';
import axios from 'axios';

export function useOrderService() {
  const orderStore = useOrderStore();

  async function fetchOrders(context: ExecutionContext) {
    try {
      orderStore.setLoading(true);
      orderStore.setError(null);

      // API call
      const response = await axios.get('/api/orders', {
        headers: {
          'X-Org-Slug': context.orgSlug,
          'X-User-Id': context.userId,
          'Authorization': `Bearer ${token}`
        }
      });

      // Update store after success
      orderStore.setOrders(response.data);
      orderStore.setLoading(false);
    } catch (error) {
      orderStore.setError(error.message);
      orderStore.setLoading(false);
      throw error;
    }
  }

  async function createOrder(context: ExecutionContext, orderData: OrderData) {
    try {
      orderStore.setLoading(true);
      orderStore.setError(null);

      // API call
      const response = await axios.post('/api/orders', orderData, {
        headers: {
          'X-Org-Slug': context.orgSlug,
          'Authorization': `Bearer ${token}`
        }
      });

      // Update store after success
      orderStore.addOrder(response.data);
      orderStore.setLoading(false);
    } catch (error) {
      orderStore.setError(error.message);
      orderStore.setLoading(false);
      throw error;
    }
  }

  return {
    fetchOrders,
    createOrder
  };
}
```

**Key Points:**
- ✅ Component filters local state (no API call)
- ✅ Store holds all orders in memory
- ✅ Service fetches orders and updates store
- ✅ Component reacts to store changes

---

## Example 3: Conversation Window with Agent Calls

**Complete flow:** Component → Service → A2A Orchestrator → API → Store → Component

### Component Layer

```vue
<!-- apps/web/src/components/conversation-window.vue -->
<template>
  <div class="conversation-window">
    <div v-for="message in conversationStore.messages" :key="message.id">
      <div :class="message.role">{{ message.content }}</div>
    </div>
    <input v-model="inputMessage" @keyup.enter="sendMessage" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useConversationStore } from '@/stores/conversation.store';
import { useAgentService } from '@/services/agent.service';
import { useExecutionContextStore } from '@/stores/executionContextStore';

const conversationStore = useConversationStore();
const agentService = useAgentService();
const executionContextStore = useExecutionContextStore();

const inputMessage = ref('');

async function sendMessage() {
  const context = executionContextStore.current;
  const message = inputMessage.value;
  
  // Add user message to store
  conversationStore.addMessage({
    role: 'user',
    content: message
  });

  // Service handles agent call
  await agentService.sendMessage(context, message);
  
  inputMessage.value = '';
}
</script>
```

### Store Layer

```typescript
// apps/web/src/stores/conversation.store.ts
import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useConversationStore = defineStore('conversation', () => {
  // State ONLY
  const messages = ref<Message[]>([]);
  const loading = ref(false);

  // Synchronous mutations
  function addMessage(message: Message) {
    messages.value.push(message);
  }

  function setMessages(newMessages: Message[]) {
    messages.value = newMessages;
  }

  function setLoading(isLoading: boolean) {
    loading.value = isLoading;
  }

  return {
    messages,
    loading,
    addMessage,
    setMessages,
    setLoading
  };
});
```

### Service Layer

```typescript
// apps/web/src/services/agent.service.ts
import { useConversationStore } from '@/stores/conversation.store';
import { ExecutionContext } from '@orchestrator-ai/transport-types';
import { a2aOrchestrator } from '@/services/a2a-orchestrator';

export function useAgentService() {
  const conversationStore = useConversationStore();

  async function sendMessage(context: ExecutionContext, message: string) {
    try {
      conversationStore.setLoading(true);

      // A2A call via orchestrator
      const response = await a2aOrchestrator.execute('marketing.blog_post', {
        userMessage: message,
        context // ✅ Pass whole context
      });

      // Add assistant response to store
      conversationStore.addMessage({
        role: 'assistant',
        content: response.content
      });

      conversationStore.setLoading(false);
    } catch (error) {
      conversationStore.setLoading(false);
      throw error;
    }
  }

  return {
    sendMessage
  };
}
```

**Key Points:**
- ✅ Component adds user message to store immediately
- ✅ Service handles A2A call
- ✅ Service adds assistant response to store
- ✅ Component reacts to store changes

---

## Key Principles Demonstrated

1. **Clear Separation** - Store (state), Service (operations), Component (UI)
2. **Unidirectional Flow** - Component → Service → API → Store → Component
3. **No Business Logic in Store** - Store only holds state
4. **No API Calls in Component** - Component uses services
5. **Store Updates After Success** - Services update stores after API success

---

## Related

- `SKILL.md` - Core web architecture principles
- `ARCHITECTURE.md` - Three-layer architecture details
- `PATTERNS.md` - Web-specific patterns

