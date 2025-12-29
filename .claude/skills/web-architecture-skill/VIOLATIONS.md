# Common Violations

Common web architecture violations and how to fix them.

## Store Violations

### Violation 1: Async Operations in Store

**❌ Bad**:
```typescript
export const useStoreName = defineStore('storeName', () => {
  const items = ref<Item[]>([]);
  
  // WRONG: Store should not have async operations
  async function fetchItems() {
    const data = await apiService.get('/items');
    items.value = data;
  }
  
  return { items, fetchItems };
});
```

**✅ Good**:
```typescript
// Store: Synchronous mutation only
export const useStoreName = defineStore('storeName', () => {
  const items = ref<Item[]>([]);
  
  function setItems(newItems: Item[]) {
    items.value = newItems;
  }
  
  return { items, setItems };
});

// Service: Async operation
class ServiceName {
  async fetchItems(): Promise<Item[]> {
    const data = await apiService.get('/items');
    const store = useStoreName();
    store.setItems(data); // Update store after success
    return data;
  }
}
```

### Violation 2: API Calls in Store

**❌ Bad**:
```typescript
export const useStoreName = defineStore('storeName', () => {
  const items = ref<Item[]>([]);
  
  // WRONG: Store should not make API calls
  function loadItems() {
    fetch('/api/items')
      .then(res => res.json())
      .then(data => {
        items.value = data;
      });
  }
  
  return { items, loadItems };
});
```

**✅ Good**:
```typescript
// Store: Synchronous mutation
export const useStoreName = defineStore('storeName', () => {
  const items = ref<Item[]>([]);
  
  function setItems(newItems: Item[]) {
    items.value = newItems;
  }
  
  return { items, setItems };
});

// Service: API call
class ServiceName {
  async loadItems(): Promise<Item[]> {
    const data = await apiService.get<Item[]>('/items');
    const store = useStoreName();
    store.setItems(data);
    return data;
  }
}
```

### Violation 3: Business Logic in Store

**❌ Bad**:
```typescript
export const useStoreName = defineStore('storeName', () => {
  const items = ref<Item[]>([]);
  
  // WRONG: Store should not contain business logic
  function processItems() {
    items.value = items.value
      .filter(item => item.active)
      .map(item => ({ ...item, processed: true }));
  }
  
  return { items, processItems };
});
```

**✅ Good**:
```typescript
// Store: State only
export const useStoreName = defineStore('storeName', () => {
  const items = ref<Item[]>([]);
  
  function setItems(newItems: Item[]) {
    items.value = newItems;
  }
  
  return { items, setItems };
});

// Service: Business logic
class ServiceName {
  async processItems(): Promise<Item[]> {
    const store = useStoreName();
    const processed = store.items
      .filter(item => item.active)
      .map(item => ({ ...item, processed: true }));
    
    store.setItems(processed);
    return processed;
  }
}
```

## Service Violations

### Violation 1: State Management in Service

**❌ Bad**:
```typescript
class ServiceName {
  private items: Item[] = []; // WRONG: Service should not manage state
  
  getItems() {
    return this.items;
  }
  
  async fetchItems() {
    this.items = await apiService.get('/items');
  }
}
```

**✅ Good**:
```typescript
class ServiceName {
  async fetchItems(): Promise<Item[]> {
    const data = await apiService.get<Item[]>('/items');
    const store = useStoreName();
    store.setItems(data); // Update store
    return data;
  }
}
```

### Violation 2: Direct Store Access Without Mutation

**❌ Bad**:
```typescript
class ServiceName {
  async updateItem(id: string) {
    const store = useStoreName();
    // WRONG: Directly mutating store state
    const item = store.items.find(i => i.id === id);
    if (item) {
      item.name = 'Updated';
    }
  }
}
```

**✅ Good**:
```typescript
class ServiceName {
  async updateItem(id: string): Promise<Item> {
    const updated = await apiService.put<Item>(`/items/${id}`, { name: 'Updated' });
    const store = useStoreName();
    const items = store.items.map(i => i.id === id ? updated : i);
    store.setItems(items); // Update store via mutation
    return updated;
  }
}
```

## Component Violations

### Violation 1: API Calls in Component

**❌ Bad**:
```vue
<script setup>
// WRONG: Component should not make API calls directly
async function loadData() {
  const response = await fetch('/api/items');
  const data = await response.json();
  // ...
}
</script>
```

**✅ Good**:
```vue
<script setup>
import { itemsService } from '@/services/itemsService';

// Component: Uses service for operations
async function loadData() {
  await itemsService.fetchItems();
}
</script>
```

### Violation 2: Business Logic in Component

**❌ Bad**:
```vue
<script setup>
import { ref } from 'vue';

const items = ref<Item[]>([]);

// WRONG: Component should not contain business logic
function processItems() {
  items.value = items.value
    .filter(item => item.active)
    .map(item => ({ ...item, processed: true }));
}
</script>
```

**✅ Good**:
```vue
<script setup>
import { useItemsStore } from '@/stores/itemsStore';
import { itemsService } from '@/services/itemsService';

const store = useItemsStore();
const items = computed(() => store.items);

// Component: Uses service for business logic
async function processItems() {
  await itemsService.processItems();
}
</script>
```

### Violation 3: Direct State Mutation in Component

**❌ Bad**:
```vue
<script setup>
import { useStoreName } from '@/stores/storeName';

const store = useStoreName();

// WRONG: Directly mutating store state
function updateItem(id: string) {
  const item = store.items.find(i => i.id === id);
  if (item) {
    item.name = 'Updated'; // Direct mutation
  }
}
</script>
```

**✅ Good**:
```vue
<script setup>
import { useStoreName } from '@/stores/storeName';
import { itemsService } from '@/services/itemsService';

const store = useStoreName();

// Component: Uses service to update
async function updateItem(id: string) {
  await itemsService.updateItem(id);
}
</script>
```

## ExecutionContext Violations

### Violation 1: Creating ExecutionContext

**❌ Bad**:
```typescript
// WRONG: Never create ExecutionContext
const ctx: ExecutionContext = {
  orgSlug: 'demo-org',
  userId: 'user-123',
  conversationId: 'conv-123',
  // ...
};
```

**✅ Good**:
```typescript
// Get ExecutionContext from store
const ctx = useExecutionContextStore().current;
```

### Violation 2: Cherry-Picking ExecutionContext Fields

**❌ Bad**:
```typescript
const ctx = useExecutionContextStore().current;

// WRONG: Don't cherry-pick fields
await service.call(ctx.orgSlug, ctx.userId);
```

**✅ Good**:
```typescript
const ctx = useExecutionContextStore().current;

// Pass entire context
await service.call(ctx);
```

### Violation 3: Not Using ExecutionContext Store

**❌ Bad**:
```typescript
// WRONG: Passing ExecutionContext as parameter
async function fetchData(ctx: ExecutionContext) {
  await apiService.get(`/endpoint?orgSlug=${ctx.orgSlug}`);
}
```

**✅ Good**:
```typescript
// Get ExecutionContext from store
async function fetchData() {
  const ctx = useExecutionContextStore().current;
  await apiService.get(`/endpoint?orgSlug=${ctx.orgSlug}`);
}
```

## A2A Protocol Violations

### Violation 1: Direct API Calls Instead of A2A Orchestrator

**❌ Bad**:
```typescript
// WRONG: Direct API call instead of A2A orchestrator
const response = await fetch('/agent-to-agent/org/agent/tasks', {
  method: 'POST',
  body: JSON.stringify({ ... }),
});
```

**✅ Good**:
```typescript
import { a2aOrchestrator } from '@/services/agent2agent/orchestrator/a2a-orchestrator';

// Use A2A orchestrator
const result = await a2aOrchestrator.execute('build.create', {
  userMessage: '...',
});
```

### Violation 2: Not Using JSON-RPC 2.0 Format

**❌ Bad**:
```typescript
// WRONG: Custom format instead of JSON-RPC 2.0
const response = await apiService.post('/agent/tasks', {
  action: 'create',
  data: { ... },
});
```

**✅ Good**:
```typescript
// Use A2A orchestrator (handles JSON-RPC 2.0 format)
const result = await a2aOrchestrator.execute('build.create', {
  userMessage: JSON.stringify({
    type: 'request-type',
    // ... request data
  }),
});
```

## File Location Violations

### Violation 1: Store File in Wrong Location

**❌ Bad**:
```
apps/web/src/services/storeName.ts  // WRONG: Store in services/
```

**✅ Good**:
```
apps/web/src/stores/storeName.ts  // Correct: Store in stores/
```

### Violation 2: Service File in Wrong Location

**❌ Bad**:
```
apps/web/src/stores/serviceName.ts  // WRONG: Service in stores/
```

**✅ Good**:
```
apps/web/src/services/serviceName.ts  // Correct: Service in services/
```

### Violation 3: Component File in Wrong Location

**❌ Bad**:
```
apps/web/src/services/Component.vue  // WRONG: Component in services/
```

**✅ Good**:
```
apps/web/src/components/Component.vue  // Correct: Component in components/
```

## Naming Convention Violations

### Violation 1: Store Without "Store" Suffix

**❌ Bad**:
```
apps/web/src/stores/conversations.ts  // WRONG: Missing "Store" suffix
```

**✅ Good**:
```
apps/web/src/stores/conversationsStore.ts  // Correct: Has "Store" suffix
```

### Violation 2: Service Without "Service" Suffix

**❌ Bad**:
```
apps/web/src/services/api.ts  // WRONG: Missing "Service" suffix
```

**✅ Good**:
```
apps/web/src/services/apiService.ts  // Correct: Has "Service" suffix
```

### Violation 3: Component Not PascalCase

**❌ Bad**:
```
apps/web/src/components/landing-page.vue  // WRONG: Not PascalCase
```

**✅ Good**:
```
apps/web/src/components/LandingPage.vue  // Correct: PascalCase
```

## Related

- **`FILE_CLASSIFICATION.md`**: File classification rules
- **`ARCHITECTURE.md`**: Three-layer architecture
- **`PATTERNS.md`**: Web-specific patterns

