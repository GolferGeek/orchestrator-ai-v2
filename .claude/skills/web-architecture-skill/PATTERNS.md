# Web Patterns

Web-specific patterns and best practices for Vue.js applications.

## Vue 3 Composition API Patterns

### Script Setup Syntax

**Preferred Pattern**:
```vue
<script setup lang="ts">
import { ref, computed } from 'vue';
import { useStore } from '@/stores/store';

const store = useStore();
const localState = ref(false);
const storeValue = computed(() => store.value);
</script>
```

**Why**: Cleaner, more concise, better TypeScript support

### Reactivity Patterns

**Primitives**: Use `ref()`
```typescript
const count = ref(0);
const name = ref('John');
```

**Objects**: Use `reactive()` or `ref()`
```typescript
// For objects, both work, but ref() is more consistent
const user = ref({ name: 'John', age: 30 });
// Or
const user = reactive({ name: 'John', age: 30 });
```

**Derived State**: Use `computed()`
```typescript
const fullName = computed(() => `${firstName.value} ${lastName.value}`);
```

### Composable Patterns

**Structure**:
```typescript
export function useFeature() {
  // Local state
  const state = ref(false);
  
  // Store access
  const store = useStore();
  const storeValue = computed(() => store.value);
  
  // Functions
  function doSomething() {
    // Logic
  }
  
  // Return reactive state and functions
  return {
    state,
    storeValue,
    doSomething,
  };
}
```

**Usage in Components**:
```vue
<script setup>
const { state, storeValue, doSomething } = useFeature();
</script>
```

## ExecutionContext Patterns

### Getting ExecutionContext

**From Store**:
```typescript
import { useExecutionContextStore } from '@/stores/executionContextStore';

const ctx = useExecutionContextStore().current; // Throws if not initialized
const isInit = useExecutionContextStore().isInitialized; // Check first
const conversationId = useExecutionContextStore().conversationId; // Convenience getter
```

### Passing ExecutionContext

**In Service Calls**:
```typescript
// ExecutionContext is automatically included from store
// No need to pass it explicitly
const result = await a2aOrchestrator.execute('build.create', {
  userMessage: '...',
});
```

**In API Calls**:
```typescript
const ctx = useExecutionContextStore().current;
const data = await apiService.get(`/endpoint?orgSlug=${ctx.orgSlug}`);
```

### ExecutionContext Validation

**✅ Good: Receive from Store**
```typescript
const ctx = useExecutionContextStore().current;
```

**❌ Bad: Create ExecutionContext**
```typescript
// WRONG: Never create ExecutionContext
const ctx = {
  orgSlug: '...',
  userId: '...',
  // ...
};
```

**✅ Good: Pass Whole Context**
```typescript
// Pass entire context
await service.call(ctx);
```

**❌ Bad: Cherry-Pick Fields**
```typescript
// WRONG: Don't cherry-pick fields
await service.call(ctx.orgSlug, ctx.userId);
```

## A2A Protocol Patterns

### Making A2A Calls

**Standard Pattern**:
```typescript
import { a2aOrchestrator } from '@/services/agent2agent/orchestrator/a2a-orchestrator';

const result = await a2aOrchestrator.execute('build.create', {
  userMessage: '...',
  // ExecutionContext automatically included from store
});
```

**Response Handling**:
```typescript
if (result.type === 'error') {
  // Handle error
  throw new Error(result.error);
}

if (result.type === 'deliverable') {
  // Handle deliverable
  const deliverable = result.deliverable;
}

if (result.type === 'message') {
  // Handle message
  const message = result.message;
}
```

### Transport Types

**Mode Selection**:
- `converse` - Conversational interaction
- `plan` - Planning mode
- `build` - Building/execution mode
- `hitl` - Human-in-the-loop mode

**Request Format**:
```typescript
await a2aOrchestrator.execute('build.create', {
  userMessage: JSON.stringify({
    type: 'request-type',
    // ... request data
  }),
});
```

## Store Patterns

### Pinia Store Structure

**Composition API Style**:
```typescript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useStoreName = defineStore('storeName', () => {
  // State
  const items = ref<Item[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  
  // Getters
  const itemCount = computed(() => items.value.length);
  const hasItems = computed(() => items.value.length > 0);
  
  // Mutations (synchronous only)
  function setItems(newItems: Item[]) {
    items.value = newItems;
  }
  
  function setLoading(isLoading: boolean) {
    loading.value = isLoading;
  }
  
  function setError(errorMessage: string | null) {
    error.value = errorMessage;
  }
  
  return {
    // State
    items,
    loading,
    error,
    // Getters
    itemCount,
    hasItems,
    // Mutations
    setItems,
    setLoading,
    setError,
  };
});
```

### Store Usage in Components

**Accessing Store**:
```typescript
import { useStoreName } from '@/stores/storeName';

const store = useStoreName();
const items = computed(() => store.items);
const itemCount = computed(() => store.itemCount);
```

**Using storeToRefs**:
```typescript
import { storeToRefs } from 'pinia';
import { useStoreName } from '@/stores/storeName';

const store = useStoreName();
const { items, loading, error } = storeToRefs(store); // Destructure reactive refs
```

## Service Patterns

### Service Structure

**Class-Based**:
```typescript
class ServiceName {
  async fetchData(): Promise<Data[]> {
    const ctx = useExecutionContextStore().current;
    const data = await apiService.get<Data[]>(`/endpoint?orgSlug=${ctx.orgSlug}`);
    
    const store = useStoreName();
    store.setItems(data);
    
    return data;
  }
}

export const serviceName = new ServiceName();
```

**Object-Based**:
```typescript
export const serviceName = {
  async fetchData(): Promise<Data[]> {
    const ctx = useExecutionContextStore().current;
    const data = await apiService.get<Data[]>(`/endpoint?orgSlug=${ctx.orgSlug}`);
    
    const store = useStoreName();
    store.setItems(data);
    
    return data;
  },
};
```

### Error Handling

**Service Error Handling**:
```typescript
async function fetchData(): Promise<Data[]> {
  const store = useStoreName();
  store.setLoading(true);
  store.setError(null);
  
  try {
    const data = await apiService.get<Data[]>('/endpoint');
    store.setItems(data);
    return data;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch data';
    store.setError(message);
    throw error;
  } finally {
    store.setLoading(false);
  }
}
```

## Component Patterns

### Component Structure

**Template → Script → Style**:
```vue
<template>
  <div class="component-name">
    <!-- UI markup -->
  </div>
</template>

<script setup lang="ts">
// Component logic
</script>

<style scoped>
/* Component styles */
</style>
```

### Component Logic

**Store Access**:
```typescript
import { useStoreName } from '@/stores/storeName';

const store = useStoreName();
const items = computed(() => store.items);
```

**Service Usage**:
```typescript
import { serviceName } from '@/services/serviceName';

async function loadData() {
  await serviceName.fetchData();
}
```

**Composable Usage**:
```typescript
import { useFeature } from '@/composables/useFeature';

const { state, doSomething } = useFeature();
```

## Custom UI Component Patterns

**For Complex Workflows**:
- Reference: `.claude/docs/marketing-swarm-conversation-window.md`
- Complex workflows may require database-driven state, SSE streams, dual data sources
- May require larger PRD effort

**Custom UI Detection**:
```vue
<!-- ConversationView.vue -->
<template v-if="hasCustomUI">
  <MarketingSwarmTab
    v-if="customUIComponent === 'marketing-swarm'"
    :conversation="conversation"
  />
</template>
```

**Custom UI Component**:
```vue
<script setup lang="ts">
import { useExecutionContextStore } from '@/stores/executionContextStore';
import { customService } from '@/services/customService';

// Initialize ExecutionContext
const ctx = useExecutionContextStore().current;

// Connect to SSE if needed
customService.connectToSSEStream(ctx.conversationId);

// Use service for operations
async function execute() {
  await customService.startExecution(config);
}
</script>
```

## Related

- **`FILE_CLASSIFICATION.md`**: File classification rules
- **`ARCHITECTURE.md`**: Three-layer architecture
- **`VIOLATIONS.md`**: Common violations and fixes
- **`.claude/docs/marketing-swarm-conversation-window.md`**: Complex workflow patterns

