# File Classification

How to classify web files by type and location.

## Classification Rules

### 1. Component Files

**Location**: `apps/web/src/components/` or `apps/web/src/views/`

**Pattern**: PascalCase with `.vue` extension
- Examples: `LandingPage.vue`, `ChatInput.vue`, `AgentListDisplay.vue`

**Structure**:
```vue
<template>
  <!-- UI markup -->
</template>

<script setup lang="ts">
// Component logic
</script>

<style scoped>
/* Component styles */
</style>
```

**Responsibilities**:
- UI presentation only
- Uses stores for state (via `useStore()`)
- Uses services for operations (via service functions)
- Uses composables for reusable logic
- Vue reactivity for UI updates

**Validation**:
- ✅ No API calls directly in component
- ✅ No business logic in component
- ✅ Uses stores for state
- ✅ Uses services for operations

### 2. Store Files

**Location**: `apps/web/src/stores/`

**Pattern**: camelCase with `Store` suffix, `.ts` extension
- Examples: `conversationsStore.ts`, `executionContextStore.ts`, `marketingSwarmStore.ts`

**Structure**:
```typescript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useStoreName = defineStore('storeName', () => {
  // State
  const items = ref<Item[]>([]);
  
  // Getters
  const itemCount = computed(() => items.value.length);
  
  // Mutations (synchronous only)
  function setItems(newItems: Item[]) {
    items.value = newItems;
  }
  
  return {
    items,
    itemCount,
    setItems,
  };
});
```

**Responsibilities**:
- State management ONLY
- Synchronous mutations only
- No async operations
- No API calls
- No business logic

**Validation**:
- ✅ No `async` functions
- ✅ No API calls (`fetch`, `apiService`, etc.)
- ✅ No business logic
- ✅ Only synchronous mutations
- ✅ Services call mutations after API success

### 3. Service Files

**Location**: `apps/web/src/services/`

**Pattern**: camelCase with `Service` suffix, `.ts` extension
- Examples: `apiService.ts`, `marketingSwarmService.ts`, `conversationsService.ts`

**Structure**:
```typescript
import { apiService } from './apiService';
import { useStoreName } from '@/stores/storeName';

class ServiceName {
  async fetchData(): Promise<Data[]> {
    const data = await apiService.get<Data[]>('/endpoint');
    const store = useStoreName();
    store.setItems(data); // Update store after success
    return data;
  }
}

export const serviceName = new ServiceName();
```

**Responsibilities**:
- All async operations
- All API calls
- All business logic
- Calls store mutations after success
- Handles errors and loading states

**Validation**:
- ✅ Contains async operations
- ✅ Makes API calls
- ✅ Contains business logic
- ✅ Updates stores after success
- ✅ No state management (uses stores)

### 4. Composable Files

**Location**: `apps/web/src/composables/`

**Pattern**: camelCase with `use` prefix, `.ts` extension
- Examples: `useValidation.ts`, `useDeliverables.ts`, `useLoading.ts`

**Structure**:
```typescript
import { ref, computed } from 'vue';
import { useStoreName } from '@/stores/storeName';

export function useFeature() {
  const store = useStoreName();
  
  // Local state
  const localState = ref(false);
  
  // Computed from store
  const storeValue = computed(() => store.value);
  
  // Functions
  function doSomething() {
    // Logic
  }
  
  return {
    localState,
    storeValue,
    doSomething,
  };
}
```

**Responsibilities**:
- Reusable logic extracted from components
- Combines stores, services, and local state
- Returns reactive state and functions
- Used by multiple components

**Validation**:
- ✅ Returns reactive state and functions
- ✅ Uses `storeToRefs()` when extracting from stores
- ✅ Reusable across components
- ✅ No direct API calls (uses services)

### 5. View Files

**Location**: `apps/web/src/views/`

**Pattern**: PascalCase with `.vue` extension
- Examples: `MarketingSwarmPage.vue`, `LandingPage.vue`

**Structure**:
- Same as component files
- Typically full-page components
- May use multiple child components

**Responsibilities**:
- Page-level UI
- May use multiple components
- May use multiple stores/services
- Route-level component

**Validation**:
- ✅ Same as component validation
- ✅ Page-level scope
- ✅ May compose multiple components

### 6. Type Files

**Location**: `apps/web/src/types/`

**Pattern**: camelCase with `.ts` extension
- Examples: `marketing-swarm.ts`, `conversation.ts`, `task.ts`

**Structure**:
```typescript
export interface TypeName {
  field: string;
  // ...
}

export type TypeAlias = 'value1' | 'value2';
```

**Responsibilities**:
- TypeScript type definitions
- Interfaces and types
- Shared type definitions

**Validation**:
- ✅ Type definitions only
- ✅ No runtime code
- ✅ Exported for use in other files

## Classification Process

### Step 1: Check Location

**If in `stores/`:**
- Must be a store file
- Must follow store patterns
- Must have `Store` suffix

**If in `services/`:**
- Must be a service file
- Must follow service patterns
- Must have `Service` suffix

**If in `components/` or `views/`:**
- Must be a component/view file
- Must follow component patterns
- Must be PascalCase

**If in `composables/`:**
- Must be a composable file
- Must follow composable patterns
- Must have `use` prefix

**If in `types/`:**
- Must be a type file
- Must contain type definitions only

### Step 2: Check Naming

**Store**: `[name]Store.ts` (camelCase)
**Service**: `[name]Service.ts` (camelCase)
**Component**: `[Name].vue` (PascalCase)
**Composable**: `use[Name].ts` (camelCase with `use` prefix)
**Type**: `[name].ts` (camelCase)

### Step 3: Check Structure

**Store**: `defineStore()` with Composition API
**Service**: Class or object with async methods
**Component**: `<template>`, `<script setup>`, `<style>`
**Composable**: Function returning reactive state and functions
**Type**: Type definitions only

### Step 4: Validate Responsibilities

**Store**: State only, no async, no API calls
**Service**: Async operations, API calls, business logic
**Component**: UI only, uses stores/services
**Composable**: Reusable logic, combines stores/services
**Type**: Type definitions only

## Examples

### Example 1: Component File

**File**: `apps/web/src/components/landing/LandingPage.vue`

**Classification**:
- ✅ Location: `components/` → Component
- ✅ Naming: PascalCase → Component
- ✅ Structure: `<template>`, `<script setup>`, `<style>` → Component
- ✅ Responsibilities: UI presentation, uses stores/services → Component

**Result**: Component file

### Example 2: Store File

**File**: `apps/web/src/stores/landingStore.ts`

**Classification**:
- ✅ Location: `stores/` → Store
- ✅ Naming: `Store` suffix → Store
- ✅ Structure: `defineStore()` → Store
- ✅ Responsibilities: State only → Store

**Result**: Store file

### Example 3: Service File

**File**: `apps/web/src/services/landingService.ts`

**Classification**:
- ✅ Location: `services/` → Service
- ✅ Naming: `Service` suffix → Service
- ✅ Structure: Class with async methods → Service
- ✅ Responsibilities: API calls, business logic → Service

**Result**: Service file

## Related

- **`PATTERNS.md`**: Web-specific patterns
- **`ARCHITECTURE.md`**: Three-layer architecture
- **`VIOLATIONS.md`**: Common violations

