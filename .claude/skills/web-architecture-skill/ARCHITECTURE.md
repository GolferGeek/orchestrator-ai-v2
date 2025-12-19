# Three-Layer Architecture

The web application follows a strict three-layer architecture: Store → Service → Component.

## Layer Responsibilities

### Store Layer (`apps/web/src/stores/`)

**Purpose**: State management only

**Responsibilities**:
- Store application state
- Provide reactive getters
- Provide synchronous mutations
- Vue reactivity for UI updates

**What Stores DO:**
- ✅ Define state with `ref()` or `reactive()`
- ✅ Provide computed getters
- ✅ Provide synchronous mutation functions
- ✅ Use Pinia `defineStore()` with Composition API

**What Stores DON'T DO:**
- ❌ No async operations
- ❌ No API calls
- ❌ No business logic
- ❌ No side effects

**Example**:
```typescript
export const useConversationsStore = defineStore('conversations', () => {
  const conversations = ref<Conversation[]>([]);
  
  const conversationCount = computed(() => conversations.value.length);
  
  function setConversations(newConversations: Conversation[]) {
    conversations.value = newConversations;
  }
  
  return {
    conversations,
    conversationCount,
    setConversations,
  };
});
```

### Service Layer (`apps/web/src/services/`)

**Purpose**: All async operations and business logic

**Responsibilities**:
- Make API calls
- Handle business logic
- Process data
- Update stores after success
- Handle errors and loading states

**What Services DO:**
- ✅ Make API calls (`apiService.get()`, `apiService.post()`, etc.)
- ✅ Handle business logic
- ✅ Process and transform data
- ✅ Call store mutations after success
- ✅ Handle errors and loading states
- ✅ Use ExecutionContext from store

**What Services DON'T DO:**
- ❌ No state management (uses stores)
- ❌ No direct UI updates (updates stores, UI reacts)

**Example**:
```typescript
class ConversationsService {
  async fetchConversations(): Promise<Conversation[]> {
    const ctx = useExecutionContextStore().current;
    const data = await apiService.get<Conversation[]>(
      `/conversations?orgSlug=${ctx.orgSlug}`
    );
    
    const store = useConversationsStore();
    store.setConversations(data); // Update store after success
    
    return data;
  }
}

export const conversationsService = new ConversationsService();
```

### Component Layer (`apps/web/src/components/` or `apps/web/src/views/`)

**Purpose**: UI presentation

**Responsibilities**:
- Render UI
- Handle user interactions
- Use stores for state
- Use services for operations
- Use composables for reusable logic

**What Components DO:**
- ✅ Render UI with Vue templates
- ✅ Handle user interactions (clicks, inputs, etc.)
- ✅ Use stores for state (via `useStore()`)
- ✅ Use services for operations (via service functions)
- ✅ Use composables for reusable logic
- ✅ React to store changes (Vue reactivity)

**What Components DON'T DO:**
- ❌ No API calls directly (use services)
- ❌ No business logic (use services)
- ❌ No state management (use stores)

**Example**:
```vue
<template>
  <div>
    <h2>Conversations ({{ conversationCount }})</h2>
    <button @click="loadConversations">Load</button>
    <ul>
      <li v-for="conv in conversations" :key="conv.id">
        {{ conv.title }}
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { useConversationsStore } from '@/stores/conversationsStore';
import { conversationsService } from '@/services/conversationsService';

const store = useConversationsStore();
const conversations = computed(() => store.conversations);
const conversationCount = computed(() => store.conversationCount);

async function loadConversations() {
  await conversationsService.fetchConversations();
}
</script>
```

## Data Flow

### Reading Data

```
Component → Store (getter) → Reactive UI Update
```

1. Component accesses store getter
2. Store returns reactive state
3. Vue reactivity updates UI automatically

### Writing Data

```
Component → Service (operation) → API Call → Store (mutation) → Reactive UI Update
```

1. Component calls service function
2. Service makes API call
3. Service calls store mutation after success
4. Store updates state
5. Vue reactivity updates UI automatically

## Layer Violations

### Store Violations

**❌ Bad: Async in Store**
```typescript
// WRONG: Store should not have async operations
async function fetchConversations() {
  const data = await apiService.get('/conversations');
  conversations.value = data;
}
```

**✅ Good: Service Updates Store**
```typescript
// Store: Synchronous mutation only
function setConversations(newConversations: Conversation[]) {
  conversations.value = newConversations;
}

// Service: Async operation
async function fetchConversations() {
  const data = await apiService.get('/conversations');
  const store = useConversationsStore();
  store.setConversations(data); // Update store after success
}
```

### Service Violations

**❌ Bad: State Management in Service**
```typescript
// WRONG: Service should not manage state
class ConversationsService {
  private conversations: Conversation[] = []; // State in service
  
  getConversations() {
    return this.conversations;
  }
}
```

**✅ Good: Service Uses Store**
```typescript
// Service: Uses store for state
class ConversationsService {
  async fetchConversations() {
    const data = await apiService.get('/conversations');
    const store = useConversationsStore();
    store.setConversations(data); // Update store
    return data;
  }
}
```

### Component Violations

**❌ Bad: API Call in Component**
```vue
<script setup>
// WRONG: Component should not make API calls directly
async function loadData() {
  const data = await fetch('/api/conversations');
  // ...
}
</script>
```

**✅ Good: Component Uses Service**
```vue
<script setup>
import { conversationsService } from '@/services/conversationsService';

// Component: Uses service for operations
async function loadData() {
  await conversationsService.fetchConversations();
}
</script>
```

## Composables in the Architecture

Composables bridge stores, services, and components:

```
Component → Composable → Store + Service
```

**Example**:
```typescript
export function useConversations() {
  const store = useConversationsStore();
  const service = conversationsService;
  
  const conversations = computed(() => store.conversations);
  
  async function load() {
    await service.fetchConversations();
  }
  
  return {
    conversations,
    load,
  };
}
```

**Component Usage**:
```vue
<script setup>
const { conversations, load } = useConversations();
</script>
```

## Related

- **`FILE_CLASSIFICATION.md`**: How to classify files by layer
- **`PATTERNS.md`**: Web-specific patterns
- **`VIOLATIONS.md`**: Common violations and fixes

