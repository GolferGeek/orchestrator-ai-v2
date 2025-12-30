# Web Application Context

You are being invoked from the **Orchestrator AI web application** (`apps/web`).

## Your Role

You are helping a developer work on the Vue.js web application. Assume all requests relate to the web app unless explicitly stated otherwise.

## Application Overview

- **Framework**: Vue 3 with Composition API (`<script setup>`)
- **State Management**: Pinia stores
- **Architecture**: Three-layer (Store → Service → Component)
- **Location**: `apps/web/src/`

## Progressive Skills

Load these skills **only when needed** for the specific task:

### When Working on Stores (`apps/web/src/stores/`)
Use `web-architecture-skill` - specifically the store patterns:
- State ONLY (no async, no API calls, no business logic)
- Synchronous mutations only
- Services call mutations after API success

### When Working on Services (`apps/web/src/services/`)
Use `web-architecture-skill` - specifically the service patterns:
- All async operations go here
- All API calls go here
- All business logic goes here
- Call store mutations after success

### When Working on Components (`apps/web/src/components/` or `apps/web/src/views/`)
Use `web-architecture-skill` - specifically the component patterns:
- UI presentation only
- Use stores for state (via `useXxxStore()`)
- Use services for operations
- Use composables for reusable logic

### When Working with ExecutionContext
Use `execution-context-skill`:
- ExecutionContext is a complete "capsule" containing: orgSlug, userId, conversationId, taskId, planId, deliverableId, agentSlug, agentType, provider, model
- NEVER cherry-pick fields from ExecutionContext
- ALWAYS pass it as a whole object
- ExecutionContext is created in `executionContextStore` when conversation is selected

### When Making A2A (Agent-to-Agent) Calls
Use `transport-types-skill`:
- All A2A calls use JSON-RPC 2.0 format
- Use `a2aOrchestrator.execute()` for A2A calls
- Transport types must match the interaction mode

### When Writing Tests
Use `web-testing-skill`:
- Vue 3 + Vitest for unit tests
- Cypress for E2E tests
- Test stores, services, composables, and components separately

## Key Files to Know

| Purpose | Location |
|---------|----------|
| API Service | `apps/web/src/services/apiService.ts` |
| Auth Store | `apps/web/src/stores/authStore.ts` |
| Conversations Store | `apps/web/src/stores/conversationsStore.ts` |
| ExecutionContext Store | `apps/web/src/stores/executionContextStore.ts` |
| Router | `apps/web/src/router/index.ts` |
| Main Entry | `apps/web/src/main.ts` |

## Three-Layer Architecture (Critical)

```
┌─────────────────────────────────────────────────────────┐
│                    COMPONENT LAYER                       │
│  (apps/web/src/components/ and apps/web/src/views/)     │
│  - UI presentation only                                  │
│  - Reads from stores                                     │
│  - Calls services for operations                         │
└─────────────────────┬───────────────────────────────────┘
                      │ uses
┌─────────────────────▼───────────────────────────────────┐
│                    SERVICE LAYER                         │
│  (apps/web/src/services/)                               │
│  - All async operations                                  │
│  - All API calls                                         │
│  - All business logic                                    │
│  - Calls store mutations after success                   │
└─────────────────────┬───────────────────────────────────┘
                      │ mutates
┌─────────────────────▼───────────────────────────────────┐
│                    STORE LAYER                           │
│  (apps/web/src/stores/)                                 │
│  - State ONLY                                            │
│  - Synchronous mutations only                            │
│  - NO async, NO API calls, NO business logic             │
└─────────────────────────────────────────────────────────┘
```

## Common Violations to Avoid

1. **API calls in stores** - Move to services
2. **Business logic in components** - Move to services
3. **State management in services** - Keep state in stores
4. **Cherry-picking ExecutionContext fields** - Pass whole object
5. **Direct API calls in components** - Use services

## Quick Reference Commands

```bash
# Run web app
npm run dev:web

# Build web app
npm run build:web

# Lint web app
npm run lint:web

# Test web app
npm run test:web
```

## When in Doubt

If you're unsure which pattern to follow:
1. Check existing similar files in the codebase
2. Load `web-architecture-skill` for detailed guidance
3. Ask the user for clarification
